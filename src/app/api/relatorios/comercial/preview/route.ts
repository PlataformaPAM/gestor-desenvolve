import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { montarDocumentoHtmlCompleto } from "@/lib/documentos/documento-html";
import { buildComercialSnapshot } from "@/lib/relatorios/comercial";
import type { ComercialReportId, ComercialSituacao } from "@/lib/relatorios/comercial-catalogo";
import { absolutizeAssetUrl } from "@/lib/server/asset-data-url";

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
    const timbreUrl = absolutizeAssetUrl(report.snapshot.timbreUrl ?? "", req.url);
    const renderConfig = report.snapshot.renderConfig
      ? {
          ...report.snapshot.renderConfig,
          papelTimbradoUrl:
            absolutizeAssetUrl(report.snapshot.renderConfig.papelTimbradoUrl ?? "", req.url) || timbreUrl,
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
      autoPrint: false,
    });
    return ok({ html, resumo: report.resumo });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao montar relatório.";
    if (message.includes("não encontrado")) return fail("NOT_FOUND", message, 404);
    return fail("BAD_REQUEST", message, 400);
  }
}
