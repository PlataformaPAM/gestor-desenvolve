import type { Lead, LeadInteraction, LeadOwnershipSnapshot } from "./types";

const OWNERSHIP_FIELD = "ownership";

export function getLeadOwnership(lead: Lead): LeadOwnershipSnapshot {
  const colaboradoresColuna = lead.colaboradores ?? [];
  if (lead.responsavelPrincipalId?.trim() || lead.responsavelPrincipalNome?.trim()) {
    return {
      responsavelId: lead.responsavelPrincipalId?.trim() || undefined,
      responsavelNome: lead.responsavelPrincipalNome?.trim() || undefined,
      colaboradores: colaboradoresColuna,
    };
  }

  const interactions = lead.interactions ?? [];
  for (let i = interactions.length - 1; i >= 0; i -= 1) {
    const item = interactions[i];
    const key = (item.fieldKey ?? item.field ?? "").toLowerCase();
    if (item.type !== "sistema" || key !== OWNERSHIP_FIELD) continue;
    const raw = item.newValue;
    if (!raw || typeof raw !== "object") continue;
    const data = raw as Record<string, unknown>;
    const responsavelId = typeof data.responsavelId === "string" ? data.responsavelId : undefined;
    const responsavelNome = typeof data.responsavelNome === "string" ? data.responsavelNome : undefined;
    const colaboradores = Array.isArray(data.colaboradores)
      ? data.colaboradores
          .map((c) => {
            if (!c || typeof c !== "object") return null;
            const itemObj = c as Record<string, unknown>;
            const id = typeof itemObj.id === "string" ? itemObj.id : "";
            const nome = typeof itemObj.nome === "string" ? itemObj.nome : "";
            if (!id || !nome) return null;
            return { id, nome };
          })
          .filter((x): x is { id: string; nome: string } => !!x)
      : [];
    return { responsavelId, responsavelNome, colaboradores };
  }

  return {
    responsavelId: lead.criadoPorId ?? undefined,
    responsavelNome: lead.registroCriadoPorNome ?? undefined,
    colaboradores: [],
  };
}

/** Primeira interação de ownership ao criar lead (criador = responsável). */
export function createInitialOwnershipInteraction(
  userId: string | null | undefined,
  userName: string
): LeadInteraction {
  return {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `own-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    date: new Date().toISOString(),
    type: "sistema",
    user: userName,
    userId: userId ?? null,
    action: "CREATE",
    field: "ownership",
    fieldKey: "ownership",
    description: `Responsável inicial: ${userName}`,
    newValue: {
      responsavelId: userId || undefined,
      responsavelNome: userName,
      colaboradores: [],
    },
  };
}

export function buildOwnershipInteraction(params: {
  base: LeadInteraction[];
  previous: LeadOwnershipSnapshot;
  next: LeadOwnershipSnapshot;
  userName: string;
  userId?: string | null;
}): LeadInteraction[] {
  const same =
    (params.previous.responsavelId ?? "") === (params.next.responsavelId ?? "") &&
    JSON.stringify(params.previous.colaboradores ?? []) === JSON.stringify(params.next.colaboradores ?? []);
  if (same) return params.base;
  const description = [
    `Responsável: ${params.previous.responsavelNome ?? "—"} -> ${params.next.responsavelNome ?? "—"}`,
    `Colaboradores: ${
      (params.previous.colaboradores ?? []).map((c) => c.nome).join(", ") || "—"
    } -> ${(params.next.colaboradores ?? []).map((c) => c.nome).join(", ") || "—"}`,
  ].join(" | ");
  return [
    ...params.base,
    {
      id:
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      date: new Date().toISOString(),
      type: "sistema",
      user: params.userName,
      userId: params.userId ?? null,
      action: "UPDATE",
      field: "ownership",
      fieldKey: "ownership",
      oldValue: params.previous,
      newValue: params.next,
      description,
    },
  ];
}
