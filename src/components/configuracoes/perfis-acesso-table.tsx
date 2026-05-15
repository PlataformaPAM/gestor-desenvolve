"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  FileText,
  Handshake,
  LifeBuoy,
  ListTodo,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  Pencil,
  SquareArrowOutUpRight,
  UserCog,
  Users,
  Wallet,
  LayoutGrid,
} from "lucide-react";
import type { PerfilAcesso, ModuloPermissao } from "@/lib/configuracoes/types";
import { MODULO_LABELS } from "@/lib/configuracoes/constants";
import { DB_PERMISSION_MODULES } from "@/lib/configuracoes/permission-utils";
import { buildProfileColorMap } from "@/lib/configuracoes/profile-color-map";

type PerfisAcessoTableProps = {
  perfis: PerfilAcesso[];
  onEditar?: (p: PerfilAcesso) => void;
  onToggle?: (perfilId: string, modulo: ModuloPermissao, value: boolean) => void;
  readOnly?: boolean;
  allowedModules?: ModuloPermissao[];
  moduleLabels?: Partial<Record<ModuloPermissao, string>>;
};

type PermissionColumn = {
  id: string;
  label: string;
  modulo: ModuloPermissao;
  icon: typeof Handshake;
  activeClassName: string;
  iconClassName: string;
};

const ALL_PERMISSION_COLUMNS: PermissionColumn[] = [
  {
    id: "comercial",
    label: "Comercial",
    modulo: "comercial",
    icon: Handshake,
    activeClassName:
      "border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-700/70 dark:bg-blue-900/40 dark:text-blue-200",
    iconClassName: "text-blue-700 dark:text-blue-300",
  },
  {
    id: "financeiro",
    label: "Financeiro",
    modulo: "financeiro",
    icon: Wallet,
    activeClassName:
      "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700/70 dark:bg-emerald-900/40 dark:text-emerald-200",
    iconClassName: "text-emerald-700 dark:text-emerald-300",
  },
  {
    id: "clientes",
    label: "Clientes",
    modulo: "clientes",
    icon: Users,
    activeClassName:
      "border-cyan-300 bg-cyan-100 text-cyan-700 dark:border-cyan-700/70 dark:bg-cyan-900/40 dark:text-cyan-200",
    iconClassName: "text-cyan-700 dark:text-cyan-300",
  },
  {
    id: "contratos",
    label: "Contratos",
    modulo: "contratos",
    icon: ScrollText,
    activeClassName:
      "border-indigo-300 bg-indigo-100 text-indigo-700 dark:border-indigo-700/70 dark:bg-indigo-900/40 dark:text-indigo-200",
    iconClassName: "text-indigo-700 dark:text-indigo-300",
  },
  {
    id: "solucoes",
    label: "Soluções",
    modulo: "solucoes",
    icon: Package,
    activeClassName:
      "border-purple-300 bg-purple-100 text-purple-700 dark:border-purple-700/70 dark:bg-purple-900/40 dark:text-purple-200",
    iconClassName: "text-purple-700 dark:text-purple-300",
  },
  {
    id: "suporte",
    label: "Suporte",
    modulo: "helpdesk",
    icon: LifeBuoy,
    activeClassName:
      "border-orange-300 bg-orange-100 text-orange-700 dark:border-orange-700/70 dark:bg-orange-900/40 dark:text-orange-200",
    iconClassName: "text-orange-700 dark:text-orange-300",
  },
  {
    id: "pos-venda",
    label: "Pós-venda",
    modulo: "posVenda",
    icon: CheckCircle2,
    activeClassName:
      "border-violet-300 bg-violet-100 text-violet-700 dark:border-violet-700/70 dark:bg-violet-900/40 dark:text-violet-200",
    iconClassName: "text-violet-700 dark:text-violet-300",
  },
  {
    id: "tarefas",
    label: "Tarefas Internas",
    modulo: "tarefas",
    icon: ListTodo,
    activeClassName:
      "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700/70 dark:bg-amber-900/40 dark:text-amber-200",
    iconClassName: "text-amber-700 dark:text-amber-300",
  },
  {
    id: "relatorios",
    label: "Relatórios",
    modulo: "relatorios",
    icon: BarChart3,
    activeClassName:
      "border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-700/70 dark:bg-rose-900/40 dark:text-rose-200",
    iconClassName: "text-rose-700 dark:text-rose-300",
  },
  {
    id: "rh",
    label: "RH e Parceiros",
    modulo: "rh",
    icon: UserCog,
    activeClassName:
      "border-fuchsia-300 bg-fuchsia-100 text-fuchsia-700 dark:border-fuchsia-700/70 dark:bg-fuchsia-900/40 dark:text-fuchsia-200",
    iconClassName: "text-fuchsia-700 dark:text-fuchsia-300",
  },
  {
    id: "configuracoes",
    label: "Configurações",
    modulo: "configuracoes",
    icon: Settings,
    activeClassName:
      "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
    iconClassName: "text-slate-700 dark:text-slate-300",
  },
  {
    id: "cfg-docs",
    label: "Construtor de Documentos",
    modulo: "configuracoes_construtor_documentos",
    icon: FileText,
    activeClassName:
      "border-lime-300 bg-lime-100 text-lime-700 dark:border-lime-700/70 dark:bg-lime-900/40 dark:text-lime-200",
    iconClassName: "text-lime-700 dark:text-lime-300",
  },
  {
    id: "cfg-logs",
    label: "Logs do Sistema",
    modulo: "configuracoes_logs",
    icon: Activity,
    activeClassName:
      "border-red-300 bg-red-100 text-red-700 dark:border-red-700/70 dark:bg-red-900/40 dark:text-red-200",
    iconClassName: "text-red-700 dark:text-red-300",
  },
  {
    id: "cfg-perfis",
    label: "Perfis de Acesso",
    modulo: "configuracoes_perfis",
    icon: ShieldCheck,
    activeClassName:
      "border-yellow-300 bg-yellow-100 text-yellow-700 dark:border-yellow-700/70 dark:bg-yellow-900/40 dark:text-yellow-200",
    iconClassName: "text-yellow-700 dark:text-yellow-300",
  },
  {
    id: "cfg-usuarios",
    label: "Usuários",
    modulo: "configuracoes_usuarios",
    icon: Users,
    activeClassName:
      "border-sky-300 bg-sky-100 text-sky-700 dark:border-sky-700/70 dark:bg-sky-900/40 dark:text-sky-200",
    iconClassName: "text-sky-700 dark:text-sky-300",
  },
  {
    id: "portal-cliente",
    label: "Portal do Cliente",
    modulo: "portal_cliente",
    icon: LayoutGrid,
    activeClassName:
      "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-700/70 dark:bg-sky-900/40 dark:text-sky-200",
    iconClassName: "text-sky-700 dark:text-sky-300",
  },
];

