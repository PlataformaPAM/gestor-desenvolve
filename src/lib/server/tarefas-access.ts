import type { SessionPayload } from "@/lib/auth";
import type { PermissionAction } from "@/lib/configuracoes/permission-catalog";
import type { Tarefa } from "@/lib/tarefas/types";
import { authorize } from "@/lib/server/authorize";
import { fail } from "@/lib/server/api-response";
import { prisma } from "@/lib/prisma";
import { resourceAccessGate, type ResourceAccessGate } from "@/lib/server/rbac-gate";

export const TAREFAS_INTERNAS_RESOURCE = "tarefas.internas";

export function isTarefaVisibleToUser(tarefa: Tarefa, userId: string | null | undefined): boolean {
  if (!userId) return false;
  if (tarefa.responsavel?.id === userId) return true;
  return tarefa.colaboradores?.some((c) => c.id === userId) ?? false;
}

export function filterTarefasForSession(
  tarefas: Tarefa[],
  session: SessionPayload,
  userId: string | null | undefined
): Tarefa[] {
  const view = authorize(session, TAREFAS_INTERNAS_RESOURCE, "ver");
  if (!view.allowed) return [];
  if (view.scope === "todos") return tarefas;
  return tarefas.filter((t) => isTarefaVisibleToUser(t, userId));
}

async function userCanAccessTarefaId(
  userId: string | null,
  tarefaId: string,
  scope: "todos" | "vinculados"
): Promise<boolean> {
  if (scope === "todos") return true;
  if (!userId) return false;
  const row = await prisma.tarefa.findUnique({
    where: { id: tarefaId },
    select: {
      responsavelId: true,
      colaboradores: { select: { usuarioId: true } },
    },
  });
  if (!row) return false;
  if (row.responsavelId === userId) return true;
  return row.colaboradores.some((c) => c.usuarioId === userId);
}

export async function tarefasAccessGate(
  req: Request,
  action: PermissionAction,
  tarefaId?: string
): Promise<ResourceAccessGate> {
  const gate = await resourceAccessGate(
    req,
    TAREFAS_INTERNAS_RESOURCE,
    action,
    "Sem permissão para esta ação em Tarefas."
  );
  if (!gate.ok) return gate;

  if (tarefaId && gate.scope === "vinculados") {
    const row = await prisma.tarefa.findUnique({
      where: { id: tarefaId },
      select: { id: true },
    });
    if (!row) {
      return { ok: false, response: fail("NOT_FOUND", "Tarefa não encontrada.", 404) };
    }
    const ok = await userCanAccessTarefaId(gate.userId, tarefaId, gate.scope);
    if (!ok) {
      return {
        ok: false,
        response: fail("FORBIDDEN", "Você não tem acesso a esta tarefa.", 403),
      };
    }
  }

  return gate;
}
