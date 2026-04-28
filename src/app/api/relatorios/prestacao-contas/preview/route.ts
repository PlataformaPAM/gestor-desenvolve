import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { montarDocumentoHtmlCompleto } from "@/lib/documentos/documento-html";
import { buildPrestacaoContasSnapshot } from "@/lib/relatorios/prestacao-contas";

type Body = {
  clienteId?: string;
  modeloId?: string;
  periodoInicio?: string;
  periodoFim?: string;
};

function absolutizeAssetUrl(rawUrl: string, requestUrl: string): string {
  const value = rawUrl?.trim();
  if (!value) return "";
  if (/^data:/i.test(value)) return value;
  try {
    return new URL(value, requestUrl).toString();
  } catch {
    return value;
  }
}

export async function POST(req: Request) {
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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao montar relatório.";
    if (message.includes("não encontrado")) return fail("NOT_FOUND", message, 404);
    return fail("BAD_REQUEST", message, 400);
  }

  const timbreUrl = absolutizeAssetUrl(report.snapshot.timbreUrl ?? "", req.url);
  const renderConfig = report.snapshot.renderConfig
    ? {
        ...report.snapshot.renderConfig,
        papelTimbradoUrl:
          absolutizeAssetUrl(report.snapshot.renderConfig.papelTimbradoUrl ?? "", req.url) || timbreUrl,
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
    autoPrint: false,
  });

  return ok({
    html,
    resumo: report.resumo,
  });
}
