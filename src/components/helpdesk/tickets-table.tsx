"use client";

import { ChevronRight } from "lucide-react";
import type { Ticket, TicketResponsavel } from "@/lib/helpdesk/types";
import { PRIORIDADE_LABELS, STATUS_LABELS, CATEGORIA_LABELS, getSlaEstado } from "@/lib/helpdesk/constants";
import clsx from "clsx";
import { EntityMetaStrip } from "@/components/ui/entity-meta-strip";

/** Cores: Crítica=Vermelho, Alta=Laranja, Média=Amarelo, Baixa=Azul */
const PRIORIDADE_BADGE: Record<Ticket["prioridade"], string> = {
  baixa: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700/50",
  media: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700/50",
  alta: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-700/50",
  critica: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-700/50",
};

type TicketsTableProps = {
  tickets: Ticket[];
  onSelectTicket: (ticket: Ticket) => void;
  pendingByTicketId?: Record<string, number>;
};

function IniciaisAvatar({ responsavel, className }: { responsavel: TicketResponsavel; className?: string }) {
  const iniciais = responsavel.nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";
  return (
    <div
      className={clsx(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6D28D9]/15 text-xs font-semibold text-[#6D28D9] dark:bg-violet-500/20 dark:text-violet-300",
        className
      )}
      title={responsavel.nome}
    >
      {iniciais}
    </div>
  );
}

export function TicketsTable({ tickets, onSelectTicket, pendingByTicketId = {} }: TicketsTableProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
      {/* Desktop: tabela rica */}
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80">
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Ticket
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Solicitante / Cliente
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Classificação
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Status & SLA
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Responsável
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {tickets.map((ticket) => {
                const sla = getSlaEstado(ticket.previsaoConclusao);
                return (
                  <tr
                    key={ticket.id}
                    onClick={() => onSelectTicket(ticket)}
                    className="relative cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <td className="px-6 py-4">
                      <p className="font-mono text-sm font-bold text-[#6D28D9]">{ticket.id}</p>
                      <p className="mt-0.5 text-sm text-slate-700 line-clamp-2 dark:text-slate-300">{ticket.assunto}</p>
                      <EntityMetaStrip
                        className="mt-1.5"
                        criadoPorNome={ticket.registroCriadoPorNome}
                        criadoEm={ticket.createdAt}
                        atualizadoEm={ticket.updatedAt}
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900 dark:text-slate-100">{ticket.clienteNome}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600">
                          {CATEGORIA_LABELS[ticket.categoria]}
                        </span>
                        <span
                          className={clsx(
                            "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                            PRIORIDADE_BADGE[ticket.prioridade]
                          )}
                        >
                          {PRIORIDADE_LABELS[ticket.prioridade]}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-slate-700 dark:text-slate-300">{STATUS_LABELS[ticket.status]}</span>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span className="flex items-center gap-1 text-xs">
                          {sla === "no_prazo" && <><span className="text-emerald-500" aria-hidden>🟢</span> No prazo</>}
                          {sla === "atencao" && <><span className="text-amber-500" aria-hidden>🟡</span> Atenção</>}
                          {sla === "atrasado" && <><span className="text-red-500" aria-hidden>🔴</span> Atrasado</>}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {(pendingByTicketId[ticket.id] ?? 0) > 0 && (
                        <span className="absolute right-2 top-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {(pendingByTicketId[ticket.id] ?? 0) > 99 ? "99+" : (pendingByTicketId[ticket.id] ?? 0)}
                        </span>
                      )}
                      <div className="flex -space-x-2">
                        {ticket.responsaveis.length
                          ? ticket.responsaveis.map((r) => (
                              <IniciaisAvatar key={r.id} responsavel={r} className="ring-2 ring-white dark:ring-slate-900" />
                            ))
                          : <span className="text-xs text-slate-400">—</span>
                        }
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {tickets.length === 0 && (
          <div className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhum ticket encontrado com os filtros aplicados.
          </div>
        )}
      </div>

      {/* Mobile: cards */}
      <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
        {tickets.map((ticket) => {
          const sla = getSlaEstado(ticket.previsaoConclusao);
          return (
            <div
              key={ticket.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectTicket(ticket)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectTicket(ticket);
                }
              }}
              className="relative w-full px-4 py-4 text-left cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <p className="font-mono text-sm font-bold text-[#6D28D9]">{ticket.id}</p>
              {(pendingByTicketId[ticket.id] ?? 0) > 0 && (
                <span className="absolute right-2 top-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {(pendingByTicketId[ticket.id] ?? 0) > 99 ? "99+" : (pendingByTicketId[ticket.id] ?? 0)}
                </span>
              )}
              <p className="mt-0.5 text-sm font-medium text-slate-900 line-clamp-2 dark:text-slate-100">{ticket.assunto}</p>
              <EntityMetaStrip
                className="mt-1.5"
                criadoPorNome={ticket.registroCriadoPorNome}
                criadoEm={ticket.createdAt}
                atualizadoEm={ticket.updatedAt}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{ticket.clienteNome}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {CATEGORIA_LABELS[ticket.categoria]}
                </span>
                <span className={clsx("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", PRIORIDADE_BADGE[ticket.prioridade])}>
                  {PRIORIDADE_LABELS[ticket.prioridade]}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-slate-600">{STATUS_LABELS[ticket.status]}</span>
                <span className="text-xs">
                  {sla === "no_prazo" && <>🟢 No prazo</>}
                  {sla === "atencao" && <>🟡 Atenção</>}
                  {sla === "atrasado" && <>🔴 Atrasado</>}
                </span>
              </div>
              {ticket.responsaveis.length > 0 && (
                <div className="mt-2 flex -space-x-2">
                  {ticket.responsaveis.map((r) => (
                    <IniciaisAvatar key={r.id} responsavel={r} className="ring-2 ring-white h-7 w-7 text-[10px]" />
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center justify-end">
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
            </div>
          );
        })}
        {tickets.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhum ticket encontrado com os filtros aplicados.
          </div>
        )}
      </div>
    </div>
  );
}
