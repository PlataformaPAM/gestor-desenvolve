"use client";

import { memo } from "react";
import clsx from "clsx";
import { motion } from "framer-motion";
import type { Lead, LeadPriority, PipelineStageId } from "@/lib/comercial/types";
import { PRIORIDADE_LABELS } from "@/lib/comercial/constants";
import { formatCurrency } from "@/lib/comercial/utils";
import { STAGE_COLORS } from "@/lib/comercial/stage-colors";
import { getLeadOwnership } from "@/lib/comercial/ownership";

/** Mesma hierarquia visual das prioridades em Tarefas (Kanban interno). */
const PRIORITY_STYLES: Record<LeadPriority, { label: string; className: string }> = {
  baixa: {
    label: PRIORIDADE_LABELS.baixa,
    className:
      "border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
  media: {
    label: PRIORIDADE_LABELS.media,
    className:
      "border border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-700/50 dark:bg-amber-950/50 dark:text-amber-300",
  },
  alta: {
    label: PRIORIDADE_LABELS.alta,
    className:
      "border border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-700/50 dark:bg-orange-950/50 dark:text-orange-300",
  },
  urgente: {
    label: PRIORIDADE_LABELS.urgente,
    className:
      "border border-red-200 bg-red-100 text-red-700 dark:border-red-700/50 dark:bg-red-950/50 dark:text-red-300",
  },
};

type LeadCardProps = {
  lead: Lead;
  isSelected: boolean;
  onSelect: () => void;
  /** Borda lateral pela cor da etapa */
  stageId: PipelineStageId;
  /** Feedback visual ao arrastar (sombra maior + leve rotação) */
  isDragging?: boolean;
};

export const LeadCard = memo(function LeadCard({
  lead,
  isSelected,
  onSelect,
  stageId,
  isDragging = false,
}: LeadCardProps) {
  const priority = PRIORITY_STYLES[lead.priority];
  const stageColors = STAGE_COLORS[stageId];
  const ownership = getLeadOwnership(lead);
  const ultimaAlteracao = lead.registroAtualizadoEm
    ? new Date(lead.registroAtualizadoEm).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      layout
      initial={false}
      whileHover={isDragging ? undefined : { y: -2 }}
      transition={{ duration: 0.15 }}
      className={clsx(
        "w-full cursor-inherit rounded-lg border border-l-4 border-slate-200 bg-white p-3 text-left shadow-sm transition-all duration-200 dark:border-slate-600 dark:bg-slate-900",
        "hover:border-purple-300 hover:shadow-md dark:hover:border-violet-500/40",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950",
        stageColors.borderLeft,
        isSelected
          ? "border-[#6D28D9] bg-violet-50/80 shadow-[0_4px_12px_0_rgba(109,40,217,0.12)] ring-2 ring-[#6D28D9]/20 dark:border-violet-500 dark:bg-violet-950/40 dark:ring-violet-500/35"
          : "border-slate-200",
        isDragging &&
          "rotate-[2deg] shadow-[0_12px_24px_-8px_rgba(0,0,0,0.18)] ring-2 ring-slate-200/80 dark:ring-slate-600/80"
      )}
    >
      <p className="text-sm font-semibold text-[#6D28D9]">
        {formatCurrency(lead.valorTotal > 0 ? lead.valorTotal : lead.value)}
      </p>
      <p className="mt-2 text-xs text-slate-700 dark:text-slate-300">
        Responsável: {ownership.responsavelNome ?? "—"}
      </p>
      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
        Última alteração: {ultimaAlteracao}
      </p>
      <span
        className={clsx(
          "mt-2.5 inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
          priority.className
        )}
      >
        {priority.label}
      </span>
    </motion.button>
  );
});

export function LeadCardSkeleton() {
  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white p-3 shadow-[0_1px_3px_0_rgba(0,0,0,0.06)] dark:border-slate-600 dark:bg-slate-800/90">
      <div className="h-4 w-3/4 rounded bg-slate-200 animate-pulse" />
      <div className="mt-2 h-4 w-1/2 rounded bg-slate-200 animate-pulse" />
      <div className="mt-3 h-6 w-16 rounded-md bg-slate-200 animate-pulse" />
    </div>
  );
}
