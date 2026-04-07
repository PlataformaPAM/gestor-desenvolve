export function formatTimeInStage(enteredStageAt: string): string {
  const entered = new Date(enteredStageAt);
  const now = new Date();
  const diffMs = now.getTime() - entered.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "1 dia";
  if (diffDays < 7) return `${diffDays} dias`;
  const weeks = Math.floor(diffDays / 7);
  if (weeks === 1) return "1 sem";
  return `${weeks} sem`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
