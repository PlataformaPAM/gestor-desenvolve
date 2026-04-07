"use client";

import { useState } from "react";
import { Send, User, HeadphonesIcon, Bot } from "lucide-react";
import type { Ticket, ComentarioTicket } from "@/lib/helpdesk/types";
import { PRIORIDADE_LABELS, STATUS_LABELS, CATEGORIA_LABELS } from "@/lib/helpdesk/constants";
import clsx from "clsx";

const STATUS_BADGE: Record<Ticket["status"], string> = {
  novo: "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-500/40 dark:bg-blue-950/50 dark:text-blue-300",
  em_andamento:
    "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-300",
  aguardando_cliente:
    "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  aguardando_equipe:
    "border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-500/40 dark:bg-violet-950/50 dark:text-violet-300",
  pendente:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300",
  respondido:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300",
  finalizado:
    "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-300",
  nao_solucionado:
    "border-red-200 bg-red-100 text-red-700 dark:border-red-500/40 dark:bg-red-950/50 dark:text-red-300",
};

type TicketDetailDrawerProps = {
  ticket: Ticket | null;
};

function IconAutor({ tipo }: { tipo: ComentarioTicket["autorTipo"] }) {
  if (tipo === "cliente") return <User className="h-4 w-4" />;
  if (tipo === "atendente") return <HeadphonesIcon className="h-4 w-4" />;
  return <Bot className="h-4 w-4" />;
}

function formatComentarioData(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const mesmoDia =
    d.getDate() === hoje.getDate() &&
    d.getMonth() === hoje.getMonth() &&
    d.getFullYear() === hoje.getFullYear();
  if (mesmoDia) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TicketDetailDrawer({ ticket }: TicketDetailDrawerProps) {
  const [novoComentario, setNovoComentario] = useState("");

  if (!ticket) return null;

  const enviarComentario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoComentario.trim()) return;
    setNovoComentario("");
  };

  return (
    <div className="flex h-full flex-col">
      {/* Cabeçalho do ticket */}
      <div className="shrink-0 border-b border-slate-200 p-4 dark:border-slate-700 lg:p-6">
        <p className="font-mono text-sm font-medium text-[#6D28D9] dark:text-violet-400">{ticket.id}</p>
        <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{ticket.assunto}</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {CATEGORIA_LABELS[ticket.categoria]}
          </span>
          <span
            className={clsx(
              "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
              ticket.prioridade === "baixa" &&
                "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-500/40 dark:bg-blue-950/50 dark:text-blue-300",
              ticket.prioridade === "media" &&
                "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-300",
              ticket.prioridade === "alta" &&
                "border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-500/40 dark:bg-orange-950/50 dark:text-orange-300",
              ticket.prioridade === "critica" &&
                "border-red-200 bg-red-100 text-red-700 dark:border-red-500/40 dark:bg-red-950/50 dark:text-red-300"
            )}
          >
            {PRIORIDADE_LABELS[ticket.prioridade]}
          </span>
          <span className={clsx("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium", STATUS_BADGE[ticket.status])}>
            {STATUS_LABELS[ticket.status]}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Cliente: <span className="font-medium text-slate-700 dark:text-slate-300">{ticket.clienteNome}</span>
          {ticket.responsaveis.length > 0 && (
            <>
              {" · "}
              Responsável(is):{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {ticket.responsaveis.map((r) => r.nome).join(", ")}
              </span>
            </>
          )}
        </p>
      </div>

      {/* Área de Chat / Comentários */}
      <div className="flex flex-1 min-h-0 flex-col">
        <p className="shrink-0 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Histórico do atendimento
        </p>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          {ticket.comentarios.map((c) => (
            <div
              key={c.id}
              className={clsx(
                "flex gap-3 rounded-lg p-3",
                c.autorTipo === "cliente" && "bg-slate-50 dark:bg-slate-800/60",
                c.autorTipo === "atendente" && "bg-violet-50/80 dark:bg-violet-950/40",
                c.autorTipo === "sistema" && "bg-slate-100/80 dark:bg-slate-800/80"
              )}
            >
              <div
                className={clsx(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  c.autorTipo === "cliente" && "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
                  c.autorTipo === "atendente" &&
                    "bg-[#6D28D9]/20 text-[#6D28D9] dark:bg-violet-500/25 dark:text-violet-300",
                  c.autorTipo === "sistema" && "bg-slate-300 text-slate-500 dark:bg-slate-600 dark:text-slate-400"
                )}
              >
                <IconAutor tipo={c.autorTipo} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {c.autor}
                  <span className="ml-2 font-normal text-slate-400 dark:text-slate-500">
                    {formatComentarioData(c.data)}
                  </span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">{c.texto}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Campo para novo comentário */}
        <form
          onSubmit={enviarComentario}
          className="shrink-0 border-t border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={novoComentario}
              onChange={(e) => setNovoComentario(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <button
              type="submit"
              className="rounded-lg bg-[#6D28D9] p-2 text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9]"
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
