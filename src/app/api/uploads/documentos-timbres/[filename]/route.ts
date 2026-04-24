import { readFile } from "node:fs/promises";
import path from "node:path";

function contentTypeFromExt(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/png";
}

function safeFileName(raw: string): string | null {
  const name = String(raw ?? "").trim();
  if (!name) return null;
  if (name.includes("/") || name.includes("\\") || name.includes("..")) return null;
  return name;
}

export async function GET(_req: Request, ctx: { params: Promise<{ filename: string }> }) {
  const { filename: raw } = await ctx.params;
  const filename = safeFileName(raw);
  if (!filename) return new Response("Arquivo inválido.", { status: 400 });

  const candidates = [
    path.join(process.cwd(), "uploads", "documentos-timbres", filename),
    path.join(process.cwd(), "public", "uploads", "documentos-timbres", filename),
    path.join(process.cwd(), ".next", "standalone", "public", "uploads", "documentos-timbres", filename),
  ];

  for (const filePath of candidates) {
    try {
      const data = await readFile(filePath);
      return new Response(new Uint8Array(data), {
        status: 200,
        headers: {
          "Content-Type": contentTypeFromExt(filename),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      // tenta próximo caminho
    }
  }

  return new Response("Arquivo não encontrado.", { status: 404 });
}

