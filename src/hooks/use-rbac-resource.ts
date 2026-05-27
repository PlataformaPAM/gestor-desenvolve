"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import {
  canCreateResourceClient,
  canDeleteResourceClient,
  canEditResourceClient,
  canViewResourceClient,
} from "@/lib/configuracoes/permission-client";
import { getFirstAllowedNavHref } from "@/lib/nav-access";
import { hasAnyFinanceiroSubmodule } from "@/lib/financeiro/financeiro-nav";

export const CONTRATOS_RESOURCE = "contratos.lista";
export const COMERCIAL_PIPELINE_RESOURCE = "comercial.pipeline";
export const CENTRAL_DASHBOARD_RESOURCE = "central.dashboard";

/** Redireciona para o primeiro módulo permitido se não tiver Ver na Central. */
export function useCentralPageGuard(): boolean {
  const { session } = useAuth();
  const router = useRouter();
  const podeVerCentral = useMemo(
    () => canViewResourceClient(session, CENTRAL_DASHBOARD_RESOURCE),
    [session]
  );

  useEffect(() => {
    if (!session.perfilId && !session.isSystemAdmin) return;
    if (podeVerCentral) return;
    const href = getFirstAllowedNavHref({
      isSystemAdmin: session.isSystemAdmin,
      perfilNome: session.perfilNome,
      permissoes: session.permissoes,
      permissoesGranulares: session.permissoesGranulares,
    });
    router.replace(href ?? "/acesso-negado");
  }, [session.perfilId, session.isSystemAdmin, session.perfilNome, session.permissoes, session.permissoesGranulares, podeVerCentral, router]);

  return podeVerCentral;
}

export function useContratosRbac() {
  const { session } = useAuth();
  return useMemo(
    () => ({
      podeVer: canViewResourceClient(session, CONTRATOS_RESOURCE),
      podeCriar: canCreateResourceClient(session, CONTRATOS_RESOURCE),
      podeEditar: canEditResourceClient(session, CONTRATOS_RESOURCE),
    }),
    [session]
  );
}

export function useComercialRbac() {
  const { session } = useAuth();
  return useMemo(
    () => ({
      podeVer: canViewResourceClient(session, COMERCIAL_PIPELINE_RESOURCE),
      podeCriar: canCreateResourceClient(session, COMERCIAL_PIPELINE_RESOURCE),
      podeEditar: canEditResourceClient(session, COMERCIAL_PIPELINE_RESOURCE),
      podeExcluir: canDeleteResourceClient(session, COMERCIAL_PIPELINE_RESOURCE),
    }),
    [session]
  );
}

/** Redireciona se o perfil não tiver Ver em nenhum submódulo do Financeiro. */
export function useFinanceiroPageGuard(redirectTo = "/acesso-negado"): boolean {
  const { session } = useAuth();
  const router = useRouter();
  const podeVer = useMemo(() => hasAnyFinanceiroSubmodule(session), [session]);

  useEffect(() => {
    if (!session.perfilId && !session.isSystemAdmin) return;
    if (!podeVer) router.replace(redirectTo);
  }, [session.perfilId, session.isSystemAdmin, podeVer, router, redirectTo]);

  return podeVer;
}

export function useComercialPageGuard(redirectTo = "/acesso-negado"): boolean {
  const { session } = useAuth();
  const router = useRouter();
  const podeVer = useMemo(
    () => canViewResourceClient(session, COMERCIAL_PIPELINE_RESOURCE),
    [session]
  );

  useEffect(() => {
    if (!session.perfilId && !session.isSystemAdmin) return;
    if (!podeVer) router.replace(redirectTo);
  }, [session.perfilId, session.isSystemAdmin, podeVer, router, redirectTo]);

  return podeVer;
}

