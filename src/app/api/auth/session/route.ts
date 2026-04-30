import { fail, ok } from "@/lib/server/api-response";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ModuloPermissao } from "@/lib/configuracoes/types";

export async function GET(req: Request) {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const value = match?.[1]?.trim();
  const session = decodeSession(value);
  if (!session?.perfilId) {
    return fail("UNAUTHORIZED", "Sessão inválida.", 401);
  }
  const perfil = await prisma.perfilAcesso.findUnique({
    where: { id: session.perfilId },
    include: { permissoes: true },
  });
  const permissoes = Object.fromEntries(
    (perfil?.permissoes ?? []).map((p) => [p.modulo, p.permitido])
  ) as Partial<Record<ModuloPermissao, boolean>>;

  const usuario =
    (session.userId
      ? await prisma.usuario.findUnique({
          where: { id: session.userId },
          select: { id: true, nomeExibicao: true, cpf: true, email: true, telefone: true },
        })
      : null) ??
    (session.userCpf
      ? await prisma.usuario.findUnique({
          where: { cpf: session.userCpf },
          select: { id: true, nomeExibicao: true, cpf: true, email: true, telefone: true },
        })
      : null) ??
    (await prisma.usuario.findFirst({
      where: { perfilId: session.perfilId, ativo: true },
      orderBy: { updatedAt: "desc" },
      select: { id: true, nomeExibicao: true, cpf: true, email: true, telefone: true },
    }));

  const userId = usuario?.id ?? session.userId ?? null;
  const userName = usuario?.nomeExibicao ?? session.userName ?? null;
  const userCpf = usuario?.cpf ?? session.userCpf ?? null;
  const userEmail = usuario?.email ?? session.userEmail ?? null;
  const userPhone = usuario?.telefone ?? session.userPhone ?? null;
  const clienteVinculos = userId
    ? await prisma.usuarioVinculo.findMany({
        where: { usuarioId: userId, tipo: "cliente" },
        select: { pessoaId: true },
      })
    : [];
  const clienteIds = Array.from(new Set(clienteVinculos.map((v) => v.pessoaId)));
  const perfilNome = (perfil?.nome ?? "").toLowerCase();
  const isPortalCliente = clienteIds.length > 0;
  const isAdminCliente =
    isPortalCliente &&
    (
      permissoes.configuracoes === true ||
      perfilNome.includes("admin") ||
      perfilNome.includes("administrador")
    );
  return ok({
    perfilId: session.perfilId,
    userId,
    userName,
    userCpf,
    userEmail,
    userPhone,
    clienteIds,
    isPortalCliente,
    isAdminCliente,
    permissoes,
  });
}

