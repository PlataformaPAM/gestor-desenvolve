import { prisma } from "@/lib/prisma";
import { mapTarefaFromDb } from "../_shared";
import { ok } from "@/lib/server/api-response";

export async function GET() {
  const [usuariosBase, colaboradoresRh, tarefas] = await Promise.all([
    loadUsuariosBase(),
    loadColaboradoresRhSafe(),
    loadTarefasSafe(),
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
  const mappedTarefas = tarefas
    .map((t) => {
      try {
        return mapTarefaFromDb(t);
      } catch (e) {
        console.warn("[tarefas/bootstrap] falha ao mapear tarefa; item ignorado.", e);
        return null;
      }
    })
    .filter((t): t is NonNullable<typeof t> => t != null);
  return ok({
    usuarios: mappedUsuarios,
    tarefas: mappedTarefas,
    data: { usuarios: mappedUsuarios, tarefas: mappedTarefas },
  });
}

type UsuarioBase = {
  id: string;
  nomeExibicao?: string | null;
  email: string;
  cpf?: string | null;
};

async function loadUsuariosBase(): Promise<UsuarioBase[]> {
  // Tentativa principal (schema completo).
  try {
    const ativos = await prisma.usuario.findMany({
      where: { ativo: true },
      orderBy: { nomeExibicao: "asc" },
      select: { id: true, nomeExibicao: true, email: true, cpf: true },
    });
    if (ativos.length > 0) return ativos;
  } catch (e) {
    console.warn("[tarefas/bootstrap] usuarios com cpf falhou; fallback sem cpf.", e);
  }

  // Fallback sem cpf (ambientes com cliente Prisma/schema divergente).
  try {
    const ativos = await prisma.usuario.findMany({
      where: { ativo: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, nomeExibicao: true, email: true },
    });
    if (ativos.length > 0) return ativos;
  } catch (e) {
    console.warn("[tarefas/bootstrap] usuarios ativos falhou; fallback geral.", e);
  }

  // Último fallback: não bloquear dropdowns se não houver flag de ativo consistente.
  try {
    return await prisma.usuario.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, nomeExibicao: true, email: true },
    });
  } catch (e) {
    console.error("[tarefas/bootstrap] usuarios fallback geral falhou.", e);
    return [];
  }
}

type ColaboradorRhLite = {
  nome: string;
  email: string | null;
  cpfCnpj: string | null;
};

async function loadColaboradoresRhSafe(): Promise<ColaboradorRhLite[]> {
  try {
    return await prisma.colaboradorRH.findMany({
      where: {
        status: "ativo",
        tipoPessoa: { in: ["equipe_interna", "vendedor_externo", "fornecedor_parceiro"] },
      },
      orderBy: { nome: "asc" },
      select: { nome: true, email: true, cpfCnpj: true },
    });
  } catch (e) {
    // RH não pode derrubar bootstrap de tarefas.
    console.warn("[tarefas/bootstrap] RH indisponível; seguindo apenas com usuarios.", e);
    return [];
  }
}

async function loadTarefasSafe() {
  try {
    return await prisma.tarefa.findMany({
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
    });
  } catch (e) {
    console.warn(
      "[tarefas/bootstrap] include clientesVinculados indisponível no banco; fallback para cliente único.",
      e
    );
  }

  try {
    return await prisma.tarefa.findMany({
      include: {
        criadoPor: true,
        cliente: { select: { id: true, nome: true, empresa: true } },
        responsavel: true,
        colaboradores: { include: { usuario: true } },
        anexos: true,
        historico: { include: { autor: true, anexos: true }, orderBy: { data: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (e) {
    console.error("[tarefas/bootstrap] falha ao carregar tarefas; retornando lista vazia.", e);
    return [];
  }
}

