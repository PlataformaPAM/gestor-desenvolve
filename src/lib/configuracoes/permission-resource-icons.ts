import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgePercent,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  Handshake,
  ImageUp,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  ListTodo,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import type { PermissionResourceDef } from "@/lib/configuracoes/permission-catalog";

export type PermissionResourceVisual = {
  icon: LucideIcon;
  iconClassName: string;
  chipClassName: string;
};

/**
 * Ícones alinhados à sidebar (`dashboard-shell`), subpáginas e `perfis-acesso-table` / `perfil-form`.
 * Chave = `PermissionResourceDef.id`.
 */
export const PERMISSION_RESOURCE_VISUALS: Record<string, PermissionResourceVisual> = {
  "central.dashboard": {
    icon: LayoutDashboard,
    iconClassName: "text-violet-700 dark:text-violet-300",
    chipClassName:
      "border-violet-200 bg-violet-50 dark:border-violet-700/70 dark:bg-violet-900/40",
  },
  "comercial.pipeline": {
    icon: Handshake,
    iconClassName: "text-blue-700 dark:text-blue-300",
    chipClassName: "border-blue-200 bg-blue-50 dark:border-blue-700/70 dark:bg-blue-900/40",
  },
  "financeiro.lancamentos": {
    icon: Wallet,
    iconClassName: "text-emerald-700 dark:text-emerald-300",
    chipClassName:
      "border-emerald-200 bg-emerald-50 dark:border-emerald-700/70 dark:bg-emerald-900/40",
  },
  "financeiro.comissoes": {
    icon: BadgePercent,
    iconClassName: "text-emerald-700 dark:text-emerald-300",
    chipClassName:
      "border-emerald-200 bg-emerald-50 dark:border-emerald-700/70 dark:bg-emerald-900/40",
  },
  "financeiro.extrato": {
    icon: ScrollText,
    iconClassName: "text-emerald-700 dark:text-emerald-300",
    chipClassName:
      "border-emerald-200 bg-emerald-50 dark:border-emerald-700/70 dark:bg-emerald-900/40",
  },
  "financeiro.aprovacoes": {
    icon: ClipboardCheck,
    iconClassName: "text-amber-700 dark:text-amber-300",
    chipClassName:
      "border-amber-200 bg-amber-50 dark:border-amber-700/70 dark:bg-amber-900/40",
  },
  "financeiro.venda_direta": {
    icon: ShoppingCart,
    iconClassName: "text-emerald-700 dark:text-emerald-300",
    chipClassName:
      "border-emerald-200 bg-emerald-50 dark:border-emerald-700/70 dark:bg-emerald-900/40",
  },
  "clientes.cadastro": {
    icon: Users,
    iconClassName: "text-cyan-700 dark:text-cyan-300",
    chipClassName: "border-cyan-200 bg-cyan-50 dark:border-cyan-700/70 dark:bg-cyan-900/40",
  },
  "contratos.lista": {
    icon: FileText,
    iconClassName: "text-indigo-700 dark:text-indigo-300",
    chipClassName:
      "border-indigo-200 bg-indigo-50 dark:border-indigo-700/70 dark:bg-indigo-900/40",
  },
  "solucoes.catalogo": {
    icon: Package,
    iconClassName: "text-purple-700 dark:text-purple-300",
    chipClassName:
      "border-purple-200 bg-purple-50 dark:border-purple-700/70 dark:bg-purple-900/40",
  },
  "helpdesk.tickets": {
    icon: LifeBuoy,
    iconClassName: "text-orange-700 dark:text-orange-300",
    chipClassName:
      "border-orange-200 bg-orange-50 dark:border-orange-700/70 dark:bg-orange-900/40",
  },
  "posvenda.tarefas": {
    icon: CheckCircle2,
    iconClassName: "text-violet-700 dark:text-violet-300",
    chipClassName:
      "border-violet-200 bg-violet-50 dark:border-violet-700/70 dark:bg-violet-900/40",
  },
  "tarefas.internas": {
    icon: ListTodo,
    iconClassName: "text-amber-700 dark:text-amber-300",
    chipClassName:
      "border-amber-200 bg-amber-50 dark:border-amber-700/70 dark:bg-amber-900/40",
  },
  "rh.colaboradores": {
    icon: UserCog,
    iconClassName: "text-fuchsia-700 dark:text-fuchsia-300",
    chipClassName:
      "border-fuchsia-200 bg-fuchsia-50 dark:border-fuchsia-700/70 dark:bg-fuchsia-900/40",
  },
  "relatorios.comercial": {
    icon: Briefcase,
    iconClassName: "text-rose-700 dark:text-rose-300",
    chipClassName: "border-rose-200 bg-rose-50 dark:border-rose-700/70 dark:bg-rose-900/40",
  },
  "relatorios.financeiro": {
    icon: CircleDollarSign,
    iconClassName: "text-rose-700 dark:text-rose-300",
    chipClassName: "border-rose-200 bg-rose-50 dark:border-rose-700/70 dark:bg-rose-900/40",
  },
  "relatorios.operacional": {
    icon: Layers,
    iconClassName: "text-rose-700 dark:text-rose-300",
    chipClassName: "border-rose-200 bg-rose-50 dark:border-rose-700/70 dark:bg-rose-900/40",
  },
  "relatorios.saude_empresa": {
    icon: Activity,
    iconClassName: "text-rose-700 dark:text-rose-300",
    chipClassName: "border-rose-200 bg-rose-50 dark:border-rose-700/70 dark:bg-rose-900/40",
  },
  "relatorios.prestacao_contas": {
    icon: ShieldCheck,
    iconClassName: "text-rose-700 dark:text-rose-300",
    chipClassName: "border-rose-200 bg-rose-50 dark:border-rose-700/70 dark:bg-rose-900/40",
  },
  "configuracoes.dados_empresa": {
    icon: Building2,
    iconClassName: "text-violet-700 dark:text-violet-300",
    chipClassName:
      "border-violet-200 bg-violet-50 dark:border-violet-700/70 dark:bg-violet-900/40",
  },
  "configuracoes.papeis_timbrados": {
    icon: ImageUp,
    iconClassName: "text-violet-700 dark:text-violet-300",
    chipClassName:
      "border-violet-200 bg-violet-50 dark:border-violet-700/70 dark:bg-violet-900/40",
  },
  "configuracoes.construtor_documentos": {
    icon: FileText,
    iconClassName: "text-lime-700 dark:text-lime-300",
    chipClassName: "border-lime-200 bg-lime-50 dark:border-lime-700/70 dark:bg-lime-900/40",
  },
  "configuracoes.logs": {
    icon: Activity,
    iconClassName: "text-red-700 dark:text-red-300",
    chipClassName: "border-red-200 bg-red-50 dark:border-red-700/70 dark:bg-red-900/40",
  },
  "configuracoes.perfis": {
    icon: ShieldCheck,
    iconClassName: "text-amber-700 dark:text-amber-300",
    chipClassName:
      "border-amber-200 bg-amber-50 dark:border-amber-700/70 dark:bg-amber-900/40",
  },
  "configuracoes.usuarios": {
    icon: Users,
    iconClassName: "text-sky-700 dark:text-sky-300",
    chipClassName: "border-sky-200 bg-sky-50 dark:border-sky-700/70 dark:bg-sky-900/40",
  },
  "portal.acesso": {
    icon: LayoutGrid,
    iconClassName: "text-sky-700 dark:text-sky-300",
    chipClassName: "border-sky-200 bg-sky-50 dark:border-sky-700/70 dark:bg-sky-900/40",
  },
  "alertas.caixa": {
    icon: Bell,
    iconClassName: "text-amber-700 dark:text-amber-300",
    chipClassName:
      "border-amber-200 bg-amber-50 dark:border-amber-700/70 dark:bg-amber-900/40",
  },
};

