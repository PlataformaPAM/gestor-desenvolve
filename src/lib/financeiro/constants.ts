import type { Lancamento, TipoRecorrencia } from "./types";

export const STATUS_LABELS: Record<Lancamento["status"], string> = {
  pago: "Pago",
  pendente: "Pendente",
  atrasado: "Atrasado",
};

export const TIPO_REC_LABEL: Record<TipoRecorrencia, string> = {
  unico: "Único",
  fixo_mensal: "Fixo mensal",
  parcelado: "Parcelado",
};

/** Formas de pagamento (ordem alfabética A–Z em pt-BR). */
export const FORMAS_PAGAMENTO = [
  "Boleto",
  "Dinheiro",
  "Empenho",
  "Pix",
  "Transferência bancária",
] as const;

export type FormaPagamentoPadrao = (typeof FORMAS_PAGAMENTO)[number];
