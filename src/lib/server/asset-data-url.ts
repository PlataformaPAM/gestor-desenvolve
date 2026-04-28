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
      const diskPath = path.join(process.cwd(), "uploads", "documentos-timbres", filename);
      const file = await readFile(diskPath);
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
      const diskPath = path.join(process.cwd(), "public", pathname);
      const file = await readFile(diskPath);
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
