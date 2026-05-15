/** Percentual pt-BR com exatamente 2 casas decimais (ex.: `10,00%`, `3,75%`). */
export function formatPercentPtBr2(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)}%`;
}
