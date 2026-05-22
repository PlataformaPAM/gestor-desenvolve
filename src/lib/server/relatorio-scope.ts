import type { SessionPayload } from "@/lib/auth";
import { authorize } from "@/lib/server/authorize";
import { filterClientesForSession, userCanAccessClienteId } from "@/lib/server/cliente-access";
import { filterLancamentosForSession } from "@/lib/server/financeiro-access";
import { filterLeadIdsForResourceScope } from "@/lib/server/lead-access";
import { filterHelpdeskTicketsForScope } from "@/lib/server/helpdesk-access";
import { filterPosVendaTarefasRaw } from "@/lib/server/posvenda-access";
import type { DataScope } from "@/lib/server/authorize";

export type RelatorioAccessContext = {
  session: SessionPayload;
  userId: string | null;
  scope: DataScope;
  resourceId: string;
};

export class RelatorioForbiddenError extends Error {
  constructor(message = "Sem acesso a este cliente.") {
    super(message);
    this.name = "RelatorioForbiddenError";
  }
}

export async function assertRelatorioClienteId(
  ctx: RelatorioAccessContext,
  clienteId?: string
): Promise<void> {
  if (!clienteId || ctx.scope === "todos") return;
  const ok = await userCanAccessClienteId(ctx.userId, clienteId, ctx.scope);
  if (!ok) throw new RelatorioForbiddenError();
}

export function getRelatorioViewScope(session: SessionPayload, resourceId: string) {
  return authorize(session, resourceId, "ver");
}

export async function filterRelatorioLeads<T extends { id: string }>(
  rows: T[],
  session: SessionPayload,
  userId: string | null,
  resourceId: string
): Promise<T[]> {
  const filtered = await filterLeadIdsForResourceScope(rows, session, userId, resourceId);
  const allowed = new Set(filtered.map((r) => r.id));
  return rows.filter((r) => allowed.has(r.id));
}

export async function filterRelatorioLancamentos<T extends { leadIdOrigem?: string | null }>(
  rows: T[],
  session: SessionPayload,
  userId: string | null,
  resourceId: string
): Promise<T[]> {
  const view = authorize(session, resourceId, "ver");
  if (!view.allowed) return [];
  return filterLancamentosForSession(rows, userId, view.scope);
}

export async function filterRelatorioClientes<T extends { id: string; criadoPorId?: string | null }>(
  rows: T[],
  session: SessionPayload,
  userId: string | null,
  resourceId: string
): Promise<T[]> {
  const view = authorize(session, resourceId, "ver");
  if (!view.allowed) return [];
  return filterClientesForSession(rows, userId, view.scope);
}

export function filterRelatorioTarefasRaw<
  T extends { responsavelId: string; colaboradores: Array<{ usuarioId: string }> },
>(rows: T[], userId: string | null, scope: DataScope): T[] {
  if (scope === "todos") return rows;
  if (!userId) return [];
  return rows.filter(
    (t) =>
      t.responsavelId === userId || t.colaboradores.some((c) => c.usuarioId === userId)
  );
}

export function filterRelatorioTicketsRaw<
  T extends { responsaveis: Array<{ usuarioId: string }> },
>(rows: T[], userId: string | null, scope: DataScope): T[] {
  return filterHelpdeskTicketsForScope(rows, userId, scope);
}

export { filterPosVendaTarefasRaw as filterRelatorioPosVendaTarefas };
