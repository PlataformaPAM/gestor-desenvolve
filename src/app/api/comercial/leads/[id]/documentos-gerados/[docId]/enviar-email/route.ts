import { prisma } from "@/lib/prisma";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { comercialAccessGate } from "@/lib/server/comercial-lead-access";
import { getSessionUserId } from "@/lib/server/request-session";
import { getPublicBaseUrl } from "@/lib/server/request-base-url";
import { montarDocumentoHtmlCompleto, type DocumentoSnapshot } from "@/lib/documentos/documento-html";
import { sendDocumentoEmail } from "@/lib/server/documento-email";
import { renderHtmlToPdfBuffer } from "@/lib/server/html-to-pdf";

type Body = { toEmail?: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
  return { modeloNome, snapshot: { assunto, cabecalhoHtml, corpoHtml, rodapeHtml } };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string; docId: string }> }) {
  const { id: leadId, docId } = await ctx.params;
  const gate = await comercialAccessGate(req, "editar", leadId);
  if (!gate.ok) return gate.response;
  const parsedBody = await parseJsonSafe<Body>(req);
  if (!parsedBody.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const toEmail = (parsedBody.value.toEmail ?? "").trim().toLowerCase();
  if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
    return fail("BAD_REQUEST", "Informe um e-mail válido para envio.", 400);
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, name: true },
  });
  if (!lead) return fail("NOT_FOUND", "Lead não encontrado.", 404);

  const row = await prisma.leadInteraction.findFirst({
    where: { id: docId, leadId, type: "proposta", field: "documentoModelo" },
    select: { id: true, date: true, newValue: true },
  });
  if (!row) return fail("NOT_FOUND", "Documento gerado não encontrado.", 404);

  const parsed = parseSnapshot(row.newValue);
  if (!parsed) return fail("NOT_FOUND", "Snapshot do documento indisponível.", 404);

  const subject = parsed.snapshot.assunto?.trim()
    ? parsed.snapshot.assunto.trim()
    : `Documento comercial - ${lead.name}`;
  const htmlCompleto = montarDocumentoHtmlCompleto({
    title: subject,
    modeloNome: parsed.modeloNome,
    snapshot: parsed.snapshot,
    geradoEmIso: row.date.toISOString(),
  });

  let pdf: Buffer;
  try {
    pdf = await renderHtmlToPdfBuffer(htmlCompleto);
  } catch (error) {
    const detalhe =
      process.env.NODE_ENV === "development" && error instanceof Error
        ? ` Detalhe técnico: ${error.message}`
        : "";
    return fail("INTERNAL_ERROR", `Não foi possível gerar o PDF para anexo.${detalhe}`, 500);
  }

  const base = getPublicBaseUrl(req);
  const pdfOnlineHref = base
    ? `${base}/api/comercial/leads/${encodeURIComponent(leadId)}/documentos-gerados/${encodeURIComponent(row.id)}/pdf`
    : "";

  const dataEmitida = new Date(row.date).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  const text = [
    `Prezado(a),`,
    ``,
    `Encaminhamos a proposta/documento comercial em anexo (formato PDF).`,
    ``,
    `Assunto: ${subject}`,
    `Modelo: ${parsed.modeloNome}`,
    `Oportunidade / referência: ${lead.name}`,
    `Emitido em: ${dataEmitida}`,
    pdfOnlineHref ? `Link para visualizar ou baixar o mesmo PDF no navegador: ${pdfOnlineHref}` : ``,
    ``,
    `Permanecemos à disposição para esclarecimentos e ajustes.`,
    ``,
    `Atenciosamente,`,
    `Equipe comercial`,
    ``,
    `—`,
    `Observação: mensagens enviadas de domínios recém-configurados podem ser classificadas como spam pelo Gmail e outros provedores. ` +
      `Verifique a caixa de spam nas primeiros envios. Para maior taxa de entrega, configure SPF, DKIM e DMARC no painel do provedor de hospedagem (ex.: HostGator).`,
  ]
    .filter(Boolean)
    .join("\n");

  const safeSubject = escapeHtml(subject);
  const safeModelo = escapeHtml(parsed.modeloNome);
  const safeLead = escapeHtml(lead.name);
  const safeData = escapeHtml(dataEmitida);
  const linkBlock = pdfOnlineHref
    ? `<p style="margin:20px 0 0;font-size:14px;line-height:1.5;color:#334155;">
        <a href="${escapeHtml(pdfOnlineHref)}" style="color:#4c1d95;font-weight:600;">Abrir o mesmo documento em PDF no navegador</a>
      </p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeSubject}</title>
</head>
<body style="margin:0;background:#f1f5f9;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;border-collapse:collapse;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(90deg,#5b21b6,#6d28d9);padding:20px 24px;">
              <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;">Documento comercial</p>
              <p style="margin:8px 0 0;font-size:14px;color:#e9d5ff;line-height:1.45;">${safeSubject}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 24px 8px;">
              <p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#0f172a;">Prezado(a),</p>
              <p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#334155;">
                Segue em <strong>anexo o documento em PDF</strong>, gerado a partir do modelo comercial
                <strong>${safeModelo}</strong>, referente à oportunidade <strong>${safeLead}</strong>.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin-top:8px;border:1px solid #e2e8f0;border-radius:8px;">
                <tr>
                  <td style="padding:12px 14px;background:#f8fafc;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Resumo</td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#0f172a;">
                    <strong>Modelo:</strong> ${safeModelo}<br/>
                    <strong>Referência:</strong> ${safeLead}<br/>
                    <strong>Emitido em:</strong> ${safeData}
                  </td>
                </tr>
              </table>
              ${linkBlock}
              <p style="margin:24px 0 0;font-size:15px;line-height:1.55;color:#334155;">
                Permanecemos à disposição para esclarecimentos e eventual adequação de condições comerciais.
              </p>
              <p style="margin:20px 0 0;font-size:15px;line-height:1.55;color:#0f172a;">
                Atenciosamente,<br/>
                <strong>Equipe comercial</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 20px;background:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:11px;line-height:1.5;color:#64748b;">
                Entrega: o arquivo anexo está no formato PDF e pode ser aberto em qualquer leitor padrão.
                Provedores como o Gmail podem filtrar mensagens novas; recomenda-se verificar a pasta de spam nas primeiras remessas
                e alinhar SPF, DKIM e DMARC no domínio de envio com o suporte da hospedagem.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  let sendMeta: { response: string; messageId: string } | null = null;
  try {
    const send = await sendDocumentoEmail({
      to: toEmail,
      subject,
      text,
      html,
      attachmentFilename: `documento-${row.id}.pdf`,
      attachmentContent: pdf,
      attachmentContentType: "application/pdf",
    });
    if (!send.accepted.includes(toEmail) || send.rejected.includes(toEmail)) {
      return fail("INTERNAL_ERROR", "Servidor de e-mail não confirmou o destinatário informado.", 500);
    }
    sendMeta = { response: send.response, messageId: send.messageId };
  } catch (error) {
    const detalhe =
      process.env.NODE_ENV === "development" && error instanceof Error
        ? ` Detalhe técnico: ${error.message}`
        : "";
    return fail("INTERNAL_ERROR", `Não foi possível enviar o e-mail do documento.${detalhe}`, 500);
  }

  const sessionUserId = getSessionUserId(req);
  const usuario = sessionUserId
    ? await prisma.usuario.findUnique({ where: { id: sessionUserId }, select: { nomeExibicao: true } })
    : null;
  await prisma.leadInteraction.create({
    data: {
      leadId,
      date: new Date(),
      type: "proposta",
      action: "UPDATE",
      description: `Documento (PDF) enviado por e-mail para ${toEmail}.`,
      userId: sessionUserId ?? null,
      autorNome: usuario?.nomeExibicao?.trim() || "Usuário",
      field: "documentoEnvioEmail",
      fieldKey: row.id,
      newValue: {
        canal: "email",
        status: "enviado",
        toEmail,
        docId: row.id,
        anexo: "application/pdf",
        smtpResponse: sendMeta?.response ?? "",
        messageId: sendMeta?.messageId ?? "",
      },
    },
  });

  return ok({ sent: true, smtpResponse: sendMeta?.response ?? "", messageId: sendMeta?.messageId ?? "" });
}
