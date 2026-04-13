import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/server/api-response";
import { montarDocumentoHtmlCompleto, type DocumentoSnapshot } from "@/lib/documentos/documento-html";
import { renderHtmlToPdfBuffer } from "@/lib/server/html-to-pdf";

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

  const title = parsed.snapshot.assunto?.trim() ? parsed.snapshot.assunto.trim() : "Documento gerado";
  const html = montarDocumentoHtmlCompleto({
    title,
    modeloNome: parsed.modeloNome,
    snapshot: parsed.snapshot,
    geradoEmIso: row.date.toISOString(),
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