export function useFinanceiroLancamentosRbac() {
  const { session } = useAuth();
  const resourceId = "financeiro.lancamentos";
  return useMemo(
    () => ({
      podeVer: canViewResourceClient(session, resourceId),
      podeCriar: canCreateResourceClient(session, resourceId),
      podeEditar: canEditResourceClient(session, resourceId),
      podeExcluir: canDeleteResourceClient(session, resourceId),
    }),
    [session]
  );
}

export const RH_COLABORADORES_RESOURCE = "rh.colaboradores";
export const PORTAL_ACESSO_RESOURCE = "portal.acesso";

export function useRhColaboradoresRbac() {
  const { session } = useAuth();
  return useMemo(
    () => ({
      podeVer: canViewResourceClient(session, RH_COLABORADORES_RESOURCE),
      podeCriar: canCreateResourceClient(session, RH_COLABORADORES_RESOURCE),
      podeEditar: canEditResourceClient(session, RH_COLABORADORES_RESOURCE),
      podeExcluir: canDeleteResourceClient(session, RH_COLABORADORES_RESOURCE),
    }),
    [session]
  );
}

export function useConfiguracoesResourceRbac(resourceId: string) {
  const { session } = useAuth();
  return useMemo(
    () => ({
      podeVer: canViewResourceClient(session, resourceId),
      podeCriar: canCreateResourceClient(session, resourceId),
      podeEditar: canEditResourceClient(session, resourceId),
      podeExcluir: canDeleteResourceClient(session, resourceId),
    }),
    [session, resourceId]
  );
}

/** Redireciona para /configuracoes se o perfil não tiver Ver no recurso. */
export function useConfiguracoesSectionGuard(
  resourceId: string,
  redirectTo = "/configuracoes"
): boolean {
  const { session } = useAuth();
  const router = useRouter();
  const podeVer = useMemo(
    () => canViewResourceClient(session, resourceId),
    [session, resourceId]
  );

  useEffect(() => {
    if (!session.perfilId && !session.isSystemAdmin) return;
    if (!podeVer) router.replace(redirectTo);
  }, [session.perfilId, session.isSystemAdmin, podeVer, router, redirectTo]);

  return podeVer;
}

/** Permissões CRUD + verTodos para qualquer recurso do catálogo. */
export function useResourceRbac(resourceId: string) {
  const { session } = useAuth();
  return useMemo(
    () => ({
      podeVer: canViewResourceClient(session, resourceId),
      podeCriar: canCreateResourceClient(session, resourceId),
      podeEditar: canEditResourceClient(session, resourceId),
      podeExcluir: canDeleteResourceClient(session, resourceId),
    }),
    [session, resourceId]
  );
}

/**
 * Redireciona se o perfil não tiver Ver no recurso.
 * `skipForPortalCliente`: mantém acesso de usuários do portal (ex.: alertas).
 */
export function useResourcePageGuard(
  resourceId: string,
  redirectTo = "/acesso-negado",
  options?: { skipForPortalCliente?: boolean }
): boolean {
  const { session } = useAuth();
  const router = useRouter();
  const skipPortal = options?.skipForPortalCliente === true;
  const podeVer = useMemo(
    () =>
      skipPortal && session.isPortalCliente
        ? true
        : canViewResourceClient(session, resourceId),
    [session, resourceId, skipPortal]
  );

  useEffect(() => {
    if (!session.perfilId && !session.isSystemAdmin) return;
    if (!podeVer) router.replace(redirectTo);
  }, [session.perfilId, session.isSystemAdmin, podeVer, router, redirectTo]);

  return podeVer;
}

/** Redireciona para /relatorios se o perfil logado não tiver permissão Ver no recurso. */
export function useRelatorioRbac(resourceId: string): boolean {
  const { session } = useAuth();
  const router = useRouter();
  const podeVer = useMemo(
    () => canViewResourceClient(session, resourceId),
    [session, resourceId]
  );

  useEffect(() => {
    if (!session.perfilId && !session.isSystemAdmin) return;
    if (!podeVer) router.replace("/relatorios");
  }, [session.perfilId, session.isSystemAdmin, podeVer, router]);

  return podeVer;
}
