"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export type SearchableOption = {
  value: string;
  label: string;
  subtitle?: string;
};

type SearchableSelectProps = {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  searchable?: boolean;
};

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyLabel = "Nenhuma opção encontrada.",
  disabled = false,
  searchable = true,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);
  const filtered = useMemo(() => {
    if (!searchable) return options;
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.subtitle ?? ""}`.toLowerCase().includes(q));
  }, [options, query, searchable]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((s) => !s)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 transition-colors hover:border-slate-300 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-500"
      >
        <span className={selected ? "truncate" : "truncate text-slate-400 dark:text-slate-500"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open ? (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-600 dark:bg-slate-900">
          {searchable ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          ) : null}

          <div className={`${searchable ? "mt-2" : ""} max-h-56 overflow-y-auto`}>
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{emptyLabel}</p>
            ) : (
              filtered.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-violet-50 dark:hover:bg-violet-950/30"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-slate-900 dark:text-slate-100">{opt.label}</span>
                      {opt.subtitle ? (
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{opt.subtitle}</span>
                      ) : null}
                    </span>
                    {isSelected ? <Check className="h-4 w-4 text-[#6D28D9]" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type SearchableMultiSelectProps = {
  options: SearchableOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  selectedLabel?: string;
};

export function SearchableMultiSelect({
  options,
  values,
  onChange,
  placeholder = "Selecionar colaboradores...",
  searchPlaceholder = "Buscar...",
  emptyLabel = "Nenhuma opção encontrada.",
  selectedLabel = "Selecionados",
}: SearchableMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const selectedSet = useMemo(() => new Set(values), [values]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.subtitle ?? ""}`.toLowerCase().includes(q));
  }, [options, query]);
  const selectedItems = useMemo(() => options.filter((o) => selectedSet.has(o.value)), [options, selectedSet]);

  const toggle = (value: string) => {
    if (selectedSet.has(value)) onChange(values.filter((v) => v !== value));
    else onChange([...values, value]);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 transition-colors hover:border-slate-300 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-500"
      >
        <span className={selectedItems.length ? "truncate" : "truncate text-slate-400 dark:text-slate-500"}>
          {selectedItems.length ? `${selectedItems.length} ${selectedLabel.toLowerCase()}` : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open ? (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-600 dark:bg-slate-900">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="mt-2 max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{emptyLabel}</p>
            ) : (
              filtered.map((opt) => {
                const isSelected = selectedSet.has(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggle(opt.value)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-violet-50 dark:hover:bg-violet-950/30"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-slate-900 dark:text-slate-100">{opt.label}</span>
                      {opt.subtitle ? (
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{opt.subtitle}</span>
                      ) : null}
                    </span>
                    {isSelected ? <Check className="h-4 w-4 text-[#6D28D9]" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      {selectedItems.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedItems.map((item) => (
            <span
              key={item.value}
              className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
            >
              {item.label}
              <button
                type="button"
                onClick={() => toggle(item.value)}
                className="rounded p-0.5 hover:bg-violet-200/70 dark:hover:bg-violet-800/60"
                aria-label={`Remover ${item.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

