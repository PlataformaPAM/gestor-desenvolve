"use client";

import { ChevronRight } from "lucide-react";
import type { Ticket } from "@/lib/suporte/types";
import { PRIORIDADE_LABELS, STATUS_LABELS, CATEGORIA_LABELS } from "@/lib/suporte/constants";
import clsx from "clsx";

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

function formatData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getSituacaoBadge(previsaoConclusao: string): { label: string; className: string } | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(previsaoConclusao);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) {
    return {
      label: "Atrasado",
      className:
        "border-red-200 bg-red-100 text-red-700 dark:border-red-500/40 dark:bg-red-950/50 dark:text-red-300",
    };
  }
  if (diffDays <= 3) {
    return {
      label: "Vence logo",
      className:
        "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-300",
    };
  }
  return null;
}

export function TicketsTable({ tickets, onSelectTicket, pendingByTicketId = {} }: TicketsTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-[42%]" />
              <col className="w-[22%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80">
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ticket</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Prazos</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Categoria</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Prioridade</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {tickets.map((ticket) => {
                const situacaoBadge = getSituacaoBadge(ticket.previsaoConclusao);
                const responsavel = ticket.responsaveis[0]?.nome ?? "Não definido";
                return (
                  <tr
                    key={ticket.id}
                    onClick={() => onSelectTicket(ticket)}
                    className="relative cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/80"
                  >
                    <td className="px-6 py-4 align-top">
                      <div className="space-y-1.5">
                        <p className="inline-flex rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:border-violet-500/40 dark:bg-violet-950/40 dark:text-violet-300">
                          {ticket.id}
                        </p>
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{ticket.assunto}</p>
                        <p className="truncate text-xs text-slate-600 dark:text-slate-300">
                          <span className="font-medium">Cliente:</span> {ticket.clienteNome}
                        </p>
                        <p className="truncate text-xs text-slate-600 dark:text-slate-300">
                          <span className="font-medium">Responsável:</span> {responsavel}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <div className="space-y-1">
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          Início: <span className="font-medium">{formatData(ticket.dataCriacao)}</span>
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          Final: <span className="font-medium">{formatData(ticket.previsaoConclusao)}</span>
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {CATEGORIA_LABELS[ticket.categoria]}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <span className={clsx("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium", PRIORIDADE_BADGE[ticket.prioridade])}>
                        {PRIORIDADE_LABELS[ticket.prioridade]}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      {(pendingByTicketId[ticket.id] ?? 0) > 0 && (
                        <span className="absolute right-2 top-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {(pendingByTicketId[ticket.id] ?? 0) > 99 ? "99+" : (pendingByTicketId[ticket.id] ?? 0)}
                        </span>
                      )}
                      <div className="space-y-1 text-center">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {STATUS_LABELS[ticket.status]}
                        </span>
                        {situacaoBadge ? (
                          <span className={clsx("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium", situacaoBadge.className)}>
                            {situacaoBadge.label}
                          </span>
                        ) : null}
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

      <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
        {tickets.map((ticket) => (
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
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Cliente: {ticket.clienteNome}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Responsável: {ticket.responsaveis[0]?.nome ?? "Não definido"}</p>
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
                {getSituacaoBadge(ticket.previsaoConclusao)?.label ?? "No prazo"}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-end">
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>
          </div>
        ))}
        {tickets.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhum ticket encontrado com os filtros aplicados.
          </div>
        )}
      </div>
    </div>
  );
}
