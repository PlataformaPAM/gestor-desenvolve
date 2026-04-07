"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Repeat,
  ChevronRight,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import type { Lancamento } from "@/lib/financeiro/types";
import { STATUS_LABELS } from "@/lib/financeiro/constants";
import {
  badgeUrgenciaVencimento,
  descricaoParaExibicao,
  linhaLancamentoComAlertaVisual,
  parcelaRotuloCurto,
} from "@/lib/financeiro/lancamento-utils";
import type { Cliente } from "@/lib/clientes/types";
import clsx from "clsx";

const STATUS_BADGE: Record<Lancamento["status"], string> = {
  pago: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700/50",
  pendente: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/45 dark:text-amber-300 dark:border-amber-700/50",
  atrasado: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/45 dark:text-red-300 dark:border-red-700/50",
};

type LancamentosTableProps = {
  lancamentos: Lancamento[];
  /** Map clienteId -> Cliente para link ao perfil 360 */
  clientesMap: Map<string, Cliente>;
  onVerCliente?: (cliente: Cliente) => void;
  onEditar?: (lancamento: Lancamento) => void;
  /** Baixa / recebimento rápido (alterna pago ↔ pendente) */
  onAlternarBaixa?: (lancamento: Lancamento) => void;
  onExcluir?: (lancamento: Lancamento) => void;
  disabledActionIds?: Record<string, boolean>;
  /** Quando true, mostra coluna Tipo (Entrada/Saída) - aba Fluxo de Caixa */
  showTipo?: boolean;
  pendingByLancamentoId?: Record<string, number>;
};

function VencimentoComSelo({ vencimento, lanc }: { vencimento: string; lanc: Lancamento }) {
  const badge = badgeUrgenciaVencimento(lanc);
  return (
    <div className="flex flex-col items-start gap-1.5">
      <span className="whitespace-nowrap text-sm font-mono text-slate-600 dark:text-slate-300">
        {new Date(vencimento).toLocaleDateString("pt-BR")}
      </span>
      {badge && (
        <span
          className={clsx(
            "inline-flex w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            badge.variant === "atraso"
              ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200"
              : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/45 dark:text-amber-200"
          )}
        >
          {badge.texto}
        </span>
      )}
    </div>
  );
}

function getContraparte(lanc: Lancamento, clientesMap: Map<string, Cliente>): { tipo: "cliente" | "fornecedor"; nome: string; cliente?: Cliente } | null {
  if (lanc.tipo === "entrada" && lanc.clienteId) {
    const c = clientesMap.get(lanc.clienteId);
    return c ? { tipo: "cliente", nome: c.nome, cliente: c } : { tipo: "cliente", nome: "—" };
  }
  if (lanc.tipo === "saida" && lanc.fornecedor) {
    return { tipo: "fornecedor", nome: lanc.fornecedor };
  }
  return { tipo: "fornecedor", nome: "—" };
}

/** Linha 1: ícone de recorrência (se houver) + sinal e R$ · Linha 2: valor · Linha 3: parcela (só parcelado). */
function LancamentoValorCol({ lanc }: { lanc: Lancamento }) {
  const showRepeat =
    lanc.tipoRecorrencia === "fixo_mensal" || lanc.tipoRecorrencia === "parcelado" || Boolean(lanc.idPai);
  const colorClass = lanc.tipo === "entrada" ? "text-emerald-600" : "text-red-600";
  const amountPart = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(lanc.valor);
  const parcelaTxt = parcelaRotuloCurto(lanc);

  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      <div className={clsx("inline-flex items-center justify-end gap-1.5", colorClass)}>
        {showRepeat && <Repeat className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />}
        <span className="whitespace-nowrap text-sm font-semibold tabular-nums">
          {lanc.tipo === "entrada" ? "+" : "−"} R$
        </span>
      </div>
      <span className={clsx("whitespace-nowrap text-sm font-semibold tabular-nums", colorClass)}>{amountPart}</span>
      {parcelaTxt && (
        <span className="whitespace-nowrap text-[11px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
          {parcelaTxt}
        </span>
      )}
    </div>
  );
}

