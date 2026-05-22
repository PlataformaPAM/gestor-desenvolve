import type { ModuloPermissao } from "@/lib/configuracoes/types";

export type PermissionAction = "ver" | "criar" | "editar" | "excluir";

export type RecursoGrant = {
  ver: boolean;
  criar: boolean;
  editar: boolean;
  excluir: boolean;
  verTodos: boolean;
};

export type GrantsMap = Record<string, RecursoGrant>;

export type PermissionResourceDef = {
  id: string;
  label: string;
  groupId: string;
  groupLabel: string;
  /** Legado: módulo da sidebar / proxy */
  moduloLegado?: ModuloPermissao;
  /** Chave extra em perfil_permissoes_extras (quando não está no enum Prisma) */
  extraModuloKey?: ModuloPermissao;
  /** Excluir sempre desabilitado na UI */
  bloquearExcluir?: boolean;
  /** Ver de todos sempre desabilitado (ex.: comissões) */
  bloquearVerTodos?: boolean;
  ajuda?: string;
};

export const PERMISSION_ACTIONS: { key: keyof RecursoGrant; label: string }[] = [
  { key: "ver", label: "Ver" },
  { key: "criar", label: "Criar" },
  { key: "editar", label: "Editar" },
  { key: "excluir", label: "Excluir" },
  { key: "verTodos", label: "Ver de todos" },
];

