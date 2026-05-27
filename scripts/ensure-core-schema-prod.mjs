/**
 * Aplica DDL core ausente no schema de produção (UsuarioVinculo, audit de Lead, etc.).
 * Use quando o app quebra com P2021/P2022 e `prisma migrate deploy` ainda não rodou.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  console.error("Defina DATABASE_URL (ex.: .env.local ou variável do Railway).");
  process.exit(1);
}

const migrationPath = path.join(
  __dirname,
  "../prisma/migrations/20260528160000_schema_sync_usuario_vinculo_lead_audit/migration.sql"
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
  console.log("OK: schema core sincronizado (UsuarioVinculo, Lead audit, registroLead, etc.).");
} finally {
  await client.end();
}
