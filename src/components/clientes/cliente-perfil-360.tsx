"use client";

import { useState } from "react";
import {
  Mail,
  Phone,
  Building2,
  MapPin,
  FileText,
  CreditCard,
  Headphones,
  Calendar,
  Repeat,
  ClipboardList,
} from "lucide-react";
import type { Cliente } from "@/lib/clientes/types";
import { formatCurrency } from "@/lib/clientes/utils";
import { STATUS_LABELS, SEGMENTO_LABELS } from "@/lib/clientes/constants";
import type { Lancamento } from "@/lib/financeiro/types";
import { descricaoParaExibicao, parcelaRotuloCurto } from "@/lib/financeiro/lancamento-utils";
import type { Ticket } from "@/lib/suporte/types";
import { PRIORIDADE_LABELS, STATUS_LABELS as TICKET_STATUS_LABELS } from "@/lib/suporte/constants";
import type { TarefaRegua } from "@/lib/pos-venda/types";
import { TIPO_TAREFA_LABELS } from "@/lib/pos-venda/constants";
import clsx from "clsx";

type TabId = "geral" | "comercial" | "financeiro" | "suporte" | "pos_venda";

const TABS: { id: TabId; label: string }[] = [
  { id: "geral", label: "Geral" },
  { id: "comercial", label: "Comercial" },
  { id: "financeiro", label: "Financeiro" },
  { id: "suporte", label: "Suporte" },
  { id: "pos_venda", label: "Pós-Venda" },
];

type ClientePerfil360Props = {
  cliente: Cliente | null;
  /** Lançamentos (parcelas/recorrências) do módulo Financeiro para este cliente */
  lancamentosDoCliente?: Lancamento[];
  /** Tickets do Suporte para este cliente */
  ticketsDoCliente?: Ticket[];
  /** Próxima tarefa de relacionamento agendada (módulo Pós-Venda) */
  proximaTarefa?: TarefaRegua | null;
};

const LANC_STATUS: Record<Lancamento["status"], string> = {
  pago: "Pago",
  pendente: "Pendente",
  atrasado: "Atrasado",
};

const PRIORIDADE_CLASS: Record<Ticket["prioridade"], string> = {
  baixa: "bg-slate-100 text-slate-700 border-slate-200",
  media: "bg-amber-50 text-amber-700 border-amber-200",
  alta: "bg-orange-50 text-orange-700 border-orange-200",
  critica: "bg-red-50 text-red-700 border-red-200",
};

