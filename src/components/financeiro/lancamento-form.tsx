"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock,
  CreditCard,
  FileText,
  Landmark,
  ListOrdered,
  RefreshCw,
  Tags,
  Text,
  TrendingDown,
  TrendingUp,
  UserRound,
  Wallet,
} from "lucide-react";
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
import {
  SearchableSelect,
  type SearchableOption,
} from "@/components/ui/searchable-select";
import { DateField } from "@/components/ui/date-field";
import {
  formInputClass,
  formInputCompactClass,
  formLabelClass,
  formModalCancelButtonClass,
  formModalSubmitButtonClass,
  formTextareaClass,
  formTextareaLeadingIconTopClass,
} from "@/components/ui/field-patterns";
import {
  iconForMeioPagamentoNome,
  meioPagamentoIconColorClass,
} from "@/lib/financeiro/meio-pagamento-icon";
import {
  defaultCategoriaVisual,
  financeiroLucideFromIconKey,
  FINANCEIRO_CONTA_VISUALS_UPDATE_EVENT,
  readContaVisualMapFromLocalStorage,
  resolveContaVisual,
  visualStorageKey,
  type VisualMeta,
} from "@/lib/financeiro/visuals";
import { textoPrazoVencimento } from "@/lib/financeiro/vencimento-utils";

const formHelperTextClass =
  "mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400";

const formSectionHeadingClass =
  "text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

function resolveMeioId(initial: Lancamento, meios: FinanceiroMeioPagamento[]): string {
  if (initial.meioPagamentoId) return initial.meioPagamentoId;
  const m = meios.find((x) => x.nome === initial.formaPagamento);
  return m?.id ?? "";
}

export type LancamentoFormMode = "create" | "edit";