/** Catálogo v1 — cada linha = uma linha na matriz do perfil. */
export const PERMISSION_RESOURCES: PermissionResourceDef[] = [
  {
    id: "central.dashboard",
    label: "Central (Home)",
    groupId: "central",
    groupLabel: "Central",
    ajuda: "Cards e KPIs na página inicial.",
  },
  {
    id: "comercial.pipeline",
    label: "Pipeline e leads",
    groupId: "comercial",
    groupLabel: "Comercial",
    moduloLegado: "comercial",
    ajuda: "Sem “Ver de todos”: só leads em que é responsável ou colaborador.",
  },
  {
    id: "financeiro.lancamentos",
    label: "Lançamentos",
    groupId: "financeiro",
    groupLabel: "Financeiro",
    moduloLegado: "financeiro",
  },
  {
    id: "financeiro.comissoes",
    label: "Comissões",
    groupId: "financeiro",
    groupLabel: "Financeiro",
    moduloLegado: "financeiro",
    bloquearVerTodos: true,
    ajuda: "Comissões são sempre apenas do próprio usuário.",
  },
  {
    id: "financeiro.extrato",
    label: "Extrato",
    groupId: "financeiro",
    groupLabel: "Financeiro",
    moduloLegado: "financeiro",
  },
  {
    id: "financeiro.aprovacoes",
    label: "Aprovações (fechamento)",
    groupId: "financeiro",
    groupLabel: "Financeiro",
    moduloLegado: "financeiro",
  },
  {
    id: "financeiro.venda_direta",
    label: "Venda direta",
    groupId: "financeiro",
    groupLabel: "Financeiro",
    moduloLegado: "financeiro",
  },
  {
    id: "clientes.cadastro",
    label: "Cadastro de clientes",
    groupId: "clientes",
    groupLabel: "Clientes",
    moduloLegado: "clientes",
    bloquearExcluir: true,
    ajuda:
      "Clientes não podem ser excluídos — apenas inativados. Sem «Ver de todos»: só clientes dos seus leads ou cadastrados por você.",
  },
  {
    id: "contratos.lista",
    label: "Contratos",
    groupId: "contratos",
    groupLabel: "Contratos",
    extraModuloKey: "contratos",
  },
  {
    id: "solucoes.catalogo",
    label: "Catálogo de soluções",
    groupId: "solucoes",
    groupLabel: "Soluções",
    extraModuloKey: "solucoes",
    bloquearVerTodos: true,
    ajuda: "Catálogo compartilhado pela empresa; quem tem Ver enxerga todas as soluções.",
  },
  {
    id: "helpdesk.tickets",
    label: "Chamados",
    groupId: "helpdesk",
    groupLabel: "Suporte",
    moduloLegado: "helpdesk",
    ajuda:
      "Sem «Ver de todos»: tickets em que você é responsável principal ou colaborador (todos os vínculos do chamado).",
  },
  {
    id: "posvenda.tarefas",
    label: "Tarefas e régua",
    groupId: "posvenda",
    groupLabel: "Pós-venda",
    moduloLegado: "posVenda",
  },
  {
    id: "tarefas.internas",
    label: "Tarefas internas",
    groupId: "tarefas",
    groupLabel: "Tarefas",
    moduloLegado: "tarefas",
  },
  {
    id: "rh.colaboradores",
    label: "Colaboradores e parceiros",
    groupId: "rh",
    groupLabel: "RH e Parceiros",
    moduloLegado: "rh",
    ajuda: "Sem «Ver de todos»: consultores veem apenas o próprio cadastro RH vinculado ao usuário.",
  },
  {
    id: "relatorios.comercial",
    label: "Relatório comercial",
    groupId: "relatorios",
    groupLabel: "Relatórios",
    extraModuloKey: "relatorios",
  },
  {
    id: "relatorios.financeiro",
    label: "Relatório financeiro",
    groupId: "relatorios",
    groupLabel: "Relatórios",
    extraModuloKey: "relatorios",
  },
  {
    id: "relatorios.operacional",
    label: "Relatório operacional",
    groupId: "relatorios",
    groupLabel: "Relatórios",
    extraModuloKey: "relatorios",
  },
  {
    id: "relatorios.saude_empresa",
    label: "Saúde da empresa",
    groupId: "relatorios",
    groupLabel: "Relatórios",
    extraModuloKey: "relatorios",
  },
  {
    id: "relatorios.prestacao_contas",
    label: "Prestação de contas",
    groupId: "relatorios",
    groupLabel: "Relatórios",
    extraModuloKey: "relatorios",
  },
  {
    id: "configuracoes.dados_empresa",
    label: "Dados da empresa",
    groupId: "configuracoes",
    groupLabel: "Configurações",
    extraModuloKey: "configuracoes",
    bloquearVerTodos: true,
    ajuda: "Dados institucionais únicos da PAM; não há escopo por usuário.",
  },
  {
    id: "configuracoes.papeis_timbrados",
    label: "Papéis timbrados",
    groupId: "configuracoes",
    groupLabel: "Configurações",
    extraModuloKey: "configuracoes",
    bloquearVerTodos: true,
    ajuda: "Modelos de papel da empresa; não há escopo por usuário.",
  },
  {
    id: "configuracoes.construtor_documentos",
    label: "Construtor de documentos",
    groupId: "configuracoes",
    groupLabel: "Configurações",
    extraModuloKey: "configuracoes_construtor_documentos",
  },
  {
    id: "configuracoes.logs",
    label: "Logs do sistema",
    groupId: "configuracoes",
    groupLabel: "Configurações",
    extraModuloKey: "configuracoes_logs",
  },
  {
    id: "configuracoes.perfis",
    label: "Perfis de acesso",
    groupId: "configuracoes",
    groupLabel: "Configurações",
    extraModuloKey: "configuracoes_perfis",
  },
  {
    id: "configuracoes.usuarios",
    label: "Usuários",
    groupId: "configuracoes",
    groupLabel: "Configurações",
    extraModuloKey: "configuracoes_usuarios",
  },
  {
    id: "portal.acesso",
    label: "Portal do cliente",
    groupId: "portal",
    groupLabel: "Portal",
    extraModuloKey: "portal_cliente",
  },
  {
    id: "alertas.caixa",
    label: "Minha Caixa",
    groupId: "alertas",
    groupLabel: "Alertas",
    ajuda: "Sempre disponível para usuários logados; Ver controla destaque na prática.",
  },
];

const RESOURCE_BY_ID = new Map(PERMISSION_RESOURCES.map((r) => [r.id, r]));

export function getPermissionResource(id: string): PermissionResourceDef | undefined {
  return RESOURCE_BY_ID.get(id);
}

export function groupPermissionResources(): { groupId: string; groupLabel: string; resources: PermissionResourceDef[] }[] {
  const order: string[] = [];
  const map = new Map<string, { groupId: string; groupLabel: string; resources: PermissionResourceDef[] }>();
  for (const r of PERMISSION_RESOURCES) {
    if (!map.has(r.groupId)) {
      order.push(r.groupId);
      map.set(r.groupId, { groupId: r.groupId, groupLabel: r.groupLabel, resources: [] });
    }
    map.get(r.groupId)!.resources.push(r);
  }
  return order.map((id) => map.get(id)!);
}
