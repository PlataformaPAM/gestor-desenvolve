/** Formata documento para coluna da lista Equipe (CPF ou CNPJ mascarado). */
export function formatDocumentoColunaEquipe(cpfCnpj: string | undefined): string {
  if (!cpfCnpj?.trim()) return "—";
  const d = cpfCnpj.replace(/\D/g, "");
  if (d.length <= 11) return maskCpfDigits(d);
  return maskCnpjDigits(d);
}

function maskCpfDigits(d: string): string {
  const x = d.slice(0, 11);
  if (x.length <= 3) return x;
  if (x.length <= 6) return `${x.slice(0, 3)}.${x.slice(3)}`;
  if (x.length <= 9) return `${x.slice(0, 3)}.${x.slice(3, 6)}.${x.slice(6)}`;
  return `${x.slice(0, 3)}.${x.slice(3, 6)}.${x.slice(6, 9)}-${x.slice(9)}`;
}

function maskCnpjDigits(d: string): string {
  const v = d.slice(0, 14);
  if (v.length <= 2) return v;
  if (v.length <= 5) return `${v.slice(0, 2)}.${v.slice(2)}`;
  if (v.length <= 8) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5)}`;
  if (v.length <= 12) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8)}`;
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12, 14)}`;
}
