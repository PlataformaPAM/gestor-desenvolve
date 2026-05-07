"use client";

import { memo, useMemo } from "react";
import clsx from "clsx";
import { Building2, ChevronRight, MapPin } from "lucide-react";
import type { Lead, LeadPriority, PipelineStage } from "@/lib/comercial/types";
import type { Cliente } from "@/lib/clientes/types";
import { PRIORIDADE_LABELS } from "@/lib/comercial/constants";
import { formatCurrency } from "@/lib/comercial/utils";
import { STAGE_COLORS } from "@/lib/comercial/stage-colors";
import { getLeadOwnership } from "@/lib/comercial/ownership";

function prioridadeBadgeClass(priority: LeadPriority): string {
  return clsx(
    priority === "urgente" &&
      "border-red-200 bg-red-100 text-red-700 dark:border-red-500/40 dark:bg-red-950/50 dark:text-red-300",
    priority === "alta" &&
      "border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-500/40 dark:bg-orange-950/50 dark:text-orange-300",
    priority === "media" &&
      "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-300",
    priority === "baixa" &&
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
  );
}

function iniciaisLead(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "??";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

function formatUltimaAlteracao(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatVencimento(value: string | undefined): string {
  if (!value?.trim()) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

type LeadListProps = {
  leads: Lead[];
  clientes: Cliente[];
  stages: PipelineStage[];
  selectedLeadId: string | null;
  onSelectLead: (lead: Lead) => void;
  isLoading?: boolean;
};

const stageLabelMap = (stages: PipelineStage[]) =>
  Object.fromEntries(stages.map((s) => [s.id, s.label]));

function ListSkeletonDesktop() {
  return (
    <tbody>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b border-slate-100 dark:border-slate-700">
          <td className="px-6 py-4">
            <div className="h-4 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          </td>
          <td className="px-6 py-4">
            <div className="h-4 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          </td>
          <td className="px-6 py-4">
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          </td>
          <td className="px-6 py-4">
            <div className="h-6 w-16 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700" />
          </td>
          <td className="px-6 py-4">
            <div className="h-6 w-20 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700" />
          </td>
          <td className="px-6 py-4">
            <div className="ml-auto h-4 w-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          </td>
        </tr>
      ))}
    </tbody>
  );
}

export const LeadList = memo(function LeadList({
  leads,
  clientes,
  stages,
  selectedLeadId,
  onSelectLead,
  isLoading,
}: LeadListProps) {
  const stageLabels = stageLabelMap(stages);
  const clienteMap = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);

  const isEmpty = !isLoading && leads.length === 0;

  return (
    <div
      data-testid="comercial-lead-list"
      className="mt-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="hidden md:block">
        {!isEmpty && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80">
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Lead
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Responsável / Prazos
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Valor
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Prioridade
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Etapa
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Ações
                  </th>
                </tr>
              </thead>
              {isLoading ? (
                <ListSkeletonDesktop />
              ) : (
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {leads.map((lead) => {
                    const ownership = getLeadOwnership(lead);
                    const cliente = lead.clienteId ? clienteMap.get(lead.clienteId) : undefined;
                    const stageColors = STAGE_COLORS[lead.stageId];
                    const priorityStyle = prioridadeBadgeClass(lead.priority);

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => onSelectLead(lead)}
                        className={clsx(
                          "cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60",
                          selectedLeadId === lead.id && "bg-violet-50/80 dark:bg-violet-950/40"
                        )}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-[#6D28D9] dark:bg-violet-950/60 dark:text-violet-300">
                              {iniciaisLead(lead.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {lead.name}
                              </p>
                              {cliente ? (
                                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                  <Building2 className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{cliente.empresa || cliente.nome}</span>
                                </p>
                              ) : (
                                <p className="mt-0.5 text-xs text-slate-400">Sem cliente vinculado</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            Responsável: {ownership.responsavelNome ?? "—"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Última alteração: {formatUltimaAlteracao(lead.registroAtualizadoEm)}
                          </p>
                          {(["proposta", "contratacao", "fechado", "perdido"] as Lead["stageId"][]).includes(lead.stageId) && (
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              Vencimento: {formatVencimento(lead.previsaoFechamento)}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
                          {formatCurrency(lead.valorTotal > 0 ? lead.valorTotal : lead.value)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={clsx(
                              "inline-flex max-w-full truncate rounded-md border px-2 py-0.5 text-xs font-medium",
                              priorityStyle
                            )}
                          >
                            {PRIORIDADE_LABELS[lead.priority]}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={clsx(
                              "inline-flex max-w-full truncate rounded-md px-2 py-0.5 text-xs font-medium",
                              stageColors.badge
                            )}
                          >
                            {stageLabels[lead.stageId] ?? lead.stageId}
                          </span>
                        </td>
                        <td
                          className="px-6 py-4 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectLead(lead)}
                            className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#6D28D9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] dark:hover:bg-slate-800 dark:hover:text-violet-300"
                            aria-label={`Abrir ${lead.name}`}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              )}
            </table>
          </div>
        )}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-purple-100/80 text-[#6D28D9] dark:bg-violet-950/50 dark:text-violet-300">
              <MapPin className="h-10 w-10" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Nenhum lead na lista
            </h3>
            <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Crie um novo lead ou ajuste os filtros do funil.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3 md:hidden">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          ))}
        {!isLoading &&
          leads.map((lead) => {
            const ownership = getLeadOwnership(lead);
            const cliente = lead.clienteId ? clienteMap.get(lead.clienteId) : undefined;
            const stageColors = STAGE_COLORS[lead.stageId];
            return (
              <div
                key={lead.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectLead(lead)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectLead(lead);
                  }
                }}
                className={clsx(
                  "flex cursor-pointer flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-all hover:bg-slate-50/50 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/50",
                  selectedLeadId === lead.id && "ring-2 ring-[#6D28D9]/30"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-[#6D28D9] dark:bg-violet-950/60 dark:text-violet-300">
                    {iniciaisLead(lead.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{lead.name}</p>
                    {cliente ? (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <Building2 className="h-3 w-3 shrink-0" />
                        {cliente.empresa || cliente.nome}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-slate-400">Sem cliente vinculado</p>
                    )}
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                      Responsável: {ownership.responsavelNome ?? "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Última alteração: {formatUltimaAlteracao(lead.registroAtualizadoEm)}
                    </p>
                    {(["proposta", "contratacao", "fechado", "perdido"] as Lead["stageId"][]).includes(lead.stageId) && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        Vencimento: {formatVencimento(lead.previsaoFechamento)}
                      </p>
                    )}
                    <p className="mt-2 text-sm font-bold text-[#6D28D9]">
                      {formatCurrency(lead.valorTotal > 0 ? lead.valorTotal : lead.value)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={clsx(
                      "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium",
                      prioridadeBadgeClass(lead.priority)
                    )}
                  >
                    {PRIORIDADE_LABELS[lead.priority]}
                  </span>
                  <span
                    className={clsx(
                      "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                      stageColors.badge
                    )}
                  >
                    {stageLabels[lead.stageId] ?? lead.stageId}
                  </span>
                </div>
                <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            );
          })}
        {isEmpty && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
            Nenhum lead na lista.
          </div>
        )}
      </div>
    </div>
  );
});
