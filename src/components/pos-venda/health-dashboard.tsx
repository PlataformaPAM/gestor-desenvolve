"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { ClienteHealth } from "@/lib/pos-venda/types";
import { HEALTH_LABELS } from "@/lib/pos-venda/constants";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";

const HEALTH_STYLE: Record<ClienteHealth["healthScore"], string> = {
  engajado: "bg-emerald-500",
  neutro: "bg-amber-500",
  risco: "bg-red-500",
};

const HEALTH_BADGE: Record<ClienteHealth["healthScore"], string> = {
  engajado:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-500/40",
  neutro:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-500/40",
  risco: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-500/40",
};

type HealthDashboardProps = {
  clientes: ClienteHealth[];
  compacto?: boolean;
};

export function HealthDashboard({ clientes, compacto = false }: HealthDashboardProps) {
  const [filtro, setFiltro] = useState<"todos" | "risco" | "atraso">("todos");
  const [ordem, setOrdem] = useState<"risco" | "nome">("risco");
  const [busca, setBusca] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);

  const lista = useMemo(() => {
    const term = busca.trim().toLowerCase();
    const base = clientes.filter((c) => {
      if (filtro === "risco" && c.healthScore !== "risco") return false;
      if (filtro === "atraso" && c.atrasadas <= 0) return false;
      const nomeMatch = c.clienteNome.toLowerCase().includes(term);
      const docMatch = (c.clienteDocumento ?? "").toLowerCase().includes(term);
      if (!term) return true;
      return nomeMatch || docMatch;
    });
    if (ordem === "nome") {
      return [...base].sort((a, b) => a.clienteNome.localeCompare(b.clienteNome, "pt-BR"));
    }
    return [...base].sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      if (a.atrasadas !== b.atrasadas) return b.atrasadas - a.atrasadas;
      return b.pendentes - a.pendentes;
    });
  }, [clientes, filtro, ordem, busca]);

  const qtdRisco = clientes.filter((c) => c.healthScore === "risco").length;
  const qtdAtraso = clientes.filter((c) => c.atrasadas > 0).length;
  const safeIndex = lista.length === 0 ? 0 : currentIndex % lista.length;
  const visiveis =
    lista.length <= 2
      ? lista
      : [lista[safeIndex], lista[(safeIndex + 1) % lista.length]];

  useEffect(() => {
    if (lista.length <= 1 || paused) return;
    const timer = window.setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 2) % lista.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [lista.length, paused]);

  return (
    <div className={clsx("flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900", compacto ? "p-3" : "p-4 lg:p-6")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Sinais por cliente
        </h2>
      </div>

      {!compacto && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={lista.length === 0}
              onClick={() => {
                setDirection(-1);
                setCurrentIndex((prev) => (prev - 2 + lista.length) % lista.length);
              }}
              className="rounded-md border border-[#6D28D9]/30 bg-[#6D28D9]/10 p-2 text-[#6D28D9] hover:bg-[#6D28D9]/15 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Cliente anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setCurrentIndex(0);
                }}
                placeholder="Buscar por nome ou CNPJ"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFiltro("todos");
                  setCurrentIndex(0);
                }}
                className={clsx(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  filtro === "todos"
                    ? "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                )}
              >
                Todos ({clientes.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setFiltro("risco");
                  setCurrentIndex(0);
                }}
                className={clsx(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  filtro === "risco"
                    ? "border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-300"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                )}
              >
                Risco ({qtdRisco})
              </button>
              <button
                type="button"
                onClick={() => {
                  setFiltro("atraso");
                  setCurrentIndex(0);
                }}
                className={clsx(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  filtro === "atraso"
                    ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                )}
              >
                Atrasados ({qtdAtraso})
              </button>
              <select
                value={ordem}
                onChange={(e) => {
                  setOrdem(e.target.value as "risco" | "nome");
                  setCurrentIndex(0);
                }}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="risco">Ordenar: maior risco</option>
                <option value="nome">Ordenar: nome</option>
              </select>
            </div>
            <button
              type="button"
              disabled={lista.length === 0}
              onClick={() => {
                setDirection(1);
                setCurrentIndex((prev) => (prev + 2) % lista.length);
              }}
              className="rounded-md border border-[#6D28D9]/30 bg-[#6D28D9]/10 p-2 text-[#6D28D9] hover:bg-[#6D28D9]/15 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Próximo cliente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
      <div className="mt-3">
        {visiveis.length > 0 && (
          <div
            className="w-full"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                key={visiveis.map((c) => c.clienteId).join("-")}
                initial={{ opacity: 0, x: direction > 0 ? 18 : -18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction > 0 ? -18 : 18 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="grid grid-cols-1 gap-3 lg:grid-cols-2"
              >
                {visiveis.map((atual) => (
                  <div key={atual.clienteId} className={clsx("w-full rounded-lg border p-3 transition-all", HEALTH_BADGE[atual.healthScore])}>
                    <div className="flex items-center gap-2">
                      <span
                        className={clsx("h-2 w-2 shrink-0 rounded-full", HEALTH_STYLE[atual.healthScore])}
                        aria-hidden
                      />
                      <span className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                        {atual.clienteNome}
                      </span>
                      <span className="rounded-md border border-current/20 px-2 py-0.5 text-xs font-semibold">
                        {atual.score}/100
                      </span>
                    </div>
                    <p className="mt-1 text-xs opacity-90 text-slate-600 dark:text-slate-300">{HEALTH_LABELS[atual.healthScore]}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{atual.clienteDocumento || "Sem CNPJ/CPF"}</p>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded bg-white/70 px-2 py-1 dark:bg-slate-900/40">
                        <p className="text-slate-500 dark:text-slate-400">Pendente</p>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{atual.pendentes}</p>
                      </div>
                      <div className="rounded bg-white/70 px-2 py-1 dark:bg-slate-900/40">
                        <p className="text-slate-500 dark:text-slate-400">Atraso</p>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{atual.atrasadas}</p>
                      </div>
                      <div className="rounded bg-white/70 px-2 py-1 dark:bg-slate-900/40">
                        <p className="text-slate-500 dark:text-slate-400">Concluído</p>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{atual.concluidasTotal}</p>
                      </div>
                    </div>
                    {!compacto && (
                      <>
                        <p className="mt-2 line-clamp-2 text-sm text-slate-700 dark:text-slate-200">{atual.motivoPrincipal}</p>
                        <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-800 dark:text-slate-100">{atual.proximaAcao}</p>
                      </>
                    )}
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
            {!compacto && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {Math.min(safeIndex + 1, lista.length)} a {Math.min(safeIndex + visiveis.length, lista.length)} de {lista.length}
              </p>
            )}
          </div>
        )}
        {lista.length === 0 && (
          <p className="w-full text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhum indicador de saúde disponível.
          </p>
        )}
      </div>
    </div>
  );
}
