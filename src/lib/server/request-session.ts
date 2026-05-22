import { COOKIE_NAME, decodeSession, getSessionFromCookieHeader, type SessionPayload } from "@/lib/auth";
import {
  buildDefaultPermissoes,
  isAdminProfileName,
  withAdminOverride,
} from "@/lib/configuracoes/permission-utils";
import { grantsForAdmin, grantsFromLegacyPermissoes } from "@/lib/configuracoes/permission-grants";
import { prisma } from "@/lib/prisma";
import { applySessionAccessRules } from "@/lib/server/session-access";
import { loadSessionPermissions } from "@/lib/server/session-permissions";

/** `userId` gravado no cookie após login (UUID do `Usuario`). */
export function getSessionUserId(req: Request): string | null {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  const id = session?.userId?.trim();
  return id || null;
}

/** Sessão do cookie enriquecida com permissões e matriz granular do perfil (DB). */
export async function getRequestSession(req: Request): Promise<SessionPayload | null> {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session?.perfilId) return null;

  try {
    const resolved = await loadSessionPermissions(prisma, session.perfilId);
    const access = applySessionAccessRules(session, resolved);
    return {
      ...session,
      perfilNome: access.perfilNome,
      isSystemAdmin: access.isSystemAdmin,
      isPortalCliente: access.isPortalCliente,
      isAdminCliente: access.isAdminCliente,
      permissoes: access.permissoes,
      permissoesGranulares: resolved.grants,
    };
  } catch (error) {
    console.error("[request-session] falha ao carregar permissões:", error);
    try {
      const perfil = await prisma.perfilAcesso.findUnique({
        where: { id: session.perfilId },
        select: { nome: true },
      });
      const perfilNome = perfil?.nome?.trim() ?? session.perfilNome ?? "";
      const permissoesFallback = withAdminOverride(
        { ...buildDefaultPermissoes(), ...(session.permissoes ?? {}) },
        perfilNome
      );
      const access = applySessionAccessRules(session, {
        perfilNome,
        isSystemAdmin: isAdminProfileName(perfilNome) || session.isSystemAdmin === true,
        permissoes: permissoesFallback,
      });
      const isAdmin = access.isSystemAdmin;
      return {
        ...session,
        perfilNome: access.perfilNome,
        isSystemAdmin: access.isSystemAdmin,
        permissoes: access.permissoes,
        permissoesGranulares: isAdmin
          ? grantsForAdmin()
          : grantsFromLegacyPermissoes(access.permissoes),
      };
    } catch {
      return session;
    }
  }
}

/** Decodifica cookie sem ir ao banco (útil só para presença de `perfilId`). */
export function getSessionFromRequest(req: Request): SessionPayload | null {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return decodeSession(match?.[1]?.trim());
}
