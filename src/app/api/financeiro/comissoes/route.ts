import { prisma } from "@/lib/prisma";
import { mapEvento } from "@/app/api/comissoes/_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { syncComissoesFromLancamentoPagamento } from "@/lib/server/comissoes-service";
import type { ComissaoStatus } from "@/lib/comissoes/types";
import { writeAuditLog } from "@/lib/server/audit-log";
import {
  backfillComissaoPagasSemLancamentoSaida,
  ensureComissaoEventoLancamentoSaidaSchema,
} from "@/lib/server/ensure-comissao-evento-pg-schema";
import {
  assertComissaoIdsAllowed,
  assertLancamentoLeadAccess,
  filterComissoesConsultorId,
  financeiroAccessGate,
  FINANCEIRO_COMISSOES_RESOURCE,
  FINANCEIRO_LANCAMENTOS_RESOURCE,
  resolveConsultorRhForUsuario,
} from "@/lib/server/financeiro-access";

function toInt(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(req: Request) {
  const gate = await financeiroAccessGate(req, FINANCEIRO_COMISSOES_RESOURCE, "ver");
  if (!gate.ok) return gate.response;

  await ensureComissaoEventoLancamentoSaidaSchema(prisma).catch((err) => {
    console.error("[api/financeiro/comissoes GET] ensure schema:", err);
  });
  await backfillComissaoPagasSemLancamentoSaida(prisma).catch((err) => {
    console.error("[api/financeiro/comissoes GET] backfill saídas:", err);
  });

  try {
    const { searchParams } = new URL(req.url);
    const competenciaAno = toInt(searchParams.get("ano"));
    const competenciaMes = toInt(searchParams.get("mes"));
    const consultorIdParam = searchParams.get("consultorId") ?? undefined;
    const status = (searchParams.get("status") as ComissaoStatus | null) ?? undefined;

    const ownConsultor = await resolveConsultorRhForUsuario(gate.userId);
    const consultorId = filterComissoesConsultorId(consultorIdParam, ownConsultor?.id ?? null);
    if (consultorId === "__none__") {
      return ok({
        eventos: [],
        consultores: ownConsultor ? [{ id: ownConsultor.id, nome: ownConsultor.nome }] : [],
        resumo: { previsto: 0, elegivel: 0, aprovado: 0, pago: 0 },
      });
    }

    const eventos = await prisma.comissaoEvento.findMany({
      where: {
        ...(competenciaAno ? { competenciaAno } : {}),
        ...(competenciaMes ? { competenciaMes } : {}),
        ...(consultorId ? { consultorId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        consultor: { select: { nome: true } },
        lead: { select: { name: true } },
        leadSolucao: { select: { nome: true } },
      },
      orderBy: [{ competenciaAno: "desc" }, { competenciaMes: "desc" }, { createdAt: "desc" }],
    });
    let consultores = await prisma.colaboradorRH.findMany({
      where: { tipoPessoa: { in: ["vendedor_externo", "equipe_interna"] }, status: "ativo" },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    });
    if (gate.scope === "vinculados" && ownConsultor) {
      consultores = consultores.filter((c) => c.id === ownConsultor.id);
    }
    const resumo = eventos.reduce(
      (acc, e) => {
        const v = Number(e.valorComissao.toString());
        if (e.status === "prevista") acc.previsto += v;
        if (e.status === "elegivel") acc.elegivel += v;
        if (e.status === "aprovada") acc.aprovado += v;
        if (e.status === "paga") acc.pago += v;
        return acc;
      },
      { previsto: 0, elegivel: 0, aprovado: 0, pago: 0 }
    );
    return ok({
      eventos: eventos.map(mapEvento),
      consultores,
      resumo,
    });
  } catch {
    return fail(
      "INTERNAL_ERROR",
      "Não foi possível carregar comissões. Confirme se as migrações do banco foram aplicadas (npx prisma migrate deploy).",
      500
    );
  }
}

type AcaoPayload = {
  acao?: "aprovar_lote" | "marcar_pago" | "recalcular_lancamento";
  ids?: string[];
  observacao?: string;
  referenciaExterna?: string;
  pagoEm?: string;
  lancamentoId?: string;
};

export async function PATCH(req: Request) {
  const body = await parseJsonSafe<AcaoPayload>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const payload = body.value;

  if (payload.acao === "recalcular_lancamento") {
    const gateLanc = await financeiroAccessGate(req, FINANCEIRO_LANCAMENTOS_RESOURCE, "editar");
    if (!gateLanc.ok) return gateLanc.response;
    if (!payload.lancamentoId) return fail("BAD_REQUEST", "Informe o lançamento.", 400);
    const lancRow = await prisma.lancamento.findUnique({
      where: { id: payload.lancamentoId },
      select: { leadIdOrigem: true },
    });
    if (!lancRow) return fail("NOT_FOUND", "Lançamento não encontrado.", 404);
    const okLead = await assertLancamentoLeadAccess(
      gateLanc.userId,
      lancRow.leadIdOrigem,
      gateLanc.scope
    );
    if (!okLead) return fail("FORBIDDEN", "Sem acesso a este lançamento.", 403);
    const result = await syncComissoesFromLancamentoPagamento(prisma, payload.lancamentoId);
    await writeAuditLog(prisma, {
      acao: "Recalcular comissão por lançamento",
      modulo: "comissoes",
      detalhes: `${payload.lancamentoId} (created=${result.created}, cancelled=${result.cancelled})`,
    });
    return ok({ recalculo: result });
  }

  const gate = await financeiroAccessGate(req, FINANCEIRO_COMISSOES_RESOURCE, "editar");
  if (!gate.ok) return gate.response;

  const ids = payload.ids ?? [];
  if (!ids.length) return fail("BAD_REQUEST", "Nenhuma comissão selecionada.", 400);

  const ownConsultor = await resolveConsultorRhForUsuario(gate.userId);
  const idsOk = await assertComissaoIdsAllowed(ids, ownConsultor?.id ?? null, gate.scope);
  if (!idsOk) {
    return fail("FORBIDDEN", "Uma ou mais comissões não pertencem ao seu escopo.", 403);
  }

  if (payload.acao === "aprovar_lote") {
    const updated = await prisma.comissaoEvento.updateMany({
      where: { id: { in: ids }, status: "elegivel" },
      data: { status: "aprovada", aprovadoEm: new Date(), observacao: payload.observacao?.trim() || null },
    });
    await writeAuditLog(prisma, {
      acao: "Aprovar lote de comissões",
      modulo: "comissoes",
      detalhes: `${updated.count} itens`,
    });
    return ok({ updated: updated.count });
  }
  if (payload.acao === "marcar_pago") {
    const paidAt = payload.pagoEm ? new Date(payload.pagoEm) : new Date();
    if (Number.isNaN(paidAt.getTime())) return fail("BAD_REQUEST", "Data de pagamento inválida.", 400);
    const comp = { ano: paidAt.getFullYear(), mes: paidAt.getMonth() + 1 };
    const observacao = payload.observacao?.trim() || null;
    const refExterna = payload.referenciaExterna?.trim() || null;

    await ensureComissaoEventoLancamentoSaidaSchema(prisma).catch((err) => {
      console.error("[api/financeiro/comissoes PATCH marcar_pago] ensure schema:", err);
    });

    try {
      const result = await prisma.$transaction(async (tx) => {
        const candidatos = await tx.comissaoEvento.findMany({
          where: { id: { in: ids }, status: { in: ["aprovada", "elegivel"] } },
          include: {
            consultor: { select: { nome: true } },
            lead: { select: { name: true } },
          },
        });
        if (!candidatos.length) {
          return { updated: 0, loteId: null as string | null };
        }

        const cat = await tx.financeiroCategoria.findFirst({
          where: { ativo: true, tipo: { in: ["saida", "ambos"] } },
          orderBy: [{ ordem: "asc" }, { nome: "asc" }],
          select: { id: true },
        });
        if (!cat) {
          const err = new Error("NO_SAIDA_CATEGORY");
          (err as Error & { code: string }).code = "NO_SAIDA_CATEGORY";
          throw err;
        }

        const lote = await tx.comissaoLotePagamento.create({
          data: {
            competenciaAno: comp.ano,
            competenciaMes: comp.mes,
            observacao,
            referenciaExterna: refExterna,
            pagoEm: paidAt,
          },
        });

        let updated = 0;
        for (const ev of candidatos) {
          if (ev.lancamentoSaidaId) {
            await tx.comissaoEvento.update({
              where: { id: ev.id },
              data: {
                status: "paga",
                pagoEm: paidAt,
                lotePagamentoId: lote.id,
                observacao,
              },
            });
            updated += 1;
            continue;
          }
          const valor = Number(ev.valorComissao.toString());
          const saida = await tx.lancamento.create({
            data: {
              tipo: "saida",
              descricao: `Pagamento comissão — ${ev.lead?.name ?? "Lead"} / ${ev.consultor.nome}`,
              fornecedor: ev.consultor.nome,
              vencimento: paidAt,
              valor,
              status: "pago",
              dataPagamento: paidAt,
              categoriaId: cat.id,
              contaId: null,
              meioPagamentoId: null,
              leadIdOrigem: ev.leadId,
              leadSolucaoId: ev.leadSolucaoId,
            },
          });
          await tx.comissaoEvento.update({
            where: { id: ev.id },
            data: {
              status: "paga",
              pagoEm: paidAt,
              lotePagamentoId: lote.id,
              observacao,
              lancamentoSaidaId: saida.id,
            },
          });
          updated += 1;
        }
        return { updated, loteId: lote.id };
      });

      await writeAuditLog(prisma, {
        acao: "Pagamento de lote de comissões",
        modulo: "comissoes",
        detalhes: `lote=${result.loteId}; itens=${result.updated}`,
      });
      return ok({ updated: result.updated, loteId: result.loteId });
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "NO_SAIDA_CATEGORY") {
        return fail(
          "BAD_REQUEST",
          "Cadastre pelo menos uma categoria financeira ativa do tipo saída (ou ambos) para registrar o pagamento no fluxo de caixa.",
          400
        );
      }
      throw e;
    }
  }
  return fail("BAD_REQUEST", "Ação inválida.", 400);
}

