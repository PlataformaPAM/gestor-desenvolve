import { prisma } from "@/lib/prisma";
import { mapLog, mapPerfil, mapUsuario } from "../_shared";
import { fail, ok } from "@/lib/server/api-response";
import { configuracoesBootstrapGate } from "@/lib/server/configuracoes-access";
import { loadPerfilPermissoesExtras } from "@/lib/server/perfil-permissoes-extras";

export async function GET(req: Request) {
  const gate = await configuracoesBootstrapGate(req);
  if (!gate.ok) return gate.response;

  try {
    const [usuarios, perfis, logs] = await Promise.all([
      gate.canUsuarios
        ? (async () => {
            try {
              return await prisma.usuario.findMany({
                include: { vinculos: true },
                orderBy: { createdAt: "desc" },
              });
            } catch {
              return prisma.usuario.findMany({ orderBy: { createdAt: "desc" } });
            }
          })()
        : Promise.resolve([]),
      gate.canPerfis
        ? prisma.perfilAcesso.findMany({ include: { permissoes: true }, orderBy: { nome: "asc" } })
        : Promise.resolve([]),
      gate.canLogs
        ? prisma.logSistema.findMany({ include: { usuario: true }, orderBy: { data: "desc" }, take: 300 })
        : Promise.resolve([]),
    ]);

    const loadPessoasVinculo = gate.canUsuarios;
    const [colaboradores, clientes] = loadPessoasVinculo
      ? await Promise.all([
          (async () => {
            try {
              return await prisma.colaboradorRH.findMany({
                select: {
                  id: true,
                  nome: true,
                  cpfCnpj: true,
                  cargoOuFuncao: true,
                  tipoPessoa: true,
                  cadastroEfetivado: true,
                },
                orderBy: { nome: "asc" },
              });
            } catch {
              return prisma.colaboradorRH.findMany({
                select: { id: true, nome: true, cpfCnpj: true, cargoOuFuncao: true, tipoPessoa: true },
                orderBy: { nome: "asc" },
              });
            }
          })(),
          prisma.cliente.findMany({
            select: { id: true, nome: true, cpfCnpj: true, empresa: true },
            orderBy: { nome: "asc" },
          }),
        ])
      : [[], []];

    const pessoasVinculo = loadPessoasVinculo
      ? [
          ...colaboradores
            .filter(
              (c) => (c as { cadastroEfetivado?: boolean }).cadastroEfetivado !== false && Boolean(c.cpfCnpj)
            )
            .map((c) => ({
              id: c.id,
              nome: c.nome,
              cpfCnpj: c.cpfCnpj as string,
              tipo: "rh" as const,
              subtitulo: c.cargoOuFuncao ?? undefined,
              rhTipo: c.tipoPessoa,
            })),
          ...clientes.map((c) => ({
            id: c.id,
            nome: c.nome,
            cpfCnpj: c.cpfCnpj,
            tipo: "cliente" as const,
            subtitulo: c.empresa,
          })),
        ]
      : [];
    const nomeByTipoId = new Map(
      pessoasVinculo.map((p) => [`${p.tipo}:${p.id}`, p.nome] as const)
    );
    const mappedUsuarios = usuarios.map((u) => {
      const mapped = mapUsuario(u);
      const listaVinculos =
        mapped.vinculos?.length ? mapped.vinculos : mapped.vinculacao ? [mapped.vinculacao] : [];
      const vinculos = listaVinculos.map((v) => ({
        ...v,
        nome: nomeByTipoId.get(`${v.tipo}:${v.id}`),
      }));
      return {
        ...mapped,
        vinculos: vinculos.length ? vinculos : undefined,
        vinculacao: vinculos[0] ?? mapped.vinculacao,
      };
    });
    const extrasByPerfil = await loadPerfilPermissoesExtras(
      prisma,
      perfis.map((p) => p.id)
    );
    const mappedPerfis = perfis.map((p) => mapPerfil(p, extrasByPerfil[p.id]));
    const mappedLogs = logs.map(mapLog);
    return ok({
      usuarios: mappedUsuarios,
      perfis: mappedPerfis,
      logs: mappedLogs,
      pessoasVinculo,
      data: { usuarios: mappedUsuarios, perfis: mappedPerfis, logs: mappedLogs, pessoasVinculo },
    });
  } catch {
    return fail("INTERNAL_ERROR", "Falha ao carregar configurações.", 500);
  }
}

