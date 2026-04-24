import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fail, ok } from "@/lib/server/api-response";
import {
  getDocumentoTimbresConfig,
  saveDocumentoTimbresConfig,
  type DocumentoTimbreItem,
} from "@/lib/documentos/timbres-config";
import { emptyEmpresaDocumentoConfig, normalizeEmpresaDocumentoConfig } from "@/lib/documentos/empresa-config-schema";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "documentos-timbres");
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

function extFromMime(mime: string): string {
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return ".jpg";
}

function apiUploadUrl(filename: string): string {
  return `/api/uploads/documentos-timbres/${filename}`;
}

function normalizeLegacyUploadUrl(raw: string): string {
  const v = String(raw ?? "").trim();
  if (!v) return "";
  if (v.startsWith("/uploads/documentos-timbres/")) {
    const filename = v.slice("/uploads/documentos-timbres/".length);
    return apiUploadUrl(filename);
  }
  return v;
}

export async function GET() {
  try {
    const config = await getDocumentoTimbresConfig();
    const timbres = config.items.map((item) => ({
      ...item,
      url: normalizeLegacyUploadUrl(item.url),
      renderConfig: {
        ...item.renderConfig,
        papelTimbradoUrl: normalizeLegacyUploadUrl(item.renderConfig.papelTimbradoUrl),
      },
    }));
    return ok({ timbres });
  } catch {
    return fail("INTERNAL_ERROR", "Não foi possível carregar os papéis timbrados.", 500);
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("arquivo");
    if (!(file instanceof File)) {
      return fail("BAD_REQUEST", "Envie o arquivo do timbrado.", 400);
    }
    if (!ALLOWED.has(file.type)) {
      return fail("BAD_REQUEST", "Formato inválido. Use PNG, JPG ou WEBP.", 400);
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return fail("BAD_REQUEST", "Arquivo inválido. Limite de 8MB.", 400);
    }
    const nomeRaw = String(form.get("nome") ?? "").trim();
    const ativoRaw = String(form.get("ativo") ?? "").trim().toLowerCase();
    const renderConfigRaw = String(form.get("renderConfig") ?? "").trim();
    let parsedRenderConfig: unknown = null;
    if (renderConfigRaw) {
      try {
        parsedRenderConfig = JSON.parse(renderConfigRaw);
      } catch {
        return fail("BAD_REQUEST", "Configuração de layout inválida.", 400);
      }
    }
    const id = randomUUID();
    const ext = extFromMime(file.type);
    const filename = `${id}${ext}`;
    const finalPath = path.join(UPLOAD_DIR, filename);
    await mkdir(UPLOAD_DIR, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(finalPath, buf);
    const base = emptyEmpresaDocumentoConfig();
    const merged = normalizeEmpresaDocumentoConfig({
      ...base,
      ...(parsedRenderConfig ?? {}),
      layoutModo: parsedRenderConfig && typeof parsedRenderConfig === "object" ? (parsedRenderConfig as Record<string, unknown>).layoutModo : "background",
      papelTimbradoUrl:
        parsedRenderConfig && typeof parsedRenderConfig === "object"
          ? (parsedRenderConfig as Record<string, unknown>).papelTimbradoUrl
          : apiUploadUrl(filename),
    });
    const item: DocumentoTimbreItem = {
      id,
      nome: nomeRaw || file.name || `Timbrado ${new Date().toLocaleDateString("pt-BR")}`,
      url: apiUploadUrl(filename),
      createdAt: new Date().toISOString(),
      ativo: ativoRaw ? ativoRaw === "true" || ativoRaw === "1" : true,
      renderConfig: {
        layoutModo: merged.layoutModo,
        papelTimbradoOpacity: merged.papelTimbradoOpacity,
        margemTopMm: merged.margemTopMm,
        margemRightMm: merged.margemRightMm,
        margemBottomMm: merged.margemBottomMm,
        margemLeftMm: merged.margemLeftMm,
        headerHeightMm: merged.headerHeightMm,
        footerHeightMm: merged.footerHeightMm,
        cabecalhoPadraoHtml: merged.cabecalhoPadraoHtml,
        rodapePadraoHtml: merged.rodapePadraoHtml,
        papelTimbradoUrl: normalizeLegacyUploadUrl(String(merged.papelTimbradoUrl ?? "")) || apiUploadUrl(filename),
      },
    };
    const config = await getDocumentoTimbresConfig();
    config.items = [item, ...config.items];
    await saveDocumentoTimbresConfig(config);
    return ok({ timbre: item }, 201);
  } catch {
    return fail("INTERNAL_ERROR", "Não foi possível enviar o papel timbrado.", 500);
  }
}