const LEGACY_FORN_PREFIX = "legacy|||";
const formInputWithIconClass = `${formInputClass} pl-9`;

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

  const [contaVisualById, setContaVisualById] = useState<Record<string, VisualMeta>>({});

  useEffect(() => {
    const refresh = () => setContaVisualById(readContaVisualMapFromLocalStorage());
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === visualStorageKey("conta") || e.key === null) refresh();
    };
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") refresh();
    };
    const onContaVisualsUpdate = () => refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener(FINANCEIRO_CONTA_VISUALS_UPDATE_EVENT, onContaVisualsUpdate);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(FINANCEIRO_CONTA_VISUALS_UPDATE_EVENT, onContaVisualsUpdate);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const clientesOrdenados = useMemo(
    () =>
      [...clientes].sort((a, b) =>
        (a.empresa || a.nome).localeCompare(b.empresa || b.nome, "pt-BR", { sensitivity: "base" })
      ),
    [clientes]
  );

  const clienteSelectOptions: SearchableOption[] = useMemo(
    () => [
      { value: "", label: "Sem cliente (avulso)", icon: Building2 },
      ...clientesOrdenados.map((c) => ({
        value: c.id,
        label: (c.empresa || c.nome).trim(),
        subtitle: c.cpfCnpj,
        icon: Building2,
      })),
    ],
    [clientesOrdenados]
  );

  const fornecedorSelectOptions: SearchableOption[] = useMemo(() => {
    const rows: SearchableOption[] = [
      { value: "", label: "Selecione um fornecedor", icon: UserRound },
      ...fornecedoresRh.map((f) => ({
        value: f.id,
        label: f.nome.trim(),
        subtitle: f.cpfCnpj,
        icon: UserRound,
      })),
    ];
    if (fornecedorKey.startsWith(LEGACY_FORN_PREFIX)) {
      const nm = decodeLegacyFornecedor(fornecedorKey);
      if (nm && !rows.some((o) => o.value === fornecedorKey)) {
        rows.splice(1, 0, {
          value: fornecedorKey,
          label: `${nm} (fora do cadastro RH)`,
          icon: UserRound,
        });
      }
    }
    return rows;
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

  const tipoLancamentoOptions: SearchableOption[] = useMemo(
    () => [
      {
        value: "entrada",
        label: "Entrada (a receber)",
        icon: ({ className }) => (
          <TrendingUp className={clsx(className, "!text-emerald-600 dark:!text-emerald-400")} />
        ),
      },
      {
        value: "saida",
        label: "Saída (a pagar)",
        icon: ({ className }) => (
          <TrendingDown className={clsx(className, "!text-red-600 dark:!text-red-400")} />
        ),
      },
    ],
    []
  );

  const tipoLeadingIcon = useMemo(() => {
    if (tipo === "entrada") {
      return ({ className }: { className?: string }) => (
        <TrendingUp className={clsx(className, "!text-emerald-600 dark:!text-emerald-400")} />
      );
    }
    return ({ className }: { className?: string }) => (
      <TrendingDown className={clsx(className, "!text-red-600 dark:!text-red-400")} />
    );
  }, [tipo]);

  const tipoRecorrenciaOptions: SearchableOption[] = useMemo(
    () => [
      {
        value: "unico",
        label: "Único",
        icon: ({ className }) => <Circle className={`!text-emerald-500 ${className ?? ""}`} />,
      },
      {
        value: "fixo_mensal",
        label: "Fixo mensal",
        icon: ({ className }) => <RefreshCw className={`!text-blue-500 ${className ?? ""}`} />,
      },
      {
        value: "parcelado",
        label: "Parcelado",
        icon: ({ className }) => <ListOrdered className={`!text-violet-500 ${className ?? ""}`} />,
      },
    ],
    []
  );

  const solucaoPropostaOptions = useMemo((): SearchableOption[] => {
    if (!solucoesAprovacao?.length) return [];
    return solucoesAprovacao.map((s) => ({
      value: s.leadSolucaoId,
      label: s.nome,
      icon: FileText,
    }));
  }, [solucoesAprovacao]);

  const contaSelectOptions = useMemo((): SearchableOption[] => {
    const empty: SearchableOption = {
      value: "",
      label: "— Selecione —",
      icon: ({ className }) => <Landmark className={clsx(className, "text-slate-400")} />,
    };
    return [
      empty,
      ...contasAtivas.map((c) => {
        const v = resolveContaVisual(c.id, contaVisualById);
        const Icon = financeiroLucideFromIconKey(v.icon);
        return {
          value: c.id,
          label: `${c.nome}${c.padrao ? " (padrão)" : ""}`,
          icon: ({ className }: { className?: string }) => (
            <Icon className={className} style={{ color: v.color }} />
          ),
        };
      }),
    ];
  }, [contasAtivas, contaVisualById]);

  const contaLeadingIcon = useMemo(() => {
    if (!contaId) {
      return ({ className }: { className?: string }) => (
        <Landmark className={clsx(className, "text-slate-400")} />
      );
    }
    const v = resolveContaVisual(contaId, contaVisualById);
    const Icon = financeiroLucideFromIconKey(v.icon);
    return ({ className }: { className?: string }) => (
      <Icon className={className} style={{ color: v.color }} />
    );
  }, [contaId, contaVisualById]);

  const categoriaSelectOptions = useMemo((): SearchableOption[] => {
    const empty: SearchableOption = {
      value: "",
      label: "— Selecione —",
      icon: ({ className }) => <Tags className={clsx(className, "text-slate-400")} />,
    };
    return [
      empty,
      ...categoriasFiltradas.map((c) => {
        const v = defaultCategoriaVisual(c.tipo);
        const Icon = financeiroLucideFromIconKey(v.icon);
        return {
          value: c.id,
          label: `${c.nome} (${c.tipo})`,
          icon: ({ className }: { className?: string }) => (
            <Icon className={className} style={{ color: v.color }} />
          ),
        };
      }),
    ];
  }, [categoriasFiltradas]);

  const categoriaLeadingIcon = useMemo(() => {
    if (!categoriaId) {
      return ({ className }: { className?: string }) => (
        <Tags className={clsx(className, "text-slate-400")} />
      );
    }
    const cat = categoriasFiltradas.find((c) => c.id === categoriaId);
    if (!cat) {
      return ({ className }: { className?: string }) => (
        <Tags className={clsx(className, "text-slate-400")} />
      );
    }
    const v = defaultCategoriaVisual(cat.tipo);
    const Icon = financeiroLucideFromIconKey(v.icon);
    return ({ className }: { className?: string }) => (
      <Icon className={className} style={{ color: v.color }} />
    );
  }, [categoriaId, categoriasFiltradas]);

  const statusSelectOptions = useMemo(
    (): SearchableOption[] => [
      {
        value: "pendente",
        label: "Pendente",
        icon: ({ className }) => (
          <Clock className={clsx(className, "!text-amber-600 dark:!text-amber-400")} />
        ),
      },
      {
        value: "pago",
        label: "Pago",
        icon: ({ className }) => (
          <CheckCircle2 className={clsx(className, "!text-emerald-600 dark:!text-emerald-400")} />
        ),
      },
      {
        value: "atrasado",
        label: "Atrasado",
        icon: ({ className }) => (
          <AlertCircle className={clsx(className, "!text-red-600 dark:!text-red-400")} />
        ),
      },
    ],
    []
  );

  const statusLeadingIcon = useMemo(() => {
    if (status === "pago") {
      return ({ className }: { className?: string }) => (
        <CheckCircle2 className={clsx(className, "!text-emerald-600 dark:!text-emerald-400")} />
      );
    }
    if (status === "atrasado") {
      return ({ className }: { className?: string }) => (
        <AlertCircle className={clsx(className, "!text-red-600 dark:!text-red-400")} />
      );
    }
    return ({ className }: { className?: string }) => (
      <Clock className={clsx(className, "!text-amber-600 dark:!text-amber-400")} />
    );
  }, [status]);

  const meioSelectOptions = useMemo(
    (): SearchableOption[] => [
      {
        value: "",
        label: "— Selecione —",
        icon: ({ className }) => <Wallet className={clsx(className, "text-slate-400")} />,
      },
      ...meiosAtivos.map((m) => {
        const I = iconForMeioPagamentoNome(m.nome);
        return {
          value: m.id,
          label: m.nome,
          icon: ({ className }: { className?: string }) => (
            <I className={clsx(className, meioPagamentoIconColorClass(m.nome))} />
          ),
        };
      }),
    ],
    [meiosAtivos]
  );

  const meioLeadingIcon = useMemo(() => {
    if (!meioPagamentoId) {
      return ({ className }: { className?: string }) => (
        <Wallet className={clsx(className, "text-slate-400")} />
      );
    }
    const m = meiosAtivos.find((x) => x.id === meioPagamentoId);
    if (!m) {
      return ({ className }: { className?: string }) => (
        <Wallet className={clsx(className, "text-slate-400")} />
      );
    }
    const I = iconForMeioPagamentoNome(m.nome);
    return ({ className }: { className?: string }) => (
      <I className={clsx(className, meioPagamentoIconColorClass(m.nome))} />
    );
  }, [meioPagamentoId, meiosAtivos]);

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
      className="flex h-full min-h-0 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(buildPayload());
      }}
    >
      <div
        role="tablist"
        aria-label="Seções do lançamento"
        className="flex w-full shrink-0 flex-wrap border-b border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50"
      >
        {(
          [
            { id: "principal" as const, label: "Dados do lançamento", Icon: ClipboardList },
            { id: "pagamento" as const, label: "Pagamento e status", Icon: CreditCard },
          ] as const
        ).map(({ id: tid, label, Icon }) => {
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
                "relative flex min-w-0 flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors",
                active ? "text-[#6D28D9] dark:text-violet-300" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              {active && (
                <motion.span
                  layoutId="financeiro-lancamento-tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6D28D9]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
      {formTab === "principal" && (
        <div
          id={`${formTabId}-principal-panel`}
          role="tabpanel"
          aria-labelledby={`${formTabId}-tab-principal`}
          className="space-y-5 p-4 lg:p-6"
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
                <div className="mt-1">
                  <SearchableSelect
                    options={solucaoPropostaOptions}
                    value={linhaAprovacaoSelecionada ?? solucoesAprovacao[0]?.leadSolucaoId ?? ""}
                    onChange={onLinhaAprovacaoChange}
                    placeholder="Selecione a solução…"
                    searchPlaceholder="Buscar solução…"
                    searchable={solucaoPropostaOptions.length > 6}
                    leadingIcon={FileText}
                  />
                </div>
              </div>
            )}
          <div>
            <label htmlFor="lanc-tipo" className={formLabelClass}>
              Entrada ou saída *
            </label>
            <div className="mt-1">
              <SearchableSelect
                options={tipoLancamentoOptions}
                value={tipo}
                onChange={(v) => handleTipoChange(v as Lancamento["tipo"])}
                placeholder="Selecione…"
                searchPlaceholder="Buscar…"
                searchable={false}
                leadingIcon={tipoLeadingIcon}
              />
            </div>
          </div>

          {tipo === "entrada" ? (
            <div>
              <label className={formLabelClass}>Cliente (recebimento)</label>
              <div className="mt-1">
                <SearchableSelect
                  options={clienteSelectOptions}
                  value={clienteId}
                  onChange={setClienteId}
                  placeholder="Selecionar cliente…"
                  searchPlaceholder="Buscar por CNPJ ou nome…"
                  emptyLabel="Nenhum cliente encontrado na base."
                  leadingIcon={Building2}
                />
              </div>
            </div>
          ) : (
            <div>
              <label className={formLabelClass}>Fornecedor (RH)</label>
              <p className={formHelperTextClass}>
                Cadastro da aba <strong>RH → Fornecedores</strong>.
              </p>
              <div className="mt-1">
                <SearchableSelect
                  options={fornecedorSelectOptions}
                  value={fornecedorKey}
                  onChange={setFornecedorKey}
                  placeholder="Selecionar fornecedor…"
                  searchPlaceholder="Buscar por CNPJ ou nome…"
                  emptyLabel="Nenhum fornecedor encontrado."
                  leadingIcon={UserRound}
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="lanc-desc" className={formLabelClass}>
              Descrição *
            </label>
            <div className="relative mt-1">
              <Text className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="lanc-desc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className={formInputWithIconClass}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="lanc-valor" className={formLabelClass}>
                Valor (R$) *
              </label>
              <div className="relative mt-1">
                <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="lanc-valor"
                  type="text"
                  inputMode="numeric"
                  value={formatCurrencyFromCents(Number.parseInt(valorDigits || "0", 10) || 0)}
                  onChange={(e) => setValorDigits(digitsOnly(e.target.value))}
                  className={formInputWithIconClass}
                  required
                />
              </div>
              {isCreate && tipoRecorrencia === "parcelado" && (
                <p className={clsx(formHelperTextClass, "mt-2")}>
                  Informe o valor total do acordo: o sistema divide igualmente entre as parcelas (cada linha na grade mostra o valor da parcela e o indicador Parcela k/N).
                </p>
              )}
            </div>
            <div>
              <label htmlFor="lanc-venc" className={formLabelClass}>
                Vencimento *
              </label>
              <div className="mt-1">
                <DateField
                  id="lanc-venc"
                  value={vencimento}
                  onChange={setVencimento}
                  placeholder="Selecione a data"
                />
              </div>
              <div
                className={clsx(
                  "mt-3 rounded-xl border px-3 py-2 text-sm",
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
              <p className={formSectionHeadingClass}>Recorrência</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="shrink-0 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Tipo
                  </span>
                  <SearchableSelect
                    fullWidth={false}
                    options={tipoRecorrenciaOptions}
                    value={tipoRecorrencia}
                    onChange={(v) => setTipoRecorrencia(v as TipoRecorrencia)}
                    placeholder="Selecione…"
                    searchable={false}
                    leadingIcon={Wallet}
                  />
                </div>
                {tipoRecorrencia === "parcelado" && (
                  <div className="w-full shrink-0 sm:w-[7.5rem]">
                    <label htmlFor="lanc-parcelas" className={formLabelClass}>
                      Parcelas
                    </label>
                    <input
                      id="lanc-parcelas"
                      type="number"
                      min={2}
                      max={60}
                      value={parcelas}
                      onChange={(e) => setParcelas(Math.max(2, parseInt(e.target.value, 10) || 2))}
                      className={`${formInputCompactClass} mt-1 w-full`}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {!isCreate && initial.leadIdOrigem && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/60">
              <p className={formSectionHeadingClass}>Origem</p>
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
          className="space-y-5 p-4 lg:p-6"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="lanc-conta" className={formLabelClass}>
                  Conta
                </label>
                <div className="mt-1">
                  <SearchableSelect
                    options={contaSelectOptions}
                    value={contaId}
                    onChange={setContaId}
                    placeholder="— Selecione —"
                    searchPlaceholder="Buscar conta…"
                    leadingIcon={contaLeadingIcon}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="lanc-cat" className={formLabelClass}>
                  Categoria
                </label>
                <div className="mt-1">
                  <SearchableSelect
                    options={categoriaSelectOptions}
                    value={categoriaId}
                    onChange={setCategoriaId}
                    placeholder="— Selecione —"
                    searchPlaceholder="Buscar categoria…"
                    leadingIcon={categoriaLeadingIcon}
                  />
                </div>
              </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="lanc-status" className={formLabelClass}>
                  Situação *
                </label>
                <div className="mt-1">
                  <SearchableSelect
                    options={statusSelectOptions}
                    value={status}
                    onChange={(v) => handleStatusChange(v as Lancamento["status"])}
                    placeholder="Situação"
                    searchPlaceholder="Buscar…"
                    searchable={false}
                    leadingIcon={statusLeadingIcon}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="lanc-data-pg" className={formLabelClass}>
                  Data do pagamento / recebimento
                </label>
                <div className="mt-1">
                  <DateField
                    id="lanc-data-pg"
                    value={dataPagamento}
                    onChange={setDataPagamento}
                    placeholder="Selecione a data"
                    disabled={status !== "pago"}
                  />
                </div>
                <p className={formHelperTextClass}>
                  Disponível quando o status for &quot;Pago&quot;.
                </p>
              </div>
          </div>

          <div className="space-y-4">
              <div>
                <label htmlFor="lanc-meio" className={formLabelClass}>
                  Meio de pagamento
                </label>
                <div className="mt-1">
                  <SearchableSelect
                    options={meioSelectOptions}
                    value={meioPagamentoId}
                    onChange={setMeioPagamentoId}
                    placeholder="— Selecione —"
                    searchable={false}
                    leadingIcon={meioLeadingIcon}
                  />
                </div>
                <p className={formHelperTextClass}>
                  Cadastre novos meios em Configurações do Financeiro (ícone de engrenagem no topo).
                </p>
              </div>
              <div>
                <label htmlFor="lanc-cond" className={formLabelClass}>
                  Condições de pagamento
                </label>
                <div className="relative mt-1">
                  <Text
                    className={clsx(
                      "pointer-events-none absolute left-3 h-4 w-4 text-slate-400",
                      formTextareaLeadingIconTopClass
                    )}
                  />
                  <textarea
                    id="lanc-cond"
                    value={condicoesPagamento}
                    onChange={(e) => setCondicoesPagamento(e.target.value)}
                    rows={4}
                    placeholder="Parcelamento, desconto, observações…"
                    className={`${formTextareaClass} min-h-[100px] resize-y pl-9`}
                  />
                </div>
              </div>
          </div>
        </div>
      )}
      </div>

      <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:justify-end sm:gap-3 lg:px-6">
        <button
          type="button"
          onClick={onCancel}
          className={formModalCancelButtonClass}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className={formModalSubmitButtonClass}
        >
          Salvar
        </button>
      </div>
    </form>
  );
}
