"use client";

import type { EventoHistorico } from "@/lib/pos-venda/types";
import { CATEGORIA_LABELS } from "@/lib/pos-venda/constants";
import clsx from "clsx";

const CATEGORIA_COR: Record<NonNullable<EventoHistorico["categoria"]>, string> = {
  onboarding: "bg-blue-500",
  relacionamento: "bg-[#6D28D9]",
  alerta_risco: "bg-orange-500",
};

type ReguaTimelineProps = {
  eventos: EventoHistorico[];
  compacto?: boolean;
  limiteItens?: number;
};

function formatData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReguaTimeline({ eventos, compacto = false, limiteItens }: ReguaTimelineProps) {
  const ordenados = [...eventos].sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
  );
  const exibidos = typeof limiteItens === "number" ? ordenados.slice(0, limiteItens) : ordenados;

  return (
    <div
      className={clsx(
        "flex h-full min-h-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900",
        compacto ? "p-3" : "p-4 lg:p-6"
      )}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200">
        Histórico de relacionamento
      </h2>

      <div className="mt-4 relative min-h-0 flex-1 space-y-0 overflow-y-auto pr-1">
        <div
          className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-slate-700"
          aria-hidden
        />

        {exibidos.map((ev) => {
          const corDot = ev.categoria ? CATEGORIA_COR[ev.categoria] : "bg-slate-400";
          const labelCategoria = !compacto && ev.categoria ? CATEGORIA_LABELS[ev.categoria] : null;
          const classCategoria =
            ev.categoria === "onboarding"
              ? "text-blue-600"
              : ev.categoria === "relacionamento"
                ? "text-[#6D28D9]"
                : ev.categoria === "alerta_risco"
                  ? "text-orange-600"
                  : "";

          return (
            <div key={ev.id} className="relative flex gap-4 pb-6 last:pb-0">
              <div
                className={clsx(
                  "relative z-10 flex h-6 w-6 shrink-0 rounded-full border-2 border-white shadow dark:border-slate-900",
                  corDot
                )}
              />

              <div className="min-w-0 flex-1 pt-0.5">
                <p className="break-words text-sm font-medium text-slate-900 dark:text-slate-100">
                  {ev.titulo}
                </p>

                {!compacto && ev.descricao && (
                  <p className="mt-0.5 break-words text-xs text-slate-500 dark:text-slate-400">{ev.descricao}</p>
                )}

                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  {formatData(ev.data)}
                  {labelCategoria ? (
                    <span className={classCategoria}>{" · "}{labelCategoria}</span>
                  ) : null}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {typeof limiteItens === "number" && ordenados.length > limiteItens && (
        <p className="pt-2 text-xs text-slate-500 dark:text-slate-400">
          Mostrando {limiteItens} de {ordenados.length} eventos neste modo.
        </p>
      )}

      {ordenados.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Nenhum evento no histórico.
        </p>
      )}
    </div>
  );
}
