#!/usr/bin/env node
/**
 * Restaura backup completo (PostgreSQL + uploads + .env opcional).
 *
 * Uso: node scripts/restore-full.mjs <pasta-do-backup> [--yes] [--skip-env] [--skip-files]
 *
 * --yes        — não pedir confirmação interativa
 * --skip-env   — não copiar secrets/ para a raiz do repo
 * --skip-files — não restaurar uploads
 *
 * A base de dados alvo é a definida por DATABASE_URL no .env atual (ou defina DATABASE_URL no ambiente).
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawnSync } from "node:child_process";
import {
  getRepoRoot,
  loadDatabaseUrl,
  copyDirIfExists,
  findPgTool,
} from "./lib/backup-utils.mjs";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));

const backupDir = args[0];
if (!backupDir) {
  console.error(`Uso: node scripts/restore-full.mjs <pasta-do-backup> [--yes] [--skip-env] [--skip-files]`);
  process.exit(1);
}

const absBackup = path.resolve(backupDir);
const manifestPath = path.join(absBackup, "MANIFEST.json");
if (!fs.existsSync(manifestPath)) {
  console.error(`MANIFEST.json não encontrado em ${absBackup}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const root = getRepoRoot();
const dbUrl = process.env.DATABASE_URL || loadDatabaseUrl(root);

if (!dbUrl) {
  console.error("Defina DATABASE_URL no ambiente ou em .env na raiz do repositório.");
  process.exit(1);
}

const dumpPath = path.join(absBackup, "database.dump");
const hasDump = fs.existsSync(dumpPath);

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main() {
  console.warn(
    "\n*** RESTAURAÇÃO DESTRUTIVA ***\n" +
      "Serão repostos objetos da base de dados a partir do dump (pg_restore --clean --if-exists).\n" +
      `Destino: ${dbUrl.replace(/:[^:@/]+@/, ":****@")}\n`,
  );

  if (!flags.has("--yes")) {
    const a = await ask('Escreva "sim" para continuar: ');
    if (a !== "sim") {
      console.log("Cancelado.");
      process.exit(0);
    }
  }

  if (hasDump) {
    const pgRestore = findPgTool("pg_restore");
    if (!pgRestore) {
      console.error("pg_restore não encontrado no PATH.");
      process.exit(1);
    }
    const restoreArgs = [
      "-d",
      dbUrl,
      "--clean",
      "--if-exists",
      "--no-owner",
      "--verbose",
      dumpPath,
    ];
    console.log("A executar pg_restore...");
    const r = spawnSync(pgRestore, restoreArgs, {
      stdio: "inherit",
      env: { ...process.env, PGSSLMODE: process.env.PGSSLMODE ?? "prefer" },
    });
    if (r.status !== 0) {
      console.error("pg_restore terminou com erro.");
      process.exit(1);
    }
    console.log("Base de dados restaurada.");
  } else {
    console.warn("database.dump ausente — ignorando restauração da BD.");
  }

  if (!flags.has("--skip-files")) {
    const fromUploads = path.join(absBackup, "files", "uploads");
    const toUploads = path.join(root, "uploads");
    const u = copyDirIfExists(fromUploads, toUploads);
    console.log(`uploads/: ${u.copied ? "restaurado" : "sem cópia no backup"}`);

    const fromPublic = path.join(absBackup, "files", "public-uploads");
    const toPublic = path.join(root, "public", "uploads");
    const p = copyDirIfExists(fromPublic, toPublic);
    console.log(`public/uploads/: ${p.copied ? "restaurado" : "sem cópia no backup"}`);
  }

  if (!flags.has("--skip-env")) {
    const secrets = path.join(absBackup, "secrets");
    if (fs.existsSync(secrets)) {
      for (const name of fs.readdirSync(secrets)) {
        const from = path.join(secrets, name);
        if (!fs.statSync(from).isFile()) continue;
        fs.copyFileSync(from, path.join(root, name));
        console.log(`Copiado ${name} para a raiz do projeto.`);
      }
    } else {
      console.warn("Pasta secrets/ ausente no backup — .env não atualizado.");
    }
  }

  console.log("\nRestauração concluída. Sugestão: npm run prisma:generate && npm run build (ou dev).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
