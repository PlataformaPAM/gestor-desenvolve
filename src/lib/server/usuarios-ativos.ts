import { prisma } from "@/lib/prisma";

export type UsuarioVinculoOption = {
  id: string;
  nome: string;
};

/** Usuários ativos do sistema (tabela Usuario) — para vínculos em tickets, tarefas, etc. */
export async function loadUsuariosAtivosParaVinculo(): Promise<UsuarioVinculoOption[]> {
  try {
    const ativos = await prisma.usuario.findMany({
      where: { ativo: true },
      orderBy: { nomeExibicao: "asc" },
      select: { id: true, nomeExibicao: true, email: true },
    });
    if (ativos.length > 0) {
      return ativos.map((u) => ({
        id: u.id,
        nome: u.nomeExibicao?.trim() || u.email,
      }));
    }
  } catch (e) {
    console.warn("[usuarios-ativos] consulta com ativo falhou; fallback geral.", e);
  }

  try {
    const rows = await prisma.usuario.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, nomeExibicao: true, email: true },
    });
    return rows.map((u) => ({
      id: u.id,
      nome: u.nomeExibicao?.trim() || u.email,
    }));
  } catch (e) {
    console.error("[usuarios-ativos] falha ao carregar usuários.", e);
    return [];
  }
}
