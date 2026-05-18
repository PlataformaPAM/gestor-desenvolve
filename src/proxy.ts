import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromCookieHeader, hasModuleAccess } from "@/lib/auth";

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
  try {
    const sessionRes = await fetch(new URL("/api/auth/session", request.url), {
      method: "GET",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: "no-store",
    });
    if (sessionRes.ok) {
      const payload = (await sessionRes.json()) as {
        data?: {
          isPortalCliente?: boolean;
          isSystemAdmin?: boolean;
          perfilNome?: string;
          permissoes?: Record<string, boolean>;
        };
      };
      effectiveSession = {
        ...session,
        isPortalCliente: payload?.data?.isPortalCliente ?? session.isPortalCliente,
        isSystemAdmin: payload?.data?.isSystemAdmin ?? session.isSystemAdmin,
        perfilNome: payload?.data?.perfilNome ?? session.perfilNome,
        permissoes: payload?.data?.permissoes ?? session.permissoes,
      };
    }
  } catch {
    effectiveSession = session;
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
    const allowInternalPortal =
      effectiveSession.isSystemAdmin === true || effectiveSession.permissoes?.portal_cliente === true;
    if (!allowInternalPortal) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  if (!hasModuleAccess(effectiveSession, pathname)) {
    return NextResponse.redirect(new URL("/acesso-negado", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|forgot-password|reset-password|redefinir-senha|_next/static|_next/image|api|favicon|desenvolve_).*)"],
};
