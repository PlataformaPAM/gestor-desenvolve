/**
 * Serviço de sessão e controle de acesso (RBAC).
 * A autenticação é feita no backend; este módulo mantém utilitários de sessão e autorização.
 */

import type { ModuloPermissao } from "@/lib/configuracoes/types";
import { isAdminProfileName, withAdminOverride } from "@/lib/configuracoes/permission-utils";

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
  isSystemAdmin?: boolean;
  perfilNome?: string;
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
  "/contratos": "contratos",
  "/helpdesk": "helpdesk",
  "/suporte": "helpdesk",
  "/pos-venda": "posVenda",
  "/solucoes": "solucoes",
  "/tarefas": "tarefas",
  "/rh": "rh",
  "/relatorios": "relatorios",
  "/configuracoes/construtor-documentos": "configuracoes_construtor_documentos",
  "/configuracoes/logs": "configuracoes_logs",
  "/configuracoes/perfis": "configuracoes_perfis",
  "/configuracoes/usuarios": "configuracoes_usuarios",
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
function effectivePermissoes(session: SessionPayload): Partial<Record<ModuloPermissao, boolean>> | undefined {
  if (session?.isSystemAdmin) return undefined;
  if (session?.perfilNome && isAdminProfileName(session.perfilNome)) {
    return withAdminOverride(session.permissoes ?? {}, session.perfilNome);
  }
  return session?.permissoes;
}

export function hasModuleAccess(session: SessionPayload, pathname: string): boolean {
  if (session?.isSystemAdmin === true) return true;
  if (session?.perfilNome && isAdminProfileName(session.perfilNome)) return true;
  if (pathname === "/portal" || pathname.startsWith("/portal/")) {
    if (session?.isPortalCliente === true) return true;
    return session?.permissoes?.portal_cliente === true;
  }
  const moduleRequired = getModuleForPath(pathname);
  if (moduleRequired === null) return true; // rota sem módulo (ex: /, /login, /acesso-negado)
  if (!session?.perfilId) return false;
  const permissoes = effectivePermissoes(session);
  if (!permissoes) return true;
  return permissoes[moduleRequired] === true;
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
