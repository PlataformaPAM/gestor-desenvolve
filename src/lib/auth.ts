/**
 * Serviço de sessão e controle de acesso (RBAC).
 * A autenticação é feita no backend; este módulo mantém utilitários de sessão e autorização.
 */

import type { ModuloPermissao } from "@/lib/configuracoes/types";

export const COOKIE_NAME = "gestor_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 dias

export type SessionPayload = {
  perfilId: string;
  userId?: string;
  userName?: string;
  userCpf?: string;
  userEmail?: string;
  userPhone?: string;
  clienteIds?: string[];
  isPortalCliente?: boolean;
  isAdminCliente?: boolean;
  permissoes?: Partial<Record<ModuloPermissao, boolean>>;
};

/** Codifica payload da sessão para o cookie. Compatível com Edge e browser (perfilId é ASCII). */
export function encodeSession(payload: SessionPayload): string {
  const json = JSON.stringify(payload);
  if (typeof btoa !== "undefined") return btoa(json);
  return Buffer.from(json, "utf-8").toString("base64");
}

/** Decodifica o valor do cookie para obter perfilId. Usado no middleware e no client. */
export function decodeSession(cookieValue: string | undefined): SessionPayload | null {
  if (!cookieValue || typeof cookieValue !== "string") return null;
  try {
    const normalizedValue = decodeURIComponent(cookieValue).replace(/ /g, "+");
    const b64 = normalizedValue.replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof atob !== "undefined" ? atob(b64) : Buffer.from(b64, "base64").toString("utf-8");
    const parsed = JSON.parse(json) as SessionPayload;
    return parsed?.perfilId ? parsed : null;
  } catch {
    return null;
  }
}

/** Mapeamento pathname -> módulo exigido. Rotas sem entrada são liberadas para qualquer logado (ex: /). */
const PATH_TO_MODULE: Record<string, ModuloPermissao> = {
  "/comercial": "comercial",
  "/financeiro": "financeiro",
  "/clientes": "clientes",
  "/contratos": "clientes",
  "/helpdesk": "helpdesk",
  "/suporte": "helpdesk",
  "/portal/usuarios": "configuracoes",
  "/portal": "helpdesk",
  "/pos-venda": "posVenda",
  "/tarefas": "tarefas",
  "/rh": "rh",
  "/configuracoes": "configuracoes",
};

function getModuleForPath(pathname: string): ModuloPermissao | null {
  const sorted = Object.entries(PATH_TO_MODULE).sort((a, b) => b[0].length - a[0].length);
  for (const [path, module] of sorted) {
    if (pathname === path || pathname.startsWith(path + "/")) return module;
  }
  return null;
}

/**
 * Verifica se o perfil do usuário tem permissão para acessar a rota.
 * Usado no middleware (Edge) e no client. Não depende de getPerfilById para evitar imports pesados no Edge.
 */
export function hasModuleAccess(session: SessionPayload, pathname: string): boolean {
  const moduleRequired = getModuleForPath(pathname);
  if (moduleRequired === null) return true; // rota sem módulo (ex: /, /login, /acesso-negado)
  if (!session?.perfilId) return false;
  if (!session.permissoes) return true;
  return session.permissoes[moduleRequired] === true;
}

/** Retorna o perfilId da sessão a partir do header Cookie (string). Útil no middleware. */
export function getPerfilIdFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const value = match?.[1]?.trim();
  const session = decodeSession(value);
  return session?.perfilId ?? null;
}

export function getSessionFromCookieHeader(cookieHeader: string | null): SessionPayload | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const value = match?.[1]?.trim();
  return decodeSession(value);
}

/** Gera o valor do cookie para setar no client (document.cookie) ou em Set-Cookie. */
export function buildSessionCookie(perfilId: string): string {
  const value = encodeSession({ perfilId });
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; Secure`;
}

/** Remove o cookie de sessão no client. Chamar antes de redirecionar para /login. */
export function clearSessionCookie(): void {
  if (typeof document !== "undefined") {
    document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0`;
  }
}
