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

/** Include mínimo para banco de produção atrasado (sem colunas de audit/vínculo). */
const COMERCIAL_BOOTSTRAP_LEAD_INCLUDE_LEGACY = {
  solucoes: { include: { solucaoCatalogo: true } },
  contatos: { include: { papeis: true } },
  checklistItems: true,
  contratoChecklist: true,
  contratoArquivos: true,
  financeiroFluxo: true,
  interactions: { include: { anexos: true }, orderBy: { date: "asc" as const } },
} as const;

type LegacyLeadRow = {
  id: string;
  name: string;
  value: number;
  valorTotal: number;
  stageId: Lead["stageId"];
  priority: Lead["priority"];
  enteredStageAt: Date | string;
  origem: Lead["origem"];
  clienteId: string | null;
  propostaGeradaEm: Date | string | null;
  previsaoFechamento: Date | string | null;
  cpf: string | null;
  company: string | null;
  contact: string | null;
  email: string | null;
  phone: string | null;
  municipioUf: string | null;
  entidade: string | null;
  cargo: string | null;
  notes: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function toIso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function mapLegacyLeadRow(row: LegacyLeadRow): Lead {
  return {
    id: row.id,
    name: row.name,
    value: Number(row.value ?? 0),
    valorTotal: Number(row.valorTotal ?? row.value ?? 0),
    stageId: row.stageId,
    priority: row.priority,
    enteredStageAt: toIso(row.enteredStageAt) ?? new Date().toISOString(),
    origem: row.origem,
    registroLead: "oportunidade",
    clienteId: row.clienteId,
    solucoes: [],
    contatosOportunidade: [],
    checklistProgress: {},
    contratoArquivos: { minuta: [], assinatura: [] },
    contratoAnexosCliente: [],
    propostaGeradaEm: toIso(row.propostaGeradaEm),
    previsaoFechamento: toIso(row.previsaoFechamento)?.slice(0, 10),
    cpf: row.cpf ?? undefined,
    company: row.company ?? undefined,
    contact: row.contact ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    municipioUf: row.municipioUf ?? undefined,
    entidade: row.entidade ?? undefined,
    cargo: row.cargo ?? undefined,
    notes: row.notes ?? undefined,
    interactions: [],
    criadoPorId: null,
    registroCriadoPorNome: null,
    registroAtualizadoPorNome: null,
    registroCriadoEm: toIso(row.createdAt),
    registroAtualizadoEm: toIso(row.updatedAt),
  };
}

async function loadComercialBootstrapLeadsLegacySql(): Promise<Lead[]> {
  const rows = await prisma.$queryRaw<LegacyLeadRow[]>`
    SELECT
      "id",
      "name",
      "value",
      "valorTotal",
      "stageId",
      "priority",
      "enteredStageAt",
      "origem",
      "clienteId",
      "propostaGeradaEm",
      "previsaoFechamento",
      "cpf",
      "company",
      "contact",
      "email",
      "phone",
      "municipioUf",
      "entidade",
      "cargo",
      "notes",
      "createdAt",
      "updatedAt"
    FROM "Lead"
    ORDER BY "createdAt" DESC
  `;
  return rows.map(mapLegacyLeadRow);
}

/** Mesmo critério que funcionava antes: somente oportunidades do funil Comercial. */
export async function loadComercialBootstrapLeadsRaw() {
  try {
    return await prisma.lead.findMany({
      where: { registroLead: "oportunidade" },
      include: COMERCIAL_BOOTSTRAP_LEAD_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    if (!isPrismaSchemaDriftError(error)) throw error;
    console.warn("[comercial-bootstrap] schema drift — tentando include legado.", error);
    try {
      return await prisma.lead.findMany({
        include: COMERCIAL_BOOTSTRAP_LEAD_INCLUDE_LEGACY,
        orderBy: { createdAt: "desc" },
      });
    } catch (legacyError) {
      if (!isPrismaSchemaDriftError(legacyError)) throw legacyError;
      console.warn("[comercial-bootstrap] include legado falhou — usando SQL legado.", legacyError);
      return loadComercialBootstrapLeadsLegacySql();
    }
  }
}

export function mapComercialBootstrapLeads(
  rows: Awaited<ReturnType<typeof loadComercialBootstrapLeadsRaw>>
): Lead[] {
  if (!rows.length) return [];
  // Fallback SQL já retorna no formato final de Lead.
  if ("checklistProgress" in (rows[0] as object)) {
    return rows as Lead[];
  }

  const mapped: Lead[] = [];
  for (const row of rows) {
    try {
      const normalized = {
        ...row,
        registroLead: (row as { registroLead?: Lead["registroLead"] }).registroLead ?? "oportunidade",
        solucoes: (row as { solucoes?: unknown[] }).solucoes ?? [],
        contatos: (row as { contatos?: unknown[] }).contatos ?? [],
        checklistItems: (row as { checklistItems?: unknown[] }).checklistItems ?? [],
        contratoArquivos: (row as { contratoArquivos?: unknown[] }).contratoArquivos ?? [],
        interactions: (row as { interactions?: unknown[] }).interactions ?? [],
      };
      const lead = mapLeadFromDb(normalized as never);
      if (lead.registroLead && lead.registroLead !== "oportunidade") continue;
      mapped.push(lead);
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
    try {
      const byCreator = await prisma.lead.findMany({
        where: { criadoPorId: uid },
        select: { id: true },
      });
      for (const row of byCreator) ids.add(row.id);
    } catch (err) {
      console.error("[comercial-bootstrap] leadIds by criadoPorId failed", err);
    }

    try {
      const byInteractionUser = await prisma.leadInteraction.findMany({
        where: { userId: uid },
        select: { leadId: true },
        distinct: ["leadId"],
      });
      for (const row of byInteractionUser) ids.add(row.leadId);
    } catch (err) {
      console.error("[comercial-bootstrap] leadIds by userId failed", err);
    }
  }

  if (name) {
    try {
      const byAutor = await prisma.leadInteraction.findMany({
        where: { autorNome: { equals: name, mode: "insensitive" } },
        select: { leadId: true },
        distinct: ["leadId"],
      });
      for (const row of byAutor) ids.add(row.leadId);
    } catch (err) {
      console.error("[comercial-bootstrap] leadIds by autorNome failed", err);
    }
  }

  return ids;
}
