import { prisma } from "@/lib/prisma";
import { mapLog, mapPerfil, mapUsuario } from "../_shared";
import { fail, ok } from "@/lib/server/api-response";

export async function GET() {
  try {
    const [usuarios, perfis, logs] = await Promise.all([
      (async () => {
        try {
          return await prisma.usuario.findMany({ include: { vinculos: true }, orderBy: { createdAt: "desc" } });
        } catch {
          // Fallback para manter Configurações funcional enquanto ambiente local sincroniza cliente/schema.
          return prisma.usuario.findMany({ orderBy: { createdAt: "desc" } });
        }
      })(),
      prisma.perfilAcesso.findMany({ include: { permissoes: true }, orderBy: { nome: "asc" } }),
      prisma.logSistema.findMany({ include: { usuario: true }, orderBy: { data: "desc" }, take: 300 }),
    ]);
    const [colaboradores, clientes] = await Promise.all([
      prisma.colaboradorRH.findMany({
        select: { id: true, nome: true, cpfCnpj: true, cargoOuFuncao: true },
        orderBy: { nome: "asc" },
      }),
      prisma.cliente.findMany({
        select: { id: true, nome: true, cpfCnpj: true, empresa: true },
        orderBy: { nome: "asc" },
      }),
    ]);

    const pessoasVinculo = [
      ...colaboradores
        .filter((c) => Boolean(c.cpfCnpj))
        .map((c) => ({
          id: c.id,
          nome: c.nome,
          cpfCnpj: c.cpfCnpj as string,
          tipo: "rh" as const,
          subtitulo: c.cargoOuFuncao ?? undefined,
        })),
      ...clientes.map((c) => ({
        id: c.id,
        nome: c.nome,
        cpfCnpj: c.cpfCnpj,
        tipo: "cliente" as const,
        subtitulo: c.empresa,
      })),
    ];
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
    const mappedPerfis = perfis.map(mapPerfil);
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

