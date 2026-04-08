import { prisma } from "@/lib/prisma";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { createResetToken, sendResetEmail } from "@/lib/server/password-reset";
import { writeAuditLog } from "@/lib/server/audit-log";

type Payload = { email: string };

export async function POST(req: Request) {
  const parsed = await parseJsonSafe<Payload>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const email = (parsed.value.email || "").trim().toLowerCase();
  if (!email) return fail("BAD_REQUEST", "E-mail é obrigatório.", 400);

  const usuario = await prisma.usuario.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, ativo: true },
    select: { id: true, email: true, nomeExibicao: true },
  });

  // Resposta neutra para não vazar existência do e-mail.
  if (!usuario) return ok({ sent: true });

  const token = createResetToken(usuario.id);
  const baseUrl =
    process.env.GESTOR_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : undefined) ||
    "http://localhost:3000";
  const resetUrl = `${baseUrl.replace(/\/$/, "")}/redefinir-senha/${encodeURIComponent(token)}`;
  await sendResetEmail(usuario.email, resetUrl);
  await writeAuditLog(prisma, {
    usuarioId: usuario.id,
    acao: "Solicitação de recuperação de senha",
    modulo: "auth",
    detalhes: `Usuário ${usuario.nomeExibicao ?? usuario.email}`,
  });
  return ok({ sent: true });
}
