import { fail, parseJsonSafe } from "@/lib/server/api-response";
import { montarDocumentoHtmlCompleto } from "@/lib/documentos/documento-html";
import { renderHtmlToPdfBuffer } from "@/lib/server/html-to-pdf";
import { buildComercialSnapshot } from "@/lib/relatorios/comercial";
import type { ComercialReportId, ComercialSituacao } from "@/lib/relatorios/comercial-catalogo";
import { absolutizeAssetUrl, toDataUrlIfPossible } from "@/lib/server/asset-data-url";

type Body = {
  reportId?: ComercialReportId;
  modeloId?: string;
  periodoInicio?: string;
  periodoFim?: string;
  situacao?: ComercialSituacao;
};

export async function POST(req: Request) {
  const parsed = await parseJsonSafe<Body>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const reportId = parsed.value.reportId;
  const modeloId = parsed.value.modeloId?.trim();
  const periodoInicio = parsed.value.periodoInicio?.trim();
  const periodoFim = parsed.value.periodoFim?.trim();
  if (!reportId || !modeloId || !periodoInicio || !periodoFim) {
    return fail("BAD_REQUEST", "Informe tipo do relatório, modelo e período.", 400);
  }
  try {
    const report = await buildComercialSnapshot({
      reportId,
      modeloId,
      periodoInicio,
      periodoFim,
      situacao: parsed.value.situacao,
    });
    const timbreAbs = absolutizeAssetUrl(report.snapshot.timbreUrl ?? "", req.url);
    const timbreUrl = await toDataUrlIfPossible(timbreAbs);
    const renderCfgRaw = report.snapshot.renderConfig
      ? { ...report.snapshot.renderConfig }
      : timbreUrl || timbreAbs
        ? {}
        : undefined;
    const renderCfgAbs = absolutizeAssetUrl(String(renderCfgRaw?.papelTimbradoUrl ?? ""), req.url);
    const renderCfgDataUrl = await toDataUrlIfPossible(renderCfgAbs);
    const renderConfig = renderCfgRaw
      ? {
          ...renderCfgRaw,
          papelTimbradoUrl: renderCfgDataUrl || timbreUrl || renderCfgAbs || timbreAbs,
        }
      : undefined;
    if (
      renderConfig &&
      (renderConfig.layoutModo === undefined || renderConfig.layoutModo === "none") &&
      (renderConfig.papelTimbradoUrl || timbreUrl)
    ) {
      renderConfig.layoutModo = "background";
    }
    const html = montarDocumentoHtmlCompleto({
      title: `Relatório - ${report.resumo.reportTitulo}`,
      modeloNome: report.modeloNome,
      snapshot: {
        ...report.snapshot,
        timbreUrl,
        renderConfig,
      },
      geradoEmIso: new Date().toISOString(),
    });
    const pdf = await renderHtmlToPdfBuffer(html);
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="relatorio-comercial-${Date.now()}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao montar relatório.";
    if (message.includes("não encontrado")) return fail("NOT_FOUND", message, 404);
    return fail("BAD_REQUEST", message, 400);
  }
}
