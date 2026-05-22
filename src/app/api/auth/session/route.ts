import { fail, ok } from "@/lib/server/api-response";
import { COOKIE_NAME, decodeSession, encodeSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadSessionPermissions } from "@/lib/server/session-permissions";
import { applySessionAccessRules } from "@/lib/server/session-access";
import { isAdminProfileName, withAdminOverride } from "@/lib/configuracoes/permission-utils";
import { grantsForAdmin, grantsFromLegacyPermissoes } from "@/lib/configuracoes/permission-grants";

const IS_PROD = process.env.NODE_ENV === "production";

export async function GET(req: Request) {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const value = match?.[1]?.trim();
  const session = decodeSession(value);
  if (!session?.perfilId) {
    return fail("UNAUTHORIZED", "Sessão inválida.", 401);
  }

  let resolved: Awaited<ReturnType<typeof loadSessionPermissions>> | undefined;
  try {
    resolved = await loadSessionPermissions(prisma, session.perfilId);
  } catch (error) {
    console.error("[auth/session] falha ao carregar perfil/permissões:", error);
    try {
      const perfil = await prisma.perfilAcesso.findUnique({
        where: { id: session.perfilId },
        select: { nome: true },
      });
      const perfilNomeFallback = perfil?.nome?.trim() ?? session.perfilNome ?? "";
      const permissoesFallback = withAdminOverride(session.permissoes ?? {}, perfilNomeFallback);
      resolved = {
        perfilNome: perfilNomeFallback,
        isSystemAdmin: isAdminProfileName(perfilNomeFallback),
        permissoes: permissoesFallback,
        grants: isAdminProfileName(perfilNomeFallback)
          ? grantsForAdmin()
          : grantsFromLegacyPermissoes(permissoesFallback),
      };
    } catch (fallbackError) {
      console.error("[auth/session] fallback de perfil falhou:", fallbackError);
    }
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

  const access = applySessionAccessRules({ ...session, clienteIds }, resolved);
  const { permissoes, perfilNome, isSystemAdmin, isPortalCliente, isAdminCliente } = access;

  const permissoesGranulares =
    resolved?.grants ??
    (isSystemAdmin ? grantsForAdmin() : grantsFromLegacyPermissoes(permissoes));

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
    permissoesGranulares,
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
