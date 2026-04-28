import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { montarDocumentoHtmlCompleto } from "@/lib/documentos/documento-html";
import { renderHtmlToPdfBuffer } from "@/lib/server/html-to-pdf";
import { sendDocumentoEmail } from "@/lib/server/documento-email";
import { buildFinanceiroSnapshot } from "@/lib/relatorios/financeiro";
import type { FinanceiroReportId, FinanceiroSituacao, FinanceiroTipo } from "@/lib/relatorios/financeiro-catalogo";

type Body = {
  reportId?: FinanceiroReportId;
  clienteId?: string;
  modeloId?: string;
  periodoInicio?: string;
  periodoFim?: string;
  situacao?: FinanceiroSituacao;
  tipo?: FinanceiroTipo;
  toEmail?: string;
};

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request) {
  const parsed = await parseJsonSafe<Body>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const reportId = parsed.value.reportId;
  const modeloId = parsed.value.modeloId?.trim();
  const periodoInicio = parsed.value.periodoInicio?.trim();
  const periodoFim = parsed.value.periodoFim?.trim();
  const toEmail = parsed.value.toEmail?.trim().toLowerCase() ?? "";
  if (!reportId || !modeloId || !periodoInicio || !periodoFim || !toEmail) {
    return fail("BAD_REQUEST", "Informe tipo do relatório, modelo, período e e-mail.", 400);
  }
  if (!isEmail(toEmail)) return fail("BAD_REQUEST", "Informe um e-mail válido.", 400);

  try {
    const report = await buildFinanceiroSnapshot({
      reportId,
      clienteId: parsed.value.clienteId?.trim() || undefined,
      modeloId,
      periodoInicio,
      periodoFim,
      situacao: parsed.value.situacao,
      tipo: parsed.value.tipo,
    });
    const subject = report.assunto || `Relatório financeiro - ${report.resumo.reportTitulo}`;
    const htmlDocumento = montarDocumentoHtmlCompleto({
      title: `Relatório - ${report.resumo.reportTitulo}`,
      modeloNome: report.modeloNome,
      snapshot: report.snapshot,
      geradoEmIso: new Date().toISOString(),
    });
    const pdf = await renderHtmlToPdfBuffer(htmlDocumento);
    const send = await sendDocumentoEmail({
      to: toEmail,
      subject,
      text: `Segue relatório financeiro em anexo.\nTipo: ${report.resumo.reportTitulo}\nPeríodo: ${report.resumo.periodoInicio} até ${report.resumo.periodoFim}`,
      html: `<p>Segue relatório financeiro em anexo.</p><p><strong>Tipo:</strong> ${report.resumo.reportTitulo}</p><p><strong>Período:</strong> ${report.resumo.periodoInicio} até ${report.resumo.periodoFim}</p>`,
      attachmentFilename: `relatorio-financeiro-${Date.now()}.pdf`,
      attachmentContent: pdf,
      attachmentContentType: "application/pdf",
    });
    if (!send.accepted.includes(toEmail) || send.rejected.includes(toEmail)) {
      return fail("INTERNAL_ERROR", "Servidor de e-mail não confirmou o destinatário.", 500);
    }
    return ok({ sent: true, messageId: send.messageId, response: send.response });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao enviar relatório.";
    if (message.includes("não encontrado")) return fail("NOT_FOUND", message, 404);
    return fail("BAD_REQUEST", message, 400);
  }
}
