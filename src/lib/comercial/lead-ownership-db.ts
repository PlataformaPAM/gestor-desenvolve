import type { Prisma } from "@prisma/client";
import type { Lead, LeadOwnershipSnapshot } from "@/lib/comercial/types";
import { getLeadOwnership } from "@/lib/comercial/ownership";

export function parseLeadColaboradoresJson(
  value: unknown
): Array<{ id: string; nome: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id.trim() : "";
      const nome = typeof row.nome === "string" ? row.nome.trim() : "";
      if (!id || !nome) return null;
      return { id, nome };
    })
    .filter((x): x is { id: string; nome: string } => !!x);
}

/** Resolve ownership para gravar em colunas do Lead (prioriza colunas já no payload, senão interações). */
export function resolveLeadOwnershipForDb(lead: Lead): LeadOwnershipSnapshot {
  const fromColumns: LeadOwnershipSnapshot = {
    responsavelId: lead.responsavelPrincipalId?.trim() || undefined,
    responsavelNome: lead.responsavelPrincipalNome?.trim() || undefined,
    colaboradores: lead.colaboradores ?? [],
  };
  if (fromColumns.responsavelId || fromColumns.responsavelNome) {
    return {
      ...fromColumns,
      colaboradores: fromColumns.colaboradores ?? [],
    };
  }
  return getLeadOwnership(lead);
}

export function ownershipToLeadColumns(ownership: LeadOwnershipSnapshot): {
  responsavelPrincipalId: string | null;
  responsavelPrincipalNome: string | null;
  colaboradores: Prisma.InputJsonValue;
} {
  return {
    responsavelPrincipalId: ownership.responsavelId?.trim() || null,
    responsavelPrincipalNome: ownership.responsavelNome?.trim() || null,
    colaboradores: (ownership.colaboradores ?? []) as Prisma.InputJsonValue,
  };
}

export function ownershipColumnsFromLead(lead: Lead) {
  return ownershipToLeadColumns(resolveLeadOwnershipForDb(lead));
}
