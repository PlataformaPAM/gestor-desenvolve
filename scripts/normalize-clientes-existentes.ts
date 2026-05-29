/**
 * Normaliza textos de todos os clientes já cadastrados (caixa, acentos, município IBGE).
 * Idempotente: só grava registros que mudarem.
 *
 * Uso: npm run db:normalize-clientes
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { runNormalizeClientesBackfill } from "../src/lib/server/normalize-clientes-backfill";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Defina DATABASE_URL.");
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const result = await runNormalizeClientesBackfill(prisma);
    console.log(
      `OK: normalização de clientes — ${result.updated} atualizado(s), ${result.skipped} já ok, ${result.total} total.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[db:normalize-clientes] falhou:", err);
  process.exit(1);
});
