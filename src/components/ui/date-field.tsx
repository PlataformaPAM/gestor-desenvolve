"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

type DateFieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
};

function formatPtBr(isoDate: string): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

function parsePtBrToIso(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length !== 8) return "";
  const d = Number(digits.slice(0, 2));
  const m = Number(digits.slice(2, 4));
  const y = Number(digits.slice(4, 8));
  if (!d || !m || !y) return "";
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return "";
  return toIso(dt);
}

function maskPtBr(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function clampToMonthStart(value?: string): Date {
  if (!value) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function DateField({
  id,
  value,
  onChange,
  placeholder = "Selecione a data",
  min,
  max,
  disabled = false,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const [monthCursor, setMonthCursor] = useState<Date>(() => clampToMonthStart(value));
  const [inputValue, setInputValue] = useState(value ? formatPtBr(value) : "");
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMonthCursor(clampToMonthStart(value));
    setInputValue(value ? formatPtBr(value) : "");
  }, [value]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setMonthMenuOpen(false);
        setYearMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const selectedDate = value ? new Date(`${value}T00:00:00`) : null;
  const minDate = min ? new Date(`${min}T00:00:00`) : null;
  const maxDate = max ? new Date(`${max}T00:00:00`) : null;

  const monthLabel = useMemo(
    () =>
      monthCursor.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      }),
    [monthCursor]
  );
  const monthValue = String(monthCursor.getMonth() + 1);
  const yearValue = String(monthCursor.getFullYear());
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, idx) => ({
        value: String(idx + 1),
        label: new Date(2026, idx, 1).toLocaleDateString("pt-BR", { month: "short" }),
      })),
    []
  );
  const yearOptions = useMemo(() => {
    const center = monthCursor.getFullYear();
    const list: number[] = [];
    for (let y = center - 10; y <= center + 10; y += 1) list.push(y);
    return list;
  }, [monthCursor]);

  const days = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const first = new Date(year, month, 1);
    const startWeekday = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ iso: string; day: number; muted: boolean }> = [];

    for (let i = 0; i < startWeekday; i += 1) {
      cells.push({ iso: "", day: 0, muted: true });
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      const dt = new Date(year, month, d);
      cells.push({ iso: toIso(dt), day: d, muted: false });
    }
    while (cells.length % 7 !== 0) cells.push({ iso: "", day: 0, muted: true });
    return cells;
  }, [monthCursor]);

  const isIsoOutsideBounds = (iso: string): boolean => {
    if (!iso) return true;
    const d = new Date(`${iso}T00:00:00`);
    if (minDate && d < minDate) return true;
    if (maxDate && d > maxDate) return true;
    return false;
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((s) => !s)}
        className={`flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 transition-colors hover:border-slate-300 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-500 ${
          disabled ? "cursor-not-allowed opacity-60 hover:border-slate-200 dark:hover:border-slate-600" : ""
        }`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
          <span className={value ? "min-w-0 truncate" : "min-w-0 truncate text-slate-400 dark:text-slate-500"}>
            {inputValue || placeholder}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open && !disabled ? (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-600 dark:bg-slate-900">
          <div className="mb-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                const masked = maskPtBr(e.target.value);
                setInputValue(masked);
                const iso = parsePtBrToIso(masked);
                if (iso) {
                  onChange(iso);
                  setMonthCursor(clampToMonthStart(iso));
                }
                if (!masked) onChange("");
              }}
              placeholder="dd/mm/aaaa"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="relative flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setMonthMenuOpen((s) => !s);
                  setYearMenuOpen(false);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium capitalize text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {monthOptions.find((m) => m.value === monthValue)?.label ?? monthValue}
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setYearMenuOpen((s) => !s);
                  setMonthMenuOpen(false);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {yearValue}
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {monthMenuOpen ? (
                <div className="absolute left-0 top-8 z-50 max-h-48 w-28 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-600 dark:bg-slate-900">
                  {monthOptions.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => {
                        setMonthCursor((prev) => new Date(prev.getFullYear(), Number(m.value) - 1, 1));
                        setMonthMenuOpen(false);
                      }}
                      className={`w-full rounded-md px-2 py-1.5 text-left text-xs capitalize hover:bg-violet-50 dark:hover:bg-violet-950/30 ${
                        m.value === monthValue ? "bg-violet-50 text-[#6D28D9] dark:bg-violet-950/40 dark:text-violet-300" : "text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {yearMenuOpen ? (
                <div className="absolute right-0 top-8 z-50 max-h-48 w-24 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-600 dark:bg-slate-900">
                  {yearOptions.map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => {
                        setMonthCursor((prev) => new Date(y, prev.getMonth(), 1));
                        setYearMenuOpen(false);
                      }}
                      className={`w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-violet-50 dark:hover:bg-violet-950/30 ${
                        String(y) === yearValue ? "bg-violet-50 text-[#6D28D9] dark:bg-violet-950/40 dark:text-violet-300" : "text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 text-center text-[11px] font-medium capitalize text-slate-500 dark:text-slate-400">{monthLabel}</div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {["S", "T", "Q", "Q", "S", "S", "D"].map((d, idx) => (
              <div key={`${d}-${idx}`}>{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((cell, idx) => {
              if (cell.muted) return <div key={`m-${idx}`} className="h-8 rounded-md" />;
              const selected = selectedDate ? toIso(selectedDate) === cell.iso : false;
              const disabledCell = isIsoOutsideBounds(cell.iso);
              return (
                <button
                  key={cell.iso}
                  type="button"
                  disabled={disabledCell}
                  onClick={() => {
                    onChange(cell.iso);
                    setOpen(false);
                  }}
                  className={`h-8 rounded-md text-sm transition-colors ${
                    selected
                      ? "bg-[#6D28D9] text-white"
                      : "text-slate-800 hover:bg-violet-50 dark:text-slate-100 dark:hover:bg-violet-950/40"
                  } ${disabledCell ? "cursor-not-allowed opacity-40 hover:bg-transparent" : ""}`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

