"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import clsx from "clsx";

export type SearchableSelectOption = {
  value: string;
  label: string;
  /** Texto usado na busca (nome, CPF/CNPJ, etc.) */
  searchText: string;
};

type SearchableSelectProps = {
  id?: string;
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyOptionLabel?: string;
  className?: string;
  disabled?: boolean;
  /** Mostra botão para limpar seleção */
  clearable?: boolean;
};

function normalizeSearch(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

export function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder = "Buscar…",
  emptyOptionLabel = "— Nenhum —",
  className,
  disabled,
  clearable = true,
}: SearchableSelectProps) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);

  const syncQueryFromValue = () => {
    const sel = options.find((o) => o.value === value);
    setQuery(sel?.label ?? "");
  };

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    const qNum = digitsOnly(query);
    if (!q && !qNum) return options;
    return options.filter((o) => {
      const hay = normalizeSearch(o.searchText);
      const hayNum = digitsOnly(o.searchText);
      if (q && hay.includes(q)) return true;
      if (qNum.length >= 2 && hayNum.includes(qNum)) return true;
      return false;
    });
  }, [options, query]);

  const displayValue = open ? query : (selected?.label ?? "");

  return (
    <div ref={rootRef} className={clsx("relative", className)}>
      <div className="flex gap-1">
        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            disabled={disabled}
            value={displayValue}
            placeholder={placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            className={clsx(
              "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-9 text-sm text-slate-900 placeholder:text-slate-400",
              "focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9]",
              "dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500",
              disabled && "cursor-not-allowed opacity-60"
            )}
          />
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              if (open) setOpen(false);
              else {
                syncQueryFromValue();
                setOpen(true);
              }
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Abrir lista"
          >
            <ChevronDown className={clsx("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>
        </div>
        {clearable && value && !disabled && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setQuery("");
              setOpen(false);
            }}
            className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Limpar"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && !disabled && (
        <ul
          id={listboxId}
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          <li>
            <button
              type="button"
              role="option"
              aria-selected={value === ""}
              className="w-full px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange("");
                setQuery("");
                setOpen(false);
              }}
            >
              {emptyOptionLabel}
            </button>
          </li>
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">Nenhum resultado.</li>
          )}
          {filtered.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={clsx(
                  "w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800",
                  o.value === value
                    ? "bg-purple-50 font-medium text-[#6D28D9] dark:bg-violet-950/50 dark:text-violet-300"
                    : "text-slate-800 dark:text-slate-200"
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(o.value);
                  setQuery(o.label);
                  setOpen(false);
                }}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
