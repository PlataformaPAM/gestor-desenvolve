import { createHmac, timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";

type ResetPayload = {
  sub: string;
  exp: number;
};

function b64url(data: string): string {
  return Buffer.from(data, "utf8").toString("base64url");
}

function getSecret(): string {
  return (
    process.env.AUTH_RESET_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "dev-only-reset-secret-change-me"
  );
}

export function createResetToken(userId: string, ttlMs = 15 * 60 * 1000): string {
  const payload: ResetPayload = { sub: userId, exp: Date.now() + ttlMs };
  const payloadPart = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", getSecret()).update(payloadPart).digest("base64url");
  return `${payloadPart}.${sig}`;
}

export function verifyResetToken(token: string): ResetPayload | null {
  const [payloadPart, sigPart] = token.split(".");
  if (!payloadPart || !sigPart) return null;
  const expected = createHmac("sha256", getSecret()).update(payloadPart).digest("base64url");
  const ok = timingSafeEqual(Buffer.from(sigPart), Buffer.from(expected));
  if (!ok) return null;
  const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as ResetPayload;
  if (!payload?.sub || !payload?.exp) return null;
  if (Date.now() > payload.exp) return null;
  return payload;
}

export async function sendResetEmail(to: string, resetUrl: string): Promise<void> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  if (!host || !user || !pass || !from) {
    // Fallback para dev: mantém funcional sem quebrar o fluxo.
    // eslint-disable-next-line no-console
    console.log("[password-reset] SMTP não configurado. Link:", resetUrl);
    return;
  }
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  await transporter.sendMail({
    from,
    to,
    subject: "Redefinição de senha - Gestor Desenvolve",
    text: `Recebemos um pedido de redefinição de senha.\n\nUse este link por 15 minutos:\n${resetUrl}\n\nSe você não solicitou, ignore este e-mail.`,
  });
}
