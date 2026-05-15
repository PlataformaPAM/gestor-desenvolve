/**
 * Garante a coluna `cadastroEfetivado` em `ColaboradorRH` (mesmo SQL da migration oficial).
 * Use quando `prisma migrate deploy` não puder ser usado (ex.: P3005 / banco legado sem histórico Migrate).
 */
import "dotenv/config";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Defina DATABASE_URL.");
  process.exit(1);
}

const sql = `
ALTER TABLE "ColaboradorRH" ADD COLUMN IF NOT EXISTS "cadastroEfetivado" BOOLEAN NOT NULL DEFAULT true;
`;

const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query(sql);
  console.log('OK: coluna "cadastroEfetivado" em "ColaboradorRH" verificada/criada.');
} finally {
  await client.end();
}
