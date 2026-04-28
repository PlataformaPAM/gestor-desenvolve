import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { montarDocumentoHtmlCompleto } from "@/lib/documentos/documento-html";
import { renderHtmlToPdfBuffer } from "@/lib/server/html-to-pdf";
import { sendDocumentoEmail } from "@/lib/server/documento-email";
import { buildPrestacaoContasSnapshot } from "@/lib/relatorios/prestacao-contas";

type Body = {
  clienteId?: string;
  modeloId?: string;
  periodoInicio?: string;
  periodoFim?: string;
  toEmail?: string;
};

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request) {
  const parsed = await parseJsonSafe<Body>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const clienteId = parsed.value.clienteId?.trim();
  const modeloId = parsed.value.modeloId?.trim();
  const periodoInicio = parsed.value.periodoInicio?.trim();
  const periodoFim = parsed.value.periodoFim?.trim();
  const toEmail = parsed.value.toEmail?.trim().toLowerCase() ?? "";
  if (!clienteId || !modeloId || !periodoInicio || !periodoFim || !toEmail) {
    return fail("BAD_REQUEST", "Informe cliente, modelo, período e e-mail de destino.", 400);
  }
  if (!isEmail(toEmail)) return fail("BAD_REQUEST", "Informe um e-mail válido.", 400);

  let report;
  try {
    report = await buildPrestacaoContasSnapshot({ clienteId, modeloId, periodoInicio, periodoFim });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao montar relatório.";
    if (message.includes("não encontrado")) return fail("NOT_FOUND", message, 404);
    return fail("BAD_REQUEST", message, 400);
  }

  const subject = report.assunto || `Relatório - ${report.resumo.cliente}`;
  const htmlDocumento = montarDocumentoHtmlCompleto({
    title: `Relatório - ${report.resumo.cliente}`,
    modeloNome: report.modeloNome,
    snapshot: report.snapshot,
    geradoEmIso: new Date().toISOString(),
  });

  let pdf: Buffer;
  try {
    pdf = await renderHtmlToPdfBuffer(htmlDocumento);
  } catch {
    return fail("INTERNAL_ERROR", "Não foi possível gerar o PDF para envio.", 500);
  }

  try {
    const send = await sendDocumentoEmail({
      to: toEmail,
      subject,
      text: `Segue relatório em anexo.\nCliente: ${report.resumo.cliente}\nPeríodo: ${report.resumo.periodoInicio} até ${report.resumo.periodoFim}`,
      html: `<p>Segue relatório em anexo.</p><p><strong>Cliente:</strong> ${report.resumo.cliente}</p><p><strong>Período:</strong> ${report.resumo.periodoInicio} até ${report.resumo.periodoFim}</p>`,
      attachmentFilename: `relatorio-${Date.now()}.pdf`,
      attachmentContent: pdf,
      attachmentContentType: "application/pdf",
    });
    if (!send.accepted.includes(toEmail) || send.rejected.includes(toEmail)) {
      return fail("INTERNAL_ERROR", "Servidor de e-mail não confirmou o destinatário.", 500);
    }
    return ok({ sent: true, messageId: send.messageId, response: send.response });
  } catch {
    return fail("INTERNAL_ERROR", "Não foi possível enviar o e-mail do relatório.", 500);
  }
}
