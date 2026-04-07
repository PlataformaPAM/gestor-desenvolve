import type { TipoRecorrencia } from "@/lib/financeiro/types";

export type RecorrenciaPagamentoSolucao = "mensal" | "unica" | "parcelado";

export function recorrenciaComercialParaFinanceiro(
  r: RecorrenciaPagamentoSolucao | null | undefined
): TipoRecorrencia {
  if (r === "mensal") return "fixo_mensal";
  if (r === "parcelado") return "parcelado";
  return "unico";
}
