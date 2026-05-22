import type { SessionPayload } from "@/lib/auth";
import type { PermissionAction } from "@/lib/configuracoes/permission-catalog";
import { authorize, isSessionAdmin } from "@/lib/server/authorize";
import { fail } from "@/lib/server/api-response";
import { prisma } from "@/lib/prisma";
import { resourceAccessGate, type ResourceAccessGate } from "@/lib/server/rbac-gate";

export const POSVENDA_TAREFAS_RESOURCE = "posvenda.tarefas";

export async function posvendaAccessGate(
  req: Request,
  action: PermissionAction,
  tarefaId?: string
): Promise<ResourceAccessGate> {
  const gate = await resourceAccessGate(
    req,
    POSVENDA_TAREFAS_RESOURCE,
    action,
    "Sem permissão para esta ação em Pós-venda."
  );
  if (!gate.ok) return gate;

  if (tarefaId && gate.scope === "vinculados" && !isSessionAdmin(gate.session)) {
    const row = await prisma.tarefa.findUnique({
      where: { id: tarefaId },
      select: {
        responsavelId: true,
        colaboradores: { select: { usuarioId: true } },
      },
    });
    if (!row) {
      return { ok: false, response: fail("NOT_FOUND", "Tarefa não encontrada.", 404) };
    }
    const uid = gate.userId;
    if (!uid) {
      return { ok: false, response: fail("FORBIDDEN", "Você não tem acesso a esta tarefa.", 403) };
    }
    const okAccess =
      row.responsavelId === uid || row.colaboradores.some((c) => c.usuarioId === uid);
    if (!okAccess) {
      return {
        ok: false,
        response: fail("FORBIDDEN", "Você não tem acesso a esta tarefa.", 403),
      };
    }
  }

  return gate;
}

export function filterPosVendaTarefasRaw<
  T extends { responsavelId: string; colaboradores: Array<{ usuarioId: string }> },
>(rows: T[], session: SessionPayload, userId: string | null): T[] {
  const view = authorize(session, POSVENDA_TAREFAS_RESOURCE, "ver");
  if (!view.allowed) return [];
  if (view.scope === "todos" || isSessionAdmin(session)) return rows;
  if (!userId) return [];
  return rows.filter(
    (r) =>
      r.responsavelId === userId || r.colaboradores.some((c) => c.usuarioId === userId)
  );
}
