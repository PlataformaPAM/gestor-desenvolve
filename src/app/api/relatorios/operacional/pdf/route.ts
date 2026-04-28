import { fail, parseJsonSafe } from "@/lib/server/api-response";
import { montarDocumentoHtmlCompleto } from "@/lib/documentos/documento-html";
import { renderHtmlToPdfBuffer } from "@/lib/server/html-to-pdf";
import { buildOperacionalSnapshot } from "@/lib/relatorios/operacional";
import type { OperacionalReportId, OperacionalSituacao } from "@/lib/relatorios/operacional-catalogo";
import { absolutizeAssetUrl, toDataUrlIfPossible } from "@/lib/server/asset-data-url";

type Body = {
  reportId?: OperacionalReportId;
  clienteId?: string;
  modeloId?: string;
  periodoInicio?: string;
  periodoFim?: string;
  situacao?: OperacionalSituacao;
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
    const report = await buildOperacionalSnapshot({
      reportId,
      clienteId: parsed.value.clienteId?.trim() || undefined,
      modeloId,
      periodoInicio,
      periodoFim,
      situacao: parsed.value.situacao,
    });
    const timbreAbs = absolutizeAssetUrl(report.snapshot.timbreUrl ?? "", req.url);
    const timbreUrl = await toDataUrlIfPossible(timbreAbs);
    const renderConfig = report.snapshot.renderConfig
      ? {
          ...report.snapshot.renderConfig,
          papelTimbradoUrl: await toDataUrlIfPossible(
            absolutizeAssetUrl(report.snapshot.renderConfig.papelTimbradoUrl ?? "", req.url) || timbreAbs
          ),
        }
      : undefined;
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
        "Content-Disposition": `attachment; filename="relatorio-operacional-${Date.now()}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao montar relatório.";
    if (message.includes("não encontrado")) return fail("NOT_FOUND", message, 404);
    return fail("BAD_REQUEST", message, 400);
  }
}