/** Ícone do módulo na sidebar (fallback se o recurso não estiver no mapa). */
const GROUP_SIDEBAR_VISUALS: Record<string, PermissionResourceVisual> = {
  central: PERMISSION_RESOURCE_VISUALS["central.dashboard"],
  comercial: PERMISSION_RESOURCE_VISUALS["comercial.pipeline"],
  financeiro: PERMISSION_RESOURCE_VISUALS["financeiro.lancamentos"],
  clientes: PERMISSION_RESOURCE_VISUALS["clientes.cadastro"],
  contratos: PERMISSION_RESOURCE_VISUALS["contratos.lista"],
  solucoes: PERMISSION_RESOURCE_VISUALS["solucoes.catalogo"],
  helpdesk: PERMISSION_RESOURCE_VISUALS["helpdesk.tickets"],
  posvenda: PERMISSION_RESOURCE_VISUALS["posvenda.tarefas"],
  tarefas: PERMISSION_RESOURCE_VISUALS["tarefas.internas"],
  rh: PERMISSION_RESOURCE_VISUALS["rh.colaboradores"],
  relatorios: {
    icon: BarChart3,
    iconClassName: "text-rose-700 dark:text-rose-300",
    chipClassName: "border-rose-200 bg-rose-50 dark:border-rose-700/70 dark:bg-rose-900/40",
  },
  configuracoes: {
    icon: Settings,
    iconClassName: "text-violet-700 dark:text-violet-300",
    chipClassName:
      "border-violet-200 bg-violet-50 dark:border-violet-700/70 dark:bg-violet-900/40",
  },
  portal: PERMISSION_RESOURCE_VISUALS["portal.acesso"],
  alertas: PERMISSION_RESOURCE_VISUALS["alertas.caixa"],
};

export function getPermissionResourceVisual(
  resourceId: string,
  def?: Pick<PermissionResourceDef, "groupId">
): PermissionResourceVisual | undefined {
  const direct = PERMISSION_RESOURCE_VISUALS[resourceId];
  if (direct) return direct;
  if (def?.groupId) return GROUP_SIDEBAR_VISUALS[def.groupId];
  return undefined;
}
