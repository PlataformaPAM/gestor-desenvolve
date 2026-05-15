import type { ComissaoEvento, ComissaoParticipacaoVenda, ComissaoRegra } from "@/lib/comissoes/types";
import type { Prisma } from "@prisma/client";

function toNum(v: Prisma.Decimal | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v.toString());
}

export function mapRegra(
  row: {
    id: string;
    consultorId: string;
    solucaoCatalogoId: string | null;
    categoriaSolucao: string | null;
    baseCalculo: "bruto" | "liquido";
    percentualComissao: Prisma.Decimal;
    despesaFixa: Prisma.Decimal | null;
    vigenciaInicio: Date;
    vigenciaFim: Date | null;
    ativo: boolean;
    prioridade: number;
    observacoes: string | null;
    createdAt: Date;
    updatedAt: Date;
    consultor?: { nome: string } | null;
    solucaoCatalogo?: { nome: string } | null;
  }
): ComissaoRegra {
  return {
    id: row.id,
    consultorId: row.consultorId,
    consultorNome: row.consultor?.nome ?? undefined,
    solucaoCatalogoId: row.solucaoCatalogoId ?? undefined,
    solucaoNome: row.solucaoCatalogo?.nome ?? undefined,
    categoriaSolucao: row.categoriaSolucao ?? undefined,
    baseCalculo: row.baseCalculo,
    percentualComissao: toNum(row.percentualComissao),
    despesaFixa: row.despesaFixa != null ? toNum(row.despesaFixa) : undefined,
    vigenciaInicio: row.vigenciaInicio.toISOString(),
    vigenciaFim: row.vigenciaFim?.toISOString(),
    ativo: row.ativo,
    prioridade: row.prioridade,
    observacoes: row.observacoes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapParticipacao(
  row: {
    id: string;
    leadId: string;
    leadSolucaoId: string | null;
    consultorId: string;
    percentualParticipacao: Prisma.Decimal;
    ativo: boolean;
    observacoes: string | null;
    createdAt: Date;
    updatedAt: Date;
    consultor?: { nome: string } | null;
  }
): ComissaoParticipacaoVenda {
  return {
    id: row.id,
    leadId: row.leadId,
    leadSolucaoId: row.leadSolucaoId ?? undefined,
    consultorId: row.consultorId,
    consultorNome: row.consultor?.nome ?? undefined,
    percentualParticipacao: toNum(row.percentualParticipacao),
    ativo: row.ativo,
    observacoes: row.observacoes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapEvento(
  row: {
    id: string;
    status: "prevista" | "elegivel" | "aprovada" | "paga" | "cancelada_tecnica";
    competenciaAno: number;
    competenciaMes: number;
    dataRecebimento: Date;
    origemLancamentoId: string;
    leadId: string;
    leadSolucaoId: string | null;
    consultorId: string;
    regraId: string | null;
    participacaoId: string | null;
    lotePagamentoId: string | null;
    baseCalculo: "bruto" | "liquido";
    percentualComissao: Prisma.Decimal;
    percentualParticipacao: Prisma.Decimal;
    despesaFixa: Prisma.Decimal | null;
    valorBase: Prisma.Decimal;
    valorComissao: Prisma.Decimal;
    observacao: string | null;
    aprovadoEm: Date | null;
    pagoEm: Date | null;
    canceladoEm: Date | null;
    createdAt: Date;
    updatedAt: Date;
    consultor?: { nome: string } | null;
    lead?: { name: string } | null;
    leadSolucao?: { nome: string } | null;
  }
): ComissaoEvento {
  return {
    id: row.id,
    status: row.status,
    competenciaAno: row.competenciaAno,
    competenciaMes: row.competenciaMes,
    dataRecebimento: row.dataRecebimento.toISOString(),
    origemLancamentoId: row.origemLancamentoId,
    leadId: row.leadId,
    leadNome: row.lead?.name ?? undefined,
    leadSolucaoId: row.leadSolucaoId ?? undefined,
    solucaoNome: row.leadSolucao?.nome ?? undefined,
    consultorId: row.consultorId,
    consultorNome: row.consultor?.nome ?? undefined,
    regraId: row.regraId ?? undefined,
    participacaoId: row.participacaoId ?? undefined,
    lotePagamentoId: row.lotePagamentoId ?? undefined,
    baseCalculo: row.baseCalculo,
    percentualComissao: toNum(row.percentualComissao),
    percentualParticipacao: toNum(row.percentualParticipacao),
    despesaFixa: row.despesaFixa != null ? toNum(row.despesaFixa) : undefined,
    valorBase: toNum(row.valorBase),
    valorComissao: toNum(row.valorComissao),
    observacao: row.observacao ?? undefined,
    aprovadoEm: row.aprovadoEm?.toISOString(),
    pagoEm: row.pagoEm?.toISOString(),
    canceladoEm: row.canceladoEm?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

