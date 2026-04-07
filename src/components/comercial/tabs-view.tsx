"use client";

import { useId } from "react";
import clsx from "clsx";
import { LayoutGrid, List } from "lucide-react";

export type ViewMode = "kanban" | "lista";

type TabsViewProps = {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
};

const TABS: { value: ViewMode; label: string; icon: React.ElementType }[] = [
  { value: "kanban", label: "Kanban", icon: LayoutGrid },
  { value: "lista", label: "Lista", icon: List },
];

export function TabsView({ value, onChange }: TabsViewProps) {
  const id = useId();

  return (
    <div
      role="tablist"
      aria-label="Alternar visualização"
      className="inline-flex items-center rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = value === tab.value;
        return (
          <button
            key={tab.value}
            role="tab"
            id={`${id}-${tab.value}`}
            aria-selected={isActive}
            aria-controls={`${id}-${tab.value}-panel`}
            type="button"
            onClick={() => onChange(tab.value)}
            className={clsx(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-white text-purple-700 shadow-sm dark:bg-slate-700 dark:text-violet-300 dark:shadow-none"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
