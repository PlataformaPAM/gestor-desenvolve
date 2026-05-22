import type { SessionPayload } from "@/lib/auth";
import type { ModuloPermissao } from "@/lib/configuracoes/types";
import {
  buildDefaultPermissoes,
  isAdminProfileName,
  withAdminOverride,
  withDerivedConfiguracoes,
} from "@/lib/configuracoes/permission-utils";
import type { ResolvedSessionPermissions } from "@/lib/server/session-permissions";

export type NormalizedSessionAccess = {
  permissoes: Record<ModuloPermissao, boolean>;
  perfilNome: string;
  isSystemAdmin: boolean;
  isPortalCliente: boolean;
  isAdminCliente: boolean;
};

/** Sessão com perfil Administrador (flag ou nome do perfil). */
export function isPrivilegedSession(session: SessionPayload | null | undefined): boolean {
  if (!session) return false;
  if (session.isSystemAdmin === true) return true;
  const nome = session.perfilNome?.trim() ?? "";
  return isAdminProfileName(nome);
}

/**
 * Cookie legado: só perfilId, sem permissões carregadas.
 * Evita bloquear tudo com `permissoes: {}` até a API de sessão responder.
 */
export function hasStaleEmptyPermissions(session: SessionPayload): boolean {
  if (isPrivilegedSession(session)) return false;
  const raw = session.permissoes;
  if (raw == null) return true;
  return Object.keys(raw).length === 0;
}

/** Unifica permissões do DB + cookie e garante override do perfil Administrador. */
export function applySessionAccessRules(
  session: SessionPayload,
  resolved?: Partial<ResolvedSessionPermissions>
): NormalizedSessionAccess {
  const perfilNome = (resolved?.perfilNome ?? session.perfilNome ?? "").trim();
  let permissoes = withDerivedConfiguracoes(
    resolved?.permissoes ?? session.permissoes ?? buildDefaultPermissoes()
  );
  let isSystemAdmin = resolved?.isSystemAdmin === true || session.isSystemAdmin === true;

  if (isAdminProfileName(perfilNome)) {
    isSystemAdmin = true;
    permissoes = withAdminOverride(permissoes, perfilNome);
  }

  const isPortalCliente =
    !isSystemAdmin &&
    ((session.clienteIds?.length ?? 0) > 0 || session.isPortalCliente === true);

  const isAdminCliente =
    isPortalCliente &&
    (permissoes.configuracoes === true || isSystemAdmin || session.isAdminCliente === true);

  return { permissoes, perfilNome, isSystemAdmin, isPortalCliente, isAdminCliente };
}
