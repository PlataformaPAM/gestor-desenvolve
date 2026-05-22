import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromCookieHeader } from "@/lib/auth";
import { applySessionAccessRules } from "@/lib/server/session-access";
import { getFinanceiroRedirectTarget } from "@/lib/financeiro/financeiro-nav";
import { canAccessInternalPortal, canAccessPageRoute } from "@/lib/server/route-access";
import type { ClientAuthSession } from "@/lib/configuracoes/permission-client";
import type { GrantsMap } from "@/lib/configuracoes/permission-grants";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicPath =
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/redefinir-senha/");
  if (isPublicPath) return NextResponse.next();
  const cookieHeader = request.headers.get("cookie");
  const session = getSessionFromCookieHeader(cookieHeader);

  if (!session?.perfilId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let effectiveSession = session;
  let permissoesGranulares: GrantsMap | undefined;
  try {
    const sessionRes = await fetch(new URL("/api/auth/session", request.url), {
      method: "GET",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: "no-store",
    });
    if (sessionRes.status === 401) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (sessionRes.ok) {
      const payload = (await sessionRes.json()) as {
        data?: {
          clienteIds?: string[];
          isPortalCliente?: boolean;
          isAdminCliente?: boolean;
          isSystemAdmin?: boolean;
          perfilNome?: string;
          permissoes?: Record<string, boolean>;
          permissoesGranulares?: GrantsMap;
        };
      };
      const access = applySessionAccessRules(
        {
          ...session,
          clienteIds: payload?.data?.clienteIds ?? session.clienteIds,
        },
        {
          permissoes: payload?.data?.permissoes as never,
          perfilNome: payload?.data?.perfilNome,
          isSystemAdmin: payload?.data?.isSystemAdmin,
        }
      );
      permissoesGranulares = payload?.data?.permissoesGranulares;
      effectiveSession = {
        ...session,
        perfilNome: access.perfilNome,
        isSystemAdmin: access.isSystemAdmin,
        permissoes: access.permissoes,
        permissoesGranulares,
        isPortalCliente: access.isPortalCliente,
        isAdminCliente: access.isAdminCliente,
      };
    }
  } catch {
    const access = applySessionAccessRules(session);
    effectiveSession = {
      ...session,
      perfilNome: access.perfilNome,
      isSystemAdmin: access.isSystemAdmin,
      permissoes: access.permissoes,
      isPortalCliente: access.isPortalCliente,
      isAdminCliente: access.isAdminCliente,
    };
  }

  if (effectiveSession.isPortalCliente) {
    const rotaPermitidaCliente =
      pathname.startsWith("/portal") ||
      pathname === "/alertas" ||
      pathname.startsWith("/alertas/");
    if (!rotaPermitidaCliente) {
      return NextResponse.redirect(new URL("/portal", request.url));
    }
  } else if (pathname.startsWith("/portal")) {
    if (!canAccessInternalPortal(effectiveSession)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  if (!canAccessPageRoute(effectiveSession, pathname)) {
    return NextResponse.redirect(new URL("/acesso-negado", request.url));
  }

  if (pathname.startsWith("/financeiro")) {
    const authForFinanceiro: ClientAuthSession = {
      isSystemAdmin: effectiveSession.isSystemAdmin,
      perfilNome: effectiveSession.perfilNome,
      permissoes: effectiveSession.permissoes,
      permissoesGranulares,
    };
    const finRedirect = getFinanceiroRedirectTarget(pathname, authForFinanceiro);
    if (finRedirect) {
      return NextResponse.redirect(new URL(finRedirect, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|forgot-password|reset-password|redefinir-senha|_next/static|_next/image|api|favicon|desenvolve_).*)",
  ],
};
