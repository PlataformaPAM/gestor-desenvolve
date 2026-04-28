"use client";

import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { useState } from "react";
import { Search, ListTodo } from "lucide-react";
import clsx from "clsx";
import type { Tarefa, StatusTarefa } from "@/lib/tarefas/types";
import { STATUS_LABELS, PRIORIDADE_LABELS, getSlaTarefa } from "@/lib/tarefas/constants";

const COLUNAS_ORDER: StatusTarefa[] = [
  "a_fazer",
  "em_andamento",
  "impedimento",
  "concluido",
];

const COLUNA_STYLES: Record<StatusTarefa, { bg: string; border: string; header: string; badge: string }> = {
  em_andamento: {
    bg: "bg-blue-50/80 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-700/50",
    header: "text-blue-800 dark:text-blue-300",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  },
  impedimento: {
    bg: "bg-orange-50/80 dark:bg-orange-950/40",
    border: "border-orange-200 dark:border-orange-700/50",
    header: "text-orange-800 dark:text-orange-300",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  },
  concluido: {
    bg: "bg-emerald-50/80 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-700/50",
    header: "text-emerald-800 dark:text-emerald-300",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
  a_fazer: {
    bg: "bg-slate-50/80 dark:bg-slate-800/50",
    border: "border-slate-200 dark:border-slate-600",
    header: "text-slate-700 dark:text-slate-200",
    badge: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  },
};

const PRIORIDADE_BADGE: Record<Tarefa["prioridade"], string> = {
  baixa: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600",
  media: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700/50",
  alta: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-700/50",
  urgente: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-700/50",
};

function formatDataHora(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function prazoDiasLabel(dataFim: string, status: Tarefa["status"]): string {
  if (status === "concluido") return "Concluída";
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const d = new Date(dataFim);
  d.setHours(0, 0, 0, 0);
  const diffMs = d.getTime() - hoje.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return `${Math.abs(diffDays)} dia(s) em atraso`;
  if (diffDays === 0) return "Vence hoje";
  return `${diffDays} dia(s) restantes`;
}

type TarefasKanbanProps = {
  tarefas: Tarefa[];
  onAbrirTarefa: (t: Tarefa) => void;
  onDragEnd: (result: DropResult) => void;
};

export function TarefasKanban({
  tarefas,
  onAbrirTarefa,
  onDragEnd,
}: TarefasKanbanProps) {
  const [buscasColunas, setBuscasColunas] = useState<Record<string, string>>({});

  const porColuna = COLUNAS_ORDER.map((status) => ({
    id: status,
    label: STATUS_LABELS[status],
    tarefas: tarefas.filter((t) => {
      if (t.status !== status) return false;
      const termo = (buscasColunas[status] ?? "").trim().toLowerCase();
      if (!termo) return true;
      return (
        t.titulo.toLowerCase().includes(termo) ||
        (t.descricao ?? "").toLowerCase().includes(termo) ||
        t.responsavel.nome.toLowerCase().includes(termo)
      );
    }),
    styles: COLUNA_STYLES[status],
  }));

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2">
      <div className="flex gap-3 lg:gap-4 min-w-max lg:min-w-0 lg:grid lg:grid-cols-4">
        {porColuna.map((col) => (
          <Droppable key={col.id} droppableId={col.id}>
            {(provided, snapshot) => (
              <div className="flex-shrink-0 w-[280px] snap-center lg:snap-none lg:w-full lg:min-w-0">
                <div
                  className={clsx(
                    "h-full min-h-[140px] rounded-xl border border-slate-200 bg-slate-50/50 p-3 transition-all duration-200 dark:border-slate-600 dark:bg-slate-800/40",
                    col.styles.border,
                    snapshot.isDraggingOver &&
                      "bg-slate-100 border-dashed border-purple-300 dark:bg-slate-800/80 dark:border-violet-500/50"
                  )}
                >
                  <div className="rounded-lg bg-slate-50/80 px-3 py-2.5 backdrop-blur-sm dark:bg-slate-800/60">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className={clsx("text-sm font-semibold", col.styles.header)}>{col.label}</h3>
                      <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", col.styles.badge)}>
                        <ListTodo className="h-3 w-3" />
                        {col.tarefas.length}
                      </span>
                    </div>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar..."
                        value={buscasColunas[col.id] ?? ""}
                        onChange={(e) => setBuscasColunas((prev) => ({ ...prev, [col.id]: e.target.value }))}
                        className="w-full rounded-md border border-transparent bg-slate-50 py-1.5 pl-8 pr-3 text-sm text-slate-700 transition-all placeholder:text-slate-400 focus:border-purple-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100 dark:bg-slate-900/80 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-violet-500 dark:focus:bg-slate-900 dark:focus:ring-violet-900/40"
                      />
                    </div>
                  </div>
                  <div ref={provided.innerRef} {...provided.droppableProps} className="mt-2 min-h-[60px] space-y-2">
                    {col.tarefas.map((t, index) => (
                      <Draggable key={t.id} draggableId={String(t.id)} index={index}>
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            role="button"
                            tabIndex={0}
                            onClick={() => onAbrirTarefa(t)}
                            onKeyDown={(e) => e.key === "Enter" && onAbrirTarefa(t)}
                            style={{ ...dragProvided.draggableProps.style }}
                            className={clsx(
                              "mb-2 last:mb-0 cursor-grab rounded-lg border border-slate-200 bg-white p-3 transition-all duration-200 dark:border-slate-600 dark:bg-slate-900",
                              dragSnapshot.isDragging
                                ? "z-50 cursor-grabbing scale-105 rotate-1 shadow-xl ring-2 ring-purple-500 dark:ring-violet-400"
                                : "shadow-sm"
                            )}
                          >
                            {t.codigo ? (
                              <p className="mb-1 inline-flex rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:border-violet-500/40 dark:bg-violet-950/40 dark:text-violet-300">
                                {t.codigo}
                              </p>
                            ) : null}
                            <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{t.titulo}</p>
                            <div className="mt-2 space-y-2">
                              <div className="min-w-0">
                                <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                                  Responsável:
                                </p>
                                <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                                  {t.responsavel.nome}
                                </p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                                  Prazo:
                                </p>
                                <p
                                  className={clsx(
                                    "text-xs font-semibold",
                                    getSlaTarefa(t.dataFim, t.status) === "atrasado" &&
                                      "text-red-600 dark:text-red-300",
                                    getSlaTarefa(t.dataFim, t.status) === "atencao" &&
                                      "text-amber-700 dark:text-amber-300",
                                    getSlaTarefa(t.dataFim, t.status) === "no_prazo" &&
                                      "text-[#6D28D9] dark:text-violet-300"
                                  )}
                                >
                                  {prazoDiasLabel(t.dataFim, t.status)}
                                </p>
                              </div>
                              {t.clienteNome ? (
                                <div className="min-w-0">
                                  <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                                    Cliente:
                                  </p>
                                  <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                                    {t.clienteNome}
                                  </p>
                                </div>
                              ) : null}
                              <div className="min-w-0">
                                <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                                  Criado:
                                </p>
                                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                  {formatDataHora(t.createdAt)}
                                </p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                                  Última alteração:
                                </p>
                                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                  {formatDataHora(t.updatedAt)}
                                </p>
                              </div>
                            </div>
                            <span
                              className={clsx(
                                "mt-2.5 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
                                PRIORIDADE_BADGE[t.prioridade]
                              )}
                            >
                              {PRIORIDADE_LABELS[t.prioridade]}
                            </span>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              </div>
            )}
          </Droppable>
        ))}
      </div>
      </div>
    </DragDropContext>
  );
}
