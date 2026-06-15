import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "tarefas");
export const TAREFA_ANEXO_MAX_BYTES = 15 * 1024 * 1024;

export function tarefaAnexoLeituraUrl(tarefaId: string, nomeArquivo: string): string {
  return `/api/tarefas/${encodeURIComponent(tarefaId)}/anexos/arquivo?nome=${encodeURIComponent(nomeArquivo)}`;
}

export function tarefaAnexoPublicUrl(tarefaId: string, storedName: string): string {
  return `/api/uploads/tarefas/${encodeURIComponent(tarefaId)}/${encodeURIComponent(storedName)}`;
}

export function safeStoredFileName(raw: string): string | null {
  const name = String(raw ?? "").trim();
  if (!name) return null;
  if (name.includes("/") || name.includes("\\") || name.includes("..")) return null;
  return name;
}

export function storedNameForUpload(originalName: string): string {
  const base = (originalName.trim() || "anexo").replace(/[^\w.\-() áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/g, "_");
  return `${randomUUID()}-${base}`;
}

export function tarefaAnexoDiskPath(tarefaId: string, storedName: string): string {
  return path.join(UPLOAD_ROOT, tarefaId, storedName);
}

export function storedNameFromAnexoUrl(url: string | null | undefined): string | null {
  const raw = String(url ?? "").trim();
  if (!raw) return null;
  try {
    const pathname = raw.startsWith("/") ? raw : new URL(raw).pathname;
    const segment = pathname.split("/").filter(Boolean).pop() ?? "";
    return safeStoredFileName(decodeURIComponent(segment));
  } catch {
    const segment = raw.split("/").filter(Boolean).pop() ?? "";
    return safeStoredFileName(decodeURIComponent(segment));
  }
}

export function contentTypeFromFileName(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".doc") return "application/msword";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".xls") return "application/vnd.ms-excel";
  if (ext === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

export async function writeTarefaAnexo(
  tarefaId: string,
  file: File
): Promise<{ nomeArquivo: string; storedName: string; url: string }> {
  if (file.size <= 0) throw new Error("Arquivo vazio.");
  if (file.size > TAREFA_ANEXO_MAX_BYTES) throw new Error("Arquivo excede o limite de 15MB.");

  const nomeArquivo = file.name.trim() || "anexo";
  const storedName = storedNameForUpload(nomeArquivo);
  const dir = path.join(UPLOAD_ROOT, tarefaId);
  await mkdir(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(tarefaAnexoDiskPath(tarefaId, storedName), buf);

  return {
    nomeArquivo,
    storedName,
    url: tarefaAnexoPublicUrl(tarefaId, storedName),
  };
}

export async function readTarefaAnexo(
  tarefaId: string,
  storedName: string
): Promise<Buffer | null> {
  const safeName = safeStoredFileName(storedName);
  if (!safeName) return null;
  try {
    return await readFile(tarefaAnexoDiskPath(tarefaId, safeName));
  } catch {
    return null;
  }
}

export async function deleteTarefaAnexoFile(
  tarefaId: string,
  url: string | null | undefined
): Promise<void> {
  const storedName = storedNameFromAnexoUrl(url);
  if (!storedName) return;
  try {
    await unlink(tarefaAnexoDiskPath(tarefaId, storedName));
  } catch {
    /* ignore missing file */
  }
}

function displayNameFromStored(storedName: string): string {
  const dash = storedName.indexOf("-");
  if (dash <= 0) return storedName;
  return storedName.slice(dash + 1);
}

async function findStoredNameByDisplayName(
  tarefaId: string,
  nomeArquivo: string
): Promise<string | null> {
  const target = nomeArquivo.trim();
  if (!target) return null;
  try {
    const dir = path.join(UPLOAD_ROOT, tarefaId);
    const entries = await readdir(dir);
    const exact = entries.find((entry) => entry === target);
    if (exact) return exact;
    const suffix = entries.find(
      (entry) => entry === target || entry.endsWith(`-${target}`) || displayNameFromStored(entry) === target
    );
    return suffix ?? null;
  } catch {
    return null;
  }
}

export async function resolveTarefaAnexoForRead(
  tarefaId: string,
  nomeArquivo: string,
  urlFromDb?: string | null
): Promise<{ data: Buffer; contentType: string; storedName: string } | null> {
  const displayName = nomeArquivo.trim();
  if (!displayName) return null;

  const fromUrl = storedNameFromAnexoUrl(urlFromDb);
  if (fromUrl) {
    const data = await readTarefaAnexo(tarefaId, fromUrl);
    if (data) {
      return {
        data,
        contentType: contentTypeFromFileName(displayName),
        storedName: fromUrl,
      };
    }
  }

  const storedName = await findStoredNameByDisplayName(tarefaId, displayName);
  if (!storedName) return null;

  const data = await readTarefaAnexo(tarefaId, storedName);
  if (!data) return null;

  return {
    data,
    contentType: contentTypeFromFileName(displayName),
    storedName,
  };
}
