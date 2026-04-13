import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/server/api-response";
import { montarDocumentoHtmlCompleto, type DocumentoSnapshot } from "@/lib/documentos/documento-html";

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
  if (!modeloNome || !corpoHtml) return null;
  return {
    modeloNome,
    snapshot: { assunto, cabecalhoHtml, corpoHtml, rodapeHtml },
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
    select: { id: true, date: true, newValue: true },
  });
  if (!row) return fail("NOT_FOUND", "Documento gerado não encontrado.", 404);

  const parsed = parseSnapshot(row.newValue);
  if (!parsed) return fail("NOT_FOUND", "Snapshot do documento indisponível.", 404);

  const url = new URL(req.url);
  const download = url.searchParams.get("download") === "1";
  const autoPrint = url.searchParams.get("print") === "1";

  const html = montarDocumentoHtmlCompleto({
    title: parsed.snapshot.assunto || "Documento gerado",
    modeloNome: parsed.modeloNome,
    snapshot: parsed.snapshot,
    geradoEmIso: row.date.toISOString(),
    autoPrint,
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