export function ClientePerfil360({
  cliente,
  lancamentosDoCliente = [],
  ticketsDoCliente = [],
  proximaTarefa = null,
}: ClientePerfil360Props) {
  const [tab, setTab] = useState<TabId>("geral");

  if (!cliente) return null;

  const iniciais = cliente.nome
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const STATUS_BADGE: Record<Cliente["status"], string> = {
    ativo: "bg-emerald-100 text-emerald-700 border-emerald-200",
    inativo: "bg-slate-100 text-slate-600 border-slate-200",
    inadimplente: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <div className="flex flex-col h-full">
      {/* Cabeçalho do cliente */}
      <div className="flex flex-wrap items-start gap-4 p-4 lg:p-6 border-b border-slate-200 shrink-0">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#6D28D9]/10 text-xl font-semibold text-[#6D28D9]">
          {iniciais}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{cliente.nome}</h3>
          <p className="text-sm text-slate-500">{cliente.empresa}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span
              className={clsx(
                "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                STATUS_BADGE[cliente.status]
              )}
            >
              {STATUS_LABELS[cliente.status]}
            </span>
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {SEGMENTO_LABELS[cliente.segmento]}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 px-4 lg:px-6 shrink-0">
        <nav className="flex gap-1 -mb-px" aria-label="Abas do perfil">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={clsx(
                "px-3 py-3 text-sm font-medium border-b-2 transition-colors",
                tab === t.id
                  ? "border-[#6D28D9] text-[#6D28D9]"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Conteúdo das abas */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {tab === "geral" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Contato
              </p>
              <dl className="mt-2 space-y-2">
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                  <div>
                    <dt className="text-xs text-slate-500">CPF/CNPJ</dt>
                    <dd className="text-sm font-mono text-slate-900">{cliente.cpfCnpj}</dd>
                  </div>
                </div>
                {cliente.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                    <div>
                      <dt className="text-xs text-slate-500">E-mail</dt>
                      <dd>
                        <a
                          href={`mailto:${cliente.email}`}
                          className="text-sm text-[#6D28D9] hover:underline"
                        >
                          {cliente.email}
                        </a>
                      </dd>
                    </div>
                  </div>
                )}
                {cliente.telefone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                    <div>
                      <dt className="text-xs text-slate-500">Telefone</dt>
                      <dd>
                        <a
                          href={`tel:${cliente.telefone}`}
                          className="text-sm text-[#6D28D9] hover:underline"
                        >
                          {cliente.telefone}
                        </a>
                      </dd>
                    </div>
                  </div>
                )}
              </dl>
            </div>
            {cliente.endereco && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-center gap-2 text-slate-700">
                  <MapPin className="h-4 w-4 text-[#6D28D9]" />
                  <span className="text-sm font-medium">Endereço</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">
                  {cliente.endereco.logradouro}, {cliente.endereco.numero}
                  {cliente.endereco.complemento ? ` — ${cliente.endereco.complemento}` : ""}
                  <br />
                  {cliente.endereco.bairro} — {cliente.endereco.cidade}/{cliente.endereco.uf}
                  <br />
                  CEP {cliente.endereco.cep}
                </p>
              </div>
            )}
            {!cliente.email && !cliente.telefone && !cliente.endereco && (
              <p className="text-sm text-slate-500">Nenhum dado de contato ou endereço cadastrado.</p>
            )}
          </div>
        )}

        {tab === "comercial" && (
          <div className="space-y-4">
            {cliente.dataFechamento && (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <Calendar className="h-5 w-5 text-[#6D28D9]" />
                <div>
                  <p className="text-xs font-medium text-slate-500">Data de fechamento</p>
                  <p className="text-sm font-medium text-slate-900">
                    {new Date(cliente.dataFechamento).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            )}
            {cliente.propostas && cliente.propostas.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                  Histórico de propostas
                </p>
                <ul className="space-y-2">
                  {cliente.propostas.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"
                    >
                      <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">{p.titulo}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(p.dataProposta).toLocaleDateString("pt-BR")} —{" "}
                          {formatCurrency(p.valor)} · {p.status}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                {cliente.dataFechamento
                  ? "Nenhuma proposta registrada no histórico."
                  : "Sem dados comerciais (fechamento ou propostas)."}
              </p>
            )}
          </div>
        )}

        {tab === "financeiro" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex items-center gap-2 text-slate-700">
                <CreditCard className="h-5 w-5 text-[#6D28D9]" />
                <span className="text-sm font-medium">Resumo</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">Pagas</p>
                  <p className="text-lg font-semibold text-emerald-600">
                    {cliente.faturasPagas ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Pendentes</p>
                  <p className="text-lg font-semibold text-amber-600">
                    {cliente.faturasPendentes ?? 0}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Valor mensal (LTV):{" "}
                <span className="font-semibold text-[#6D28D9]">
                  {formatCurrency(cliente.valorMensal)}
                </span>
              </p>
            </div>
            {lancamentosDoCliente.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                  Parcelas e recorrências (módulo Financeiro)
                </p>
                <ul className="space-y-2">
                  {lancamentosDoCliente.map((l) => {
                    const rotuloParcela = parcelaRotuloCurto(l);
                    return (
                      <li
                        key={l.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {descricaoParaExibicao(l.descricao)}
                          </p>
                          <p className="text-xs text-slate-500">
                            Venc. {new Date(l.vencimento).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <span className="flex items-center gap-1.5 shrink-0">
                          {(l.tipoRecorrencia === "fixo_mensal" || l.tipoRecorrencia === "parcelado" || l.idPai) && (
                            <span title="Recorrente / Parcelado" className="inline-flex">
                              <Repeat className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                            </span>
                          )}
                          <span className="flex flex-col items-end gap-0.5 text-right">
                            <span className="text-sm font-semibold text-emerald-600">
                              {formatCurrency(l.valor)}
                            </span>
                            {rotuloParcela && (
                              <span className="text-[11px] font-medium tabular-nums text-slate-500">
                                {rotuloParcela}
                              </span>
                            )}
                          </span>
                          <span
                            className={clsx(
                              "text-xs font-medium",
                              l.status === "pago" && "text-emerald-600",
                              l.status === "pendente" && "text-amber-600",
                              l.status === "atrasado" && "text-red-600"
                            )}
                          >
                            {LANC_STATUS[l.status]}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Nenhum lançamento (parcela ou recorrência) no módulo Financeiro para este cliente.
              </p>
            )}
          </div>
        )}

        {tab === "suporte" && (
          <div className="space-y-4">
            {ticketsDoCliente.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                  Tickets abertos no Suporte
                </p>
                <ul className="space-y-2">
                  {ticketsDoCliente.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-start gap-3 rounded-lg border border-slate-200 p-3"
                    >
                      <Headphones className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs text-[#6D28D9]">{t.id}</p>
                        <p className="text-sm font-medium text-slate-900">{t.assunto}</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <span
                            className={clsx(
                              "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                              PRIORIDADE_CLASS[t.prioridade]
                            )}
                          >
                            {PRIORIDADE_LABELS[t.prioridade]}
                          </span>
                          <span className="text-xs text-slate-500">
                            {TICKET_STATUS_LABELS[t.status]} · Atualizado{" "}
                            {new Date(t.ultimaAtualizacao).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Nenhum ticket no Suporte para este cliente.</p>
            )}
          </div>
        )}

        {tab === "pos_venda" && (
          <div className="space-y-4">
            {proximaTarefa ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-center gap-2 text-slate-700">
                  <ClipboardList className="h-5 w-5 text-[#6D28D9]" />
                  <span className="text-sm font-medium">Próxima tarefa de relacionamento</span>
                </div>
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                  <p className="font-medium text-slate-900">
                    {TIPO_TAREFA_LABELS[proximaTarefa.tipo]}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Agendada para{" "}
                    {new Date(proximaTarefa.dataAgendada).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <span className="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Pendente
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Nenhuma tarefa de relacionamento agendada na régua de pós-venda para este cliente.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
