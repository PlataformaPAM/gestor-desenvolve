import { fail, parseJsonSafe } from "@/lib/server/api-response";
import { montarDocumentoHtmlCompleto } from "@/lib/documentos/documento-html";
import { renderHtmlToPdfBuffer } from "@/lib/server/html-to-pdf";
import { buildPrestacaoContasSnapshot } from "@/lib/relatorios/prestacao-contas";
import { absolutizeAssetUrl, toDataUrlIfPossible } from "@/lib/server/asset-data-url";

type Body = {
  clienteId?: string;
  modeloId?: string;
  periodoInicio?: string;
  periodoFim?: string;
};

export async function POST(req: Request) {
  const parsed = await parseJsonSafe<Body>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const clienteId = parsed.value.clienteId?.trim();
  const modeloId = parsed.value.modeloId?.trim();
  const periodoInicio = parsed.value.periodoInicio?.trim();
  const periodoFim = parsed.value.periodoFim?.trim();
  if (!clienteId || !modeloId || !periodoInicio || !periodoFim) {
    return fail("BAD_REQUEST", "Informe cliente, modelo e período.", 400);
  }

  let report;
  try {
    report = await buildPrestacaoContasSnapshot({ clienteId, modeloId, periodoInicio, periodoFim });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao montar relatório.";
    if (message.includes("não encontrado")) return fail("NOT_FOUND", message, 404);
    return fail("BAD_REQUEST", message, 400);
  }

  const timbreAbs = absolutizeAssetUrl(report.snapshot.timbreUrl ?? "", req.url);
  const timbreUrl = await toDataUrlIfPossible(timbreAbs);
  const renderConfig = report.snapshot.renderConfig
    ? {
        ...report.snapshot.renderConfig,
        papelTimbradoUrl: await toDataUrlIfPossible(
          absolutizeAssetUrl(report.snapshot.renderConfig.papelTimbradoUrl ?? "", req.url) || timbreAbs
        ),
      }
    : null;

  const html = montarDocumentoHtmlCompleto({
    title: `Relatório - ${report.resumo.cliente}`,
    modeloNome: report.modeloNome,
    snapshot: {
      ...report.snapshot,
      timbreUrl,
      renderConfig,
    },
    geradoEmIso: new Date().toISOString(),
  });

  let pdf: Buffer;
  try {
    pdf = await renderHtmlToPdfBuffer(html);
  } catch {
    return fail("INTERNAL_ERROR", "Não foi possível gerar o PDF no servidor.", 500);
  }

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="relatorio-${Date.now()}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
