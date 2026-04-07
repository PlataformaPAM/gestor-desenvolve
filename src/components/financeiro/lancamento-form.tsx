"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { motion } from "framer-motion";
import type {
  FinanceiroCategoria,
  FinanceiroConta,
  FinanceiroMeioPagamento,
  FornecedorRhSlim,
  Lancamento,
  LancamentoTipo,
  TipoRecorrencia,
} from "@/lib/financeiro/types";
import type { Cliente } from "@/lib/clientes/types";
import { buildLancamentosFromForm } from "@/components/financeiro/novo-lancamento-form";
import { SearchableSelect, type SearchableSelectOption } from "@/components/financeiro/searchable-select";
import { textoPrazoVencimento } from "@/lib/financeiro/vencimento-utils";

function resolveMeioId(initial: Lancamento, meios: FinanceiroMeioPagamento[]): string {
  if (initial.meioPagamentoId) return initial.meioPagamentoId;
  const m = meios.find((x) => x.nome === initial.formaPagamento);
  return m?.id ?? "";
}

export type LancamentoFormMode = "create" | "edit";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";

const LEGACY_FORN_PREFIX = "legacy|||";

function generateId(prefix: string, i: number): string {
  return `nl-${Date.now()}-${prefix}-${i}`;
}

function encodeLegacyFornecedor(nome: string): string {
  return `${LEGACY_FORN_PREFIX}${encodeURIComponent(nome)}`;
}

function decodeLegacyFornecedor(key: string): string {
  if (!key.startsWith(LEGACY_FORN_PREFIX)) return "";
  try {
    return decodeURIComponent(key.slice(LEGACY_FORN_PREFIX.length));
  } catch {
    return "";
  }
}

function fornecedorInicialKey(fornecedorNome: string | undefined, rh: FornecedorRhSlim[]): string {
  const n = fornecedorNome?.trim();
  if (!n) return "";
  const lower = n.toLowerCase();
  const m = rh.find((r) => r.nome.trim().toLowerCase() === lower);
  if (m) return m.id;
  return encodeLegacyFornecedor(n);
}

