import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { CONFIG_RESOURCES, configuracoesAccessGate } from "@/lib/server/configuracoes-access";
import {
  getDocumentoTimbresConfig,
  saveDocumentoTimbresConfig,
  type DocumentoTimbreRenderConfig,
} from "@/lib/documentos/timbres-config";
import { normalizeEmpresaDocumentoConfig } from "@/lib/documentos/empresa-config-schema";

type PatchBody = { nome?: string; ativo?: boolean; renderConfig?: Partial<DocumentoTimbreRenderConfig> };
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

function resolveStoredPath(uploadUrl: string): string {
  const clean = normalizeLegacyUploadUrl(uploadUrl);
  const marker = "/api/uploads/documentos-timbres/";
  const oldMarker = "/uploads/documentos-timbres/";
  if (clean.startsWith(marker)) {
    const filename = clean.slice(marker.length);
    return path.join(process.cwd(), "uploads", "documentos-timbres", filename);
  }
  if (clean.startsWith(oldMarker)) {
    const filename = clean.slice(oldMarker.length);
    return path.join(process.cwd(), "public", "uploads", "documentos-timbres", filename);
  }
  const relative = clean.startsWith("/") ? clean.slice(1) : clean;
  return path.join(process.cwd(), "public", relative);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await configuracoesAccessGate(req, CONFIG_RESOURCES.papeisTimbrados, "editar");
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!id?.trim()) return fail("BAD_REQUEST", "Id inválido.", 400);
  const contentType = req.headers.get("content-type") || "";
  let nome: string | undefined;
  let ativo: boolean | undefined;
  let renderConfig: Partial<DocumentoTimbreRenderConfig> | undefined;
  let file: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const nomeRaw = String(form.get("nome") ?? "").trim();
    nome = nomeRaw || undefined;
    const ativoRaw = String(form.get("ativo") ?? "").trim().toLowerCase();
    if (ativoRaw) ativo = ativoRaw === "true" || ativoRaw === "1";
    const rcRaw = String(form.get("renderConfig") ?? "").trim();
    if (rcRaw) {
      try {
        renderConfig = JSON.parse(rcRaw) as Partial<DocumentoTimbreRenderConfig>;
      } catch {
        return fail("BAD_REQUEST", "Configuração de layout inválida.", 400);
      }
    }
    const maybeFile = form.get("arquivo");
    if (maybeFile instanceof File) file = maybeFile;
  } else {
    const parsed = await parseJsonSafe<PatchBody>(req);
    if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
    nome = parsed.value.nome?.trim();
    ativo = typeof parsed.value.ativo === "boolean" ? parsed.value.ativo : undefined;
    renderConfig = parsed.value.renderConfig;
  }

  const hasNome = nome !== undefined;
  const hasAtivo = ativo !== undefined;
  const hasRenderConfig = renderConfig != null;
  const hasFile = file instanceof File;
  const fileToProcess = hasFile ? file : null;
  if (!hasNome && !hasAtivo && !hasRenderConfig) {
    if (!hasFile) return fail("BAD_REQUEST", "Informe nome, status e/ou configurações do timbrado.", 400);
  }
  if (hasNome && !nome?.trim()) return fail("BAD_REQUEST", "Informe o nome do timbrado.", 400);
  if (fileToProcess) {
    if (!ALLOWED.has(fileToProcess.type)) return fail("BAD_REQUEST", "Formato inválido. Use PNG, JPG ou WEBP.", 400);
    if (fileToProcess.size <= 0 || fileToProcess.size > MAX_BYTES)
      return fail("BAD_REQUEST", "Arquivo inválido. Limite de 8MB.", 400);
  }

  try {
    const config = await getDocumentoTimbresConfig();
    const target = config.items.find((x) => x.id === id);
    if (!target) return fail("NOT_FOUND", "Papel timbrado não encontrado.", 404);
    if (hasNome && nome) target.nome = nome;
    if (hasAtivo) target.ativo = Boolean(ativo);
    if (fileToProcess) {
      const ext = extFromMime(fileToProcess.type);
      const filename = `${randomUUID()}${ext}`;
      const finalPath = path.join(UPLOAD_DIR, filename);
      await mkdir(UPLOAD_DIR, { recursive: true });
      const buf = Buffer.from(await fileToProcess.arrayBuffer());
      await writeFile(finalPath, buf);
      const oldUrl = target.url;
      target.url = apiUploadUrl(filename);
      if (!hasRenderConfig && target.renderConfig.papelTimbradoUrl === oldUrl) {
        target.renderConfig.papelTimbradoUrl = target.url;
      }
      const oldPath = resolveStoredPath(oldUrl);
      await unlink(oldPath).catch(() => {});
    }
    if (hasRenderConfig) {
      const merged = normalizeEmpresaDocumentoConfig({
        ...target.renderConfig,
        ...(renderConfig ?? {}),
      });
      target.renderConfig = {
        layoutModo: merged.layoutModo,
        papelTimbradoUrl: normalizeLegacyUploadUrl(String(merged.papelTimbradoUrl ?? "")) || target.url,
        papelTimbradoOpacity: merged.papelTimbradoOpacity,
        margemTopMm: merged.margemTopMm,
        margemRightMm: merged.margemRightMm,
        margemBottomMm: merged.margemBottomMm,
        margemLeftMm: merged.margemLeftMm,
        headerHeightMm: merged.headerHeightMm,
        footerHeightMm: merged.footerHeightMm,
        cabecalhoPadraoHtml: merged.cabecalhoPadraoHtml,
        rodapePadraoHtml: merged.rodapePadraoHtml,
      };
    }
    await saveDocumentoTimbresConfig(config);
    return ok({ timbre: target });
  } catch {
    return fail("INTERNAL_ERROR", "Não foi possível atualizar o papel timbrado.", 500);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await configuracoesAccessGate(req, CONFIG_RESOURCES.papeisTimbrados, "excluir");
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!id?.trim()) return fail("BAD_REQUEST", "Id inválido.", 400);

  try {
    const config = await getDocumentoTimbresConfig();
    const existing = config.items.find((x) => x.id === id);
    if (!existing) return fail("NOT_FOUND", "Papel timbrado não encontrado.", 404);

    config.items = config.items.filter((x) => x.id !== id);
    for (const [modeloId, timbreId] of Object.entries(config.modeloTimbreById)) {
      if (timbreId === id) delete config.modeloTimbreById[modeloId];
    }
    await saveDocumentoTimbresConfig(config);

    const filePath = resolveStoredPath(existing.url);
    await unlink(filePath).catch(() => {});

    return ok({ removed: true });
  } catch {
    return fail("INTERNAL_ERROR", "Não foi possível remover o papel timbrado.", 500);
  }
}

