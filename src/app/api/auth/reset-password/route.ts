import { prisma } from "@/lib/prisma";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { hashPassword, validatePasswordPolicy } from "@/lib/server/password";
import { verifyResetToken } from "@/lib/server/password-reset";
import { writeAuditLog } from "@/lib/server/audit-log";

type Payload = { token: string; novaSenha: string };

export async function POST(req: Request) {
  const parsed = await parseJsonSafe<Payload>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const token = (parsed.value.token || "").trim();
  const novaSenha = (parsed.value.novaSenha || "").trim();
  if (!token || !novaSenha) return fail("BAD_REQUEST", "Token e nova senha são obrigatórios.", 400);

  const policy = validatePasswordPolicy(novaSenha);
  if (!policy.valid) return fail("BAD_REQUEST", policy.message, 400);

  const payload = verifyResetToken(token);
  if (!payload) return fail("UNAUTHORIZED", "Token inválido ou expirado.", 401);

  const usuario = await prisma.usuario.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, nomeExibicao: true, ativo: true },
  });
  if (!usuario || !usuario.ativo) return fail("UNAUTHORIZED", "Token inválido ou expirado.", 401);

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { senhaHash: hashPassword(novaSenha), atualizadoEmSistema: new Date() },
  });
  await writeAuditLog(prisma, {
    usuarioId: usuario.id,
    acao: "Senha redefinida por token",
    modulo: "auth",
    detalhes: `Usuário ${usuario.nomeExibicao ?? usuario.email}`,
  });
  return ok({ changed: true });
}
