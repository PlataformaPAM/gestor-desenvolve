"use client";

import { Paperclip, Trash2, AlertCircle, AlertTriangle } from "lucide-react";
import clsx from "clsx";
import type { Tarefa } from "@/lib/tarefas/types";
import { STATUS_LABELS, PRIORIDADE_LABELS, getSlaTarefa } from "@/lib/tarefas/constants";
import { EntityMetaStrip } from "@/components/ui/entity-meta-strip";

const PRIORIDADE_BADGE: Record<Tarefa["prioridade"], string> = {
  baixa:
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  media:
    "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-300",
  alta:
    "border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-500/40 dark:bg-orange-950/50 dark:text-orange-300",
  urgente:
    "border-red-200 bg-red-100 text-red-700 dark:border-red-500/40 dark:bg-red-950/50 dark:text-red-300",
};

const STATUS_BADGE: Record<Tarefa["status"], string> = {
  a_fazer:
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  em_andamento:
    "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-500/40 dark:bg-blue-950/50 dark:text-blue-300",
  impedimento:
    "border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-500/40 dark:bg-orange-950/50 dark:text-orange-300",
  concluido:
    "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-300",
};

function iniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";
}

function formatData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function DataFimCell({ tarefa }: { tarefa: Tarefa }) {
  const sla = getSlaTarefa(tarefa.dataFim, tarefa.status);
  const label = formatData(tarefa.dataFim);
  return (
    <td className="px-6 py-4 text-sm">
      <span className="text-slate-600 dark:text-slate-400">{formatData(tarefa.dataInicio)}</span>
      <span className="mx-1 text-slate-300 dark:text-slate-600">→</span>
      <span
        className={clsx(
          "inline-flex items-center gap-1",
          sla === "atrasado" && "font-medium text-red-600 dark:text-red-400",
          sla === "atencao" && "font-semibold text-amber-600 dark:text-amber-400",
          sla === "no_prazo" && "text-slate-600 dark:text-slate-400"
        )}
      >
        {sla === "atrasado" && (
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
        )}
        {sla === "atencao" && (
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        )}
        {sla === "atencao" && (
          <span className="text-xs text-amber-600 dark:text-amber-400">Vence em breve · </span>
        )}
        {label}
      </span>
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
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80">
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Tarefa
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Responsável
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
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {t.anexos?.length > 0 && (
                      <Paperclip className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
                    )}
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{t.titulo}</p>
                      {t.descricao && (
                        <p className="mt-0.5 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">
                          {t.descricao}
                        </p>
                      )}
                      <EntityMetaStrip
                        className="mt-1.5"
                        criadoPorNome={t.registroCriadoPorNome}
                        criadoEm={t.createdAt}
                        atualizadoEm={t.updatedAt}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex -space-x-2">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6D28D9]/15 text-xs font-semibold text-[#6D28D9] ring-2 ring-white dark:bg-violet-500/20 dark:text-violet-300 dark:ring-slate-900"
                      title={t.responsavel.nome}
                    >
                      {iniciais(t.responsavel.nome)}
                    </div>
                    {t.colaboradores?.slice(0, 2).map((c) => (
                      <div
                        key={c.id}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600 ring-2 ring-white dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-900"
                        title={c.nome}
                      >
                        {iniciais(c.nome)}
                      </div>
                    ))}
                  </div>
                </td>
                <DataFimCell tarefa={t} />
                <td className="px-6 py-4">
                  <span
                    className={clsx(
                      "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      STATUS_BADGE[t.status]
                    )}
                  >
                    {STATUS_LABELS[t.status]}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={clsx(
                      "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      PRIORIDADE_BADGE[t.prioridade]
                    )}
                  >
                    {PRIORIDADE_LABELS[t.prioridade]}
                  </span>
                </td>
                <td
                  className="px-6 py-4 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
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