export function LancamentosTable({
  lancamentos,
  clientesMap,
  onVerCliente,
  onEditar,
  onAlternarBaixa,
  onExcluir,
  disabledActionIds = {},
  showTipo = false,
  pendingByLancamentoId = {},
}: LancamentosTableProps) {
  return (
    <>
      {/* Desktop: tabela */}
      <div className="hidden md:block rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80">
                {showTipo && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                    Tipo
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                  Descrição
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                  {showTipo ? "Cliente / Fornecedor" : lancamentos[0]?.tipo === "entrada" ? "Cliente" : "Fornecedor"}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                  Vencimento
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400 min-w-[9rem] w-[1%]">
                  Valor
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                  Status
                </th>
                {onAlternarBaixa && (
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400 w-[100px]">
                    Baixa
                  </th>
                )}
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {lancamentos.map((lanc) => {
                const cp = getContraparte(lanc, clientesMap);
                const mostrarAlerta = linhaLancamentoComAlertaVisual(lanc, pendingByLancamentoId);
                return (
                  <tr
                    key={lanc.id}
                    onClick={() => onEditar?.(lanc)}
                    className={clsx("relative transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/60", onEditar && "cursor-pointer")}
                  >
                    {showTipo && (
                      <td className="px-4 py-3">
                        <span className={clsx(
                          "text-sm font-medium",
                          lanc.tipo === "entrada" ? "text-emerald-600" : "text-red-600"
                        )}>
                          {lanc.tipo === "entrada" ? "Entrada" : "Saída"}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      <p>{descricaoParaExibicao(lanc.descricao)}</p>
                    </td>
                    <td className="px-4 py-3">
                      {cp?.tipo === "cliente" && cp.cliente && onVerCliente ? (
                        <button
                          type="button"
                          onClick={() => onVerCliente(cp.cliente!)}
                          className="inline-flex items-center gap-1 text-sm font-medium text-[#6D28D9] hover:underline"
                        >
                          {cp.nome}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <span className="text-sm text-slate-600 dark:text-slate-300">{cp?.nome ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <VencimentoComSelo vencimento={lanc.vencimento} lanc={lanc} />
                    </td>
                    <td className="px-4 py-3 text-right align-top min-w-[9rem] w-[1%]">
                      <LancamentoValorCol lanc={lanc} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        STATUS_BADGE[lanc.status]
                      )}>
                        {STATUS_LABELS[lanc.status]}
                      </span>
                    </td>
                    {onAlternarBaixa && (
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAlternarBaixa(lanc);
                          }}
                          disabled={Boolean(disabledActionIds[lanc.id])}
                          title={
                            lanc.status === "pago"
                              ? "Marcar como pendente (desfazer baixa)"
                              : "Dar baixa / registrar recebimento (marcar como pago)"
                          }
                          className={clsx(
                            "inline-flex items-center justify-center rounded-xl border-2 p-2 transition-colors",
                            disabledActionIds[lanc.id] && "cursor-not-allowed opacity-60",
                            lanc.status === "pago"
                              ? "border-emerald-400 bg-emerald-100 text-emerald-700 shadow-sm hover:bg-emerald-200 dark:border-emerald-500/50 dark:bg-emerald-950/60 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
                              : lanc.status === "atrasado"
                                ? "border-red-300 bg-red-50 text-red-800 hover:border-red-400 hover:bg-red-100 dark:border-red-600 dark:bg-red-950/50 dark:text-red-200 dark:hover:bg-red-900/40"
                                : "border-amber-300 bg-amber-50 text-amber-800 hover:border-amber-500 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-900/40"
                          )}
                        >
                          {lanc.status === "pago" ? (
                            <ThumbsUp className="h-5 w-5" strokeWidth={2.5} />
                          ) : (
                            <ThumbsDown className="h-5 w-5" strokeWidth={2.5} />
                          )}
                        </button>
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <div className="ml-auto flex items-center justify-end gap-1">
                        {mostrarAlerta && (
                          <span
                            className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500"
                            aria-label="Alerta na central ou vencimento"
                            title="Alerta na central ou vencimento"
                          />
                        )}
                        {onExcluir && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onExcluir(lanc);
                            }}
                            disabled={Boolean(disabledActionIds[lanc.id])}
                            className="inline-flex rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                            title="Excluir lançamento"
                            aria-label="Excluir lançamento"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {lancamentos.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhum lançamento no período.
          </div>
        )}
      </div>

      {/* Mobile: cards expansíveis */}
      <div className="md:hidden space-y-3">
        {lancamentos.map((lanc) => (
          <LancamentoCard
            key={lanc.id}
            lancamento={lanc}
            clientesMap={clientesMap}
            onVerCliente={onVerCliente}
            onEditar={onEditar}
            onAlternarBaixa={onAlternarBaixa}
            onExcluir={onExcluir}
            disabledActionIds={disabledActionIds}
            showTipo={showTipo}
            mostrarAlertaLinha={linhaLancamentoComAlertaVisual(lanc, pendingByLancamentoId)}
          />
        ))}
        {lancamentos.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            Nenhum lançamento no período.
          </div>
        )}
      </div>
    </>
  );
}

function LancamentoCard({
  lancamento,
  clientesMap,
  onVerCliente,
  onEditar,
  onAlternarBaixa,
  onExcluir,
  disabledActionIds,
  showTipo,
  mostrarAlertaLinha,
}: {
  lancamento: Lancamento;
  clientesMap: Map<string, Cliente>;
  onVerCliente?: (c: Cliente) => void;
  onEditar?: (l: Lancamento) => void;
  onAlternarBaixa?: (l: Lancamento) => void;
  onExcluir?: (l: Lancamento) => void;
  disabledActionIds: Record<string, boolean>;
  showTipo: boolean;
  mostrarAlertaLinha: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const cp = getContraparte(lancamento, clientesMap);
  const seloVenc = badgeUrgenciaVencimento(lancamento);

  return (
    <div className="relative rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
      <div
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
            {descricaoParaExibicao(lancamento.descricao)}
          </p>
          {mostrarAlertaLinha && (
            <span
              className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500"
              aria-label="Alerta na central ou vencimento"
              title="Alerta na central ou vencimento"
            />
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <div className="flex flex-col items-start gap-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(lancamento.vencimento).toLocaleDateString("pt-BR")}
              </p>
              {seloVenc && (
                <span
                  className={clsx(
                    "inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                    seloVenc.variant === "atraso"
                      ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200"
                      : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/45 dark:text-amber-200"
                  )}
                >
                  {seloVenc.texto}
                </span>
              )}
            </div>
            <span className={clsx(
              "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
              STATUS_BADGE[lancamento.status]
            )}>
              {STATUS_LABELS[lancamento.status]}
            </span>
            {showTipo && (
              <span className={clsx(
                "text-xs font-medium",
                lancamento.tipo === "entrada" ? "text-emerald-600" : "text-red-600"
              )}>
                {lancamento.tipo === "entrada" ? "Entrada" : "Saída"}
              </span>
            )}
          </div>
          <div className="mt-1 flex justify-end">
            <LancamentoValorCol lanc={lancamento} />
          </div>
        </div>
        <div className="flex items-start gap-2 shrink-0">
          {onAlternarBaixa && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAlternarBaixa(lancamento);
              }}
              disabled={Boolean(disabledActionIds[lancamento.id])}
              className={clsx(
                "rounded-xl border-2 p-2",
                disabledActionIds[lancamento.id] && "cursor-not-allowed opacity-60",
                lancamento.status === "pago"
                  ? "border-emerald-400 bg-emerald-100 text-emerald-700"
                  : lancamento.status === "atrasado"
                    ? "border-red-300 bg-red-50 text-red-800"
                    : "border-amber-300 bg-amber-50 text-amber-800"
              )}
              aria-label={lancamento.status === "pago" ? "Desfazer baixa" : "Dar baixa"}
            >
              {lancamento.status === "pago" ? (
                <ThumbsUp className="h-4 w-4" strokeWidth={2.5} />
              ) : (
                <ThumbsDown className="h-4 w-4" strokeWidth={2.5} />
              )}
            </button>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </div>
      <div className="px-4 pb-2">
        <div className="flex items-center justify-end gap-1">
          <ChevronRight
            className="h-4 w-4 text-slate-400"
            onClick={(e) => {
              e.stopPropagation();
              onEditar?.(lancamento);
            }}
          />
          {onExcluir && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onExcluir(lancamento);
              }}
              disabled={Boolean(disabledActionIds[lancamento.id])}
              className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400"
              aria-label="Excluir"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-2 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50">
          {showTipo && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tipo: <span className={lancamento.tipo === "entrada" ? "text-emerald-600" : "text-red-600"}>{lancamento.tipo === "entrada" ? "Entrada" : "Saída"}</span>
            </p>
          )}
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Cliente/Fornecedor:{" "}
            {cp?.tipo === "cliente" && cp.cliente && onVerCliente ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onVerCliente(cp.cliente!); }}
                className="font-medium text-[#6D28D9] hover:underline inline-flex items-center gap-1"
              >
                {cp.nome}
                <ExternalLink className="h-3 w-3" />
              </button>
            ) : (
              <span>{cp?.nome ?? "—"}</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
