"use client";

import { ChevronRight } from "lucide-react";
import type { ColaboradorParceiro } from "@/lib/rh/types";
import { STATUS_LABELS, iniciais } from "@/lib/rh/constants";
import { formatDocumentoColunaEquipe } from "@/lib/rh/format-documento";
import { displayCargoRh } from "@/lib/rh/pre-cadastro-consultor";
import clsx from "clsx";

const STATUS_BADGE: Record<ColaboradorParceiro["status"], string> = {
  ativo:
    "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950/70",
  inativo:
    "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-950/70",
  ferias:
    "border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-500/40 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-950/70",
  afastado:
    "border-red-300 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-500/40 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950/70",
};

type ColaboradoresTableProps = {
  lista: ColaboradorParceiro[];
  /** Na aba Equipe, CPF/CNPJ é exibido com máscara. */
  variant?: "equipe" | "default";
  /** Aba Consultores: exibe badge em linhas de pré-cadastro. */
  showPreCadastroBadge?: boolean;
  onSelecionar: (c: ColaboradorParceiro) => void;
};

export function ColaboradoresTable({
  lista,
  variant = "default",
  showPreCadastroBadge = false,
  onSelecionar,
}: ColaboradoresTableProps) {
  const docCell = (c: ColaboradorParceiro) =>
    variant === "equipe" ? formatDocumentoColunaEquipe(c.cpfCnpj) : (c.cpfCnpj ?? "—");
  return (
    <>
      <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                  Nome
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                  {variant === "equipe" ? "CPF" : "CPF/CNPJ"}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                  Cargo / Função
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-10 dark:text-slate-400">
                  <span className="sr-only">Abrir detalhes</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {lista.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => onSelecionar(c)}
                  className="cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/80"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#6D28D9]/10 text-sm font-semibold text-[#6D28D9] dark:bg-violet-500/20 dark:text-violet-300">
                        {iniciais(c.nome)}
                      </div>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{c.nome}</span>
                      {showPreCadastroBadge && c.tipo === "vendedor_externo" && c.cadastroEfetivado === false ? (
                        <span className="ml-2 inline-flex shrink-0 rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:border-amber-600/50 dark:bg-amber-950/60 dark:text-amber-100">
                          Pré-cadastro
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-slate-600 dark:text-slate-400">
                    {docCell(c)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{displayCargoRh(c)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={clsx(
                        "inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold",
                        STATUS_BADGE[c.status]
                      )}
                    >
                      {STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="ml-auto h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {lista.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhum registro nesta categoria.
          </div>
        )}
      </div>

      {/* Mobile: cards com avatar */}
      <div className="md:hidden space-y-2">
        {lista.map((c) => (
          <div
            key={c.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelecionar(c)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelecionar(c);
              }
            }}
            className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/80"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#6D28D9]/10 text-sm font-semibold text-[#6D28D9] dark:bg-violet-500/20 dark:text-violet-300">
                  {iniciais(c.nome)}
                </div>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-slate-900 dark:text-slate-100">
                    <span className="truncate">{c.nome}</span>
                    {showPreCadastroBadge && c.tipo === "vendedor_externo" && c.cadastroEfetivado === false ? (
                      <span className="inline-flex shrink-0 rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:border-amber-600/50 dark:bg-amber-950/60 dark:text-amber-100">
                        Pré-cadastro
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">{displayCargoRh(c)}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span
                  className={clsx(
                    "inline-flex rounded-lg border px-2 py-1 text-xs font-semibold",
                    STATUS_BADGE[c.status]
                  )}
                >
                  {STATUS_LABELS[c.status]}
                </span>
              </div>
            </div>
              <div className="mt-2 flex justify-end text-slate-400 dark:text-slate-500">
                <ChevronRight className="h-4 w-4" aria-hidden />
              </div>
          </div>
        ))}
        {lista.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            Nenhum registro nesta categoria.
          </div>
        )}
      </div>
    </>
  );
}
