import { Prisma, type ComissaoStatus, type PrismaClient } from "@prisma/client";
import { categoriaEfetivaSolucaoCatalogo } from "@/app/api/solucoes/_shared";
import { splitValorTotalEmParcelas } from "@/lib/financeiro/lancamento-utils";
import {
  consultoresUnicosResolvidos,
  resolveEquipeVendaParaComissao,
} from "@/lib/server/comissoes-ownership-resolve";

import {
  ensureComissaoEventoLancamentoSaidaSchema,
} from "@/lib/server/ensure-comissao-evento-pg-schema";

function toDecimal(v: Prisma.Decimal | number | string | null | undefined): Prisma.Decimal {
  if (v instanceof Prisma.Decimal) return v;
  if (v === null || v === undefined || Number.isNaN(Number(v))) return new Prisma.Decimal(0);
  return new Prisma.Decimal(v);
}

function competenciaFrom(date: Date): { ano: number; mes: number } {
  return { ano: date.getFullYear(), mes: date.getMonth() + 1 };
}

/**
 * Valor bruto usado na comissão sobre este lançamento de entrada.
 * Parcelado: se houver uma única linha com valor = total da solução na proposta e parcelas N,
 * usa o valor de UMA parcela (evita comissão sobre o total antes dos recebimentos parcelados).
 * Caso já existam outras parcelas numeradas no caixa para a mesma solução, mantém o valor da linha.
 * Recorrente mensal / único: mantém `lancamento.valor` (cada linha mensal já é o valor da competência).
 */
async function resolveValorBrutoComissaoEntrada(
  tx: Prisma.TransactionClient,
  lancamento: {
    id: string;
    tipo: string;
    leadIdOrigem: string | null;
    leadSolucaoId: string | null;
    valor: number;
    tipoRecorrencia: "unico" | "fixo_mensal" | "parcelado" | null;
    parcelas: number | null;
    parcelaNumero: number | null;
    idPai: string | null;
  }
): Promise<Prisma.Decimal> {
  const base = toDecimal(lancamento.valor);
  if (lancamento.tipo !== "entrada" || !lancamento.leadSolucaoId || !lancamento.leadIdOrigem) {
    return base;
  }
  if (
    lancamento.tipoRecorrencia !== "parcelado" ||
    lancamento.parcelas == null ||
    lancamento.parcelas < 2 ||
    lancamento.parcelaNumero != null ||
    lancamento.idPai != null
  ) {
    return base;
  }

  const jaExistemParcelasNumeradas = await tx.lancamento.count({
    where: {
      leadIdOrigem: lancamento.leadIdOrigem,
      leadSolucaoId: lancamento.leadSolucaoId,
      tipo: "entrada",
      parcelaNumero: { not: null },
      NOT: { id: lancamento.id },
    },
  });
  if (jaExistemParcelasNumeradas > 0) {
    return base;
  }

  const ls = await tx.leadSolucao.findUnique({
    where: { id: lancamento.leadSolucaoId },
    select: { valor: true },
  });
  const total = ls?.valor != null ? Number(ls.valor) : NaN;
  if (!Number.isFinite(total) || total <= 0) {
    return base;
  }

  const n = Math.max(2, Math.floor(lancamento.parcelas));
  const partes = splitValorTotalEmParcelas(total, n);
  const vLin = Number(lancamento.valor);
  if (Math.abs(vLin - total) <= 0.02) {
    return toDecimal(partes[0]!);
  }
  return base;
}

