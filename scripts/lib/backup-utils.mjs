/**
 * Utilitários partilhados entre backup / verificação / restauração.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

/** Raiz do repositório (scripts/lib → ../../) */
export function getRepoRoot() {
  const here = fileURLToPath(new URL(import.meta.url));
  return path.resolve(path.dirname(here), "..", "..");
}

/** URL sem parâmetros que pg_dump/pg_restore rejeitam (ex.: ?schema= do Prisma). */
export function normalizeDatabaseUrlForPgTools(url) {
  if (!url?.trim()) return url;
  try {
    const u = new URL(url);
    for (const key of ["schema", "connection_limit", "pool_timeout", "connect_timeout"]) {
      u.searchParams.delete(key);
    }
    const out = u.toString();
    return out.endsWith("?") ? out.slice(0, -1) : out;
  } catch {
    return url
      .replace(/[?&]schema=[^&]*/gi, "")
      .replace(/[?&]connection_limit=[^&]*/gi, "")
      .replace(/\?&/, "?")
      .replace(/[?&]$/, "");
  }
}

export function loadDatabaseUrl(root) {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return null;
  const text = fs.readFileSync(envPath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (key !== "DATABASE_URL") continue;
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    return val;
  }
  return null;
}

export function sha256File(filePath) {
  const h = crypto.createHash("sha256");
  h.update(fs.readFileSync(filePath));
  return h.digest("hex");
}

/**
 * Cópia recursiva de pasta. No Windows usa robocopy (melhor com OneDrive/reparse points);
 * nos outros SO usa fs.cpSync.
 */
export function copyDirIfExists(src, dest) {
  if (!fs.existsSync(src)) return { copied: false, reason: "missing" };
  const srcAbs = path.resolve(src);
  const destAbs = path.resolve(dest);

  if (process.platform === "win32") {
    fs.mkdirSync(destAbs, { recursive: true });
    const r = spawnSync(
      "robocopy",
      [srcAbs, destAbs, "/E", "/R:1", "/W:1", "/NFL", "/NDL", "/NJH", "/NJS", "/nc", "/ns", "/np"],
      { encoding: "utf8", windowsHide: true },
    );
    const code = r.status ?? 1;
    if (code >= 8) {
      return {
        copied: false,
        reason: "robocopy_failed",
        robocopyCode: code,
        stderr: (r.stderr || r.stdout || "").slice(0, 2000),
      };
    }
    return { copied: true, via: "robocopy" };
  }

  fs.mkdirSync(path.dirname(destAbs), { recursive: true });
  fs.cpSync(srcAbs, destAbs, { recursive: true, force: true });
  return { copied: true, via: "cpSync" };
}

export function copyEnvTemplates(root, destSecretsDir) {
  fs.mkdirSync(destSecretsDir, { recursive: true });
  const names = fs.readdirSync(root).filter((n) => n.startsWith(".env"));
  const copied = [];
  for (const name of names) {
    const from = path.join(root, name);
    if (!fs.statSync(from).isFile()) continue;
    const to = path.join(destSecretsDir, name);
    fs.copyFileSync(from, to);
    copied.push(name);
  }
  return copied;
}

export function runCmd(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    ...opts,
  });
  return {
    status: r.status,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    error: r.error,
  };
}

export function findPgTool(name) {
  const tryNames = process.platform === "win32" ? [`${name}.exe`, name] : [name];
  for (const bin of tryNames) {
    const which = process.platform === "win32" ? "where.exe" : "command";
    const whichArgs =
      process.platform === "win32" ? [bin] : ["-v", bin];
    const r = runCmd(which, whichArgs);
    if (r.status === 0 && r.stdout.trim()) {
      const first = r.stdout.trim().split(/\r?\n/)[0];
      return first || bin;
    }
  }
  return null;
}
