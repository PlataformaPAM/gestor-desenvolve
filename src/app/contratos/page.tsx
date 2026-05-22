"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  Building2,
  ChevronRight,
  FileText,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Text,
  Wallet,
  X,
} from "lucide-react";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import { ContratoDetalheView } from "@/app/contratos/[id]/page";
import { DateField } from "@/components/ui/date-field";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { usePageHeader } from "@/contexts/page-header-context";
import {
  CONTRATOS_RESOURCE,
  useContratosRbac,
  useResourcePageGuard,
} from "@/hooks/use-rbac-resource";
import {
  formInputClass,
  formLabelClass,
  formModalCancelButtonClass,
  formModalSubmitButtonClass,
  formTextareaClass,
} from "@/components/ui/field-patterns";
import { CONTRATO_STATUS_LABEL } from "@/lib/contratos/constants";
import {
  badgeUrgenciaContrato,
  contratoLinhaComAlertaVisual,
} from "@/lib/contratos/vencimento-utils";
import { formatCurrency } from "@/lib/comercial/utils";
import { formatDateDMY } from "@/lib/format/dates";

type ContratoRow = {
  id: string;
  codigo: string;
  codigoSistema?: string;
  codigoPersonalizado?: string | null;
  leadId: string | null;
  clienteId: string;
  origem: string;
  geraPosVenda: boolean;
  clienteNome: string;
  leadNome: string | null;
  titulo: string | null;
  status: string;
  valorTotal: number;
  dataInicio: string | null;
  dataFim: string | null;
  itensCount: number;
  createdAt: string;
  updatedAt: string;
  registroCriadoPorNome: string | null;
};