async function resolveParticipacoes(
  tx: Prisma.TransactionClient,
  params: { leadId: string; leadSolucaoId?: string }
): Promise<Array<{ id: string; consultorId: string; percentual: Prisma.Decimal }>> {
  const participacoes = await tx.comissaoParticipacaoVenda.findMany({
    where: {
      leadId: params.leadId,
      ativo: true,
      ...(params.leadSolucaoId ? { leadSolucaoId: params.leadSolucaoId } : {}),
    },
    select: { id: true, consultorId: true, percentualParticipacao: true },
  });
  if (participacoes.length) {
    return participacoes.map((p) => ({ id: p.id, consultorId: p.consultorId, percentual: p.percentualParticipacao }));
  }

  const fallbackParticipacoes = await tx.comissaoParticipacaoVenda.findMany({
    where: { leadId: params.leadId, leadSolucaoId: null, ativo: true },
    select: { id: true, consultorId: true, percentualParticipacao: true },
  });
  if (fallbackParticipacoes.length) {
    return fallbackParticipacoes.map((p) => ({ id: p.id, consultorId: p.consultorId, percentual: p.percentualParticipacao }));
  }

  const equipe = await resolveEquipeVendaParaComissao(tx, params.leadId);
  const consultores = consultoresUnicosResolvidos(equipe);
  if (!consultores.length) return [];

  const share = new Prisma.Decimal(100).div(consultores.length);
  return consultores.map((c, idx) => ({
    id: `auto-${params.leadId}-${params.leadSolucaoId ?? "all"}-${idx}`,
    consultorId: c.id,
    percentual: share,
  }));
}

async function resolveRegraVigente(
  tx: Prisma.TransactionClient,
  params: { consultorId: string; dataRef: Date; solucaoCatalogoId?: string; categoriaSolucao?: string | null }
) {
  const whereBase: Prisma.ComissaoRegraWhereInput = {
    consultorId: params.consultorId,
    ativo: true,
    vigenciaInicio: { lte: params.dataRef },
    OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: params.dataRef } }],
  };
  const bySolucao = params.solucaoCatalogoId
    ? await tx.comissaoRegra.findFirst({
        where: { ...whereBase, solucaoCatalogoId: params.solucaoCatalogoId },
        orderBy: [{ prioridade: "desc" }, { vigenciaInicio: "desc" }, { createdAt: "desc" }],
      })
    : null;
  if (bySolucao) return bySolucao;
  if (params.categoriaSolucao) {
    const byCategoria = await tx.comissaoRegra.findFirst({
      where: { ...whereBase, categoriaSolucao: params.categoriaSolucao },
      orderBy: [{ prioridade: "desc" }, { vigenciaInicio: "desc" }, { createdAt: "desc" }],
    });
    if (byCategoria) return byCategoria;
  }
  return tx.comissaoRegra.findFirst({
    where: { ...whereBase, solucaoCatalogoId: null, categoriaSolucao: null },
    orderBy: [{ prioridade: "desc" }, { vigenciaInicio: "desc" }, { createdAt: "desc" }],
  });
}

const CANCELAVEL: ComissaoStatus[] = ["prevista", "elegivel", "aprovada"];

/** Campos recalculados em todo sync (create e update), exceto status/aprovação/pagamento. */
type ComissaoEventoComunsPayload = Pick<
  Prisma.ComissaoEventoUncheckedCreateInput,
  | "competenciaAno"
  | "competenciaMes"
  | "dataRecebimento"
  | "leadId"
  | "leadSolucaoId"
  | "regraId"
  | "participacaoId"
  | "baseCalculo"
  | "percentualComissao"
  | "percentualParticipacao"
  | "despesaFixa"
  | "valorBase"
  | "valorComissao"
  | "canceladoEm"
>;

function dadosComissaoEventoComuns(params: {
  comp: { ano: number; mes: number };
  dataRecebimento: Date;
  lancamento: {
    leadIdOrigem: string;
    leadSolucaoId: string | null;
  };
  regra: {
    id: string;
    baseCalculo: "bruto" | "liquido";
    despesaFixa: Prisma.Decimal | null;
  };
  part: { id: string; consultorId: string; percentual: Prisma.Decimal };
  porcentagemRegra: Prisma.Decimal;
  porcentagemPart: Prisma.Decimal;
  base: Prisma.Decimal;
  valorComissao: Prisma.Decimal;
}): ComissaoEventoComunsPayload {
  const { comp, dataRecebimento, lancamento, regra, part, porcentagemRegra, porcentagemPart, base, valorComissao } =
    params;
  return {
    competenciaAno: comp.ano,
    competenciaMes: comp.mes,
    dataRecebimento,
    leadId: lancamento.leadIdOrigem,
    leadSolucaoId: lancamento.leadSolucaoId ?? null,
    regraId: regra.id,
    participacaoId: part.id.startsWith("auto-") ? null : part.id,
    baseCalculo: regra.baseCalculo,
    percentualComissao: porcentagemRegra,
    percentualParticipacao: porcentagemPart,
    despesaFixa: regra.despesaFixa != null ? toDecimal(regra.despesaFixa) : null,
    valorBase: base,
    valorComissao,
    canceladoEm: null,
  };
}

