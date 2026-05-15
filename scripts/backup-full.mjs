#!/usr/bin/env node
/**
 * Backup completo do estado do sistema (dados + ficheiros locais + referência Prisma + .env*).
 *
 * Uso (na raiz do repositório): node scripts/backup-full.mjs
 * Requer: PostgreSQL client tools (pg_dump) no PATH.
 *
 * Saída: backups/archive/<timestamp>/
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  getRepoRoot,
  loadDatabaseUrl,
  sha256File,
  copyDirIfExists,
  copyEnvTemplates,
  runCmd,
  findPgTool,
} from "./lib/backup-utils.mjs";

const root = getRepoRoot();
process.chdir(root);

const skipDatabase = process.env.BACKUP_SKIP_DATABASE === "1";

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(root, "backups", "archive", stamp);
fs.mkdirSync(outDir, { recursive: true });

const manifest = {
  version: 1,
  createdAt: new Date().toISOString(),
  hostname: os.hostname(),
  platform: process.platform,
  repoRoot: root,
  components: {},
  notes: [
    "Guarde esta pasta num local seguro (disco externo, nuvem encriptada). Contém dados e segredos (.env).",
    "Para restaurar: npm run restore:full -- <caminho-desta-pasta>",
    "Verificar integridade: npm run backup:verify -- <caminho-desta-pasta>",
  ],
};

/** @type {string[]} */
const warnings = [];

// --- PostgreSQL (formato custom: pg_restore) ---
const dbUrl = skipDatabase ? null : loadDatabaseUrl(root);
const dumpPath = path.join(outDir, "database.dump");
const pgDump = skipDatabase ? null : findPgTool("pg_dump");

if (skipDatabase) {
  manifest.components.database = {
    ok: false,
    skipped: true,
    reason: "BACKUP_SKIP_DATABASE=1 (exportação da BD ignorada)",
  };
  warnings.push("Backup sem base de dados (BACKUP_SKIP_DATABASE=1).");
} else if (!dbUrl) {
  manifest.components.database = {
    ok: false,
    skipped: true,
    reason: "DATABASE_URL não encontrada em .env",
  };
  warnings.push("DATABASE_URL ausente: base de dados não foi exportada.");
} else if (!pgDump) {
  manifest.components.database = {
    ok: false,
    skipped: true,
    reason: "pg_dump não encontrado no PATH (instale PostgreSQL client tools)",
  };
  warnings.push("Instale as ferramentas de cliente PostgreSQL e volte a correr o backup.");
} else {
  const tmpDump = path.join(
    os.tmpdir(),
    `pam-gestor-backup-${stamp.replace(/[^a-zA-Z0-9_-]/g, "_")}.dump`,
  );
  const args = [
    "--format=custom",
    "--compress=9",
    "--no-owner",
    "--file",
    tmpDump,
    dbUrl,
  ];
  const r = runCmd(pgDump, args, { env: { ...process.env, PGSSLMODE: process.env.PGSSLMODE ?? "prefer" } });
  if (r.status !== 0 || !fs.existsSync(tmpDump)) {
    manifest.components.database = {
      ok: false,
      error: (r.stderr || r.stdout || String(r.error || "pg_dump falhou")).slice(0, 2000),
    };
    warnings.push("pg_dump falhou — verifique DATABASE_URL e ligação à rede.");
    try {
      fs.unlinkSync(tmpDump);
    } catch {
      /* ignore */
    }
  } else {
    try {
      fs.renameSync(tmpDump, dumpPath);
    } catch {
      fs.copyFileSync(tmpDump, dumpPath);
      fs.unlinkSync(tmpDump);
    }
    const stat = fs.statSync(dumpPath);
    manifest.components.database = {
      ok: true,
      format: "custom",
      file: "database.dump",
      bytes: stat.size,
      sha256: sha256File(dumpPath),
      pgDumpPath: pgDump,
    };
  }
}

