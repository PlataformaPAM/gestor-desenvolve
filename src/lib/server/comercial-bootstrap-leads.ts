import { prisma } from "@/lib/prisma";
import { mapLeadFromDb } from "@/app/api/comercial/_shared";
import { isPrismaSchemaDriftError } from "@/lib/server/prisma-schema";
import type { Lead } from "@/lib/comercial/types";

export const COMERCIAL_BOOTSTRAP_LEAD_INCLUDE = {
  criadoPor: { select: { nomeExibicao: true } },
  atualizadoPor: { select: { nomeExibicao: true } },
  solucoes: { include: { solucaoCatalogo: true } },
  contatos: { include: { papeis: true } },
  checklistItems: true,
  contratoChecklist: true,
  contratoArquivos: true,
  financeiroFluxo: true,
  interactions: { include: { user: true, anexos: true }, orderBy: { date: "asc" as const } },
} as const;

/** Funil Comercial: tudo exceto venda direta do Financeiro (inclui legado sem registroLead). */
export async function loadComercialBootstrapLeadsRaw() {
  try {
    return await prisma.lead.findMany({
      where: { NOT: { registroLead: "venda_direta_financeiro" } },
      include: COMERCIAL_BOOTSTRAP_LEAD_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    if (!isPrismaSchemaDriftError(error, "registroLead")) throw error;
    return prisma.lead.findMany({
      include: COMERCIAL_BOOTSTRAP_LEAD_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }
}

export function mapComercialBootstrapLeads(
  rows: Awaited<ReturnType<typeof loadComercialBootstrapLeadsRaw>>
): Lead[] {
  const mapped: Lead[] = [];
  for (const row of rows) {
    try {
      mapped.push(mapLeadFromDb(row as never));
    } catch (err) {
      console.error("[comercial-bootstrap] mapLeadFromDb failed", row.id, err);
    }
  }
  return mapped;
}

/** IDs de leads com vínculo explícito ao usuário (interações / criador). */
export async function leadIdsExplicitlyLinkedToUser(
  userId: string | null | undefined,
  userName: string | null | undefined
): Promise<Set<string>> {
  const ids = new Set<string>();
  const uid = userId?.trim();
  const name = userName?.trim();

  if (uid) {
    const byCreator = await prisma.lead.findMany({
      where: { criadoPorId: uid, NOT: { registroLead: "venda_direta_financeiro" } },
      select: { id: true },
    });
    for (const row of byCreator) ids.add(row.id);

    const byInteractionUser = await prisma.leadInteraction.findMany({
      where: { userId: uid },
      select: { leadId: true },
      distinct: ["leadId"],
    });
    for (const row of byInteractionUser) ids.add(row.leadId);
  }

  if (name) {
    const byAutor = await prisma.leadInteraction.findMany({
      where: { autorNome: { equals: name, mode: "insensitive" } },
      select: { leadId: true },
      distinct: ["leadId"],
    });
    for (const row of byAutor) ids.add(row.leadId);
  }

  return ids;
}