export async function syncComissoesFromLancamentoPagamento(
  prisma: PrismaClient,
  lancamentoId: string
): Promise<{ created: number; cancelled: number }> {
  await ensureComissaoEventoLancamentoSaidaSchema(prisma).catch((err) => {
    console.error("[syncComissoesFromLancamentoPagamento] ensure schema:", err);
  });
  return prisma.$transaction(async (tx) => {
    const lancamento = await tx.lancamento.findUnique({
      where: { id: lancamentoId },
      include: {
        leadOrigem: { select: { id: true, name: true } },
        leadSolucao: { include: { solucaoCatalogo: { select: { id: true, categoria: true, descricao: true } } } },
      },
    });
    if (!lancamento) return { created: 0, cancelled: 0 };
    if (lancamento.tipo !== "entrada" || !lancamento.leadIdOrigem) {
      const cancel = await tx.comissaoEvento.updateMany({
        where: {
          origemLancamentoId: lancamento.id,
          status: { in: CANCELAVEL },
          canceladoEm: null,
        },
        data: {
          status: "cancelada_tecnica",
          canceladoEm: new Date(),
          observacao:
            lancamento.tipo !== "entrada"
              ? "Lançamento deixou de ser recebimento."
              : "Recebimento desvinculado do lead.",
        },
      });
      return { created: 0, cancelled: cancel.count };
    }

    const isPaid = lancamento.status === "pago" && lancamento.dataPagamento != null;
    const dataRef = isPaid ? lancamento.dataPagamento! : lancamento.vencimento;
    const comp = competenciaFrom(dataRef);

    const participacoes = await resolveParticipacoes(tx, {
      leadId: lancamento.leadIdOrigem,
      leadSolucaoId: lancamento.leadSolucaoId ?? undefined,
    });
    if (!participacoes.length) {
      const cancelOrfaos = await tx.comissaoEvento.updateMany({
        where: {
          origemLancamentoId: lancamento.id,
          status: { in: CANCELAVEL },
          canceladoEm: null,
        },
        data: {
          status: "cancelada_tecnica",
          canceladoEm: new Date(),
          observacao: "Sem participação de consultores para este recebimento.",
        },
      });
      return { created: 0, cancelled: cancelOrfaos.count };
    }

    const valorBrutoComissao = await resolveValorBrutoComissaoEntrada(tx, lancamento);
    const dataRecebimento = dataRef;
    let created = 0;
    let cancelled = 0;

    const consultorIdsParticipando = new Set(participacoes.map((p) => p.consultorId));

    for (const part of participacoes) {
      const catRow = lancamento.leadSolucao?.solucaoCatalogo;
      const categoriaParaRegra = catRow
        ? (categoriaEfetivaSolucaoCatalogo(catRow).trim() || null)
        : null;
      const regra = await resolveRegraVigente(tx, {
        consultorId: part.consultorId,
        dataRef,
        solucaoCatalogoId: catRow?.id ?? undefined,
        categoriaSolucao: categoriaParaRegra,
      });

      const whereEvento: Prisma.ComissaoEventoWhereUniqueInput = {
        origemLancamentoId_consultorId: {
          origemLancamentoId: lancamento.id,
          consultorId: part.consultorId,
        },
      };

      if (!regra) {
        const semRegra = await tx.comissaoEvento.updateMany({
          where: {
            origemLancamentoId: lancamento.id,
            consultorId: part.consultorId,
            status: { in: CANCELAVEL },
            canceladoEm: null,
          },
          data: {
            status: "cancelada_tecnica",
            canceladoEm: new Date(),
            observacao: "Sem regra de comissão vigente para o consultor e o contexto da venda.",
          },
        });
        cancelled += semRegra.count;
        continue;
      }

      const porcentagemRegra = toDecimal(regra.percentualComissao);
      const porcentagemPart = toDecimal(part.percentual);
      const bruto = valorBrutoComissao;
      /** `despesaFixa` na regra: % sobre o bruto quando base = líquido (0–100); ignorado no bruto. */
      const despesaPct =
        regra.baseCalculo === "liquido" && regra.despesaFixa != null
          ? toDecimal(regra.despesaFixa)
          : new Prisma.Decimal(0);
      const fatorLiquido = new Prisma.Decimal(100).sub(despesaPct).div(100);
      const base =
        regra.baseCalculo === "liquido"
          ? Prisma.Decimal.max(bruto.mul(fatorLiquido), new Prisma.Decimal(0))
          : bruto;
      const valorComissao = base.mul(porcentagemRegra).div(100).mul(porcentagemPart).div(100);

      const comuns = dadosComissaoEventoComuns({
        comp,
        dataRecebimento,
        lancamento: { leadIdOrigem: lancamento.leadIdOrigem, leadSolucaoId: lancamento.leadSolucaoId },
        regra: {
          id: regra.id,
          baseCalculo: regra.baseCalculo,
          despesaFixa: regra.despesaFixa,
        },
        part,
        porcentagemRegra,
        porcentagemPart,
        base,
        valorComissao,
      });

      const existing = await tx.comissaoEvento.findUnique({
        where: whereEvento,
        select: { id: true, status: true },
      });

      if (existing) {
        const st = existing.status;
        if (st === "cancelada_tecnica") {
          await tx.comissaoEvento.update({
            where: whereEvento,
            data: {
              ...comuns,
              status: isPaid ? "elegivel" : "prevista",
              observacao: null,
              aprovadoEm: null,
              pagoEm: null,
              lotePagamentoId: null,
              canceladoEm: null,
            },
          });
        } else if (st === "paga") {
          await tx.comissaoEvento.update({
            where: whereEvento,
            data: {
              ...comuns,
              status: "paga",
            },
          });
        } else if (isPaid) {
          if (st === "aprovada") {
            await tx.comissaoEvento.update({
              where: whereEvento,
              data: {
                ...comuns,
                status: "aprovada",
              },
            });
          } else {
            await tx.comissaoEvento.update({
              where: whereEvento,
              data: {
                ...comuns,
                status: "elegivel",
                observacao: null,
              },
            });
          }
        } else {
          await tx.comissaoEvento.update({
            where: whereEvento,
            data: {
              ...comuns,
              status: "prevista",
              observacao:
                st === "aprovada" || st === "elegivel"
                  ? "Recebimento ainda não baixado; comissão permanece como previsão."
                  : null,
              aprovadoEm: null,
            },
          });
        }
      } else {
        await tx.comissaoEvento.create({
          data: {
            ...comuns,
            status: isPaid ? "elegivel" : "prevista",
            origemLancamentoId: lancamento.id,
            consultorId: part.consultorId,
          },
        });
        created += 1;
      }
    }

    const cancelExtras = await tx.comissaoEvento.updateMany({
      where: {
        origemLancamentoId: lancamento.id,
        consultorId: { notIn: [...consultorIdsParticipando] },
        status: { in: CANCELAVEL },
        canceladoEm: null,
      },
      data: {
        status: "cancelada_tecnica",
        canceladoEm: new Date(),
        observacao: "Consultor não participa mais desta venda neste recebimento.",
      },
    });
    cancelled += cancelExtras.count;

    return { created, cancelled };
  });
}

