import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromCookieHeader, hasModuleAccess } from "@/lib/auth";

export function proxy(request: NextRequest) {
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

  if (!hasModuleAccess(session, pathname)) {
    return NextResponse.redirect(new URL("/acesso-negado", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|forgot-password|reset-password|redefinir-senha|_next/static|_next/image|api|favicon|desenvolve_).*)"],
};

