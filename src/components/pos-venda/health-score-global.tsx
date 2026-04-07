"use client";

import { Heart } from "lucide-react";
import type { ClienteHealth } from "@/lib/pos-venda/types";

type HealthScoreGlobalProps = {
  clientes: ClienteHealth[];
  compacto?: boolean;
};

export function HealthScoreGlobal({ clientes, compacto = false }: HealthScoreGlobalProps) {
  const total = clientes.length;
  const engajado = clientes.filter((c) => c.healthScore === "engajado").length;
  const neutro = clientes.filter((c) => c.healthScore === "neutro").length;
  const risco = clientes.filter((c) => c.healthScore === "risco").length;
  const mediaScore = total
    ? Math.round(clientes.reduce((acc, c) => acc + (Number.isFinite(c.score) ? c.score : 0), 0) / total)
    : 0;

  const pctEngajado = total ? Math.round((engajado / total) * 100) : 0;
  const pctNeutro = total ? Math.round((neutro / total) * 100) : 0;
  const pctRisco = total ? Math.round((risco / total) * 100) : 0;

  return (
    <div className={`flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 ${compacto ? "p-3" : "p-4 lg:p-6"}`}>
      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
        <Heart className="h-5 w-5 text-[#6D28D9]" />
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          Panorama da carteira
        </h2>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-700 dark:bg-slate-800/70">
          <div className="flex flex-col items-center justify-center gap-1">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Média de saúde</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{mediaScore}/100</p>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-700 dark:bg-slate-800/70">
          <div className="flex flex-col items-center justify-center gap-1">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Clientes</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{total}</p>
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2 text-center dark:border-emerald-500/40 dark:bg-emerald-950/30">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Engajados</p>
          <p className="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">{pctEngajado}%</p>
          <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">({engajado})</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2 text-center dark:border-amber-500/40 dark:bg-amber-950/30">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Neutros</p>
          <p className="mt-1 text-sm font-bold text-amber-700 dark:text-amber-300">{pctNeutro}%</p>
          <p className="text-xs text-amber-700/80 dark:text-amber-300/80">({neutro})</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50/60 p-2 text-center dark:border-red-500/40 dark:bg-red-950/30">
          <p className="text-xs font-medium text-red-700 dark:text-red-300">Risco</p>
          <p className="mt-1 text-sm font-bold text-red-700 dark:text-red-300">{pctRisco}%</p>
          <p className="text-xs text-red-700/80 dark:text-red-300/80">({risco})</p>
        </div>
      </div>
      {!compacto && (
        <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          {pctEngajado > 0 && (
            <div className="h-full rounded-l-full bg-emerald-500" style={{ width: `${pctEngajado}%` }} />
          )}
          {pctNeutro > 0 && (
            <div className="h-full bg-amber-500" style={{ width: `${pctNeutro}%` }} />
          )}
          {pctRisco > 0 && (
            <div className="h-full rounded-r-full bg-red-500" style={{ width: `${pctRisco}%` }} />
          )}
        </div>
      )}
    </div>
  );
}
