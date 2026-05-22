import {
  relatorioAccessFromGate,
  relatoriosAccessGate,
  RELATORIOS_FINANCEIRO_RESOURCE,
} from "@/lib/server/relatorios-access";
import { RelatorioForbiddenError } from "@/lib/server/relatorio-scope";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { montarDocumentoHtmlCompleto } from "@/lib/documentos/documento-html";
import { buildFinanceiroSnapshot } from "@/lib/relatorios/financeiro";
import type { FinanceiroReportId, FinanceiroSituacao, FinanceiroTipo } from "@/lib/relatorios/financeiro-catalogo";
import { absolutizeAssetUrl, toDataUrlIfPossible } from "@/lib/server/asset-data-url";

type Body = {
  reportId?: FinanceiroReportId;
  clienteId?: string;
  modeloId?: string;
  periodoInicio?: string;
  periodoFim?: string;
  situacao?: FinanceiroSituacao;
  tipo?: FinanceiroTipo;
};

export async function POST(req: Request) {
  const gate = await relatoriosAccessGate(req, RELATORIOS_FINANCEIRO_RESOURCE, "ver");
  if (!gate.ok) return gate.response;


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
    const report = await buildFinanceiroSnapshot({
      reportId,
      clienteId: parsed.value.clienteId?.trim() || undefined,
      modeloId,
      periodoInicio,
      periodoFim,
      situacao: parsed.value.situacao,
      tipo: parsed.value.tipo,
      access: relatorioAccessFromGate(gate, RELATORIOS_FINANCEIRO_RESOURCE),
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
      autoPrint: false,
    });
    return ok({ html, resumo: report.resumo });
  } catch (error) {
    if (error instanceof RelatorioForbiddenError) return fail("FORBIDDEN", error.message, 403);
    const message = error instanceof Error ? error.message : "Falha ao montar relatório.";
    if (message.includes("não encontrado")) return fail("NOT_FOUND", message, 404);
    return fail("BAD_REQUEST", message, 400);
  }
}
