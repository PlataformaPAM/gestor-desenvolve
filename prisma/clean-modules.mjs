/**
 * Remove dados transacionais dos módulos Comercial, Financeiro (lançamentos),
 * Contratos (via cascade ao apagar leads) e Pós-venda (tarefas com meta).
 *
 * Não apaga: clientes, usuários, soluções, cadastros financeiros (contas/categorias/meios).
 *
 * Uso: npm run db:clean-modules (lê .env.local ou .env) ou DATABASE_URL=... node prisma/clean-modules.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function loadDatabaseUrlFromEnvFiles() {
  if (process.env.DATABASE_URL) return;
  for (const name of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    const lines = readFileSync(p, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const m = t.match(/^DATABASE_URL\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[1].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      process.env.DATABASE_URL = v;
      return;
    }
  }
}

loadDatabaseUrlFromEnvFiles();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Defina DATABASE_URL.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const POSVENDA_MARKER = "[POSVENDA_META]";

async function main() {
  const nLanc = await prisma.lancamento.deleteMany({});
  const nPv = await prisma.tarefa.deleteMany({
    where: { descricao: { contains: POSVENDA_MARKER } },
  });
  const nLeads = await prisma.lead.deleteMany({});

  console.log("Limpeza concluída:");
  console.log(`  Lançamentos removidos: ${nLanc.count}`);
  console.log(`  Tarefas Pós-venda removidas: ${nPv.count}`);
  console.log(`  Leads removidos (contratos e filhos em cascade): ${nLeads.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
