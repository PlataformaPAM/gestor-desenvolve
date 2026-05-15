"use client";

import { Trash2, AlertCircle, AlertTriangle, Pencil, ChevronRight } from "lucide-react";
import clsx from "clsx";
import type { Tarefa } from "@/lib/tarefas/types";
import { STATUS_LABELS, PRIORIDADE_LABELS, getSlaTarefa } from "@/lib/tarefas/constants";

function formatData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function DataFimCell({ tarefa }: { tarefa: Tarefa }) {
  const sla = getSlaTarefa(tarefa.dataFim, tarefa.status);
  return (
    <td className="px-6 py-4 text-sm align-middle">
      <div className="space-y-1">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Início: <span className="font-medium text-slate-700 dark:text-slate-200">{formatData(tarefa.dataInicio)}</span>
        </p>
        <p
          className={clsx(
            "inline-flex items-center gap-1 text-xs",
            sla === "atrasado" && "font-medium text-red-600 dark:text-red-400",
            sla === "atencao" && "font-semibold text-amber-600 dark:text-amber-400",
            sla === "no_prazo" && "text-slate-600 dark:text-slate-300"
          )}
        >
          {sla === "atrasado" && (
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
          )}
          {sla === "atencao" && (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          )}
          Final: {formatData(tarefa.dataFim)}
        </p>
      </div>
    </td>
  );
}

type TarefasTableProps = {
  tarefas: Tarefa[];
  onAbrirTarefa: (t: Tarefa) => void;
  onExcluir?: (t: Tarefa) => void;
};

export function TarefasTable({
  tarefas,
  onAbrirTarefa,
  onExcluir,
}: TarefasTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-[44%]" />
            <col className="w-[22%]" />
            <col className="w-[12%]" />
            <col className="w-[14%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80">
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Tarefa
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Prazos
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Prioridade
              </th>
              <th className="w-20 px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {tarefas.map((t) => (
              <tr
                key={t.id}
                onClick={() => onAbrirTarefa(t)}
                className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/80"
              >
                <td className="px-6 py-4 align-middle">
                  <div className="min-w-0 space-y-1.5">
                    {t.codigo ? (
                      <p className="inline-flex rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:border-violet-500/40 dark:bg-violet-950/40 dark:text-violet-300">
                        {t.codigo}
                      </p>
                    ) : null}
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{t.titulo}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-medium">Responsável:</span> {t.responsavel.nome}
                    </p>
                    {t.clienteNome ? (
                      <p className="truncate text-xs text-slate-600 dark:text-slate-300">
                        <span className="font-medium">Cliente:</span> {t.clienteNome}
                      </p>
                    ) : null}
                  </div>
                </td>
                <DataFimCell tarefa={t} />
                <td className="px-6 py-4 align-middle">
                  <span
                    className={clsx(
                      "inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      t.status === "concluido" &&
                        "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-300",
                      t.status === "em_andamento" &&
                        "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-500/40 dark:bg-blue-950/50 dark:text-blue-300",
                      t.status === "impedimento" &&
                        "border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-500/40 dark:bg-orange-950/50 dark:text-orange-300",
                      t.status === "a_fazer" &&
                        "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    )}
                  >
                    {STATUS_LABELS[t.status]}
                  </span>
                </td>
                <td className="px-6 py-4 align-middle">
                  <span
                    className={clsx(
                      "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      t.prioridade === "urgente" &&
                        "border-red-200 bg-red-100 text-red-700 dark:border-red-500/40 dark:bg-red-950/50 dark:text-red-300",
                      t.prioridade === "alta" &&
                        "border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-500/40 dark:bg-orange-950/50 dark:text-orange-300",
                      t.prioridade === "media" &&
                        "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-300",
                      t.prioridade === "baixa" &&
                        "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    )}
                  >
                    {PRIORIDADE_LABELS[t.prioridade]}
                  </span>
                </td>
                <td
                  className="px-6 py-4 text-right align-middle"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="inline-flex items-center justify-end gap-1">
                    <span
                      className="pointer-events-none inline-flex items-center gap-0.5 text-slate-400 dark:text-slate-500"
                      aria-hidden
                    >
                      <Pencil className="h-4 w-4" />
                      <ChevronRight className="h-4 w-4" />
                    </span>
                    {onExcluir && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onExcluir(t);
                        }}
                        className="rounded-full p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tarefas.length === 0 && (
        <div className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
          Nenhuma tarefa encontrada com os filtros aplicados.
        </div>
      )}
    </div>
  );
}
