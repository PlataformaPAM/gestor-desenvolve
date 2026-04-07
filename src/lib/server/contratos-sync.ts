import type {
  ContratoStatus,
  FinanceiroFluxoStatus,
  PipelineStageId,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { emitAlert } from "@/lib/server/alerts";

export type SolucaoSnapshot = {
  id: string;
  solucaoCatalogoId?: string | null;
  nome: string;
  valor?: number | null;
  condicoesPagamento?: string | null;
};

function statusContratoFromFinanceiroFluxo(
  fluxo: FinanceiroFluxoStatus | null | undefined
): ContratoStatus {
  if (fluxo === "lancado") return "ativo";
  if (fluxo === "devolvido") return "nao_efetivado";
  return "pendente_financeiro";
}

async function buildItensCreate(
  tx: Prisma.TransactionClient,
  solucoes: SolucaoSnapshot[]
): Promise<
  Array<{
    solucaoCatalogoId: string | null;
    nome: string;
    valor: number | null;
    condicoesPagamento: string | null;
  }>
> {
  const catalogIds = [...new Set(solucoes.map((s) => s.id))];
  const existentes =
    catalogIds.length > 0
      ? await tx.solucaoCatalogo.findMany({
          where: { id: { in: catalogIds } },
          select: { id: true },
        })
      : [];
  const idsValidos = new Set(existentes.map((e) => e.id));

  return solucoes.map((s) => ({
    solucaoCatalogoId: idsValidos.has(s.id) ? s.id : null,
    nome: s.nome,
    valor: s.valor ?? null,
    condicoesPagamento: s.condicoesPagamento ?? null,
  }));
}

/**
 * Ao transicionar para Fechado: cria ou reabre contrato (idempotente por leadId).
 * — Novo: status pendente_financeiro + itens espelhando as soluções do lead.
 * — Já existente ativo/pendente: não altera (evita sobrescrever durante edições no Fechado).
 * — nao_efetivado/cancelado: volta para pendente_financeiro e atualiza snapshot.
 */
export async function syncContratoOnLeadFechado(
  tx: Prisma.TransactionClient,
  params: {
    leadId: string;
    clienteId: string | null;
    leadName: string;
    valorTotal: number;
    solucoes: SolucaoSnapshot[];
    previousStageId: PipelineStageId | null;
    newStageId: PipelineStageId;
    criadoPorId?: string | null;
  }
): Promise<void> {
  if (params.newStageId !== "fechado") return;
  if (params.previousStageId === "fechado") return;
  if (!params.clienteId?.trim()) return;

  const valor =
    params.valorTotal > 0
      ? params.valorTotal
      : params.solucoes.reduce((acc, s) => acc + (s.valor && s.valor > 0 ? s.valor : 0), 0);

  const itensCreate = await buildItensCreate(tx, params.solucoes);

  const existing = await tx.contrato.findUnique({ where: { leadId: params.leadId } });

  if (!existing) {
    await tx.contrato.create({
      data: {
        leadId: params.leadId,
        clienteId: params.clienteId,
        titulo: params.leadName,
        valorTotal: valor,
        status: "pendente_financeiro",
        origem: "via_lead",
        geraPosVenda: true,
        criadoPorId: params.criadoPorId ?? undefined,
        atualizadoPorId: params.criadoPorId ?? undefined,
        itens: itensCreate.length ? { create: itensCreate } : undefined,
      },
    });
    await emitAlert(tx, {
      modulo: "contratos",
      titulo: `Novo contrato gerado: ${params.leadName}`,
      descricao: `Contrato criado automaticamente para o cliente após mover o lead para Fechado.`,
      dedupeKey: `contrato-novo-${params.leadId}`,
    });
    return;
  }

  const reabrir: ContratoStatus[] = ["nao_efetivado", "cancelado"];
  if (reabrir.includes(existing.status)) {
    await tx.contratoItem.deleteMany({ where: { contratoId: existing.id } });
    await tx.contrato.update({
      where: { id: existing.id },
      data: {
        clienteId: params.clienteId,
        titulo: params.leadName,
        valorTotal: valor,
        status: "pendente_financeiro",
        atualizadoPorId: params.criadoPorId ?? undefined,
        itens: itensCreate.length ? { create: itensCreate } : undefined,
      },
    });
    await emitAlert(tx, {
      modulo: "contratos",
      titulo: `Contrato reaberto: ${params.leadName}`,
      descricao: `Contrato retornou para pendente financeiro após novo fechamento/composição comercial.`,
      dedupeKey: `contrato-reaberto-${params.leadId}-${Date.now()}`,
    });
  }
}

export type BackfillResult = { criados: number; leadIds: string[] };

/**
 * Cria contrato para leads já em Fechado que ainda não têm registro (ex.: antes do módulo existir).
 * Status inicial alinhado ao fluxo financeiro do lead (lancado → ativo; devolvido → nao_efetivado).
 */
export async function backfillContratosFaltantes(): Promise<BackfillResult> {
  const leads = await prisma.lead.findMany({
    where: {
      stageId: "fechado",
      clienteId: { not: null },
      contrato: { is: null },
    },
    include: {
      solucoes: true,
      financeiroFluxo: true,
    },
  });

  const leadIds: string[] = [];

  for (const lead of leads) {
    if (!lead.clienteId) continue;

    const solucoes: SolucaoSnapshot[] = lead.solucoes.map((s) => ({
      id: s.id,
      solucaoCatalogoId: s.solucaoCatalogoId,
      nome: s.nome,
      valor: s.valor,
      condicoesPagamento: s.condicoesPagamento,
    }));

    const valor =
      lead.valorTotal > 0
        ? lead.valorTotal
        : solucoes.reduce((acc, s) => acc + (s.valor && s.valor > 0 ? s.valor : 0), 0);

    const status = statusContratoFromFinanceiroFluxo(lead.financeiroFluxo?.status);

    let inseriu = false;
    await prisma.$transaction(async (tx) => {
      const dup = await tx.contrato.findUnique({ where: { leadId: lead.id } });
      if (dup) return;

      const itensCreate = await buildItensCreate(tx, solucoes);
      await tx.contrato.create({
        data: {
          leadId: lead.id,
          clienteId: lead.clienteId!,
          titulo: lead.name,
          valorTotal: valor,
          status,
          origem: "via_lead",
          geraPosVenda: true,
          itens: itensCreate.length ? { create: itensCreate } : undefined,
        },
      });
      inseriu = true;
    });

    if (inseriu) leadIds.push(lead.id);
  }

  return { criados: leadIds.length, leadIds };
}
