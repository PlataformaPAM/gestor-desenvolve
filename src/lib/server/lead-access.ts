import type { SessionPayload } from "@/lib/auth";
import type { Lead } from "@/lib/comercial/types";
import { getLeadOwnership } from "@/lib/comercial/ownership";
import { mapLeadFromDb } from "@/app/api/comercial/_shared";
import { prisma } from "@/lib/prisma";
import { authorize, type DataScope } from "@/lib/server/authorize";

export const LEAD_INCLUDE_FOR_ACCESS = {
  criadoPor: { select: { nomeExibicao: true } },
  interactions: {
    where: { type: "sistema", fieldKey: "ownership" },
    orderBy: { date: "desc" as const },
    take: 1,
    select: { newValue: true },
  },
} as const;

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("pt-BR");
}

export function isLeadVisibleToUser(
  lead: Lead,
  userId: string | null | undefined,
  userName?: string | null
): boolean {
  const normalizedUserName = normalizeName(userName);
  const ownership = getLeadOwnership(lead);
  if (userId) {
    if (ownership.responsavelId === userId) return true;
    if ((ownership.colaboradores ?? []).some((c) => c.id === userId)) return true;
  }
  if (!normalizedUserName) return false;
  if (normalizeName(ownership.responsavelNome) === normalizedUserName) return true;
  if (normalizeName(lead.registroCriadoPorNome) === normalizedUserName) return true;
  return false;
}

export async function userCanAccessLeadId(
  userId: string | null | undefined,
  leadId: string,
  scope: DataScope
): Promise<boolean> {
  if (scope === "todos") return true;
  if (!userId) return false;
  const row = await prisma.lead.findUnique({
    where: { id: leadId },
    include: LEAD_INCLUDE_FOR_ACCESS,
  });
  if (!row) return false;
  return isLeadVisibleToUser(mapLeadFromDb(row as never), userId);
}

/** Conjunto de leadIds visíveis entre os informados (escopo vinculados). */
export async function accessibleLeadIdsAmong(
  userId: string | null | undefined,
  leadIds: string[],
  scope: DataScope
): Promise<Set<string>> {
  if (scope === "todos") return new Set(leadIds);
  if (!userId || leadIds.length === 0) return new Set();
  const unique = [...new Set(leadIds.filter(Boolean))];
  const rows = await prisma.lead.findMany({
    where: { id: { in: unique } },
    include: LEAD_INCLUDE_FOR_ACCESS,
  });
  const allowed = new Set<string>();
  for (const row of rows) {
    if (isLeadVisibleToUser(mapLeadFromDb(row as never), userId)) {
      allowed.add(row.id);
    }
  }
  return allowed;
}

export function canAccessLeadIdFromSet(
  leadId: string | null | undefined,
  allowedLeadIds: Set<string>,
  scope: DataScope
): boolean {
  if (!leadId) return false;
  if (scope === "todos") return true;
  return allowedLeadIds.has(leadId);
}

export function filterLeadsForResourceScope(
  leads: Lead[],
  session: SessionPayload,
  userId: string | null | undefined,
  resourceId: string
): Lead[] {
  const view = authorize(session, resourceId, "ver");
  if (!view.allowed) return [];
  if (view.scope === "todos") return leads;
  return leads.filter((lead) => isLeadVisibleToUser(lead, userId, session.userName));
}

/** Filtra linhas `{ id }` pelo escopo Ver de um recurso (ex.: relatórios). */
export async function filterLeadIdsForResourceScope(
  rows: Array<{ id: string }>,
  session: SessionPayload,
  userId: string | null | undefined,
  resourceId: string
): Promise<Array<{ id: string }>> {
  const view = authorize(session, resourceId, "ver");
  if (!view.allowed) return [];
  if (view.scope === "todos") return rows;
  const ids = rows.map((r) => r.id);
  const allowed = await accessibleLeadIdsAmong(userId, ids, view.scope);
  return rows.filter((r) => allowed.has(r.id));
}
