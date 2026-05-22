import { canViewResourceClient, type ClientAuthSession } from "@/lib/configuracoes/permission-client";

export const FINANCEIRO_RESOURCE = {
  lancamentos: "financeiro.lancamentos",
  comissoes: "financeiro.comissoes",
  extrato: "financeiro.extrato",
  aprovacoes: "financeiro.aprovacoes",
  vendaDireta: "financeiro.venda_direta",
} as const;

export function canViewFinanceiroLancamentos(session: ClientAuthSession): boolean {
  return canViewResourceClient(session, FINANCEIRO_RESOURCE.lancamentos);
}

export function canViewFinanceiroComissoes(session: ClientAuthSession): boolean {
  return canViewResourceClient(session, FINANCEIRO_RESOURCE.comissoes);
}

export function canViewFinanceiroExtrato(session: ClientAuthSession): boolean {
  return canViewResourceClient(session, FINANCEIRO_RESOURCE.extrato);
}

export function canViewFinanceiroAprovacoes(session: ClientAuthSession): boolean {
  return canViewResourceClient(session, FINANCEIRO_RESOURCE.aprovacoes);
}

export function canViewFinanceiroVendaDireta(session: ClientAuthSession): boolean {
  return canViewResourceClient(session, FINANCEIRO_RESOURCE.vendaDireta);
}

export function hasAnyFinanceiroSubmodule(session: ClientAuthSession): boolean {
  return (
    canViewFinanceiroLancamentos(session) ||
    canViewFinanceiroComissoes(session) ||
    canViewFinanceiroExtrato(session) ||
    canViewResourceClient(session, FINANCEIRO_RESOURCE.aprovacoes) ||
    canViewResourceClient(session, FINANCEIRO_RESOURCE.vendaDireta)
  );
}

/** Rota inicial ao clicar em Financeiro na sidebar. */
export function getFinanceiroDefaultHref(session: ClientAuthSession): string {
  if (canViewFinanceiroLancamentos(session)) return "/financeiro";
  if (canViewFinanceiroAprovacoes(session) || canViewFinanceiroVendaDireta(session)) {
    return "/financeiro";
  }
  if (canViewFinanceiroComissoes(session)) return "/financeiro/comissoes";
  if (canViewFinanceiroExtrato(session)) return "/financeiro/extrato";
  return "/financeiro";
}

export function pathnameAllowedInFinanceiro(
  pathname: string,
  session: ClientAuthSession
): boolean {
  if (pathname === "/financeiro" || pathname.startsWith("/financeiro?")) {
    return (
      canViewFinanceiroLancamentos(session) ||
      canViewFinanceiroAprovacoes(session) ||
      canViewFinanceiroVendaDireta(session)
    );
  }
  if (pathname.startsWith("/financeiro/comissoes")) {
    return canViewFinanceiroComissoes(session);
  }
  if (pathname.startsWith("/financeiro/extrato")) {
    return canViewFinanceiroExtrato(session);
  }
  return canViewFinanceiroLancamentos(session);
}

/** `null` = rota permitida; string = redirecionar antes de renderizar a página. */
export function getFinanceiroRedirectTarget(
  pathname: string,
  session: ClientAuthSession
): string | null {
  if (!pathname.startsWith("/financeiro")) return null;
  if (!hasAnyFinanceiroSubmodule(session)) return "/";
  if (pathnameAllowedInFinanceiro(pathname, session)) return null;
  const target = getFinanceiroDefaultHref(session);
  return target === pathname ? "/" : target;
}
