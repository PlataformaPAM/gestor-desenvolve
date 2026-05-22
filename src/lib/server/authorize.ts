import type { SessionPayload } from "@/lib/auth";
import { isPrivilegedSession } from "@/lib/server/session-access";
import {
  getPermissionResource,
  type PermissionAction,
  type GrantsMap,
  type RecursoGrant,
} from "@/lib/configuracoes/permission-catalog";
import { parseGrantsMap } from "@/lib/configuracoes/permission-grants";

export type DataScope = "todos" | "vinculados";

export type AuthorizeResult = {
  allowed: boolean;
  scope: DataScope;
  grant?: RecursoGrant;
};

function sessionGrants(session: SessionPayload): GrantsMap | null {
  const raw = (session as SessionPayload & { permissoesGranulares?: unknown }).permissoesGranulares;
  if (raw) return parseGrantsMap(raw);
  return null;
}

export function isSessionAdmin(session: SessionPayload): boolean {
  return isPrivilegedSession(session);
}

/**
 * Verifica ação em um recurso. Fase 1: uso opcional nas APIs; sidebar segue legado.
 * Administrador sempre permitido.
 */
export function authorize(
  session: SessionPayload,
  resourceId: string,
  action: PermissionAction
): AuthorizeResult {
  if (isSessionAdmin(session)) {
    return { allowed: true, scope: "todos", grant: undefined };
  }

  const grants = sessionGrants(session);
  const def = getPermissionResource(resourceId);
  if (!grants || !def) {
    return { allowed: false, scope: "vinculados" };
  }

  const grant = grants[resourceId] ?? {
    ver: false,
    criar: false,
    editar: false,
    excluir: false,
    verTodos: false,
  };

  let allowed = false;
  if (action === "ver") allowed = grant.ver;
  else if (action === "criar") allowed = grant.criar && grant.ver;
  else if (action === "editar") allowed = grant.editar && grant.ver;
  else if (action === "excluir") allowed = grant.excluir && grant.ver && !def.bloquearExcluir;

  const scope: DataScope =
    def.bloquearVerTodos || !grant.verTodos ? "vinculados" : "todos";

  return { allowed, scope, grant };
}

export function canViewResource(session: SessionPayload, resourceId: string): boolean {
  return authorize(session, resourceId, "ver").allowed;
}

export function getResourceDataScope(session: SessionPayload, resourceId: string): DataScope {
  return authorize(session, resourceId, "ver").scope;
}
