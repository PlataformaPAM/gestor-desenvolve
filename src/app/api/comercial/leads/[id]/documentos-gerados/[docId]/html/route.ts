import { prisma } from "@/lib/prisma";
import { comercialAccessGate } from "@/lib/server/comercial-lead-access";
import { fail } from "@/lib/server/api-response";
import { montarDocumentoHtmlCompleto, type DocumentoSnapshot } from "@/lib/documentos/documento-html";
import { getEmpresaDocumentoConfig } from "@/lib/documentos/empresa-config";

function parseSnapshot(newValue: unknown): { modeloNome: string; snapshot: DocumentoSnapshot } | null {
  if (!newValue || typeof newValue !== "object") return null;
  const root = newValue as Record<string, unknown>;
  const modelo = (root.modelo ?? null) as Record<string, unknown> | null;
  const documento = (root.documento ?? null) as Record<string, unknown> | null;
  if (!modelo || !documento) return null;
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
    modeloNome,
    snapshot: { assunto, cabecalhoHtml, corpoHtml, rodapeHtml, timbreUrl, renderConfig },
  };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string; docId: string }> }) {
  const { id: leadId, docId } = await ctx.params;
  const gate = await comercialAccessGate(req, "ver", leadId);
  if (!gate.ok) return gate.response;
  const row = await prisma.leadInteraction.findFirst({
    where: {
      id: docId,
      leadId,
      type: "proposta",
      field: "documentoModelo",
    },
    select: { id: true, date: true, newValue: true },
  });
  if (!row) return fail("NOT_FOUND", "Documento gerado não encontrado.", 404);

  const parsed = parseSnapshot(row.newValue);
  if (!parsed) return fail("NOT_FOUND", "Snapshot do documento indisponível.", 404);

  const url = new URL(req.url);
  const download = url.searchParams.get("download") === "1";
  const autoPrint = url.searchParams.get("print") === "1";
  const empresaConfig = await getEmpresaDocumentoConfig();

  const html = montarDocumentoHtmlCompleto({
    title: parsed.snapshot.assunto || "Documento gerado",
    modeloNome: parsed.modeloNome,
    snapshot: parsed.snapshot,
    geradoEmIso: row.date.toISOString(),
    autoPrint,
    renderConfig: empresaConfig,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": download
        ? `attachment; filename=\"documento-${row.id}.html\"`
        : `inline; filename=\"documento-${row.id}.html\"`,
      "Cache-Control": "no-store",
    },
  });
}