// --- uploads (timbres e legado em public) ---
const uploadsDest = path.join(outDir, "files", "uploads");
const uploadsSrc = path.join(root, "uploads");
const uploadsMeta = copyDirIfExists(uploadsSrc, uploadsDest);
manifest.components.uploadsRoot = { ...uploadsMeta, source: "uploads/" };
if (uploadsMeta.copied === false && uploadsMeta.reason !== "missing") {
  warnings.push(`Cópia de uploads/ falhou: ${uploadsMeta.reason ?? uploadsMeta.stderr ?? "erro"}`);
}

const publicUploadsDest = path.join(outDir, "files", "public-uploads");
const publicUploadsSrc = path.join(root, "public", "uploads");
const publicUploadsMeta = copyDirIfExists(publicUploadsSrc, publicUploadsDest);
manifest.components.publicUploads = { ...publicUploadsMeta, source: "public/uploads/" };
if (publicUploadsMeta.copied === false && publicUploadsMeta.reason !== "missing") {
  warnings.push(`Cópia de public/uploads/ falhou: ${publicUploadsMeta.reason ?? publicUploadsMeta.stderr ?? "erro"}`);
}

// --- Prisma (schema + migrations: referência para alinhar código com o dump) ---
const prismaDest = path.join(outDir, "prisma-snapshot");
fs.mkdirSync(prismaDest, { recursive: true });
const schemaSrc = path.join(root, "prisma", "schema.prisma");
if (fs.existsSync(schemaSrc)) {
  fs.copyFileSync(schemaSrc, path.join(prismaDest, "schema.prisma"));
}
const migrationsSrc = path.join(root, "prisma", "migrations");
const migrationsMeta = copyDirIfExists(migrationsSrc, path.join(prismaDest, "migrations"));
manifest.components.prismaSnapshot = {
  schemaCopied: fs.existsSync(schemaSrc),
  migrations: migrationsMeta,
};
if (migrationsMeta.copied === false && migrationsMeta.reason !== "missing") {
  warnings.push(`Cópia de prisma/migrations falhou: ${migrationsMeta.reason ?? migrationsMeta.stderr ?? "erro"}`);
}

// --- Variáveis de ambiente (cópia integral para recuperação do mesmo ambiente) ---
const secretsDir = path.join(outDir, "secrets");
const envFiles = copyEnvTemplates(root, secretsDir);
manifest.components.envFiles = {
  copied: envFiles,
  warning: "Contém segredos. Não partilhe nem envie para repositórios públicos.",
};

manifest.warnings = warnings;

fs.writeFileSync(path.join(outDir, "MANIFEST.json"), JSON.stringify(manifest, null, 2), "utf8");

const outPosix = outDir.split(path.sep).join("/");
const readme = `Backup PAM Gestor
==================
Pasta: ${path.basename(outDir)}
Criado: ${manifest.createdAt}

Conteúdo
--------
- database.dump     — PostgreSQL (formato custom; restaurar com pg_restore)
- files/            — uploads da aplicação
- prisma-snapshot/  — schema e migrations no momento do backup
- secrets/          — cópia dos ficheiros .env* da raiz do projeto
- MANIFEST.json     — metadados e checksum SHA-256 do dump

Verificar
---------
Na raiz do repositório (use aspas no PowerShell se o caminho tiver espaços):
  npm run backup:verify -- ${outPosix}

Restaurar (substitui dados na base indicada por DATABASE_URL no .env)
---------------------------------------------------------------------
  npm run restore:full -- ${outPosix}

Requisitos: PostgreSQL client (pg_restore), Node.js, projeto com dependências instaladas (npm ci).
Após restaurar ficheiros: confirme que uploads/ e public/uploads/ existem como no backup.
`;

fs.writeFileSync(path.join(outDir, "LEIA-ME.txt"), readme, "utf8");

console.log(`Backup concluído: ${outDir}`);
if (warnings.length) {
  console.warn("Avisos:");
  for (const w of warnings) console.warn(`  - ${w}`);
}
