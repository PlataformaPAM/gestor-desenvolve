"use client";

import { useState, useEffect, useMemo, type CSSProperties } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import clsx from "clsx";
import { Search, ListTodo, ChevronLeft, ChevronRight } from "lucide-react";
import { PIPELINE_STAGES, PRIORIDADE_LABELS } from "@/lib/comercial/constants";
import type { Lead, PipelineStageId } from "@/lib/comercial/types";
import type { Cliente } from "@/lib/clientes/types";
import type { ColumnsState } from "@/lib/comercial/columns";
import { STAGE_COLORS, STAGE_HIGHLIGHT_HEX } from "@/lib/comercial/stage-colors";
import { getLeadOwnership } from "@/lib/comercial/ownership";
import { LeadCardSkeleton } from "./lead-card";
import { formatCurrency } from "@/lib/comercial/utils";

function formatUltimaAlteracao(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatVencimento(value: string | undefined): string {
  if (!value?.trim()) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

const KANBAN_COLLAPSED_STORAGE_KEY = "pam.comercial.kanban.columns.collapsed";
const KANBAN_COLLAPSED_COL_WIDTH = "3rem";
/** Altura mínima do cabeçalho recolhido (alinha todas à maior etiqueta, ex.: Qualificação). */
const COLLAPSED_HEADER_MIN_HEIGHT_PX =
  92 + Math.max(...PIPELINE_STAGES.map((s) => s.label.length)) * 11;

function sanitizeCollapsedState(
  state: Partial<Record<PipelineStageId, boolean>>
): Partial<Record<PipelineStageId, boolean>> {
  const openCount = PIPELINE_STAGES.filter((stage) => !state[stage.id]).length;
  if (openCount > 0) return state;
  const allMarkedCollapsed = PIPELINE_STAGES.every((stage) => state[stage.id]);
  if (!allMarkedCollapsed) return state;
  const next = { ...state };
  delete next[PIPELINE_STAGES[0].id];
  return next;
}

function readCollapsedFromStorage(): Partial<Record<PipelineStageId, boolean>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KANBAN_COLLAPSED_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return sanitizeCollapsedState(parsed as Partial<Record<PipelineStageId, boolean>>);
  } catch {
    return {};
  }
}

function countOpenColumns(state: Partial<Record<PipelineStageId, boolean>>): number {
  return PIPELINE_STAGES.filter((stage) => !state[stage.id]).length;
}

type ComercialKanbanProps = {
  columns: ColumnsState;
  clientes: Cliente[];
  onDragEnd: (result: DropResult) => void;
  selectedLeadId: string | null;
  onSelectLead: (lead: Lead) => void;
  isLoading: boolean;
  pendingLeadCountById?: Record<string, number>;
  pendingStageCountById?: Partial<Record<PipelineStageId, number>>;
  /** Borda em destaque (~3s) após criar/editar/mover o lead. */
  pulsingLeadIds?: Record<string, boolean>;
  /** Desabilita arrastar cartões (sem permissão Editar). */
  dragEnabled?: boolean;
};

