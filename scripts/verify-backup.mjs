#!/usr/bin/env node
/**
 * Verifica integridade de um backup: MANIFEST, checksum do dump, listagem pg_restore.
 *
 * Uso: node scripts/verify-backup.mjs <caminho-da-pasta-de-backup>
 */
import fs from "node:fs";
import path from "node:path";
import { sha256File, runCmd, findPgTool } from "./lib/backup-utils.mjs";

const dir = process.argv[2];
if (!dir) {
  console.error("Uso: node scripts/verify-backup.mjs <pasta-do-backup>");
  process.exit(1);
}
const abs = path.resolve(dir);
if (!fs.existsSync(abs)) {
  console.error(`Pasta não existe: ${abs}`);
  process.exit(1);
}

const manifestPath = path.join(abs, "MANIFEST.json");
if (!fs.existsSync(manifestPath)) {
  console.error(`MANIFEST.json em falta em ${abs}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
let ok = true;

const dumpPath = path.join(abs, "database.dump");
if (manifest.components?.database?.ok && manifest.components.database.file) {
  if (!fs.existsSync(dumpPath)) {
    console.error("database.dump em falta mas o manifest indica que deveria existir.");
    ok = false;
  } else {
    const sha = sha256File(dumpPath);
    const expected = manifest.components.database.sha256;
    if (expected && sha !== expected) {
      console.error(`SHA-256 do dump não coincide.
  esperado: ${expected}
  actual:   ${sha}`);
      ok = false;
    } else {
      console.log("SHA-256 do dump: OK");
    }
    const pgRestore = findPgTool("pg_restore");
    if (!pgRestore) {
      console.warn("pg_restore não encontrado — não foi possível listar o conteúdo do dump.");
      ok = false;
    } else {
      const r = runCmd(pgRestore, ["--list", dumpPath]);
      if (r.status !== 0) {
        console.error("pg_restore --list falhou:\n", r.stderr || r.stdout);
        ok = false;
      } else {
        const lines = r.stdout.split(/\r?\n/).filter(Boolean).length;
        console.log(`pg_restore --list: OK (${lines} linhas)`);
      }
    }
  }
} else {
  console.warn("Backup sem base de dados exportada (ver MANIFEST).");
}

const secrets = path.join(abs, "secrets");
if (fs.existsSync(secrets)) {
  const files = fs.readdirSync(secrets);
  console.log(`secrets/: ${files.length} ficheiro(s)`);
}

const uploads = path.join(abs, "files", "uploads");
if (fs.existsSync(uploads)) {
  console.log("files/uploads/: presente");
}

process.exit(ok ? 0 : 1);
