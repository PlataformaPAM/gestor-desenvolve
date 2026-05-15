import { prisma } from "@/lib/prisma";
import type { Lancamento } from "@/lib/financeiro/types";
import type { Prisma } from "@prisma/client";
import { mapLancamentoFromDb } from "../../_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { emitAlert } from "@/lib/server/alerts";
import { markAlertsReadForLancamentoPaid } from "@/lib/server/alerts-resolve";
import { syncComissoesFromLancamentoPagamento } from "@/lib/server/comissoes-service";

function toDate(v: string): Date {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

async function resolveLeadIdOrigem(
  tx: Prisma.TransactionClient,
  row: { leadIdOrigem: string | null; idPai: string | null }
): Promise<string | null> {
  if (row.leadIdOrigem) return row.leadIdOrigem;
  if (!row.idPai) return null;
  const parent = await tx.lancamento.findUnique({
    where: { id: row.idPai },
    select: { leadIdOrigem: true },
  });
  return parent?.leadIdOrigem ?? null;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await parseJsonSafe<{ lancamento?: Lancamento }>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const l = body.value.lancamento;
  if (!l || l.id !== id) return fail("BAD_REQUEST", "Payload inválido.", 400);

  const before = await prisma.lancamento.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      vencimento: true,
      descricao: true,
      valor: true,
      tipo: true,
      leadIdOrigem: true,
    },
  });
  const updated = await prisma.lancamento.update({
    where: { id },
    data: {
      tipo: l.tipo,
      descricao: l.descricao,
      clienteId: l.clienteId ?? null,
      fornecedor: l.fornecedor ?? null,
      vencimento: toDate(l.vencimento),
      valor: l.valor,
      status: l.status,
      dataPagamento: l.dataPagamento ? toDate(l.dataPagamento) : null,
      tipoRecorrencia: l.tipoRecorrencia ?? null,
      parcelas: l.parcelas ?? null,
      idPai: l.idPai ?? null,
      parcelaNumero: l.parcelaNumero ?? null,
      leadIdOrigem: l.leadIdOrigem ?? null,
      leadSolucaoId: l.leadSolucaoId ?? null,
      formaPagamento: l.formaPagamento ?? null,
      condicoesPagamento: l.condicoesPagamento ?? null,
      prazoDias: l.prazoDias ?? null,
      contaId: l.contaId ?? null,
      categoriaId: l.categoriaId ?? null,
      meioPagamentoId: l.meioPagamentoId ?? null,
    },
  });

  await writeAuditLog(prisma, {
    acao: "Lançamento financeiro atualizado",
    modulo: "financeiro",
    detalhes: `${updated.descricao}`,
  });

  const becamePending = before?.status === "pago" && updated.status !== "pago";
  if (updated.tipo === "entrada" || before?.tipo === "entrada") {
    await syncComissoesFromLancamentoPagamento(prisma, updated.id);
  }
  if (updated.status === "pago") {
    await markAlertsReadForLancamentoPaid(prisma, {
      id: updated.id,
      descricao: updated.descricao,
    });
  }

  if (becamePending) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(updated.vencimento);
    due.setHours(0, 0, 0, 0);
    const deltaDays = Math.round((due.getTime() - today.getTime()) / 86400000);
    if (deltaDays < 0 || deltaDays === 0 || deltaDays <= 7) {
      await emitAlert(prisma, {
        modulo: "financeiro",
        titulo: deltaDays < 0 ? "Lançamento em atraso" : "Lançamento próximo do vencimento",
        descricao:
          deltaDays < 0
            ? `${updated.descricao} voltou para pendente e está em atraso há ${Math.abs(deltaDays)} dia(s). Valor: R$ ${updated.valor.toFixed(2)}.`
            : `${updated.descricao} voltou para pendente e vence ${deltaDays === 0 ? "hoje" : `em ${deltaDays} dia(s)`}. Valor: R$ ${updated.valor.toFixed(2)}.`,
        dedupeKey: `reaberto-pendente-${updated.id}-${deltaDays}`,
      });
    }
  }

  return ok({ lancamento: mapLancamentoFromDb(updated) });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const existing = await prisma.lancamento.findUnique({ where: { id } });
  if (!existing) return fail("NOT_FOUND", "Lançamento não encontrado.", 404);

  try {
    await prisma.$transaction(async (tx) => {
      const leadId = await resolveLeadIdOrigem(tx, {
        leadIdOrigem: existing.leadIdOrigem,
        idPai: existing.idPai,
      });

      await tx.lancamento.delete({ where: { id } });

      if (!leadId) return;

      const remaining = await tx.lancamento.count({
        where: { leadIdOrigem: leadId },
      });
      if (remaining > 0) return;

      const fluxo = await tx.leadFinanceiroFluxo.findUnique({ where: { leadId } });
      if (!fluxo || fluxo.status !== "lancado") return;

      const now = new Date();
      await tx.leadFinanceiroFluxo.update({
        where: { leadId },
        data: {
          status: "pendente_aprovacao",
          bloqueadoEdicao: false,
          solicitadoEm: fluxo.solicitadoEm ?? now,
          aprovadoEm: null,
        },
      });

      await tx.contrato.updateMany({
        where: { leadId, status: "ativo" },
        data: { status: "pendente_financeiro" },
      });

      await tx.leadInteraction.create({
        data: {
          leadId,
          date: now,
          type: "sistema",
          action: "UPDATE",
          autorNome: "Financeiro",
          description:
            "Lançamento de recebimento vinculado ao fechamento foi excluído no Financeiro. O lead volta a aguardar aprovação/lançamento e o Comercial fica liberado para edição até novo bloqueio.",
        },
      });
    });
  } catch {
    return fail("NOT_FOUND", "Lançamento não encontrado.", 404);
  }

  await writeAuditLog(prisma, {
    acao: "Lançamento financeiro excluído",
    modulo: "financeiro",
    detalhes: id,
  });
  return ok({ id });
}
