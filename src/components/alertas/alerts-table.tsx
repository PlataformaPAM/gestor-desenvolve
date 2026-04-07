"use client";

import clsx from "clsx";
import { AlertCircle, Bell, CheckCircle2, ChevronRight, DollarSign, Eye, Trash2 } from "lucide-react";

type ModuloAlerta = "tarefas" | "financeiro" | "sistema" | "comercial" | "contratos" | "helpdesk" | "posVenda";

export type AlertaRow = {
  id: string;
  modulo: ModuloAlerta;
  titulo: string;
  descricao: string;
  data: string;
  lida: boolean;
  prioridade?: "urgente" | "alta" | "normal";
  slaLabel?: string | null;
};

function IconeModuloAlerta({ modulo }: { modulo: ModuloAlerta }) {
  switch (modulo) {
    case "tarefas":
      return <CheckCircle2 className="h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" />;
    case "financeiro":
      return <DollarSign className="h-5 w-5 shrink-0 text-red-500 dark:text-red-400" />;
    case "sistema":
      return <Bell className="h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" />;
    case "comercial":
      return <AlertCircle className="h-5 w-5 shrink-0 text-fuchsia-600 dark:text-fuchsia-400" />;
    case "contratos":
      return <CheckCircle2 className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />;
    case "helpdesk":
      return <AlertCircle className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" />;
    case "posVenda":
      return <CheckCircle2 className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />;
    default:
      return <AlertCircle className="h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" />;
  }
}

function formatDataRelativa(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return "Agora";
  if (diffMin < 60) return `Ha ${diffMin} min`;
  if (diffH < 24) return `Ha ${diffH} hora${diffH > 1 ? "s" : ""}`;
  if (diffD === 1) return "Ontem";
  if (diffD < 7) return `Ha ${diffD} dias`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

type AlertsTableProps = {
  alertas: AlertaRow[];
  onMarcarComoLida: (id: string) => void;
  onExcluir: (alerta: AlertaRow) => void;
};

export function AlertsTable({ alertas, onMarcarComoLida, onExcluir }: AlertsTableProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80">
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Alerta</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Modulo</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Criticidade</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Data</th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {alertas.map((a) => (
                <tr key={a.id} className={clsx("transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60", !a.lida && "bg-violet-50/70 dark:bg-violet-950/25")}>
                  <td className="px-6 py-4">
                    <p className={clsx("text-sm", a.lida ? "font-medium text-slate-700 dark:text-slate-200" : "font-semibold text-slate-900 dark:text-slate-100")}>
                      {a.titulo}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{a.descricao}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <IconeModuloAlerta modulo={a.modulo} />
                      <span>{a.modulo}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={clsx(
                        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        (a.prioridade ?? "normal") === "urgente" && "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
                        (a.prioridade ?? "normal") === "alta" && "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
                        (a.prioridade ?? "normal") === "normal" && "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      )}>
                        {a.prioridade ?? "normal"}
                      </span>
                      {a.slaLabel && (
                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                          {a.slaLabel}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{formatDataRelativa(a.data)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="ml-auto flex items-center justify-end gap-1">
                      <button type="button" onClick={() => onMarcarComoLida(a.id)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200" title="Marcar como lida" aria-label="Marcar como lida">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => onExcluir(a)} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/50 dark:hover:text-red-400" title="Excluir alerta" aria-label="Excluir alerta">
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {alertas.length === 0 && (
          <div className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum alerta encontrado.</div>
        )}
      </div>

      <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
        {alertas.map((a) => (
          <div key={a.id} className={clsx("px-4 py-4", !a.lida && "bg-violet-50/70 dark:bg-violet-950/25")}>
            <div className="flex items-start gap-2">
              <IconeModuloAlerta modulo={a.modulo} />
              <div className="min-w-0 flex-1">
                <p className={clsx("text-sm", a.lida ? "font-medium text-slate-700 dark:text-slate-200" : "font-semibold text-slate-900 dark:text-slate-100")}>{a.titulo}</p>
                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{a.descricao}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className={clsx(
                    "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    (a.prioridade ?? "normal") === "urgente" && "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
                    (a.prioridade ?? "normal") === "alta" && "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
                    (a.prioridade ?? "normal") === "normal" && "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  )}>{a.prioridade ?? "normal"}</span>
                  {a.slaLabel && <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">{a.slaLabel}</span>}
                  <span className="text-xs text-slate-500 dark:text-slate-400">{formatDataRelativa(a.data)}</span>
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-end gap-1">
              <button type="button" onClick={() => onMarcarComoLida(a.id)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200" title="Marcar como lida" aria-label="Marcar como lida">
                <Eye className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => onExcluir(a)} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/50 dark:hover:text-red-400" title="Excluir alerta" aria-label="Excluir alerta">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {alertas.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum alerta encontrado.</div>
        )}
      </div>
    </div>
  );
}
