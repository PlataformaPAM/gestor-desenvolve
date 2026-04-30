import { prisma } from "@/lib/prisma";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { resolvePortalContext } from "@/lib/server/portal-access";
import { hashPassword, validatePasswordPolicy } from "@/lib/server/password";
import { writeAuditLog } from "@/lib/server/audit-log";

type NovoUsuarioPortalBody = {
  nome: string;
  email: string;
  cpf: string;
  senha: string;
  isAdminCliente?: boolean;
  perfilId?: string;
};

function digitsOnly(v: string): string {
  return v.replace(/\D/g, "");
}

export async function GET(req: Request) {
  const ctx = await resolvePortalContext(req);
  if (!ctx) return fail("FORBIDDEN", "Acesso ao portal do cliente não autorizado.", 403);

  const vinculacoes = await prisma.usuarioVinculo.findMany({
    where: { tipo: "cliente", pessoaId: { in: ctx.clienteIds } },
    include: {
      usuario: {
        include: {
          perfil: { select: { nome: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const byUserId = new Map<string, typeof vinculacoes[number]["usuario"]>();
  vinculacoes.forEach((v) => byUserId.set(v.usuario.id, v.usuario));

  const usuarios = [...byUserId.values()].map((u) => ({
    id: u.id,
    nome: u.nomeExibicao?.trim() || u.email,
    email: u.email,
    cpf: u.cpf,
    ativo: u.ativo,
    perfilId: u.perfilId,
    perfilNome: u.perfil.nome,
    isAdminCliente: u.perfil.nome.toLowerCase().includes("cliente") && u.perfil.nome.toLowerCase().includes("admin"),
  }));

  return ok({ usuarios, data: { usuarios } });
}

export async function POST(req: Request) {
  const ctx = await resolvePortalContext(req);
  if (!ctx) return fail("FORBIDDEN", "Acesso ao portal do cliente não autorizado.", 403);
  if (!ctx.isAdminCliente) {
    return fail("FORBIDDEN", "Apenas administrador do cliente pode criar usuários.", 403);
  }

  const parsed = await parseJsonSafe<NovoUsuarioPortalBody>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const body = parsed.value;

  const nome = body.nome?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const cpf = digitsOnly(body.cpf ?? "");
  const senha = body.senha ?? "";
  if (!nome || !email || cpf.length !== 11 || !senha) {
    return fail("BAD_REQUEST", "Nome, e-mail, CPF e senha são obrigatórios.", 400);
  }

  const policy = validatePasswordPolicy(senha);
  if (!policy.valid) return fail("BAD_REQUEST", policy.message, 400);

  const [existingCpf, existingEmail] = await Promise.all([
    prisma.usuario.findUnique({ where: { cpf }, select: { id: true } }),
    prisma.usuario.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    }),
  ]);
  if (existingCpf || existingEmail) {
    return fail("CONFLICT", "Já existe usuário com este CPF ou e-mail.", 409);
  }

  const perfilSelecionado = body.perfilId
    ? await prisma.perfilAcesso.findUnique({
        where: { id: body.perfilId },
        select: { id: true, nome: true },
      })
    : null;

  const perfilBaseNome = body.isAdminCliente ? "cliente admin" : "cliente";
  const perfilAuto =
    perfilSelecionado ??
    (await prisma.perfilAcesso.findFirst({
      where: { nome: { contains: perfilBaseNome, mode: "insensitive" } },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    })) ??
    (await prisma.perfilAcesso.findFirst({
      where: { nome: { contains: "cliente", mode: "insensitive" } },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }));
  if (!perfilAuto) {
    return fail("BAD_REQUEST", "Perfil de cliente não encontrado. Configure os perfis antes de continuar.", 400);
  }

  const usuario = await prisma.usuario.create({
    data: {
      cpf,
      email,
      nomeExibicao: nome,
      senhaHash: hashPassword(senha),
      perfilId: perfilAuto.id,
      ativo: true,
      vinculacaoTipo: "cliente",
      vinculacaoPessoaId: ctx.clienteIds[0],
      vinculos: {
        createMany: {
          data: ctx.clienteIds.map((clienteId) => ({ tipo: "cliente", pessoaId: clienteId })),
        },
      },
    },
    include: {
      perfil: { select: { nome: true } },
    },
  });

  await writeAuditLog(prisma, {
    usuarioId: ctx.userId,
    acao: "Usuário cliente criado no portal",
    modulo: "configuracoes",
    detalhes: `${usuario.nomeExibicao ?? usuario.email} (${usuario.email})`,
  });

  return ok(
    {
      usuario: {
        id: usuario.id,
        nome: usuario.nomeExibicao?.trim() || usuario.email,
        email: usuario.email,
        cpf: usuario.cpf,
        ativo: usuario.ativo,
        perfilNome: usuario.perfil.nome,
        perfilId: usuario.perfilId,
      },
    },
    201
  );
}

