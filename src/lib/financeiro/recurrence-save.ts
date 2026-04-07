import type { Lancamento } from "./types";

export type RecurrenceScope = "single" | "future" | "all";

/** Raiz do grupo (primeiro lançamento do fixo/parcelado). */
export function getRecurrenceRootId(l: Lancamento): string {
  return l.idPai ?? l.id;
}

/** Todos os lançamentos do mesmo grupo, ordenados por vencimento. */
export function getGroupMembers(rootId: string, all: Lancamento[]): Lancamento[] {
  return all
    .filter((x) => x.id === rootId || x.idPai === rootId)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}

export function isRecorrenciaPagamento(l: Lancamento | undefined | null): boolean {
  return l?.tipoRecorrencia === "fixo_mensal" || l?.tipoRecorrencia === "parcelado";
}

const DIFF_KEYS: (keyof Lancamento)[] = [
  "descricao",
  "valor",
  "vencimento",
  "tipo",
  "clienteId",
  "fornecedor",
  "status",
  "dataPagamento",
  "contaId",
  "categoriaId",
  "meioPagamentoId",
  "formaPagamento",
  "condicoesPagamento",
  "prazoDias",
];

export function hasLancamentoEdicaoDiff(initial: Lancamento, edited: Lancamento): boolean {
  for (const k of DIFF_KEYS) {
    const a = initial[k];
    const b = edited[k];
    if (k === "valor") {
      if (Math.abs((Number(a) || 0) - (Number(b) || 0)) > 0.009) return true;
      continue;
    }
    if (a !== b) return true;
  }
  return false;
}

/**
 * Mescla o formulário editado em cada linha do grupo.
 * - Campos descritivos / cadastro: replicam do editado.
 * - Valor: em linhas já pagas não altera o valor (exceto na linha que o usuário está editando).
 * - Status / dataPagamento: só na linha editada; demais mantêm o estado atual.
 * - vencimento, id, idPai, parcelaNumero, lead*: preservados por linha.
 */
export function mergeRecurrenceBulkRow(
  target: Lancamento,
  edited: Lancamento,
  editedRowId: string
): Lancamento {
  const isPrimary = target.id === editedRowId;
  const shared: Partial<Lancamento> = {
    descricao: edited.descricao,
    tipo: edited.tipo,
    clienteId: edited.clienteId,
    fornecedor: edited.fornecedor,
    contaId: edited.contaId,
    categoriaId: edited.categoriaId,
    meioPagamentoId: edited.meioPagamentoId,
    formaPagamento: edited.formaPagamento,
    condicoesPagamento: edited.condicoesPagamento,
    prazoDias: edited.prazoDias,
    tipoRecorrencia: edited.tipoRecorrencia ?? target.tipoRecorrencia,
    parcelas: edited.parcelas ?? target.parcelas,
  };

  let valor = target.valor;
  if (isPrimary || target.status !== "pago") {
    valor = edited.valor;
  }

  return {
    ...target,
    ...shared,
    valor,
    vencimento: target.vencimento,
    id: target.id,
    idPai: target.idPai,
    parcelaNumero: target.parcelaNumero,
    leadIdOrigem: target.leadIdOrigem,
    leadSolucaoId: target.leadSolucaoId,
    status: isPrimary ? edited.status : target.status,
    dataPagamento: isPrimary ? edited.dataPagamento : target.dataPagamento,
  };
}

export function buildPayloadsForRecurrenceScope(
  scope: RecurrenceScope,
  initial: Lancamento,
  edited: Lancamento,
  all: Lancamento[]
): Lancamento[] {
  if (scope === "single") {
    return [edited];
  }
  const rootId = getRecurrenceRootId(initial);
  const group = getGroupMembers(rootId, all);
  let subset =
    scope === "future"
      ? group.filter((t) => t.vencimento >= initial.vencimento)
      : group;
  return subset.map((t) => mergeRecurrenceBulkRow(t, edited, initial.id));
}
