import { prisma } from "@/lib/prisma";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { resolvePortalContext } from "@/lib/server/portal-access";
import { writeAuditLog } from "@/lib/server/audit-log";
import { hashPassword, validatePasswordPolicy } from "@/lib/server/password";

type AtualizarUsuarioPortalBody = {
  ativo?: boolean;
  nome?: string;
  email?: string;
  perfilId?: string;
  senha?: string;
};

export async function PATCH(req: Request, ctxRoute: { params: Promise<{ id: string }> }) {
  const ctx = await resolvePortalContext(req);
  if (!ctx) return fail("FORBIDDEN", "Acesso ao portal do cliente não autorizado.", 403);
  if (!ctx.isAdminCliente) {
    return fail("FORBIDDEN", "Apenas administrador do cliente pode gerenciar usuários.", 403);
  }
  const { id } = await ctxRoute.params;
  if (id === ctx.userId) {
    return fail("BAD_REQUEST", "Não é permitido alterar seu próprio acesso por esta tela.", 400);
  }
  const parsed = await parseJsonSafe<AtualizarUsuarioPortalBody>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  if (
    typeof parsed.value.ativo !== "boolean" &&
    typeof parsed.value.nome !== "string" &&
    typeof parsed.value.email !== "string" &&
    typeof parsed.value.perfilId !== "string" &&
    typeof parsed.value.senha !== "string"
  ) {
    return fail("BAD_REQUEST", "Informe ao menos um campo para atualização.", 400);
  }

  const alvo = await prisma.usuario.findUnique({
    where: { id },
    include: {
      vinculos: {
        where: { tipo: "cliente" },
        select: { pessoaId: true },
      },
      perfil: { select: { nome: true } },
    },
  });
  if (!alvo) return fail("NOT_FOUND", "Usuário não encontrado.", 404);
  const clienteDoAlvo = alvo.vinculos.map((v) => v.pessoaId);
  const possuiIntersecao = clienteDoAlvo.some((cid) => ctx.clienteIds.includes(cid));
  if (!possuiIntersecao) {
    return fail("FORBIDDEN", "Você não pode gerenciar usuário de outro cliente.", 403);
  }

  if (parsed.value.senha) {
    const policy = validatePasswordPolicy(parsed.value.senha);
    if (!policy.valid) return fail("BAD_REQUEST", policy.message, 400);
  }

  const nome = parsed.value.nome?.trim();
  const email = parsed.value.email?.trim().toLowerCase();
  const perfilId = parsed.value.perfilId?.trim();
  if (email && email !== alvo.email) {
    const existing = await prisma.usuario.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, NOT: { id } },
      select: { id: true },
    });
    if (existing) return fail("CONFLICT", "Já existe usuário com este e-mail.", 409);
  }

  const updated = await prisma.usuario.update({
    where: { id },
    data: {
      ativo: typeof parsed.value.ativo === "boolean" ? parsed.value.ativo : undefined,
      nomeExibicao: typeof nome === "string" ? nome : undefined,
      email: typeof email === "string" ? email : undefined,
      perfilId: typeof perfilId === "string" && perfilId.length > 0 ? perfilId : undefined,
      senhaHash: parsed.value.senha ? hashPassword(parsed.value.senha) : undefined,
    },
    include: { perfil: { select: { nome: true } } },
  });

  await writeAuditLog(prisma, {
    usuarioId: ctx.userId,
    acao:
      typeof parsed.value.ativo === "boolean"
        ? parsed.value.ativo
          ? "Usuário cliente ativado no portal"
          : "Usuário cliente desativado no portal"
        : "Usuário cliente atualizado no portal",
    modulo: "configuracoes",
    detalhes: `${updated.nomeExibicao ?? updated.email} (${updated.email})`,
  });

  return ok({
    usuario: {
      id: updated.id,
      nome: updated.nomeExibicao?.trim() || updated.email,
      email: updated.email,
      cpf: updated.cpf,
      ativo: updated.ativo,
      perfilNome: updated.perfil.nome,
    },
  });
}

