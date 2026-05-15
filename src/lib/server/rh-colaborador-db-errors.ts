import { Prisma } from "@prisma/client";
import { fail } from "@/lib/server/api-response";

/**
 * Coluna `cadastroEfetivado` existe no schema Prisma mas não na tabela PostgreSQL
 * (migration `20260511190000_rh_consultor_cadastro_efetivado` não aplicada).
 * Omitir o campo no `data` não basta: o client ainda referencia a coluna no SQL.
 */
export function isCadastroEfetivadoMissingInDatabase(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  const mentions = msg.includes("cadastroefetivado") || msg.includes("cadastro_efetivado");
  if (!mentions) return false;
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") return true;
  return msg.includes("does not exist") || msg.includes("não existe") || msg.includes("unknown column");
}

export function failCadastroEfetivadoMigrationPending() {
  return fail(
    "MIGRATION_REQUIRED",
    'O PostgreSQL está sem a coluna cadastroEfetivado em "ColaboradorRH". Alinhe o banco ao Prisma: na raiz, rode `npm run db:migrate` (ou `npx prisma migrate deploy`). Se o migrate falhar com banco já existente (P3005), rode `npm run db:ensure-rh-cadastro` para aplicar só esse DDL de forma idempotente.',
    503
  );
}
