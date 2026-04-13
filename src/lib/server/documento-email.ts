import nodemailer from "nodemailer";

type SendDocumentoEmailParams = {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachmentFilename: string;
  /** Conteúdo binário do anexo (ex.: PDF). */
  attachmentContent: Buffer;
  attachmentContentType: string;
};

export type SendDocumentoEmailResult = {
  accepted: string[];
  rejected: string[];
  response: string;
  messageId: string;
};

export async function sendDocumentoEmail(params: SendDocumentoEmailParams): Promise<SendDocumentoEmailResult> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  if (!host || !user || !pass || !from) {
    throw new Error("SMTP não configurado.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.verify();
  const info = await transporter.sendMail({
    from,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
    attachments: [
      {
        filename: params.attachmentFilename,
        content: params.attachmentContent,
        contentType: params.attachmentContentType,
      },
    ],
  });
  const acceptedRaw = (info as { accepted?: unknown }).accepted;
  const rejectedRaw = (info as { rejected?: unknown }).rejected;
  const accepted = Array.isArray(acceptedRaw) ? acceptedRaw.map((x) => String(x).toLowerCase()) : [];
  const rejected = Array.isArray(rejectedRaw) ? rejectedRaw.map((x) => String(x).toLowerCase()) : [];
  return {
    accepted,
    rejected,
    response: String((info as { response?: unknown }).response ?? ""),
    messageId: String((info as { messageId?: unknown }).messageId ?? ""),
  };
}

