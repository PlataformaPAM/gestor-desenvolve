"use client";

import clsx from "clsx";
import type { OperacaoViewId } from "@/lib/operacao/priorizacao";

type OperacaoViewsProps = {
  value: OperacaoViewId;
  onChange: (value: OperacaoViewId) => void;
  closedLabel: string;
};

const BASE_VIEWS: Array<{ id: Exclude<OperacaoViewId, "fechados">; label: string }> = [
  { id: "abertos", label: "Todos" },
  { id: "minha_fila", label: "Minha fila" },
  { id: "urgentes", label: "Urgentes" },
  { id: "atrasados", label: "Atrasados" },
  { id: "vence_logo", label: "Vence logo" },
];

export function OperacaoViews({ value, onChange, closedLabel }: OperacaoViewsProps) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Visões operacionais">
      {BASE_VIEWS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={clsx(
            "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            value === item.id
              ? "bg-[#6D28D9]/10 text-[#6D28D9] dark:bg-violet-950/50 dark:text-violet-300"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          )}
        >
          {item.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange("fechados")}
        className={clsx(
          "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          value === "fechados"
            ? "bg-[#6D28D9]/10 text-[#6D28D9] dark:bg-violet-950/50 dark:text-violet-300"
            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        )}
      >
        {closedLabel}
      </button>
    </nav>
  );
}
