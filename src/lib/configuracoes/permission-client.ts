import {
  getPermissionResource,
  type PermissionAction,
  type RecursoGrant,
} from "@/lib/configuracoes/permission-catalog";
import {
  grantsForAdmin,
  grantsFromLegacyPermissoes,
  parseGrantsMap,
  type GrantsMap,
} from "@/lib/configuracoes/permission-grants";
import type { ModuloPermissao } from "@/lib/configuracoes/types";
import { isAdminProfileName } from "@/lib/configuracoes/permission-utils";

export type DataScope = "todos" | "vinculados";

export type AuthorizeClientResult = {
  allowed: boolean;
  scope: DataScope;
  grant?: RecursoGrant;
};

export type ClientAuthSession = {
  isSystemAdmin?: boolean;
  perfilNome?: string;
  permissoes?: Partial<Record<ModuloPermissao, boolean>>;
  permissoesGranulares?: GrantsMap | unknown;
};

export function resolveClientGrants(session: ClientAuthSession): GrantsMap {
  if (session.isSystemAdmin || isAdminProfileName(session.perfilNome ?? "")) {
    return grantsForAdmin();
  }
  if (session.permissoesGranulares) {
    return parseGrantsMap(session.permissoesGranulares);
  }
  return grantsFromLegacyPermissoes(session.permissoes ?? {});
}

export function authorizeClient(
  session: ClientAuthSession,
  resourceId: string,
  action: PermissionAction
): AuthorizeClientResult {
  if (session.isSystemAdmin || isAdminProfileName(session.perfilNome ?? "")) {
    return { allowed: true, scope: "todos" };
  }

  const grants = resolveClientGrants(session);
  const def = getPermissionResource(resourceId);
  if (!def) {
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

export function canViewResourceClient(session: ClientAuthSession, resourceId: string): boolean {
  return authorizeClient(session, resourceId, "ver").allowed;
}

export function canCreateResourceClient(session: ClientAuthSession, resourceId: string): boolean {
  return authorizeClient(session, resourceId, "criar").allowed;
}

export function canEditResourceClient(session: ClientAuthSession, resourceId: string): boolean {
  return authorizeClient(session, resourceId, "editar").allowed;
}

/** Exclusão permitida no cliente (`bloquearExcluir` não se aplica ao Administrador). */
export function canDeleteResourceClient(session: ClientAuthSession, resourceId: string): boolean {
  if (session.isSystemAdmin || isAdminProfileName(session.perfilNome ?? "")) {
    return true;
  }
  const def = getPermissionResource(resourceId);
  if (def?.bloquearExcluir) return false;
  return authorizeClient(session, resourceId, "excluir").allowed;
}

export function isFullAccessSession(session: ClientAuthSession): boolean {
  return Boolean(session.isSystemAdmin || isAdminProfileName(session.perfilNome ?? ""));
}
