import { fail, ok } from "@/lib/server/api-response";
import { COOKIE_NAME, decodeSession, encodeSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadSessionPermissions } from "@/lib/server/session-permissions";

const IS_PROD = process.env.NODE_ENV === "production";

export async function GET(req: Request) {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const value = match?.[1]?.trim();
  const session = decodeSession(value);
  if (!session?.perfilId) {
    return fail("UNAUTHORIZED", "Sessão inválida.", 401);
  }

  let permissoes = session.permissoes ?? {};
  let perfilNome = session.perfilNome ?? "";
  let isSystemAdmin = session.isSystemAdmin === true;

  try {
    const resolved = await loadSessionPermissions(prisma, session.perfilId);
    permissoes = resolved.permissoes;
    perfilNome = resolved.perfilNome;
    isSystemAdmin = resolved.isSystemAdmin;
  } catch (error) {
    console.error("[auth/session] falha ao carregar perfil/permissões:", error);
  }

  let usuario: {
    id: string;
    nomeExibicao: string | null;
    cpf: string;
    email: string;
    telefone: string | null;
  } | null = null;
  try {
    usuario =
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
  } catch (error) {
    console.error("[auth/session] falha ao carregar usuário:", error);
  }

  const userId = usuario?.id ?? session.userId ?? null;
  const userName = usuario?.nomeExibicao ?? session.userName ?? null;
  const userCpf = usuario?.cpf ?? session.userCpf ?? null;
  const userEmail = usuario?.email ?? session.userEmail ?? null;
  const userPhone = usuario?.telefone ?? session.userPhone ?? null;

  let clienteIds = session.clienteIds ?? [];
  try {
    const clienteVinculos = userId
      ? await prisma.usuarioVinculo.findMany({
          where: { usuarioId: userId, tipo: "cliente" },
          select: { pessoaId: true },
        })
      : [];
    clienteIds = Array.from(new Set(clienteVinculos.map((v) => v.pessoaId)));
  } catch (error) {
    console.error("[auth/session] falha ao carregar vínculos cliente:", error);
  }

  const isPortalCliente = (clienteIds?.length ?? 0) > 0 || session.isPortalCliente === true;
  const isAdminCliente =
    isPortalCliente &&
    (permissoes.configuracoes === true ||
      isSystemAdmin ||
      session.isAdminCliente === true);
  const response = ok({
    perfilId: session.perfilId,
    userId,
    userName,
    userCpf,
    userEmail,
    userPhone,
    clienteIds,
    isPortalCliente,
    isAdminCliente,
    isSystemAdmin,
    perfilNome,
    permissoes,
  });

  response.cookies.set({
    name: COOKIE_NAME,
    value: encodeSession({
      perfilId: session.perfilId,
      userId: userId ?? undefined,
      userName: userName ?? undefined,
      userCpf: userCpf ?? undefined,
      userEmail: userEmail ?? undefined,
      userPhone: userPhone ?? undefined,
      clienteIds,
      isPortalCliente,
      isAdminCliente,
      isSystemAdmin,
      perfilNome,
      permissoes,
    }),
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
