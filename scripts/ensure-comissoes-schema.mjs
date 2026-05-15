/**
 * Aplica o DDL do núcleo de comissões (mesmo SQL da migration oficial).
 * Use quando `prisma migrate deploy` não puder ser usado ou após pull sem rodar migrate.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Carrega .env.local e .env na raiz (sem dependência de dotenv). */
function loadEnvFiles() {
  const root = path.join(__dirname, "..");
  for (const name of [".env.local", ".env"]) {
    const filePath = path.join(root, name);
    if (!fs.existsSync(filePath)) continue;
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

loadEnvFiles();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Defina DATABASE_URL (ex.: .env.local na raiz do projeto).");
  process.exit(1);
}

const migrationPath = path.join(
  __dirname,
  "../prisma/migrations/20260511194000_comissoes_core/migration.sql"
);
if (!fs.existsSync(migrationPath)) {
  console.error(`Arquivo de migration não encontrado: ${migrationPath}`);
  process.exit(1);
}
const sql = fs.readFileSync(migrationPath, "utf8");

const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query(sql);
  console.log("OK: schema de comissões e coluna SolucaoCatalogo.categoria aplicados (idempotente).");
} finally {
  await client.end();
}
