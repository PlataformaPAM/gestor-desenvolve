"use client";

import { Check, ChevronRight } from "lucide-react";
import type { Tarefa, UsuarioTarefa } from "@/lib/tarefas/types";
import { PRIORIDADE_LABELS } from "@/lib/tarefas/constants";
import clsx from "clsx";

const PRIORIDADE_BADGE: Record<Tarefa["prioridade"], string> = {
  urgente:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-950/50 dark:text-red-300",
  alta:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-300",
  media:
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  baixa:
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

function getResponsavelAtual(tarefa: Tarefa): UsuarioTarefa | null {
  if (tarefa.status === "concluido") return null;
  return tarefa.responsavel;
}

function Avatar({ usuario }: { usuario: UsuarioTarefa }) {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6D28D9]/10 text-xs font-semibold text-[#6D28D9] dark:bg-violet-500/20 dark:text-violet-300"
      title={usuario.nome}
    >
      {usuario.nome.slice(0, 2).toUpperCase()}
    </div>
  );
}

type TarefasListProps = {
  tarefas: Tarefa[];
  usuarios: Map<string, UsuarioTarefa>;
  currentUserId: string;
  onAbrirDetalhe: (tarefa: Tarefa) => void;
  onToggleConcluir?: (tarefa: Tarefa) => void;
};

function formatData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TarefasList({
  tarefas,
  usuarios: _usuarios,
  currentUserId: _currentUserId,
  onAbrirDetalhe,
  onToggleConcluir,
}: TarefasListProps) {
  return (
    <>
      {/* Desktop: tabela */}
      <div className="hidden md:block rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80">
                <th className="w-10 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {" "}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Tarefa
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Responsável
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Prioridade
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Atualizado
                </th>
                <th className="w-10 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {" "}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {tarefas.map((t) => {
                const responsavel = getResponsavelAtual(t);
                const concluida = t.status === "concluido";
                return (
                  <tr
                    key={t.id}
                    className={clsx(
                      "transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/80",
                      concluida && "bg-slate-50/50 dark:bg-slate-800/40"
                    )}
                  >
                    <td className="px-4 py-3">
                      {!concluida && onToggleConcluir && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleConcluir(t);
                          }}
                          className="rounded border border-slate-300 p-1 text-slate-400 hover:border-[#6D28D9] hover:text-[#6D28D9] dark:border-slate-600 dark:hover:border-violet-500 dark:hover:text-violet-400"
                          aria-label="Marcar concluída"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      {concluida && (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{t.titulo}</p>
                      {t.descricao && (
                        <p className="line-clamp-1 text-sm text-slate-500 dark:text-slate-400">{t.descricao}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {responsavel ? (
                        <div className="flex items-center gap-2">
                          <Avatar usuario={responsavel} />
                          <span className="text-sm text-slate-700 dark:text-slate-300">{responsavel.nome}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400 dark:text-slate-500">Concluída</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          PRIORIDADE_BADGE[t.prioridade]
                        )}
                      >
                        {PRIORIDADE_LABELS[t.prioridade]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {formatData(t.dataFim)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onAbrirDetalhe(t)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                        aria-label="Ver detalhes"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {tarefas.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhuma tarefa encontrada.
          </div>
        )}
      </div>

      {/* Mobile: cards compactos com checkbox e foto do responsável */}
      <div className="md:hidden space-y-3">
        {tarefas.map((t) => {
          const responsavel = getResponsavelAtual(t);
          const concluida = t.status === "concluido";
          return (
            <div
              key={t.id}
              onClick={() => onAbrirDetalhe(t)}
              className={clsx(
                "flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900",
                concluida && "bg-slate-50/50 dark:bg-slate-800/50"
              )}
            >
              {!concluida && onToggleConcluir ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleConcluir(t);
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-400 dark:border-slate-600"
                  aria-label="Concluir"
                >
                  <Check className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60">
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 font-medium text-slate-900 dark:text-slate-100">{t.titulo}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={clsx(
                      "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                      PRIORIDADE_BADGE[t.prioridade]
                    )}
                  >
                    {PRIORIDADE_LABELS[t.prioridade]}
                  </span>
                  {responsavel && (
                    <div className="flex items-center gap-1">
                      <Avatar usuario={responsavel} />
                      <span className="truncate text-xs text-slate-500 dark:text-slate-400">{responsavel.nome}</span>
                    </div>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
            </div>
          );
        })}
        {tarefas.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            Nenhuma tarefa encontrada.
          </div>
        )}
      </div>
    </>
  );
}
