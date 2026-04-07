/** Data curta pt-BR (apenas dia/mês/ano), fuso America/Sao_Paulo. */
export function formatDateDMY(iso: string | Date | null | undefined): string {
  if (iso == null) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}
