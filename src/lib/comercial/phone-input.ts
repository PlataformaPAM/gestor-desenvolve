/**
 * Máscara dinâmica para telefone brasileiro no input:
 * - DDD: após 2 dígitos mostra `(11)`.
 * - Celular (3º dígito `9`): até 11 dígitos → `(DD) 9XXXX-XXXX`.
 * - Fixo (3º dígito ≠ `9`): até 10 dígitos → `(DD) XXXX-XXXX`.
 * Remove `55` inicial se o usuário colar número com DDI.
 */
export function formatBrazilianPhoneInput(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) {
    digits = digits.slice(2);
  }

  if (!digits) return "";

  const third = digits[2];
  const treatAsMobile = digits.length >= 3 && third === "9";
  const maxLen = treatAsMobile ? 11 : 10;
  const d = digits.slice(0, maxLen);

  if (d.length === 1) return `(${d}`;
  if (d.length === 2) return `(${d})`;

  const ddd = d.slice(0, 2);
  const rest = d.slice(2);

  if (treatAsMobile) {
    if (rest.length === 0) return `(${ddd})`;
    const nine = rest[0];
    const after = rest.slice(1, 9);
    if (after.length <= 4) return `(${ddd}) ${nine}${after}`;
    return `(${ddd}) ${nine}${after.slice(0, 4)}-${after.slice(4, 8)}`;
  }

  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4, 8)}`;
}
