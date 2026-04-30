import { readFile } from "node:fs/promises";
import path from "node:path";

export function absolutizeAssetUrl(rawUrl: string, requestUrl: string): string {
  const value = String(rawUrl ?? "").trim();
  if (!value) return "";
  if (/^data:/i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) return value;
  try {
    const base = new URL(requestUrl);
    return new URL(value.startsWith("/") ? value : `/${value}`, base.origin).toString();
  } catch {
    return value;
  }
}

export async function toDataUrlIfPossible(assetUrl: string): Promise<string> {
  const url = String(assetUrl ?? "").trim();
  if (!url) return "";
  if (/^data:/i.test(url)) return url;

  try {
    const parsed = new URL(url);
    const pathname = decodeURIComponent(parsed.pathname || "");
    if (pathname.startsWith("/api/uploads/documentos-timbres/")) {
      const filename = pathname.slice("/api/uploads/documentos-timbres/".length);
      const candidates = [
        path.join(process.cwd(), "uploads", "documentos-timbres", filename),
        path.join(process.cwd(), "public", "uploads", "documentos-timbres", filename),
      ];
      let file: Buffer | null = null;
      let diskPath = "";
      for (const p of candidates) {
        try {
          file = await readFile(p);
          diskPath = p;
          break;
        } catch {
          // tenta próximo caminho
        }
      }
      if (!file || !diskPath) return url;
      const ext = path.extname(diskPath).toLowerCase();
      const mime =
        ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".webp"
            ? "image/webp"
            : ext === ".gif"
              ? "image/gif"
              : "image/png";
      return `data:${mime};base64,${file.toString("base64")}`;
    }
    if (pathname.startsWith("/uploads/")) {
      const rel = pathname.replace(/^\/+/, "");
      const candidates = [
        path.join(process.cwd(), "public", rel),
        path.join(process.cwd(), rel),
      ];
      let file: Buffer | null = null;
      let diskPath = "";
      for (const p of candidates) {
        try {
          file = await readFile(p);
          diskPath = p;
          break;
        } catch {
          // tenta próximo caminho
        }
      }
      if (!file || !diskPath) return url;
      const ext = path.extname(diskPath).toLowerCase();
      const mime =
        ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".webp"
            ? "image/webp"
            : ext === ".gif"
              ? "image/gif"
              : "image/png";
      return `data:${mime};base64,${file.toString("base64")}`;
    }
  } catch {
    // fallback para tentativa de fetch
  }

  try {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) return url;
    const ab = await resp.arrayBuffer();
    const contentType = resp.headers.get("content-type")?.trim() || "image/png";
    const base64 = Buffer.from(ab).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    return url;
  }
}
