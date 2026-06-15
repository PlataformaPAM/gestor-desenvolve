"use client";

import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { useState, useEffect, useMemo } from "react";
import { Search, ListTodo, Pencil, ChevronRight, ChevronLeft } from "lucide-react";
import clsx from "clsx";
import type { Tarefa, StatusTarefa } from "@/lib/tarefas/types";
import { TAREFA_KANBAN_COLUMN_ORDER } from "@/lib/tarefas/types";
import { STATUS_LABELS, getSlaTarefa } from "@/lib/tarefas/constants";
import { PrioridadeBadge } from "@/components/tarefas/prioridade-badge";

const KANBAN_COLLAPSED_STORAGE_KEY = "pam.tarefas.kanban.columns.collapsed";
const KANBAN_COLLAPSED_COL_WIDTH = "3rem";
const COLLAPSED_HEADER_MIN_HEIGHT_PX =
  92 + Math.max(...TAREFA_KANBAN_COLUMN_ORDER.map((s) => STATUS_LABELS[s].length)) * 11;

const COLUNA_STYLES: Record<
  StatusTarefa,
  { bg: string; borderTop: string; header: string; badge: string }
> = {
  a_fazer: {
    bg: "bg-slate-100 dark:bg-slate-800/90",
    borderTop: "border-t-4 border-slate-400 dark:border-slate-500",
    header: "text-slate-700 dark:text-slate-200",
    badge: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  },
  em_andamento: {
    bg: "bg-blue-50 dark:bg-blue-950/45",
    borderTop: "border-t-4 border-blue-500 dark:border-blue-400",
    header: "text-blue-800 dark:text-blue-300",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  },
  aguardando: {
    bg: "bg-orange-50 dark:bg-orange-950/45",
    borderTop: "border-t-4 border-orange-500 dark:border-orange-400",
    header: "text-orange-800 dark:text-orange-300",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  },
  validar: {
    bg: "bg-violet-50 dark:bg-violet-950/45",
    borderTop: "border-t-4 border-violet-500 dark:border-violet-400",
    header: "text-violet-800 dark:text-violet-300",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  },
  concluido: {
    bg: "bg-emerald-50 dark:bg-emerald-950/45",
    borderTop: "border-t-4 border-emerald-500 dark:border-emerald-400",
    header: "text-emerald-800 dark:text-emerald-300",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
  cancelado: {
    bg: "bg-rose-50 dark:bg-rose-950/45",
    borderTop: "border-t-4 border-rose-500 dark:border-rose-400",
    header: "text-rose-800 dark:text-rose-300",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
  },
};

function sanitizeCollapsedState(
  state: Partial<Record<StatusTarefa, boolean>>
): Partial<Record<StatusTarefa, boolean>> {
  const openCount = TAREFA_KANBAN_COLUMN_ORDER.filter((status) => !state[status]).length;
  if (openCount > 0) return state;
  const allMarkedCollapsed = TAREFA_KANBAN_COLUMN_ORDER.every((status) => state[status]);
  if (!allMarkedCollapsed) return state;
  const next = { ...state };
  delete next[TAREFA_KANBAN_COLUMN_ORDER[0]];
  return next;
}

function readCollapsedFromStorage(): Partial<Record<StatusTarefa, boolean>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KANBAN_COLLAPSED_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return sanitizeCollapsedState(parsed as Partial<Record<StatusTarefa, boolean>>);
  } catch {
    return {};
  }
}

function countOpenColumns(state: Partial<Record<StatusTarefa, boolean>>): number {
  return TAREFA_KANBAN_COLUMN_ORDER.filter((status) => !state[status]).length;
}

