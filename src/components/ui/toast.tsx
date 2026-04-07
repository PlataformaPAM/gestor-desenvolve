"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";

type ToastProps = {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
  variant?: "success" | "error";
  closeButton?: boolean;
};

export function Toast({
  message,
  visible,
  onDismiss,
  duration = 3000,
  variant = "success",
  closeButton = false,
}: ToastProps) {
  const effectiveDuration = useMemo(() => {
    if (duration > 0) return duration;
    const base = 4000;
    const extra = Math.min(6000, Math.floor(message.length / 40) * 1000);
    return Math.min(10000, base + extra);
  }, [duration, message.length]);
  const [remainingMs, setRemainingMs] = useState(effectiveDuration);
  const [paused, setPaused] = useState(false);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    setRemainingMs(effectiveDuration);
    setPaused(false);
    lastTickRef.current = null;
  }, [visible, effectiveDuration, message]);

  useEffect(() => {
    if (!visible || paused) return;
    const interval = window.setInterval(() => {
      const now = Date.now();
      const last = lastTickRef.current ?? now;
      const delta = now - last;
      lastTickRef.current = now;
      setRemainingMs((prev) => Math.max(0, prev - delta));
    }, 100);
    return () => window.clearInterval(interval);
  }, [visible, paused]);

  useEffect(() => {
    if (!visible) return;
    if (remainingMs > 0) return;
    onDismiss();
  }, [visible, remainingMs, onDismiss]);

  if (!visible) return null;

  const isError = variant === "error";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-[70] flex justify-center sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm"
    >
      <div
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className={`flex items-center gap-3 rounded-lg border bg-white px-4 py-3 shadow-lg ring-1 ring-slate-900/5 dark:bg-slate-900 dark:ring-slate-100/10 ${
          isError ? "border-red-200 dark:border-red-800/60" : "border-emerald-200 dark:border-emerald-800/50"
        }`}
      >
        {isError ? (
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
        ) : (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        )}
        <p
          className={`text-sm font-medium ${isError ? "text-red-800 dark:text-red-300" : "text-slate-900 dark:text-slate-100"}`}
        >
          {message}
        </p>
        <span className="ml-1 shrink-0 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          {Math.ceil(remainingMs / 1000)}s
        </span>
        {closeButton && (
          <button
            type="button"
            onClick={onDismiss}
            className="ml-1 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Fechar"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
