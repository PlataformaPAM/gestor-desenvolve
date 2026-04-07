import { prisma } from "@/lib/prisma";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { hashPassword, validatePasswordPolicy, verifyPassword } from "@/lib/server/password";
import { writeAuditLog } from "@/lib/server/audit-log";

type Payload = {
  cpf: string;
  senhaAtual: string;
  novaSenha: string;
};

function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

export async function POST(req: Request) {
  const parsed = await parseJsonSafe<Payload>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);

  const cpf = normalizeCpf(parsed.value.cpf || "");
  const senhaAtual = (parsed.value.senhaAtual || "").trim();
  const novaSenha = (parsed.value.novaSenha || "").trim();

  if (!cpf || !senhaAtual || !novaSenha) {
    return fail("BAD_REQUEST", "CPF, senha atual e nova senha são obrigatórios.", 400);
  }

  const policy = validatePasswordPolicy(novaSenha);
  if (!policy.valid) {
    return fail("BAD_REQUEST", policy.message, 400);
  }

  const usuario = await prisma.usuario.findUnique({
    where: { cpf },
    select: { id: true, senhaHash: true, nomeExibicao: true },
  });
  if (!usuario?.senhaHash || !verifyPassword(senhaAtual, usuario.senhaHash)) {
    await writeAuditLog(prisma, {
      acao: "Falha na troca de senha",
      modulo: "auth",
      detalhes: `CPF ${cpf} inválido ou senha atual incorreta`,
    });
    return fail("UNAUTHORIZED", "Senha atual inválida.", 401);
  }

  await prisma.usuario.update({
    where: { cpf },
    data: { senhaHash: hashPassword(novaSenha), atualizadoEmSistema: new Date() },
  });
  await writeAuditLog(prisma, {
    usuarioId: usuario.id,
    acao: "Senha alterada",
    modulo: "auth",
    detalhes: `Usuário ${usuario.nomeExibicao ?? usuario.id}`,
  });

  return ok({ changed: true });
}

