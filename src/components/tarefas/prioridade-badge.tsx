"use client";

import clsx from "clsx";
import type { PrioridadeTarefa } from "@/lib/tarefas/types";
import { PRIORIDADE_LABELS } from "@/lib/tarefas/constants";
import { iconForPrioridade } from "@/lib/tarefas/option-icons";

const PRIORIDADE_BADGE: Record<PrioridadeTarefa, string> = {
  baixa:
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
  media:
    "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-700/50 dark:bg-amber-950/50 dark:text-amber-300",
  alta:
    "border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-700/50 dark:bg-orange-950/50 dark:text-orange-300",
  urgente:
    "border-red-200 bg-red-100 text-red-700 dark:border-red-700/50 dark:bg-red-950/50 dark:text-red-300",
};

type PrioridadeBadgeProps = {
  prioridade: PrioridadeTarefa;
  className?: string;
  variant?: "default" | "pill";
};

export function PrioridadeBadge({
  prioridade,
  className,
  variant = "default",
}: PrioridadeBadgeProps) {
  const Icon = iconForPrioridade(prioridade);

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 border text-xs font-medium [&_svg]:!text-current",
        variant === "pill" ? "rounded-full px-2.5 py-0.5" : "rounded-md px-2 py-0.5",
        PRIORIDADE_BADGE[prioridade],
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {PRIORIDADE_LABELS[prioridade]}
    </span>
  );
}
