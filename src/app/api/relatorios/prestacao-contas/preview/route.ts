import {
  relatorioAccessFromGate,
  relatoriosAccessGate,
  RELATORIOS_PRESTACAO_CONTAS_RESOURCE,
} from "@/lib/server/relatorios-access";
import { RelatorioForbiddenError } from "@/lib/server/relatorio-scope";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { montarDocumentoHtmlCompleto } from "@/lib/documentos/documento-html";
import { buildPrestacaoContasSnapshot } from "@/lib/relatorios/prestacao-contas";
import { absolutizeAssetUrl, toDataUrlIfPossible } from "@/lib/server/asset-data-url";

type Body = {
  clienteId?: string;
  modeloId?: string;
  periodoInicio?: string;
  periodoFim?: string;
};

export async function POST(req: Request) {
  const gate = await relatoriosAccessGate(req, RELATORIOS_PRESTACAO_CONTAS_RESOURCE, "ver");
  if (!gate.ok) return gate.response;


  const parsed = await parseJsonSafe<Body>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const clienteId = parsed.value.clienteId?.trim();
  const modeloId = parsed.value.modeloId?.trim();
  if (!clienteId || !modeloId || !parsed.value.periodoInicio || !parsed.value.periodoFim) {
    return fail("BAD_REQUEST", "Informe cliente, modelo e período.", 400);
  }
  let report;
  try {
    report = await buildPrestacaoContasSnapshot({
      clienteId,
      modeloId,
      periodoInicio: parsed.value.periodoInicio,
      periodoFim: parsed.value.periodoFim,
      access: relatorioAccessFromGate(gate, RELATORIOS_PRESTACAO_CONTAS_RESOURCE),
    });
  } catch (error) {
    if (error instanceof RelatorioForbiddenError) return fail("FORBIDDEN", error.message, 403);
    const message = error instanceof Error ? error.message : "Falha ao montar relatório.";
    if (message.includes("não encontrado")) return fail("NOT_FOUND", message, 404);
    return fail("BAD_REQUEST", message, 400);
  }

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
    title: `Relatório - ${report.resumo.cliente}`,
    modeloNome: report.modeloNome,
    snapshot: {
      ...report.snapshot,
      timbreUrl,
      renderConfig,
    },
    geradoEmIso: new Date().toISOString(),
    autoPrint: false,
  });

  return ok({
    html,
    resumo: report.resumo,
  });
}
