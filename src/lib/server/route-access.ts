import type { SessionPayload } from "@/lib/auth";
import { getPermissionResource, PERMISSION_RESOURCES } from "@/lib/configuracoes/permission-catalog";
import { authorize } from "@/lib/server/authorize";
import { isPrivilegedSession } from "@/lib/server/session-access";

const EMPTY_DASHBOARD_PAYLOAD = {
  kpis: [],
  fluxoData: [],
  statusClientes: [],
  atividades: [],
  pipelineBars: [],
  upcoming: [],
  radarModulos: [],
  moduleTiles: [],
};

/** pathname → recurso granular com ação Ver (mais específico primeiro). */
const ROUTE_VER_RESOURCE: Array<[string, string]> = [
  ["/alertas", "alertas.caixa"],
  ["/configuracoes/usuarios", "configuracoes.usuarios"],
  ["/configuracoes/perfis", "configuracoes.perfis"],
  ["/configuracoes/logs", "configuracoes.logs"],
  ["/configuracoes/construtor-documentos", "configuracoes.construtor_documentos"],
  ["/configuracoes/dados-empresa", "configuracoes.dados_empresa"],
  ["/configuracoes/papeis-timbrados", "configuracoes.papeis_timbrados"],
  ["/configuracoes", "configuracoes.dados_empresa"],
  ["/comercial", "comercial.pipeline"],
  ["/clientes", "clientes.cadastro"],
  ["/contratos", "contratos.lista"],
  ["/helpdesk", "helpdesk.tickets"],
  ["/suporte", "helpdesk.tickets"],
  ["/pos-venda", "posvenda.tarefas"],
  ["/solucoes", "solucoes.catalogo"],
  ["/tarefas", "tarefas.internas"],
  ["/rh", "rh.colaboradores"],
  ["/portal/usuarios", "portal.acesso"],
  ["/portal/chamados", "portal.acesso"],
  ["/portal/meu-perfil", "portal.acesso"],
  ["/portal", "portal.acesso"],
  ["/relatorios/prestacao-contas", "relatorios.prestacao_contas"],
  ["/relatorios/saude-empresa", "relatorios.saude_empresa"],
  ["/relatorios/operacional", "relatorios.operacional"],
  ["/relatorios/financeiro", "relatorios.financeiro"],
  ["/relatorios/comercial", "relatorios.comercial"],
  ["/relatorios", "relatorios.comercial"],
];

const FINANCEIRO_VER_RESOURCES = [
  "financeiro.lancamentos",
  "financeiro.comissoes",
  "financeiro.extrato",
  "financeiro.aprovacoes",
  "financeiro.venda_direta",
] as const;

function matchRoutePrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function resourceForPath(pathname: string): string | null {
  const sorted = [...ROUTE_VER_RESOURCE].sort((a, b) => b[0].length - a[0].length);
  for (const [prefix, resourceId] of sorted) {
    if (matchRoutePrefix(pathname, prefix)) return resourceId;
  }
  return null;
}

function canViewResourceRoute(session: SessionPayload, resourceId: string): boolean {
  if (authorize(session, resourceId, "ver").allowed) return true;
  if (session.permissoesGranulares) return false;
  const def = getPermissionResource(resourceId);
  if (!def) return false;
  const legadoKey = def.extraModuloKey ?? def.moduloLegado;
  return legadoKey ? session.permissoes?.[legadoKey] === true : false;
}

function hasAnyFinanceiroVer(session: SessionPayload): boolean {
  if (session.permissoesGranulares) {
    return FINANCEIRO_VER_RESOURCES.some((id) => authorize(session, id, "ver").allowed);
  }
  return session.permissoes?.financeiro === true;
}

function hasAnyCatalogVer(session: SessionPayload): boolean {
  if (session.permissoesGranulares) {
    return PERMISSION_RESOURCES.some((r) => authorize(session, r.id, "ver").allowed);
  }
  const p = session.permissoes ?? {};
  return Object.values(p).some((v) => v === true);
}

/**
 * Verificação granular de rota de página (complementa `hasModuleAccess` legado no proxy).
 * Retorna `false` quando o perfil não tem Ver no recurso da página.
 */
/** Portal interno (equipe) — clientes do portal usam outro fluxo no proxy. */
export function canAccessInternalPortal(session: SessionPayload): boolean {
  if (isPrivilegedSession(session)) return true;
  if (authorize(session, "portal.acesso", "ver").allowed) return true;
  if (!session.permissoesGranulares) {
    return session.permissoes?.portal_cliente === true;
  }
  return false;
}

export function canAccessPageRoute(session: SessionPayload, pathname: string): boolean {
  if (isPrivilegedSession(session)) return true;
  if (!session.perfilId) return false;

  if (session.isPortalCliente && matchRoutePrefix(pathname, "/portal")) {
    return true;
  }

  if (matchRoutePrefix(pathname, "/portal")) {
    return canAccessInternalPortal(session);
  }

  if (pathname === "/" || pathname === "") {
    if (canViewResourceRoute(session, "central.dashboard")) return true;
    return hasAnyCatalogVer(session);
  }

  if (matchRoutePrefix(pathname, "/financeiro")) {
    return hasAnyFinanceiroVer(session);
  }

  const resourceId = resourceForPath(pathname);
  if (!resourceId) return true;

  if (matchRoutePrefix(pathname, "/configuracoes") && resourceId === "configuracoes.dados_empresa") {
    const configResources = [
      "configuracoes.usuarios",
      "configuracoes.perfis",
      "configuracoes.logs",
      "configuracoes.construtor_documentos",
      "configuracoes.dados_empresa",
      "configuracoes.papeis_timbrados",
    ];
    return configResources.some((id) => canViewResourceRoute(session, id));
  }

  if (matchRoutePrefix(pathname, "/relatorios")) {
    const relResources = [
      "relatorios.comercial",
      "relatorios.financeiro",
      "relatorios.operacional",
      "relatorios.saude_empresa",
      "relatorios.prestacao_contas",
    ];
    return relResources.some((id) => canViewResourceRoute(session, id));
  }

  return canViewResourceRoute(session, resourceId);
}

/** Resposta mínima do bootstrap da Central quando o perfil não tem `central.dashboard`. */
export function emptyDashboardBootstrapPayload() {
  return { ...EMPTY_DASHBOARD_PAYLOAD };
}
