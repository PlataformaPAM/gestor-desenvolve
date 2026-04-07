/** Diferença em dias entre hoje (meia-noite local) e a data de vencimento (YYYY-MM-DD). */
export function diasRelativosAoVencimento(isoDate: string): number {
  const v = new Date(`${isoDate}T12:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  v.setHours(0, 0, 0, 0);
  return Math.round((v.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export function textoPrazoVencimento(isoDate: string): { text: string; variant: "neutral" | "soon" | "today" | "overdue" } {
  const d = diasRelativosAoVencimento(isoDate);
  if (d > 7) return { text: `Faltam ${d} dias para o vencimento`, variant: "neutral" };
  if (d > 1) return { text: `Faltam ${d} dias para o vencimento`, variant: "soon" };
  if (d === 1) return { text: "Falta 1 dia para o vencimento", variant: "soon" };
  if (d === 0) return { text: "Vence hoje", variant: "today" };
  const a = Math.abs(d);
  if (a === 1) return { text: "Venceu há 1 dia", variant: "overdue" };
  return { text: `Venceu há ${a} dias`, variant: "overdue" };
}