export function ComercialKanban({
  columns,
  clientes,
  onDragEnd,
  selectedLeadId,
  onSelectLead,
  isLoading,
  pendingLeadCountById = {},
  pendingStageCountById = {},
  pulsingLeadIds = {},
  dragEnabled = true,
}: ComercialKanbanProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [buscasColunas, setBuscasColunas] = useState<Record<string, string>>({});
  const [collapsedByStage, setCollapsedByStage] = useState<
    Partial<Record<PipelineStageId, boolean>>
  >({});
  const clienteMap = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);

  useEffect(() => {
    queueMicrotask(() => {
      setIsMounted(true);
      setCollapsedByStage(readCollapsedFromStorage());
    });
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    try {
      window.localStorage.setItem(
        KANBAN_COLLAPSED_STORAGE_KEY,
        JSON.stringify(sanitizeCollapsedState(collapsedByStage))
      );
    } catch {
      /* ignore quota / private mode */
    }
  }, [collapsedByStage, isMounted]);

  const gridTemplateColumns = useMemo(
    () =>
      PIPELINE_STAGES.map((stage) =>
        collapsedByStage[stage.id] ? KANBAN_COLLAPSED_COL_WIDTH : "minmax(0, 1fr)"
      ).join(" "),
    [collapsedByStage]
  );

  const hasCollapsedColumn = useMemo(
    () => PIPELINE_STAGES.some((stage) => collapsedByStage[stage.id]),
    [collapsedByStage]
  );

  const toggleColumnCollapsed = (stageId: PipelineStageId) => {
    setCollapsedByStage((prev) => {
      const willCollapse = !prev[stageId];
      if (!willCollapse) {
        return { ...prev, [stageId]: false };
      }
      const next = { ...prev, [stageId]: true };
      if (countOpenColumns(next) === 0) return prev;
      return next;
    });
  };

  const getPriorityBadgeClass = (priority: Lead["priority"]) => {
    if (priority === "urgente")
      return "border border-red-200 bg-red-100 text-red-700 dark:border-red-500/40 dark:bg-red-950/50 dark:text-red-300";
    if (priority === "alta")
      return "border border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-500/40 dark:bg-orange-950/50 dark:text-orange-300";
    if (priority === "media")
      return "border border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-300";
    return "border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300";
  };

  const getPriorityLabel = (priority: Lead["priority"]) => PRIORIDADE_LABELS[priority];

  if (!isMounted) {
    return (
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 lg:grid lg:grid-cols-6 min-w-max lg:min-w-0">
          {PIPELINE_STAGES.map((stage) => {
            const stageColors = STAGE_COLORS[stage.id];
            return (
              <div
                key={stage.id}
                className={clsx(
                  "flex-shrink-0 w-[300px] min-h-[140px] rounded-xl p-0 lg:w-full"
                )}
              >
                <div
                  className={clsx(
                    "mb-3 rounded-xl border px-3 py-2.5 backdrop-blur-sm",
                    stageColors.bg,
                    stageColors.borderTop
                  )}
                >
                  <h3 className={clsx("text-sm font-semibold", stageColors.text)}>
                    {stage.label}
                  </h3>
                </div>
                <div className="space-y-2">
                  <LeadCardSkeleton />
                  <LeadCardSkeleton />
                  <LeadCardSkeleton />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="overflow-x-auto overscroll-x-contain touch-pan-x snap-x snap-mandatory scroll-smooth pb-2 pr-3 lg:overflow-x-visible lg:pr-4">
        <div
          className="flex gap-3 lg:gap-4 min-w-max lg:min-w-0 lg:grid lg:items-stretch"
          style={{ gridTemplateColumns }}
        >
          {PIPELINE_STAGES.map((stage) => {
            const stageLeads = columns[stage.id] ?? [];
            const stageColors = STAGE_COLORS[stage.id];
            const isCollapsed = Boolean(collapsedByStage[stage.id]);
            const termo = (buscasColunas[stage.id] ?? "").trim().toLowerCase();
            const stageLeadsFiltrados = stageLeads.filter((lead) => {
              if (!termo) return true;
              const cli = lead.clienteId ? clienteMap.get(lead.clienteId) : undefined;
              const nomeCliente = cli ? `${cli.empresa} ${cli.nome}`.toLowerCase() : "";
              return (
                lead.name.toLowerCase().includes(termo) ||
                (lead.origem ?? "").toLowerCase().includes(termo) ||
                nomeCliente.includes(termo)
              );
            });

            return (
              <Droppable key={stage.id} droppableId={stage.id}>
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
                        snapshot.isDraggingOver &&
                          "bg-slate-100/40 dark:bg-slate-800/40"
                      )}
                    >
                      <div
                        className={clsx(
                          "relative rounded-xl border backdrop-blur-sm",
                          stageColors.bg,
                          stageColors.borderTop,
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
                          onClick={() => toggleColumnCollapsed(stage.id)}
                          className="absolute right-0 top-0 z-20 flex h-6 w-6 -translate-y-1/2 translate-x-[58%] items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                          aria-label={
                            isCollapsed
                              ? `Expandir coluna ${stage.label}`
                              : `Recolher coluna ${stage.label}`
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
                                stageColors.text
                              )}
                              style={{
                                writingMode: "vertical-rl",
                                textOrientation: "mixed",
                                transform: "rotate(180deg)",
                              }}
                              title={stage.label}
                            >
                              {stage.label}
                            </h3>
                            <span
                              className={clsx(
                                "inline-flex flex-col items-center gap-0.5 rounded-full px-1.5 py-1 text-[10px] font-medium",
                                stageColors.badge
                              )}
                              title={`${stageLeadsFiltrados.length} lead(s)`}
                            >
                              <ListTodo className="h-3 w-3 shrink-0" />
                              <span>{stageLeadsFiltrados.length}</span>
                            </span>
                            {(pendingStageCountById[stage.id] ?? 0) > 0 && (
                              <span
                                className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white"
                                title={`${pendingStageCountById[stage.id]} pendência(s)`}
                              >
                                {(pendingStageCountById[stage.id] ?? 0) > 99
                                  ? "99+"
                                  : (pendingStageCountById[stage.id] ?? 0)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="mb-2 flex min-w-0 items-center gap-1.5">
                              <h3
                                className={clsx(
                                  "min-w-0 flex-1 text-sm font-semibold leading-snug",
                                  stageColors.text
                                )}
                              >
                                {stage.label}
                              </h3>
                              <span
                                className={clsx(
                                  "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                                  stageColors.badge
                                )}
                                title={`${stageLeadsFiltrados.length} lead(s)`}
                              >
                                <ListTodo className="h-3 w-3 shrink-0" />
                                {stageLeadsFiltrados.length}
                              </span>
                              {(pendingStageCountById[stage.id] ?? 0) > 0 && (
                                <span
                                  className="inline-flex min-w-[18px] shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white"
                                  title={`${pendingStageCountById[stage.id]} pendência(s)`}
                                >
                                  {(pendingStageCountById[stage.id] ?? 0) > 99
                                    ? "99+"
                                    : (pendingStageCountById[stage.id] ?? 0)}
                                </span>
                              )}
                            </div>
                            <div className="relative">
                              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Buscar..."
                                value={buscasColunas[stage.id] ?? ""}
                                onChange={(e) =>
                                  setBuscasColunas((prev) => ({
                                    ...prev,
                                    [stage.id]: e.target.value,
                                  }))
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
                        {isLoading
                          ? Array.from({ length: 3 }).map((_, i) => (
                              <LeadCardSkeleton key={i} />
                            ))
                          : stageLeadsFiltrados.map((lead, index) => {
                              const ownership = getLeadOwnership(lead);
                              const cliente =
                                lead.clienteId ? clienteMap.get(lead.clienteId) : undefined;
                              return (
                                <Draggable
                                  key={String(lead.id)}
                                  draggableId={String(lead.id)}
                                  index={index}
                                  isDragDisabled={!dragEnabled || isCollapsed}
                                >
                                  {(dragProvided, snapshot) => (
                                    <div
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      {...dragProvided.dragHandleProps}
                                      role="button"
                                      tabIndex={isCollapsed ? -1 : 0}
                                      onClick={() => !isCollapsed && onSelectLead(lead)}
                                      onKeyDown={(e) =>
                                        !isCollapsed &&
                                        e.key === "Enter" &&
                                        onSelectLead(lead)
                                      }
                                      style={{
                                        ...dragProvided.draggableProps.style,
                                        ...(pulsingLeadIds[String(lead.id)]
                                          ? ({
                                              ["--pam-stage-outline"]: STAGE_HIGHLIGHT_HEX[lead.stageId],
                                            } as CSSProperties)
                                          : {}),
                                      }}
                                      className={clsx(
                                        "relative mb-2 last:mb-0 w-full overflow-hidden rounded-lg border border-slate-200 bg-white p-3 duration-200 dark:border-slate-600 dark:bg-slate-900",
                                        "transition-[transform,opacity] motion-reduce:transition-none",
                                        isCollapsed
                                          ? "pointer-events-none mb-0 max-h-0 border-0 p-0 opacity-0"
                                          : "cursor-grab",
                                        !isCollapsed &&
                                          snapshot.isDragging &&
                                          "z-50 cursor-grabbing scale-105 rotate-1 shadow-xl ring-2 ring-purple-500 dark:ring-violet-400",
                                        !isCollapsed &&
                                          !snapshot.isDragging &&
                                          !pulsingLeadIds[String(lead.id)] &&
                                          "shadow-sm",
                                        !isCollapsed &&
                                          selectedLeadId === lead.id &&
                                          "ring-2 ring-[#6D28D9]/20 dark:ring-violet-500/40",
                                        !isCollapsed &&
                                          pulsingLeadIds[String(lead.id)] &&
                                          "pam-comercial-edge-pulse"
                                      )}
                                    >
                                      <div className="relative min-h-0">
                                        <p
                                          className="line-clamp-4 text-sm font-medium leading-5 text-slate-900 dark:text-slate-100"
                                          title={lead.name}
                                        >
                                          {lead.name}
                                        </p>
                                        {cliente ? (
                                          <div className="mt-1.5 min-w-0">
                                            <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                                              Cliente:
                                            </p>
                                            <p
                                              className="line-clamp-4 break-words text-xs font-semibold leading-5 text-slate-800 dark:text-slate-200"
                                              title={cliente.empresa || cliente.nome}
                                            >
                                              {cliente.empresa || cliente.nome}
                                            </p>
                                          </div>
                                        ) : null}
                                        <p className="mt-2 text-sm font-semibold text-[#6D28D9]">
                                          {formatCurrency(lead.valorTotal > 0 ? lead.valorTotal : lead.value)}
                                        </p>
                                        <div className="mt-2 space-y-2">
                                          <div className="min-w-0">
                                            <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                                              Responsável:
                                            </p>
                                            <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                                              {ownership.responsavelNome ?? "—"}
                                            </p>
                                          </div>
                                          <div className="min-w-0">
                                            <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                                              Última alteração:
                                            </p>
                                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                              {formatUltimaAlteracao(
                                                lead.registroAtualizadoEm ?? lead.enteredStageAt
                                              )}
                                            </p>
                                          </div>
                                          {(
                                            ["proposta", "contratacao", "fechado", "perdido"] as PipelineStageId[]
                                          ).includes(lead.stageId) && (
                                            <div className="min-w-0">
                                              <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                                                Vencimento:
                                              </p>
                                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                {formatVencimento(lead.previsaoFechamento)}
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                        <div className="mt-2.5 flex items-center justify-between gap-2">
                                          <span
                                            className={clsx(
                                              "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
                                              getPriorityBadgeClass(lead.priority)
                                            )}
                                          >
                                            {getPriorityLabel(lead.priority)}
                                          </span>
                                          {(pendingLeadCountById[lead.id] ?? 0) > 0 && (
                                            <span
                                              className="inline-flex min-w-[18px] shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white"
                                              title={`${pendingLeadCountById[lead.id]} pendência(s)`}
                                            >
                                              {(pendingLeadCountById[lead.id] ?? 0) > 99
                                                ? "99+"
                                                : (pendingLeadCountById[lead.id] ?? 0)}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              );
                            })}
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
