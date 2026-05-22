import {
  canViewResourceClient,
  type ClientAuthSession,
} from "@/lib/configuracoes/permission-client";
import { getFinanceiroDefaultHref } from "@/lib/financeiro/financeiro-nav";

/** Ordem alinhada à sidebar interna (`dashboard-shell` NAV_ITEMS). */
const NAV_ACCESS_ORDER: Array<{ href: string; resourceId?: string; modulo?: string }> = [
  { href: "/", resourceId: "central.dashboard" },
  { href: "/comercial", resourceId: "comercial.pipeline" },
  { href: "/financeiro", resourceId: "financeiro.lancamentos" },
  { href: "/clientes", resourceId: "clientes.cadastro" },
  { href: "/contratos", resourceId: "contratos.lista" },
  { href: "/solucoes", resourceId: "solucoes.catalogo" },
  { href: "/helpdesk", resourceId: "helpdesk.tickets" },
  { href: "/pos-venda", resourceId: "posvenda.tarefas" },
  { href: "/alertas", resourceId: "alertas.caixa" },
  { href: "/tarefas", resourceId: "tarefas.internas" },
  { href: "/relatorios", resourceId: "relatorios.comercial" },
  { href: "/rh", resourceId: "rh.colaboradores" },
];

const FINANCEIRO_NAV_RESOURCES = [
  "financeiro.lancamentos",
  "financeiro.comissoes",
  "financeiro.extrato",
  "financeiro.aprovacoes",
  "financeiro.venda_direta",
] as const;

const RELATORIOS_NAV_RESOURCES = [
  "relatorios.comercial",
  "relatorios.financeiro",
  "relatorios.operacional",
  "relatorios.saude_empresa",
  "relatorios.prestacao_contas",
] as const;

const CONFIG_NAV_RESOURCES = [
  "configuracoes.usuarios",
  "configuracoes.perfis",
  "configuracoes.logs",
  "configuracoes.construtor_documentos",
  "configuracoes.dados_empresa",
  "configuracoes.papeis_timbrados",
] as const;

function canViewNavEntry(auth: ClientAuthSession, entry: (typeof NAV_ACCESS_ORDER)[number]): boolean {
  if (entry.href === "/financeiro") {
    return FINANCEIRO_NAV_RESOURCES.some((id) => canViewResourceClient(auth, id));
  }
  if (entry.href === "/relatorios") {
    return RELATORIOS_NAV_RESOURCES.some((id) => canViewResourceClient(auth, id));
  }
  if (entry.resourceId) {
    return canViewResourceClient(auth, entry.resourceId);
  }
  return true;
}

/** Primeira rota da sidebar que o perfil pode abrir (para redirect da Central). */
export function getFirstAllowedNavHref(auth: ClientAuthSession): string | null {
  for (const entry of NAV_ACCESS_ORDER) {
    if (!canViewNavEntry(auth, entry)) continue;
    if (entry.href === "/financeiro") {
      return getFinanceiroDefaultHref(auth);
    }
    return entry.href;
  }
  if (canViewResourceClient(auth, "configuracoes.dados_empresa") ||
    CONFIG_NAV_RESOURCES.some((id) => canViewResourceClient(auth, id))) {
    return "/configuracoes";
  }
  if (canViewResourceClient(auth, "portal.acesso")) {
    return "/portal";
  }
  return null;
}

export function canViewConfiguracoesNav(auth: ClientAuthSession, isSystemAdmin: boolean): boolean {
  if (isSystemAdmin) return true;
  return CONFIG_NAV_RESOURCES.some((id) => canViewResourceClient(auth, id));
}

export function canViewNavItem(
  auth: ClientAuthSession,
  item: { modulo?: string; resourceId?: string; href?: string },
  isSystemAdmin: boolean
): boolean {
  if (isSystemAdmin) return true;

  if (item.href === "/financeiro" || item.modulo === "financeiro") {
    return FINANCEIRO_NAV_RESOURCES.some((id) => canViewResourceClient(auth, id));
  }

  if (item.href === "/relatorios" || item.modulo === "relatorios") {
    return RELATORIOS_NAV_RESOURCES.some((id) => canViewResourceClient(auth, id));
  }

  if (item.href === "/configuracoes" || item.modulo === "configuracoes") {
    return CONFIG_NAV_RESOURCES.some((id) => canViewResourceClient(auth, id));
  }

  if (item.resourceId) {
    return canViewResourceClient(auth, item.resourceId);
  }

  return false;
}
