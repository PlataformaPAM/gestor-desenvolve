import { Prisma } from "@prisma/client";

/** Coluna/tabela do schema Prisma ainda não existente no PostgreSQL (migração pendente). */
export function isPrismaSchemaDriftError(error: unknown, columnHint?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2021" && error.code !== "P2022") return false;
  if (!columnHint) return true;
  const msg = String(error.message ?? "").toLowerCase();
  const hint = columnHint.toLowerCase();
  return msg.includes(hint) || msg.includes(hint.replace(/([A-Z])/g, "_$1").toLowerCase());
}
