import { prisma } from "@/lib/prisma";
import { mapTarefaFromDb } from "../_shared";
import { ok } from "@/lib/server/api-response";

export async function GET() {
  const [usuariosBase, colaboradoresRh, tarefas] = await Promise.all([
    prisma.usuario.findMany({
      where: { ativo: true },
      orderBy: { nomeExibicao: "asc" },
      select: { id: true, nomeExibicao: true, email: true, cpf: true },
    }),
    prisma.colaboradorRH.findMany({
      where: {
        status: "ativo",
        tipoPessoa: { in: ["equipe_interna", "vendedor_externo", "fornecedor_parceiro"] },
      },
      orderBy: { nome: "asc" },
      select: { nome: true, email: true, cpfCnpj: true },
    }),
    prisma.tarefa.findMany({
      include: {
        criadoPor: true,
        cliente: { select: { id: true, nome: true, empresa: true } },
        clientesVinculados: { include: { cliente: { select: { id: true, nome: true, empresa: true } } } },
        responsavel: true,
        colaboradores: { include: { usuario: true } },
        anexos: true,
        historico: { include: { autor: true, anexos: true }, orderBy: { data: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const usuariosById = new Map<string, { id: string; nome: string }>();
  usuariosBase.forEach((u) => {
    usuariosById.set(u.id, { id: u.id, nome: u.nomeExibicao?.trim() || u.email });
  });

  const usuariosByEmail = new Map<string, string>();
  const usuariosByCpf = new Map<string, string>();
  usuariosBase.forEach((u) => {
    const email = (u.email ?? "").trim().toLowerCase();
    const cpf = (u.cpf ?? "").replace(/\D/g, "");
    if (email) usuariosByEmail.set(email, u.id);
    if (cpf) usuariosByCpf.set(cpf, u.id);
  });

  colaboradoresRh.forEach((c) => {
    const email = (c.email ?? "").trim().toLowerCase();
    const cpfCnpj = (c.cpfCnpj ?? "").replace(/\D/g, "");
    const maybeUserId =
      (email ? usuariosByEmail.get(email) : undefined) ??
      (cpfCnpj ? usuariosByCpf.get(cpfCnpj) : undefined);
    if (!maybeUserId) return;
    if (usuariosById.has(maybeUserId)) {
      usuariosById.set(maybeUserId, { id: maybeUserId, nome: c.nome.trim() || usuariosById.get(maybeUserId)!.nome });
    }
  });

  const mappedUsuarios = [...usuariosById.values()].sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
  );
  const mappedTarefas = tarefas.map(mapTarefaFromDb);
  return ok({
    usuarios: mappedUsuarios,
    tarefas: mappedTarefas,
    data: { usuarios: mappedUsuarios, tarefas: mappedTarefas },
  });
}

