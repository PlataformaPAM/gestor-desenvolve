"use client";

import clsx from "clsx";
import type { OperacaoViewId } from "@/lib/operacao/priorizacao";
import { HintTooltip } from "@/components/ui/hint-tooltip";

type OperacaoViewsProps = {
  value: OperacaoViewId;
  onChange: (value: OperacaoViewId) => void;
  closedLabel: string;
  /** Quando informado, exibe o botão Arquivados (ex.: Tarefas Internas). */
  archivedLabel?: string;
  /** Sobrescreve o texto de ajuda ao passar o mouse (por visão). */
  viewTooltips?: Partial<Record<OperacaoViewId, string>>;
};

const BASE_VIEWS: Array<{ id: Exclude<OperacaoViewId, "fechados" | "arquivados">; label: string }> = [
  { id: "abertos", label: "Todos" },
  { id: "minha_fila", label: "Minha fila" },
  { id: "urgentes", label: "Urgentes" },
  { id: "atrasados", label: "Atrasados" },
  { id: "vence_logo", label: "Vence logo" },
];

const DEFAULT_VIEW_TOOLTIPS: Record<OperacaoViewId, string> = {
  abertos: "Exibe todos os itens, em qualquer etapa.",
  minha_fila: "Itens em aberto em que você é responsável ou colaborador.",
  urgentes: "Itens em aberto com prioridade urgente.",
  atrasados: "Itens em aberto com prazo já vencido.",
  vence_logo: "Itens em aberto que vencem nos próximos dias.",
  fechados: "Itens já encerrados ou concluídos.",
  arquivados: "Itens concluídos de meses anteriores.",
};

function tooltipFor(
  id: OperacaoViewId,
  overrides?: Partial<Record<OperacaoViewId, string>>
): string {
  return overrides?.[id] ?? DEFAULT_VIEW_TOOLTIPS[id];
}

const viewButtonClass = (active: boolean) =>
  clsx(
    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    active
      ? "bg-[#6D28D9]/10 text-[#6D28D9] dark:bg-violet-950/50 dark:text-violet-300"
      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
  );

export function OperacaoViews({
  value,
  onChange,
  closedLabel,
  archivedLabel,
  viewTooltips,
}: OperacaoViewsProps) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Visões operacionais">
      {BASE_VIEWS.map((item) => (
        <HintTooltip key={item.id} content={tooltipFor(item.id, viewTooltips)}>
          <button
            type="button"
            onClick={() => onChange(item.id)}
            className={viewButtonClass(value === item.id)}
          >
            {item.label}
          </button>
        </HintTooltip>
      ))}
      <HintTooltip content={tooltipFor("fechados", viewTooltips)}>
        <button
          type="button"
          onClick={() => onChange("fechados")}
          className={viewButtonClass(value === "fechados")}
        >
          {closedLabel}
        </button>
      </HintTooltip>
      {archivedLabel ? (
        <HintTooltip content={tooltipFor("arquivados", viewTooltips)}>
          <button
            type="button"
            onClick={() => onChange("arquivados")}
            className={viewButtonClass(value === "arquivados")}
          >
            {archivedLabel}
          </button>
        </HintTooltip>
      ) : null}
    </nav>
  );
}