function resolveFornecedorNome(key: string, rh: FornecedorRhSlim[]): string {
  if (!key) return "";
  if (key.startsWith(LEGACY_FORN_PREFIX)) return decodeLegacyFornecedor(key);
  return rh.find((r) => r.id === key)?.nome ?? "";
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function formatCurrencyFromCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export const DEFAULT_NEW_LANCAMENTO: Lancamento = {
  id: "novo",
  tipo: "entrada",
  descricao: "",
  vencimento: new Date().toISOString().slice(0, 10),
  valor: 0,
  status: "pendente",
};

type LancamentoFormProps = {
  mode: LancamentoFormMode;
  initial: Lancamento;
  clientes: Cliente[];
  fornecedoresRh: FornecedorRhSlim[];
  contas: FinanceiroConta[];
  categorias: FinanceiroCategoria[];
  meiosPagamento: FinanceiroMeioPagamento[];
  defaultContaId?: string;
  /** Ao aprovar lead com várias soluções: permite trocar a linha da proposta antes de salvar. */
  solucoesAprovacao?: Array<{ leadSolucaoId: string; nome: string }>;
  linhaAprovacaoSelecionada?: string;
  onLinhaAprovacaoChange?: (leadSolucaoId: string) => void;
  onSave: (l: Lancamento[]) => void;
  onCancel: () => void;
  /** ID do contrato ligado ao lead de origem (para link), quando existir. */
  origemContratoId?: string | null;
};

export function LancamentoForm({
  mode,
  initial,
  clientes,
  fornecedoresRh,
  contas,
  categorias,
  meiosPagamento,
  defaultContaId,
  solucoesAprovacao,
  linhaAprovacaoSelecionada,
  onLinhaAprovacaoChange,
  onSave,
  onCancel,
  origemContratoId,
}: LancamentoFormProps) {
  const isCreate = mode === "create";
  const formTabId = useId();
  const [formTab, setFormTab] = useState<"principal" | "pagamento">("principal");

  const [tipo, setTipo] = useState<Lancamento["tipo"]>(initial.tipo);
  const [descricao, setDescricao] = useState(initial.descricao);
  const [vencimento, setVencimento] = useState(initial.vencimento);
  const [valorDigits, setValorDigits] = useState(() => String(Math.round(Math.max(initial.valor, 0) * 100)));
  const [status, setStatus] = useState<Lancamento["status"]>(initial.status);
  const [dataPagamento, setDataPagamento] = useState(
    initial.dataPagamento ? initial.dataPagamento.slice(0, 10) : ""
  );
  const [clienteId, setClienteId] = useState(initial.clienteId ?? "");
  const [fornecedorKey, setFornecedorKey] = useState(() =>
    fornecedorInicialKey(initial.fornecedor, fornecedoresRh)
  );
  const [contaId, setContaId] = useState(initial.contaId ?? defaultContaId ?? "");
  const [categoriaId, setCategoriaId] = useState(initial.categoriaId ?? "");
  const [meioPagamentoId, setMeioPagamentoId] = useState(() =>
    resolveMeioId(initial, meiosPagamento)
  );
  const [condicoesPagamento, setCondicoesPagamento] = useState(initial.condicoesPagamento ?? "");
  const [tipoRecorrencia, setTipoRecorrencia] = useState<TipoRecorrencia>(initial.tipoRecorrencia ?? "unico");
  const [parcelas, setParcelas] = useState(initial.parcelas ?? 12);

  const clientesOrdenados = useMemo(
    () =>
      [...clientes].sort((a, b) =>
        (a.empresa || a.nome).localeCompare(b.empresa || b.nome, "pt-BR", { sensitivity: "base" })
      ),
    [clientes]
  );

  const clienteOptions: SearchableSelectOption[] = useMemo(
    () =>
      clientesOrdenados.map((c) => ({
        value: c.id,
        label: `${c.empresa || c.nome}${c.cpfCnpj ? ` · ${c.cpfCnpj}` : ""}`,
        searchText: `${c.nome} ${c.empresa ?? ""} ${c.cpfCnpj ?? ""}`,
      })),
    [clientesOrdenados]
  );

  const fornecedorOptions: SearchableSelectOption[] = useMemo(() => {
    const base: SearchableSelectOption[] = fornecedoresRh.map((f) => ({
      value: f.id,
      label: `${f.nome}${f.cpfCnpj ? ` · ${f.cpfCnpj}` : ""}`,
      searchText: `${f.nome} ${f.cpfCnpj ?? ""}`,
    }));
    if (fornecedorKey.startsWith(LEGACY_FORN_PREFIX)) {
      const nm = decodeLegacyFornecedor(fornecedorKey);
      if (nm && !base.some((o) => o.value === fornecedorKey)) {
        base.unshift({
          value: fornecedorKey,
          label: `${nm} (fora do cadastro RH)`,
          searchText: nm,
        });
      }
    }
    return base;
  }, [fornecedoresRh, fornecedorKey]);

  const prazoVenc = useMemo(() => textoPrazoVencimento(vencimento), [vencimento]);

  const categoriasFiltradas = useMemo(
    () =>
      categorias.filter(
        (c) => c.ativo && (c.tipo === "ambos" || c.tipo === tipo)
      ),
    [categorias, tipo]
  );

  const contasAtivas = useMemo(() => contas.filter((c) => c.ativo).sort((a, b) => a.ordem - b.ordem), [contas]);
  const meiosAtivos = useMemo(
    () => meiosPagamento.filter((m) => m.ativo).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)),
    [meiosPagamento]
  );

  const handleTipoChange = (next: Lancamento["tipo"]) => {
    setTipo(next);
    if (next === "entrada") {
      setFornecedorKey("");
    } else {
      setClienteId("");
    }
  };

  const handleStatusChange = (next: Lancamento["status"]) => {
    setStatus(next);
    if (next !== "pago") setDataPagamento("");
  };

  const buildPayload = (): Lancamento[] => {
    const valorNum = (Number.parseInt(valorDigits || "0", 10) || 0) / 100;
    const fornecedorNome =
      tipo === "saida" ? resolveFornecedorNome(fornecedorKey, fornecedoresRh).trim() || undefined : undefined;
    const meioNome = meioPagamentoId
      ? meiosPagamento.find((m) => m.id === meioPagamentoId)?.nome
      : undefined;

    const base: Lancamento = {
      ...initial,
      id: isCreate ? generateId("u", 0) : initial.id,
      tipo: tipo as LancamentoTipo,
      descricao: descricao.trim(),
      vencimento,
      valor: valorNum,
      status,
      dataPagamento:
        status === "pago" && dataPagamento.trim()
          ? `${dataPagamento.trim()}T12:00:00.000Z`
          : status === "pago" && initial.dataPagamento
            ? initial.dataPagamento
            : undefined,
      clienteId: tipo === "entrada" ? (clienteId.trim() || undefined) : undefined,
      fornecedor: fornecedorNome,
      formaPagamento: meioNome || initial.formaPagamento || undefined,
      condicoesPagamento: condicoesPagamento.trim() || undefined,
      contaId: contaId.trim() || undefined,
      categoriaId: categoriaId.trim() || undefined,
      meioPagamentoId: meioPagamentoId.trim() || undefined,
    };

    if (!isCreate) return [base];

    const baseList = buildLancamentosFromForm(
      tipo as LancamentoTipo,
      base.descricao,
      base.vencimento,
      base.valor,
      tipoRecorrencia,
      tipoRecorrencia === "parcelado" ? Math.max(2, parcelas) : 12,
      base.clienteId,
      base.fornecedor
    );
    return baseList.map((item) => ({
      ...item,
      status: base.status,
      dataPagamento: base.dataPagamento,
      leadIdOrigem: base.leadIdOrigem,
      leadSolucaoId: base.leadSolucaoId,
      formaPagamento: base.formaPagamento,
      condicoesPagamento: base.condicoesPagamento,
      contaId: base.contaId,
      categoriaId: base.categoriaId,
      meioPagamentoId: base.meioPagamentoId,
    }));
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(buildPayload());
      }}
    >
      <div
        role="tablist"
        aria-label="Seções do lançamento"
        className="flex flex-wrap border-b border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50"
      >
        {(["principal", "pagamento"] as const).map((tid) => {
          const label =
            tid === "principal" ? "1. Dados do lançamento" : "2. Pagamento e status";
          const active = formTab === tid;
          return (
            <button
              key={tid}
              type="button"
              role="tab"
              id={`${formTabId}-tab-${tid}`}
              aria-selected={active}
              aria-controls={`${formTabId}-${tid}-panel`}
              onClick={() => setFormTab(tid)}
              className={clsx(
                "relative flex min-w-0 flex-1 items-center justify-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors sm:px-4",
                active
                  ? "text-[#6D28D9] dark:text-violet-400"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              {active && (
                <motion.span
                  layoutId="financeiro-lancamento-tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6D28D9]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                />
              )}
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>

      {formTab === "principal" && (
        <div
          id={`${formTabId}-principal-panel`}
          role="tabpanel"
          aria-labelledby={`${formTabId}-tab-principal`}
          className="space-y-5"
        >
          {isCreate &&
            initial.leadIdOrigem &&
            solucoesAprovacao &&
            solucoesAprovacao.length > 1 &&
            onLinhaAprovacaoChange && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-500/30 dark:bg-amber-950/30">
                <label
                  htmlFor="lanc-linha-proposta"
                  className="mb-1 block text-sm font-medium text-amber-900 dark:text-amber-100"
                >
                  Solução da proposta (este lançamento)
                </label>
                <select
                  id="lanc-linha-proposta"
                  value={linhaAprovacaoSelecionada ?? solucoesAprovacao[0]?.leadSolucaoId ?? ""}
                  onChange={(e) => onLinhaAprovacaoChange(e.target.value)}
                  className={inputClass}
                >
                  {solucoesAprovacao.map((s) => (
                    <option key={s.leadSolucaoId} value={s.leadSolucaoId}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tipo</p>
            <div className="mt-3">
              <label htmlFor="lanc-tipo" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Entrada ou saída *
              </label>
              <select
                id="lanc-tipo"
                value={tipo}
                onChange={(e) => handleTipoChange(e.target.value as Lancamento["tipo"])}
                className={inputClass}
              >
                <option value="entrada">Entrada (a receber)</option>
                <option value="saida">Saída (a pagar)</option>
              </select>
            </div>
          </div>

          {tipo === "entrada" ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Cliente (recebimento)</label>
              <p className="mb-2 text-xs text-slate-500">Busque por nome, empresa ou CPF/CNPJ.</p>
              <SearchableSelect
                id="lanc-cliente"
                options={clienteOptions}
                value={clienteId}
                onChange={setClienteId}
                placeholder="Digite para filtrar clientes…"
                emptyOptionLabel="— Sem cliente (avulso) —"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Fornecedor (RH)</label>
              <p className="mb-2 text-xs text-slate-500">
                Cadastro da aba <strong>RH → Fornecedores</strong>. Busque por nome ou CPF/CNPJ.
              </p>
              <SearchableSelect
                id="lanc-fornecedor"
                options={fornecedorOptions}
                value={fornecedorKey}
                onChange={setFornecedorKey}
                placeholder="Digite para filtrar fornecedores…"
                emptyOptionLabel="— Selecione um fornecedor —"
              />
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <label htmlFor="lanc-desc" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Descrição *
            </label>
            <input
              id="lanc-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <label htmlFor="lanc-valor" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Valor (R$) *
              </label>
              <input
                id="lanc-valor"
                type="text"
                inputMode="numeric"
                value={formatCurrencyFromCents(Number.parseInt(valorDigits || "0", 10) || 0)}
                onChange={(e) => setValorDigits(digitsOnly(e.target.value))}
                className={inputClass}
                required
              />
              {isCreate && tipoRecorrencia === "parcelado" && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Informe o valor total do acordo: o sistema divide igualmente entre as parcelas (cada linha na grade mostra o valor da parcela e o indicador Parcela k/N).
                </p>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <label htmlFor="lanc-venc" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Vencimento *
              </label>
              <input
                id="lanc-venc"
                type="date"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
                className={inputClass}
                required
              />
              <div
                className={clsx(
                  "mt-3 rounded-lg border px-3 py-2 text-sm",
                  prazoVenc.variant === "neutral" &&
                    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300",
                  prazoVenc.variant === "soon" &&
                    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200",
                  prazoVenc.variant === "today" &&
                    "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/40 dark:bg-blue-950/40 dark:text-blue-200",
                  prazoVenc.variant === "overdue" &&
                    "border-red-200 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-200"
                )}
              >
                <span className="font-medium">Prazo: </span>
                {prazoVenc.text}
              </div>
            </div>
          </div>

          {isCreate && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-400">
                Recorrência
              </p>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="lanc-tipo-rec" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Tipo
                  </label>
                  <select
                    id="lanc-tipo-rec"
                    value={tipoRecorrencia}
                    onChange={(e) => setTipoRecorrencia(e.target.value as TipoRecorrencia)}
                    className={inputClass}
                  >
                    <option value="unico">Único</option>
                    <option value="fixo_mensal">Fixo mensal</option>
                    <option value="parcelado">Parcelado</option>
                  </select>
                </div>
                {tipoRecorrencia === "parcelado" && (
                  <div>
                    <label htmlFor="lanc-parcelas" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Parcelas
                    </label>
                    <input
                      id="lanc-parcelas"
                      type="number"
                      min={2}
                      max={60}
                      value={parcelas}
                      onChange={(e) => setParcelas(Math.max(2, parseInt(e.target.value, 10) || 2))}
                      className={inputClass}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {!isCreate && initial.leadIdOrigem && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Origem
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                <Link
                  href={`/comercial?leadId=${encodeURIComponent(initial.leadIdOrigem)}`}
                  className="inline-flex font-medium text-[#6D28D9] underline hover:text-purple-800 dark:text-violet-300 dark:hover:text-violet-200"
                >
                  Abrir lead no Comercial
                </Link>
                {origemContratoId ? (
                  <Link
                    href={`/contratos/${encodeURIComponent(origemContratoId)}`}
                    className="inline-flex font-medium text-[#6D28D9] underline hover:text-purple-800 dark:text-violet-300 dark:hover:text-violet-200"
                  >
                    Abrir contrato
                  </Link>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}

      {formTab === "pagamento" && (
        <div
          id={`${formTabId}-pagamento-panel`}
          role="tabpanel"
          aria-labelledby={`${formTabId}-tab-pagamento`}
          className="space-y-5"
        >
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Conta e categoria</p>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="lanc-conta" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Conta
                </label>
                <select
                  id="lanc-conta"
                  value={contaId}
                  onChange={(e) => setContaId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Selecione —</option>
                  {contasAtivas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                      {c.padrao ? " (padrão)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="lanc-cat" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Categoria
                </label>
                <select
                  id="lanc-cat"
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Selecione —</option>
                  {categoriasFiltradas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.tipo})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</p>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="lanc-status" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Situação *
                </label>
                <select
                  id="lanc-status"
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value as Lancamento["status"])}
                  className={inputClass}
                >
                  <option value="pendente">Pendente</option>
                  <option value="pago">Pago</option>
                  <option value="atrasado">Atrasado</option>
                </select>
              </div>
              <div>
                <label htmlFor="lanc-data-pg" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Data do pagamento / recebimento
                </label>
                <input
                  id="lanc-data-pg"
                  type="date"
                  value={dataPagamento}
                  onChange={(e) => setDataPagamento(e.target.value)}
                  className={inputClass}
                  disabled={status !== "pago"}
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Disponível quando o status for &quot;Pago&quot;.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Condições</p>
            <div className="mt-3 space-y-4">
              <div>
                <label htmlFor="lanc-meio" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Meio de pagamento
                </label>
                <select
                  id="lanc-meio"
                  value={meioPagamentoId}
                  onChange={(e) => setMeioPagamentoId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Selecione —</option>
                  {meiosAtivos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Cadastre novos meios em Configurações do Financeiro (ícone de engrenagem no topo).
                </p>
              </div>
              <div>
                <label htmlFor="lanc-cond" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Condições de pagamento
                </label>
                <textarea
                  id="lanc-cond"
                  value={condicoesPagamento}
                  onChange={(e) => setCondicoesPagamento(e.target.value)}
                  rows={4}
                  placeholder="Parcelamento, desconto, observações…"
                  className={`${inputClass} min-h-[100px] resize-y`}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 dark:border-slate-700 sm:flex-row sm:justify-end sm:gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-lg bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
        >
          {isCreate ? "Criar lançamento(s)" : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