export function PerfisAcessoTable({
  perfis,
  onEditar,
  onToggle,
  readOnly = true,
  allowedModules,
  moduleLabels,
}: PerfisAcessoTableProps) {
  const modules =
    allowedModules ?? ([...DB_PERMISSION_MODULES, "relatorios", "portal_cliente"] as ModuloPermissao[]);
  const columns = ALL_PERMISSION_COLUMNS.filter((column) => modules.includes(column.modulo));
  const resolveLabel = (mod: ModuloPermissao) => moduleLabels?.[mod] ?? MODULO_LABELS[mod];
  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const [visiblePermissionCount, setVisiblePermissionCount] = useState(columns.length);

  useEffect(() => {
    const element = tableWrapRef.current;
    if (!element) return;
    const PROFILE_COL_MIN_WIDTH = 260;
    const VIEW_COL_MIN_WIDTH = 130;
    const PERMISSION_COL_MIN_WIDTH = 132;
    const MIN_PERMISSION_COLUMNS = 1;

    const updateVisibleCount = () => {
      const width = element.clientWidth;
      const availableForPermissions = Math.max(
        0,
        width - PROFILE_COL_MIN_WIDTH - VIEW_COL_MIN_WIDTH
      );
      const fitCount = Math.floor(availableForPermissions / PERMISSION_COL_MIN_WIDTH);
      const clamped = Math.max(
        MIN_PERMISSION_COLUMNS,
        Math.min(columns.length, fitCount)
      );
      setVisiblePermissionCount(clamped);
    };

    updateVisibleCount();
    const observer = new ResizeObserver(() => updateVisibleCount());
    observer.observe(element);
    window.addEventListener("resize", updateVisibleCount);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateVisibleCount);
    };
  }, [columns.length]);

  const visibleColumns = useMemo(
    () => columns.slice(0, visiblePermissionCount),
    [columns, visiblePermissionCount]
  );
  const profileColorById = useMemo(() => buildProfileColorMap(perfis), [perfis]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
      <div ref={tableWrapRef} className="overflow-x-hidden">
        <table className="w-full table-fixed divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800/70">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Perfil
              </th>
              {visibleColumns.map((column) => {
                const Icon = column.icon;
                return (
                <th
                  key={column.id}
                  scope="col"
                  className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={column.label}>
                    <Icon className={`h-3.5 w-3.5 ${column.iconClassName}`} />
                    {column.label || resolveLabel(column.modulo)}
                  </span>
                </th>
                );
              })}
              {onEditar && (
                <th scope="col" className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Abrir perfil
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
            {perfis.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3">
                  <div className="inline-flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                    <ShieldCheck
                      className="h-4 w-4"
                      style={{ color: profileColorById.get(p.id)?.color }}
                      aria-hidden
                    />
                    {p.nome}
                  </div>
                </td>
                {visibleColumns.map((column) => (
                  <td key={column.id} className="px-3 py-3 text-center">
                    {readOnly ? (
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded border ${
                          p.permissoes[column.modulo]
                            ? column.activeClassName
                            : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-500"
                        }`}
                      >
                        {p.permissoes[column.modulo] ? "✓" : "—"}
                      </span>
                    ) : (
                      <label className="flex cursor-pointer justify-center">
                        <input
                          type="checkbox"
                          checked={!!p.permissoes[column.modulo]}
                          onChange={(e) =>
                            onToggle?.(p.id, column.modulo, e.target.checked)
                          }
                          className="h-4 w-4 rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9]"
                        />
                      </label>
                    )}
                  </td>
                ))}
                {onEditar && (
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => onEditar(p)}
                      className="inline-flex h-8 items-center justify-center gap-1 rounded-md px-2 text-slate-500 hover:bg-violet-50 hover:text-[#6D28D9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] dark:text-slate-400 dark:hover:bg-violet-900/30 dark:hover:text-violet-300"
                      aria-label="Abrir perfil"
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                      <SquareArrowOutUpRight className="h-4 w-4" aria-hidden />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
