import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/server/api-response";
import { montarDocumentoHtmlCompleto, type DocumentoSnapshot } from "@/lib/documentos/documento-html";
import { renderHtmlToPdfBuffer } from "@/lib/server/html-to-pdf";
import { getEmpresaDocumentoConfig } from "@/lib/documentos/empresa-config";
import { getDocumentoTimbresConfig } from "@/lib/documentos/timbres-config";
import { readFile } from "node:fs/promises";
import path from "node:path";

function absolutizeAssetUrl(raw: string, reqUrl: string): string {
  const v = String(raw ?? "").trim();
  if (!v) return "";
  if (/^data:/i.test(v)) return v;
  if (/^https?:\/\//i.test(v)) return v;
  const base = new URL(reqUrl);
  return new URL(v.startsWith("/") ? v : `/${v}`, base.origin).toString();
}

async function toDataUrlIfPossible(assetUrl: string): Promise<string> {
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
    // fallback para fetch
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

function parseSnapshot(newValue: unknown): { modeloId: string; modeloNome: string; snapshot: DocumentoSnapshot } | null {
  if (!newValue || typeof newValue !== "object") return null;
  const root = newValue as Record<string, unknown>;
  const modelo = (root.modelo ?? null) as Record<string, unknown> | null;
  const documento = (root.documento ?? null) as Record<string, unknown> | null;
  if (!modelo || !documento) return null;
  const modeloId = typeof modelo.id === "string" ? modelo.id : "";
  const modeloNome = typeof modelo.nome === "string" ? modelo.nome : "";
  const assunto = typeof documento.assunto === "string" ? documento.assunto : "";
  const cabecalhoHtml = typeof documento.cabecalhoHtml === "string" ? documento.cabecalhoHtml : "";
  const corpoHtml = typeof documento.corpoHtml === "string" ? documento.corpoHtml : "";
  const rodapeHtml = typeof documento.rodapeHtml === "string" ? documento.rodapeHtml : "";
  const timbreUrl = typeof documento.timbreUrl === "string" ? documento.timbreUrl : "";
  const renderConfig =
    documento.renderConfig && typeof documento.renderConfig === "object"
      ? (documento.renderConfig as Record<string, unknown>)
      : undefined;
  if (!modeloNome || !corpoHtml) return null;
  return {
    modeloId,
    modeloNome,
    snapshot: { assunto, cabecalhoHtml, corpoHtml, rodapeHtml, timbreUrl, renderConfig },
  };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string; docId: string }> }) {
  const { id: leadId, docId } = await ctx.params;
  const row = await prisma.leadInteraction.findFirst({
    where: {
      id: docId,
      leadId,
      type: "proposta",
      field: "documentoModelo",
    },
    select: { id: true, date: true, newValue: true, fieldKey: true },
  });
  if (!row) return fail("NOT_FOUND", "Documento gerado não encontrado.", 404);

  const parsed = parseSnapshot(row.newValue);
  if (!parsed) return fail("NOT_FOUND", "Snapshot do documento indisponível.", 404);
  const snapshot = parsed.snapshot;
  const modeloIdEfetivo = parsed.modeloId || String(row.fieldKey ?? "").trim();
  const timbresConfig = await getDocumentoTimbresConfig();
  const timbreIdByModelo = modeloIdEfetivo ? timbresConfig.modeloTimbreById[modeloIdEfetivo] ?? "" : "";
  const timbreByModelo = timbreIdByModelo ? timbresConfig.items.find((x) => x.id === timbreIdByModelo) : null;
  const timbreRaw = snapshot.timbreUrl?.trim() || timbreByModelo?.url?.trim() || "";
  const timbreAbs = absolutizeAssetUrl(timbreRaw, req.url);
  const timbreDataUrl = await toDataUrlIfPossible(timbreAbs);
  const renderConfigRaw =
    snapshot.renderConfig && typeof snapshot.renderConfig === "object"
      ? (snapshot.renderConfig as { papelTimbradoUrl?: unknown } & Record<string, unknown>)
      : null;
  const renderCfgRawUrl =
    String(renderConfigRaw?.papelTimbradoUrl ?? "").trim() || timbreByModelo?.renderConfig?.papelTimbradoUrl?.trim() || "";
  const renderCfgAbs = absolutizeAssetUrl(renderCfgRawUrl, req.url);
  const renderCfgDataUrl = await toDataUrlIfPossible(renderCfgAbs);
  const renderConfig =
    snapshot.renderConfig && typeof snapshot.renderConfig === "object"
      ? { ...snapshot.renderConfig }
      : timbreByModelo?.renderConfig
        ? { ...timbreByModelo.renderConfig }
        : undefined;
  if (renderConfig && typeof renderConfig === "object") {
    (renderConfig as { papelTimbradoUrl?: string }).papelTimbradoUrl = renderCfgDataUrl || timbreDataUrl || renderCfgAbs || timbreAbs;
    const layoutAtual = String((renderConfig as { layoutModo?: unknown }).layoutModo ?? "").trim();
    if ((layoutAtual === "" || layoutAtual === "none") && ((renderConfig as { papelTimbradoUrl?: string }).papelTimbradoUrl || timbreDataUrl || timbreAbs)) {
      (renderConfig as { layoutModo?: string }).layoutModo = "background";
    }
  }

  const empresaConfig = await getEmpresaDocumentoConfig();
  const title = parsed.snapshot.assunto?.trim() ? parsed.snapshot.assunto.trim() : "Documento gerado";
  const html = montarDocumentoHtmlCompleto({
    title,
    modeloNome: parsed.modeloNome,
    snapshot: {
      ...snapshot,
      timbreUrl: timbreDataUrl || timbreAbs,
      renderConfig: renderConfig ?? undefined,
    },
    geradoEmIso: row.date.toISOString(),
    renderConfig: empresaConfig,
  });

  let pdf: Buffer;
  try {
    pdf = await renderHtmlToPdfBuffer(html);
  } catch {
    return fail(
      "INTERNAL_ERROR",
      "Não foi possível gerar o PDF no servidor. Verifique os logs ou tente novamente.",
      500
    );
  }

  const url = new URL(req.url);
  const download = url.searchParams.get("download") === "1";
  const filename = `documento-${row.id}.pdf`;

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": download ? `attachment; filename="${filename}"` : `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
