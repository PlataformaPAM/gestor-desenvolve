import { prisma } from "@/lib/prisma";
import type { ModuloPermissao } from "@/lib/configuracoes/types";
import { verifyPassword } from "@/lib/server/password";
import { COOKIE_NAME, encodeSession } from "@/lib/auth";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";

type Payload = {
  cpf: string;
  senha: string;
};

const MAX_ATTEMPTS = 5;
const BLOCK_WINDOW_MS = 5 * 60 * 1000;
const IS_PROD = process.env.NODE_ENV === "production";

function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

export async function POST(req: Request) {
  try {
    const parsed = await parseJsonSafe<Payload>(req);
    if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
    const body = parsed.value;
    const cpfInput = (body.cpf || "").trim();
    const cpf = normalizeCpf(cpfInput);
    const senha = (body.senha || "").trim();
    if (!cpf || !senha) {
      return fail("BAD_REQUEST", "CPF e senha são obrigatórios.", 400);
    }

    const windowStart = new Date(Date.now() - BLOCK_WINDOW_MS);
    const failureCount = await prisma.logSistema.count({
      where: {
        modulo: "auth",
        acao: "Falha de login",
        data: { gte: windowStart },
        detalhes: { contains: `CPF ${cpf} ` },
      },
    });
    if (failureCount >= MAX_ATTEMPTS) {
      return fail("FORBIDDEN", "Muitas tentativas. Aguarde alguns minutos.", 429);
    }

    // Busca robusta por CPF ignorando qualquer máscara/pontuação salva no banco.
    const usuarios = await prisma.$queryRaw<
      Array<{
        id: string;
        perfilId: string;
        senhaHash: string | null;
        nomeExibicao: string | null;
        cpf: string;
        email: string;
        telefone: string | null;
        ativo: boolean;
      }>
    >`SELECT id, "perfilId", "senhaHash", "nomeExibicao", cpf, email, telefone, ativo
       FROM "Usuario"
      WHERE regexp_replace(cpf, '[^0-9]', '', 'g') = ${cpf}
      LIMIT 1`;
    const usuario = usuarios[0];
    if (usuario && !usuario.ativo) {
      return fail("FORBIDDEN", "Usuário inativo. Solicite reativação ao administrador.", 403);
    }

    if (!usuario?.senhaHash || !verifyPassword(senha, usuario.senhaHash)) {
      await writeAuditLog(prisma, {
        acao: "Falha de login",
        modulo: "auth",
        detalhes: `CPF ${cpf} inválido ou senha incorreta`,
      });
      return fail("UNAUTHORIZED", "CPF ou senha inválidos.", 401);
    }

    await writeAuditLog(prisma, {
      usuarioId: usuario.id,
      acao: "Login realizado",
      modulo: "auth",
      detalhes: `Usuário ${usuario.nomeExibicao ?? usuario.id}`,
    });

    const perfil = await prisma.perfilAcesso.findUnique({
      where: { id: usuario.perfilId },
      include: { permissoes: true },
    });
    const permissoes = Object.fromEntries(
      (perfil?.permissoes ?? []).map((p) => [p.modulo, p.permitido])
    ) as Partial<Record<ModuloPermissao, boolean>>;

    const response = ok({
      perfilId: usuario.perfilId,
      user: { id: usuario.id, nome: usuario.nomeExibicao ?? "Usuário" },
      permissoes,
    });
    response.cookies.set({
      name: COOKIE_NAME,
      value: encodeSession({
        perfilId: usuario.perfilId,
        userId: usuario.id,
        userName: usuario.nomeExibicao ?? "Usuário",
        userCpf: usuario.cpf,
        userEmail: usuario.email,
        userPhone: usuario.telefone ?? undefined,
        permissoes,
      }),
      httpOnly: true,
      secure: IS_PROD,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch {
    return fail("INTERNAL_ERROR", "Falha ao autenticar.", 500);
  }
}