function formatData(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function prazoDiasLabel(dataFim: string, status: Tarefa["status"]): string {
  if (status === "concluido" || status === "cancelado") return status === "concluido" ? "Concluída" : "Cancelada";
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
  /** Omitir para desabilitar arrastar colunas (sem permissão Editar). */
  onDragEnd?: (result: DropResult) => void;
};

export function TarefasKanban({
  tarefas,
  onAbrirTarefa,
  onDragEnd,
}: TarefasKanbanProps) {
  const dragEnabled = Boolean(onDragEnd);
  const [isMounted, setIsMounted] = useState(false);
  const [buscasColunas, setBuscasColunas] = useState<Record<string, string>>({});
  const [collapsedByStatus, setCollapsedByStatus] = useState<
    Partial<Record<StatusTarefa, boolean>>
  >({});

  useEffect(() => {
    queueMicrotask(() => {
      setIsMounted(true);
      setCollapsedByStatus(readCollapsedFromStorage());
    });
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    try {
      window.localStorage.setItem(
        KANBAN_COLLAPSED_STORAGE_KEY,
        JSON.stringify(sanitizeCollapsedState(collapsedByStatus))
      );
    } catch {
      /* ignore */
    }
  }, [collapsedByStatus, isMounted]);

  const gridTemplateColumns = useMemo(
    () =>
      TAREFA_KANBAN_COLUMN_ORDER.map((status) =>
        collapsedByStatus[status] ? KANBAN_COLLAPSED_COL_WIDTH : "minmax(0, 1fr)"
      ).join(" "),
    [collapsedByStatus]
  );

  const hasCollapsedColumn = useMemo(
    () => TAREFA_KANBAN_COLUMN_ORDER.some((status) => collapsedByStatus[status]),
    [collapsedByStatus]
  );

  const toggleColumnCollapsed = (status: StatusTarefa) => {
    setCollapsedByStatus((prev) => {
      const willCollapse = !prev[status];
      if (!willCollapse) {
        return { ...prev, [status]: false };
      }
      const next = { ...prev, [status]: true };
      if (countOpenColumns(next) === 0) return prev;
      return next;
    });
  };

  const porColuna = TAREFA_KANBAN_COLUMN_ORDER.map((status) => ({
    id: status,
    label: STATUS_LABELS[status],
    tarefas: tarefas.filter((t) => {
      if (t.status !== status) return false;
      const termo = (buscasColunas[status] ?? "").trim().toLowerCase();
      if (!termo) return true;
      return (
        t.titulo.toLowerCase().includes(termo) ||
        (t.descricao ?? "").toLowerCase().includes(termo) ||
        (t.codigo ?? "").toLowerCase().includes(termo) ||
        t.responsavel.nome.toLowerCase().includes(termo)
      );
    }),
    styles: COLUNA_STYLES[status],
  }));

  if (!isMounted) {
    return (
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max lg:min-w-0 lg:grid lg:grid-cols-6">
          {TAREFA_KANBAN_COLUMN_ORDER.map((status) => (
            <div key={status} className="flex-shrink-0 w-[300px] min-h-[140px] rounded-xl lg:w-full">
              <div
                className={clsx(
                  "rounded-xl border px-3 py-2.5 backdrop-blur-sm",
                  COLUNA_STYLES[status].bg,
                  COLUNA_STYLES[status].borderTop
                )}
              >
                <h3 className={clsx("text-sm font-semibold", COLUNA_STYLES[status].header)}>
                  {STATUS_LABELS[status]}
                </h3>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd ?? (() => {})}>
      <div className="overflow-x-auto overscroll-x-contain touch-pan-x snap-x snap-mandatory scroll-smooth pb-2 pr-3 lg:overflow-x-visible lg:pr-4">
        <div
          className="flex gap-3 lg:gap-4 min-w-max lg:min-w-0 lg:grid lg:items-stretch"
          style={{ gridTemplateColumns }}
        >
          {porColuna.map((col) => {
            const isCollapsed = Boolean(collapsedByStatus[col.id]);
            return (
              <Droppable key={col.id} droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    className={clsx(
                      "relative flex h-full min-h-0 flex-shrink-0 flex-col overflow-visible snap-center lg:snap-none lg:w-full lg:min-w-0",
                      isCollapsed ? "w-12" : "w-[300px]"
                    )}
                  >
                    <div
                      className={clsx(
                        "flex min-h-0 flex-1 flex-col rounded-xl p-0 transition-all duration-200",
                        !isCollapsed && "min-h-[140px]",
                        snapshot.isDraggingOver && "bg-slate-100/40 dark:bg-slate-800/40"
                      )}
                    >
                      <div
                        className={clsx(
                          "relative rounded-xl border backdrop-blur-sm",
                          col.styles.bg,
                          col.styles.borderTop,
                          isCollapsed
                            ? "flex h-full min-h-0 flex-1 flex-col px-1 pb-3 pt-4"
                            : "px-3 pb-2.5 pt-4"
                        )}
                        style={
                          isCollapsed && hasCollapsedColumn
                            ? { minHeight: COLLAPSED_HEADER_MIN_HEIGHT_PX }
                            : undefined
                        }
                      >
                        <button
                          type="button"
                          onClick={() => toggleColumnCollapsed(col.id)}
                          className="absolute right-0 top-0 z-20 flex h-6 w-6 -translate-y-1/2 translate-x-[58%] items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                          aria-label={
                            isCollapsed
                              ? `Expandir coluna ${col.label}`
                              : `Recolher coluna ${col.label}`
                          }
                          aria-expanded={!isCollapsed}
                        >
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronLeft className="h-4 w-4" />
                          )}
                        </button>
                        {isCollapsed ? (
                          <div className="flex w-full flex-1 flex-col items-center justify-start gap-2">
                            <h3
                              className={clsx(
                                "shrink-0 text-sm font-semibold leading-snug",
                                col.styles.header
                              )}
                              style={{
                                writingMode: "vertical-rl",
                                textOrientation: "mixed",
                                transform: "rotate(180deg)",
                              }}
                              title={col.label}
                            >
                              {col.label}
                            </h3>
                            <span
                              className={clsx(
                                "inline-flex flex-col items-center gap-0.5 rounded-full px-1.5 py-1 text-[10px] font-medium",
                                col.styles.badge
                              )}
                              title={`${col.tarefas.length} tarefa(s)`}
                            >
                              <ListTodo className="h-3 w-3 shrink-0" />
                              <span>{col.tarefas.length}</span>
                            </span>
                          </div>
                        ) : (
                          <>
                            <div className="mb-2 flex min-w-0 items-center gap-1.5">
                              <h3
                                className={clsx(
                                  "min-w-0 flex-1 text-sm font-semibold leading-snug",
                                  col.styles.header
                                )}
                              >
                                {col.label}
                              </h3>
                              <span
                                className={clsx(
                                  "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                                  col.styles.badge
                                )}
                              >
                                <ListTodo className="h-3 w-3 shrink-0" />
                                {col.tarefas.length}
                              </span>
                            </div>
                            <div className="relative">
                              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Buscar..."
                                value={buscasColunas[col.id] ?? ""}
                                onChange={(e) =>
                                  setBuscasColunas((prev) => ({ ...prev, [col.id]: e.target.value }))
                                }
                                className="w-full rounded-md border border-transparent bg-slate-50 py-1.5 pl-8 pr-3 text-sm text-slate-700 transition-all placeholder:text-slate-400 focus:border-purple-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100 dark:bg-slate-900/80 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-violet-500 dark:focus:bg-slate-900 dark:focus:ring-violet-900/40"
                              />
                            </div>
                          </>
                        )}
                      </div>
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={clsx(
                          isCollapsed
                            ? "mt-1 h-10 min-h-10 max-h-10 shrink-0 overflow-hidden"
                            : "mt-2 min-h-[60px] space-y-2"
                        )}
                      >
                        {col.tarefas.map((t, index) => (
                          <Draggable
                            key={t.id}
                            draggableId={String(t.id)}
                            index={index}
                            isDragDisabled={!dragEnabled || isCollapsed}
                          >
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                role="button"
                                tabIndex={isCollapsed ? -1 : 0}
                                onClick={() => !isCollapsed && onAbrirTarefa(t)}
                                onKeyDown={(e) =>
                                  !isCollapsed && e.key === "Enter" && onAbrirTarefa(t)
                                }
                                style={{ ...dragProvided.draggableProps.style }}
                                className={clsx(
                                  "relative mb-2 last:mb-0 w-full overflow-hidden rounded-lg border border-slate-200 bg-white p-3 transition-all duration-200 dark:border-slate-600 dark:bg-slate-900",
                                  isCollapsed
                                    ? "pointer-events-none mb-0 max-h-0 border-0 p-0 opacity-0"
                                    : "cursor-grab",
                                  !isCollapsed &&
                                    dragSnapshot.isDragging &&
                                    "z-50 cursor-grabbing scale-105 rotate-1 shadow-xl ring-2 ring-purple-500 dark:ring-violet-400",
                                  !isCollapsed && !dragSnapshot.isDragging && "shadow-sm"
                                )}
                              >
                                  <div className="mb-1 flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      {t.codigo ? (
                                        <p className="mb-1 inline-flex rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:border-violet-500/40 dark:bg-violet-950/40 dark:text-violet-300">
                                          {t.codigo}
                                        </p>
                                      ) : null}
                                      <p
                                        className="text-sm font-medium leading-5 text-slate-900 dark:text-slate-100"
                                        style={{
                                          display: "-webkit-box",
                                          WebkitLineClamp: 2,
                                          WebkitBoxOrient: "vertical",
                                          overflow: "hidden",
                                        }}
                                      >
                                        {t.titulo}
                                      </p>
                                    </div>
                                    <span
                                      className="pointer-events-none shrink-0 inline-flex items-center gap-0.5 text-slate-400 dark:text-slate-500"
                                      aria-hidden
                                    >
                                      <Pencil className="h-4 w-4" />
                                      <ChevronRight className="h-4 w-4" />
                                    </span>
                                  </div>
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
                                      <div className="flex flex-wrap items-baseline gap-x-1.5">
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
                                      <p className="mt-0.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                                        {formatData(t.dataFim)}
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
                                        Início:
                                      </p>
                                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                        {formatData(t.dataInicio)}
                                      </p>
                                    </div>
                                  </div>
                                <PrioridadeBadge prioridade={t.prioridade} className="mt-2.5" />
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
            );
          })}
        </div>
      </div>
    </DragDropContext>
  );
}