function tituloContratoExibicao(c: ContratoRow): string {
  const t = c.titulo?.trim();
  if (t) return t;
  return "—";
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function digitsOnly(v: string): string {
  return v.replace(/\D/g, "");
}

function formatCurrencyInput(v: string): string {
  const cents = Number.parseInt(digitsOnly(v) || "0", 10);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function parseCurrencyInput(v: string): number {
  const cents = Number.parseInt(digitsOnly(v) || "0", 10);
  return cents / 100;
}

function statusBadgeClass(status: string): string {
  if (status === "ativo")
    return "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300";
  if (status === "pendente_financeiro")
    return "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200";
  return "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

type ClienteOpt = { id: string; nome: string; empresa: string };

export default function ContratosPage() {
  const { setPrimaryAction, setSecondaryAction } = usePageHeader();
  const podeVer = useResourcePageGuard(CONTRATOS_RESOURCE);
  const { podeCriar } = useContratosRbac();
  const [contratos, setContratos] = useState<ContratoRow[]>([]);
  const [clientesOpts, setClientesOpts] = useState<ClienteOpt[]>([]);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>("");
  const [pendentesBackfill, setPendentesBackfill] = useState<number | null>(null);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [contratoSelecionadoId, setContratoSelecionadoId] = useState<string | null>(null);
  const [contratoSelecionadoTitulo, setContratoSelecionadoTitulo] = useState<string>("");
  const [novoClienteId, setNovoClienteId] = useState("");
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoValor, setNovoValor] = useState("");
  const [novoInicio, setNovoInicio] = useState("");
  const [novoFim, setNovoFim] = useState("");
  const [novoPosVenda, setNovoPosVenda] = useState(true);
  const [novoObs, setNovoObs] = useState("");
  const [novoCondicoes, setNovoCondicoes] = useState("");
  const [novoSaving, setNovoSaving] = useState(false);
  const [novoErr, setNovoErr] = useState<string | null>(null);

  const recarregarLista = useCallback(async () => {
    const res = await fetch("/api/contratos/bootstrap", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as { data?: { contratos?: ContratoRow[] } };
    setContratos(json?.data?.contratos ?? []);
  }, []);

  const recarregarPendentes = useCallback(async () => {
    const res = await fetch("/api/contratos/backfill", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as { data?: { pendentes?: number } };
    setPendentesBackfill(json?.data?.pendentes ?? 0);
  }, []);

  const rodarBackfill = useCallback(async () => {
    if (!podeCriar) return;
    setBackfillLoading(true);
    setBackfillMsg(null);
    try {
      const res = await fetch("/api/contratos/backfill", { method: "POST" });
      const json = (await res.json()) as { data?: { criados?: number } };
      if (!res.ok) {
        setBackfillMsg("Não foi possível gerar os contratos.");
        return;
      }
      const n = json?.data?.criados ?? 0;
      setBackfillMsg(
        n === 0
          ? "Nenhum lead fechado sem contrato — nada a fazer."
          : `${n} contrato(s) criado(s) com sucesso.`
      );
      await recarregarLista();
      await recarregarPendentes();
    } catch {
      setBackfillMsg("Erro ao executar backfill.");
    } finally {
      setBackfillLoading(false);
    }
  }, [recarregarLista, recarregarPendentes, podeCriar]);

  useEffect(() => {
    if (!podeCriar) {
      setPrimaryAction(null);
      setSecondaryAction(null);
      return;
    }
    setPrimaryAction({
      label: "Novo contrato",
      onClick: () => setNovoOpen(true),
      showPlusIcon: true,
    });
    setSecondaryAction(null);
    return () => {
      setPrimaryAction(null);
      setSecondaryAction(null);
    };
  }, [setPrimaryAction, setSecondaryAction, podeCriar]);

  useEffect(() => {
    if (!novoOpen) return;
    let a = true;
    void (async () => {
      try {
        const res = await fetch("/api/clientes/bootstrap", { cache: "no-store" });
        if (!res.ok || !a) return;
        const json = (await res.json()) as { data?: { clientes?: ClienteOpt[] } };
        const list = json?.data?.clientes ?? [];
        if (!a) return;
        setClientesOpts(
          list.map((c) => ({ id: c.id, nome: c.nome, empresa: c.empresa }))
        );
      } catch {
        /* noop */
      }
    })();
    return () => {
      a = false;
    };
  }, [novoOpen]);

  useEffect(() => {
    void (async () => {
      try {
        await recarregarLista();
        if (podeCriar) await recarregarPendentes();
        else setPendentesBackfill(null);
      } catch {
        // noop
      }
    })();
  }, [recarregarLista, recarregarPendentes, podeCriar]);

  const filtrados = useMemo(() => {
    const t = normalize(busca);
    return contratos.filter((c) => {
      if (statusFiltro && c.status !== statusFiltro) return false;
      if (!t) return true;
      const blob = normalize(
        [c.clienteNome, c.leadNome ?? "", c.titulo ?? "", c.status, c.leadId ?? "", c.id, c.origem].join(" ")
      );
      return blob.includes(t);
    });
  }, [contratos, busca, statusFiltro]);

  const statusOptions = useMemo(() => {
    const u = new Set(contratos.map((c) => c.status));
    return [...u].sort();
  }, [contratos]);

  const isEmpty = filtrados.length === 0;
  const clientesSelectOptions: SearchableOption[] = useMemo(
    () => [
      { value: "", label: "Selecione…", icon: Building2 },
      ...clientesOpts.map((c) => ({
        value: c.id,
        label: c.empresa || c.nome,
        subtitle: c.nome && c.empresa !== c.nome ? c.nome : undefined,
        icon: Building2,
      })),
    ],
    [clientesOpts]
  );

  if (!podeVer) return null;

  return (
    <section className="w-full min-w-0 space-y-6">
      {podeCriar && pendentesBackfill !== null && pendentesBackfill > 0 && (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-[#6D28D9] dark:bg-violet-950/60 dark:text-violet-300">
                <FileText className="h-4 w-4" strokeWidth={2} aria-hidden />
              </span>
              <span>Leads em Fechado sem contrato</span>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Contratos são criados ao mover o lead para <strong className="font-medium text-slate-800 dark:text-slate-200">Fechado</strong>
              ; ficam pendentes até o Financeiro aceitar e lançar no caixa. Use abaixo para alinhar vendas antigas.
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {pendentesBackfill === null
                ? "Carregando…"
                : pendentesBackfill === 0
                  ? "Nenhum pendente — base alinhada."
                  : `${pendentesBackfill} lead(s) podem ser convertidos em contrato.`}
            </p>
            {backfillMsg && (
              <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-200">{backfillMsg}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void rodarBackfill()}
            disabled={backfillLoading || pendentesBackfill === 0}
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#5B21B6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-slate-900 sm:w-auto"
          >
            <RefreshCw className={`h-4 w-4 ${backfillLoading ? "animate-spin" : ""}`} />
            {backfillLoading ? "Gerando…" : "Gerar contratos faltantes"}
          </button>
        </div>
      </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-nowrap sm:items-end sm:gap-3">
        <div className="relative w-full min-w-0 sm:max-w-[min(44ch,100%)] sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, contrato ou status…"
            className="w-full min-w-0 rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            aria-label="Buscar contratos"
          />
        </div>
        <div className="flex w-full shrink-0 flex-col gap-1.5 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
          <label htmlFor="contratos-filter-status" className="whitespace-nowrap text-sm font-medium text-slate-700 dark:text-slate-300">
            Status
          </label>
          <select
            id="contratos-filter-status"
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value)}
            className="min-w-[10.5rem] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">Todos</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {CONTRATO_STATUS_LABEL[s] ?? s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="hidden md:block">
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
          {!isEmpty && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/60">
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Cliente
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Contrato
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Prazos
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Valor
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filtrados.map((c) => {
                    const badge = badgeUrgenciaContrato(c.dataFim, c.status);
                    const alertaLinha = contratoLinhaComAlertaVisual(c.dataFim, c.status);
                    return (
                    <tr
                      key={c.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => {
                        setContratoSelecionadoId(c.id);
                        setContratoSelecionadoTitulo(tituloContratoExibicao(c));
                        setDetalheOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setContratoSelecionadoId(c.id);
                          setContratoSelecionadoTitulo(tituloContratoExibicao(c));
                          setDetalheOpen(true);
                        }
                      }}
                      className="relative cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{c.clienteNome}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Responsável: {c.registroCriadoPorNome?.trim() || "—"}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {tituloContratoExibicao(c)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {c.codigoSistema ?? c.codigo}
                        </p>
                        {c.codigoPersonalizado?.trim() ? (
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Contrato: {c.codigoPersonalizado.trim()}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Início: <span className="font-mono text-slate-800 dark:text-slate-200">{c.dataInicio ? formatDateDMY(c.dataInicio) : "—"}</span>
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Vencimento: <span className="font-mono text-slate-800 dark:text-slate-200">{c.dataFim ? formatDateDMY(c.dataFim) : "—"}</span>
                        </p>
                        <div className="mt-1.5 flex flex-col items-start gap-1">
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
                      </td>
                      <td className="px-6 py-4 text-sm tabular-nums text-slate-800 dark:text-slate-200">
                        {formatCurrency(c.valorTotal)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={statusBadgeClass(c.status)}>
                          {CONTRATO_STATUS_LABEL[c.status] ?? c.status}
                        </span>
                      </td>
                      <td className="relative px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        {alertaLinha && (
                          <span
                            className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500"
                            aria-hidden
                          />
                        )}
                        <span className="ml-auto inline-flex items-center gap-1 text-slate-400" aria-hidden>
                          <Pencil className="h-4 w-4" />
                          <ChevronRight className="h-4 w-4" />
                        </span>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {isEmpty && (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-purple-100/80 text-[#6D28D9] dark:bg-violet-950/50 dark:text-violet-300">
                <FileText className="h-10 w-10" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Nenhum contrato encontrado</h3>
              <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                Feche uma venda no Comercial ou use &quot;Gerar contratos faltantes&quot; para alinhar leads antigos em Fechado.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-3 md:hidden">
        {!isEmpty &&
          filtrados.map((c) => {
            const badge = badgeUrgenciaContrato(c.dataFim, c.status);
            const alertaLinha = contratoLinhaComAlertaVisual(c.dataFim, c.status);
            return (
            <div
              key={c.id}
              role="link"
              tabIndex={0}
              onClick={() => {
                setContratoSelecionadoId(c.id);
                setContratoSelecionadoTitulo(tituloContratoExibicao(c));
                setDetalheOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setContratoSelecionadoId(c.id);
                  setContratoSelecionadoTitulo(tituloContratoExibicao(c));
                  setDetalheOpen(true);
                }
              }}
              className="relative flex cursor-pointer flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-all hover:bg-slate-50/50 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/50"
            >
              {alertaLinha && (
                <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden />
              )}
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-[#6D28D9] dark:bg-violet-950/60 dark:text-violet-300">
                  <FileText className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1 pr-6">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{c.clienteNome}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Responsável: {c.registroCriadoPorNome?.trim() || "—"}
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {tituloContratoExibicao(c)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {c.codigoSistema ?? c.codigo}
                  </p>
                  {c.codigoPersonalizado?.trim() ? (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Contrato: {c.codigoPersonalizado.trim()}
                    </p>
                  ) : null}
                  <div className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-700">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Início: <span className="font-mono text-slate-800 dark:text-slate-200">{c.dataInicio ? formatDateDMY(c.dataInicio) : "—"}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Vencimento: <span className="font-mono text-slate-800 dark:text-slate-200">{c.dataFim ? formatDateDMY(c.dataFim) : "—"}</span>
                    </p>
                    {badge && (
                      <span
                        className={clsx(
                          "mt-1 inline-flex w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          badge.variant === "atraso"
                            ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200"
                            : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/45 dark:text-amber-200"
                        )}
                      >
                        {badge.texto}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Valor global</span>
                    <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                      {formatCurrency(c.valorTotal)}
                    </span>
                  </div>
                  <div className="mt-2">
                    <span className={statusBadgeClass(c.status)}>
                      {CONTRATO_STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-1 border-t border-slate-100 pt-2 dark:border-slate-700">
                <Pencil className="h-4 w-4 text-slate-400" aria-hidden />
                <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
              </div>
            </div>
          );
          })}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-100/80 text-[#6D28D9] dark:bg-violet-950/50 dark:text-violet-300">
              <FileText className="h-8 w-8" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Nenhum contrato encontrado</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Use o Comercial ou o backfill no topo da página.
            </p>
          </div>
        )}
      </div>

      <DrawerSheet
        open={novoOpen}
        onClose={() => {
          setNovoOpen(false);
          setNovoErr(null);
        }}
        title="Novo contrato"
        mobileContentPaddingClassName="px-0"
        desktopContentPaddingClassName="px-0"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Contratos sem lead geram alertas para o Financeiro e, se marcado, para o Pós-venda.
              </p>
              {novoErr && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                  {novoErr}
                </p>
              )}
              <div>
                <label className={formLabelClass} htmlFor="novo-contrato-cliente">
                  Cliente
                </label>
                <div className="mt-1">
                  <SearchableSelect
                    options={clientesSelectOptions}
                    value={novoClienteId}
                    onChange={setNovoClienteId}
                    placeholder="Selecione…"
                    searchPlaceholder="Buscar cliente…"
                    leadingIcon={Building2}
                  />
                </div>
              </div>
              <div>
                <label className={formLabelClass} htmlFor="novo-contrato-titulo">
                  Título (opcional)
                </label>
                <div className="mt-1">
                  <input
                    id="novo-contrato-titulo"
                    value={novoTitulo}
                    onChange={(e) => setNovoTitulo(e.target.value)}
                    className={formInputClass}
                    placeholder="Ex.: Prestação de serviços 2026"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={formLabelClass} htmlFor="novo-contrato-valor">
                    Valor total
                  </label>
                  <div className="relative mt-1">
                    <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="novo-contrato-valor"
                      inputMode="numeric"
                      value={novoValor}
                      onChange={(e) => setNovoValor(formatCurrencyInput(e.target.value))}
                      className={`${formInputClass} pl-9`}
                      placeholder="R$ 0,00"
                    />
                  </div>
                </div>
                <div>
                  <span className={formLabelClass}>Pós-venda</span>
                  <div className="mt-1">
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={novoPosVenda}
                        onChange={(e) => setNovoPosVenda(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9]"
                      />
                      Gerar alerta e fluxo de Pós-venda
                    </label>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={formLabelClass} htmlFor="novo-inicio">
                    Início
                  </label>
                  <div className="mt-1">
                    <DateField id="novo-inicio" value={novoInicio} onChange={setNovoInicio} placeholder="Selecione a data" />
                  </div>
                </div>
                <div>
                  <label className={formLabelClass} htmlFor="novo-fim">
                    Fim
                  </label>
                  <div className="mt-1">
                    <DateField id="novo-fim" value={novoFim} onChange={setNovoFim} placeholder="Selecione a data" />
                  </div>
                </div>
              </div>
              <div>
                <label className={formLabelClass} htmlFor="novo-cond">
                  Condições gerais
                </label>
                <div className="relative mt-1">
                  <FileText className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <textarea
                    id="novo-cond"
                    value={novoCondicoes}
                    onChange={(e) => setNovoCondicoes(e.target.value)}
                    rows={3}
                    placeholder="Termos gerais, SLA, forma de pagamento…"
                    className={`${formTextareaClass} pl-9`}
                  />
                </div>
              </div>
              <div>
                <label className={formLabelClass} htmlFor="novo-obs">
                  Observações
                </label>
                <div className="relative mt-1">
                  <Text className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <textarea
                    id="novo-obs"
                    value={novoObs}
                    onChange={(e) => setNovoObs(e.target.value)}
                    rows={3}
                    placeholder="Observações internas ou observações para o cliente…"
                    className={`${formTextareaClass} pl-9`}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:justify-end sm:gap-3 lg:px-6">
            <button
              type="button"
              onClick={() => {
                setNovoOpen(false);
                setNovoErr(null);
              }}
              className={formModalCancelButtonClass}
            >
              <span className="inline-flex items-center gap-2">
                <X className="h-4 w-4 shrink-0" aria-hidden />
                Cancelar
              </span>
            </button>
            <button
              type="button"
              disabled={novoSaving}
              onClick={() => void (async () => {
                if (!podeCriar) return;
                setNovoErr(null);
                if (!novoClienteId.trim()) {
                  setNovoErr("Selecione o cliente.");
                  return;
                }
                const valorTotal = parseCurrencyInput(novoValor);
                if (Number.isNaN(valorTotal)) {
                  setNovoErr("Valor inválido.");
                  return;
                }
                setNovoSaving(true);
                try {
                  const res = await fetch("/api/contratos", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      clienteId: novoClienteId.trim(),
                      titulo: novoTitulo.trim() || undefined,
                      valorTotal,
                      dataInicio: novoInicio || undefined,
                      dataFim: novoFim || undefined,
                      geraPosVenda: novoPosVenda,
                      observacoes: novoObs.trim() || undefined,
                      condicoesGerais: novoCondicoes.trim() || undefined,
                      status: "ativo",
                    }),
                  });
                  const json = (await res.json()) as { data?: { id?: string } };
                  if (!res.ok) {
                    setNovoErr("Não foi possível criar o contrato.");
                    return;
                  }
                  setNovoOpen(false);
                  setNovoClienteId("");
                  setNovoTitulo("");
                  setNovoValor("");
                  setNovoInicio("");
                  setNovoFim("");
                  setNovoPosVenda(true);
                  setNovoObs("");
                  setNovoCondicoes("");
                  await recarregarLista();
                  const nid = json?.data?.id;
                  if (nid) {
                    setContratoSelecionadoId(nid);
                    setContratoSelecionadoTitulo(novoTitulo.trim() || "Contrato");
                    setDetalheOpen(true);
                  }
                } catch {
                  setNovoErr("Erro de rede.");
                } finally {
                  setNovoSaving(false);
                }
              })()}
              className={formModalSubmitButtonClass}
            >
              <span className="inline-flex items-center gap-2">
                <Save className={clsx("h-4 w-4 shrink-0", novoSaving && "animate-pulse")} aria-hidden />
                {novoSaving ? "Salvando…" : "Salvar"}
              </span>
            </button>
          </div>
        </div>
      </DrawerSheet>

      <DrawerSheet
        open={detalheOpen}
        onClose={() => {
          setDetalheOpen(false);
          setContratoSelecionadoId(null);
          setContratoSelecionadoTitulo("");
          void recarregarLista();
        }}
        title={contratoSelecionadoTitulo || "Contrato"}
        maxWidth="sm:max-w-3xl"
        mobileContentPaddingClassName="px-0"
        desktopContentPaddingClassName="px-0"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {contratoSelecionadoId ? (
            <ContratoDetalheView id={contratoSelecionadoId} embedded />
          ) : null}
        </div>
      </DrawerSheet>
    </section>
  );
}
