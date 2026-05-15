"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  BadgePercent,
  Building2,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock,
  CreditCard,
  FileText,
  Landmark,
  ListOrdered,
  Plus,
  RefreshCw,
  Save,
  Tags,
  Text,
  TrendingDown,
  TrendingUp,
  ShoppingCart,
  Trash2,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type {
  ConsultorComissaoSlim,
  FinanceiroCategoria,
  FinanceiroConta,
  FinanceiroMeioPagamento,
  FornecedorRhSlim,
  Lancamento,
  LancamentoTipo,
  TipoRecorrencia,
} from "@/lib/financeiro/types";
import type { Cliente } from "@/lib/clientes/types";
import type { LeadRecorrenciaPagamento } from "@/lib/comercial/types";
import { comercialInputCompactClass, comercialLabelClass } from "@/components/comercial/field-styles";
import { formatCurrency } from "@/lib/clientes/utils";
import { buildLancamentosFromForm } from "@/components/financeiro/novo-lancamento-form";
import {
  SearchableSelect,
  type SearchableOption,
} from "@/components/ui/searchable-select";
import { DateField } from "@/components/ui/date-field";
import { Dialog } from "@/components/ui/dialog";
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
import { LANCAMENTO_FIXO_MENSAL_PROJECAO_MESES } from "@/lib/financeiro/constants";
import { lancamentoAlertaFimFixoMensal } from "@/lib/financeiro/lancamento-utils";
import { textoPrazoVencimento } from "@/lib/financeiro/vencimento-utils";
import { LeadComissaoParticipacaoPanel } from "@/components/financeiro/lead-comissao-participacao-panel";

const formHelperTextClass =
  "mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400";

const formSectionHeadingClass =
  "text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

function newVdRowKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `vd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parsePtFloat(s: string): number {
  const t = s.trim().replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

type VendaDiretaPayloadOverrides = {
  vendaLeadId: string;
  vendaSolucoes: Array<{ id: string; nome: string }>;
};

type VdCatalogSol = {
  id: string;
  nome: string;
  valorVenda: number;
  logoUrl?: string;
  recorrencia: "mensal" | "unica" | "parcelado";
  parcelasPadrao: number;
};

/** Opção «Personalizar venda» no seletor (mesmo fluxo visual da proposta no Comercial). */
const VD_PERSONALIZAR = "__vd_personalizar__";

const REC_COMERCIAL_VD_LABEL: Record<LeadRecorrenciaPagamento, string> = {
  mensal: "Mensal",
  unica: "Única",
  parcelado: "Parcelado",
};

/** Linha de solução na venda direta (espelha `LeadSolucaoRef` na UI da proposta). */
type VdPropostaSol = {
  key: string;
  nome: string;
  valor: number;
  solucaoCatalogoId?: string | null;
  logoUrl?: string;
  condicoesPagamento: string;
  recorrenciaPagamento: LeadRecorrenciaPagamento;
  parcelas: number | null;
};

function useVdBrlCentavos() {
  const [centavos, setCentavos] = useState<number | null>(null);
  const display =
    centavos == null || centavos === 0
      ? ""
      : (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const onChangeDigits = (raw: string) => {
    const d = raw.replace(/\D/g, "");
    if (d === "") {
      setCentavos(null);
      return;
    }
    setCentavos(parseInt(d, 10));
  };
  const getValorReais = (fallback: number) => {
    if (centavos == null) return fallback;
    return centavos / 100;
  };
  return { display, onChangeDigits, getValorReais, setCentavos };
}

type VdPartRow = {
  key: string;
  consultorId: string;
  percentStr: string;
};

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
  /** Resumo de soluções da proposta com status de vínculo no caixa (fluxo de aprovação). */
  propostaSolucoesResumo?: Array<{ leadSolucaoId: string; nome: string; vinculado: boolean }>;
  linhaAprovacaoSelecionada?: string;
  onLinhaAprovacaoChange?: (leadSolucaoId: string) => void;
  onSave: (l: Lancamento[]) => void;
  onCancel: () => void;
  /** ID do contrato ligado ao lead de origem (para link), quando existir. */
  origemContratoId?: string | null;
  /** Membros do grupo (fixo mensal), para aviso de fim de recorrência. */
  recorrenciaGrupo?: Lancamento[];
  /** Prorroga recebimento/pagamento em N meses (novas linhas no financeiro). Retorna true se salvou. */
  onProrrogarFixoMensal?: (meses: number) => Promise<boolean>;
  /** Consultores elegíveis a comissão (bootstrap); habilita a aba «Venda direta» no novo lançamento. */
  consultoresComissaoRh?: ConsultorComissaoSlim[];
};

type LancamentoFormTab = "principal" | "venda_comissao" | "pagamento" | "comissoes";

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
  propostaSolucoesResumo,
  linhaAprovacaoSelecionada,
  onLinhaAprovacaoChange,
  onSave,
  onCancel,
  origemContratoId,
  recorrenciaGrupo,
  onProrrogarFixoMensal,
  consultoresComissaoRh = [],
}: LancamentoFormProps) {
  const isCreate = mode === "create";
  const formTabId = useId();
  const [formTab, setFormTab] = useState<LancamentoFormTab>("principal");
  const [vendaDiretaLeadId, setVendaDiretaLeadId] = useState<string | null>(null);
  const [vendaDiretaSolucoes, setVendaDiretaSolucoes] = useState<Array<{ id: string; nome: string }>>([]);
  const [vdLeadSolucaoPick, setVdLeadSolucaoPick] = useState("");
  const [comissaoBloqueiaSalvar, setComissaoBloqueiaSalvar] = useState(false);
  const [comissaoBloqueioMotivo, setComissaoBloqueioMotivo] = useState("");

  const onParticipacaoBloqueio = useCallback((bloqueado: boolean, motivo?: string) => {
    setComissaoBloqueiaSalvar(bloqueado);
    setComissaoBloqueioMotivo(motivo ?? "");
  }, []);

  const [tipo, setTipo] = useState<Lancamento["tipo"]>(initial.tipo);

  const showVendaComissaoTab = useMemo(
    () => isCreate && !initial.leadIdOrigem && tipo === "entrada" && consultoresComissaoRh.length > 0,
    [consultoresComissaoRh.length, initial.leadIdOrigem, isCreate, tipo]
  );
  const leadIdComissao = initial.leadIdOrigem ?? vendaDiretaLeadId ?? null;
  const showPropostaComissoesTab = useMemo(
    () => tipo === "entrada" && Boolean(leadIdComissao),
    [leadIdComissao, tipo]
  );

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
  const [parcelas, setParcelas] = useState(initial.parcelas ?? LANCAMENTO_FIXO_MENSAL_PROJECAO_MESES);

  const [vdCatalogo, setVdCatalogo] = useState<VdCatalogSol[]>([]);
  const [vdCatalogLoading, setVdCatalogLoading] = useState(false);
  const [vdSolucoes, setVdSolucoes] = useState<VdPropostaSol[]>([]);
  const [vdAddSelect, setVdAddSelect] = useState("");
  const [vdAddCondicoes, setVdAddCondicoes] = useState("");
  const [vdPersNome, setVdPersNome] = useState("");
  const [vdPersRec, setVdPersRec] = useState<LeadRecorrenciaPagamento>("unica");
  const [vdPersParcelas, setVdPersParcelas] = useState(12);
  const {
    display: vdAddValorDisplay,
    onChangeDigits: vdAddValorOnDigits,
    getValorReais: vdAddGetValorReais,
    setCentavos: vdSetAddCentavos,
  } = useVdBrlCentavos();
  const [vdPartRows, setVdPartRows] = useState<VdPartRow[]>(() => [
    { key: newVdRowKey(), consultorId: "", percentStr: "100" },
  ]);
  const [tituloVd, setTituloVd] = useState("");
  const [vdError, setVdError] = useState("");
  const [vdSubmitting, setVdSubmitting] = useState(false);

  const [fixoMensalAvisoOpen, setFixoMensalAvisoOpen] = useState(false);
  const [fixoAvisoDismissed, setFixoAvisoDismissed] = useState(false);
  const [mesesProrrogarFixo, setMesesProrrogarFixo] = useState(12);
  const [prorrogandoFixo, setProrrogandoFixo] = useState(false);

  useEffect(() => {
    setFixoAvisoDismissed(false);
  }, [initial.id]);

  useEffect(() => {
    if (formTab === "venda_comissao" && !showVendaComissaoTab) {
      setFormTab("principal");
    }
  }, [formTab, showVendaComissaoTab]);

  useEffect(() => {
    if (formTab === "comissoes" && !showPropostaComissoesTab) {
      setFormTab("principal");
    }
  }, [formTab, showPropostaComissoesTab]);

  useEffect(() => {
    if (!vendaDiretaSolucoes.length) {
      setVdLeadSolucaoPick("");
      return;
    }
    setVdLeadSolucaoPick((prev) =>
      prev && vendaDiretaSolucoes.some((s) => s.id === prev) ? prev : (vendaDiretaSolucoes[0]?.id ?? "")
    );
  }, [vendaDiretaSolucoes]);

  useEffect(() => {
    if (!showVendaComissaoTab) return;
    let cancelled = false;
    (async () => {
      setVdCatalogLoading(true);
      setVdError("");
      try {
        const res = await fetch("/api/solucoes/bootstrap", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as {
          success?: boolean;
          data?: { solucoes?: VdCatalogSol[] };
        };
        const list = Array.isArray(json?.data?.solucoes) ? json.data!.solucoes! : [];
        if (!cancelled) setVdCatalogo(list.filter((s) => s && typeof s.id === "string"));
      } catch {
        if (!cancelled) setVdError("Não foi possível carregar o catálogo de soluções.");
      } finally {
        if (!cancelled) setVdCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showVendaComissaoTab]);

  useEffect(() => {
    if (!vdAddSelect) {
      vdSetAddCentavos(null);
      setVdAddCondicoes("");
      setVdPersNome("");
      return;
    }
    if (vdAddSelect === VD_PERSONALIZAR) {
      vdSetAddCentavos(null);
      setVdPersNome("");
      setVdPersRec("unica");
      setVdPersParcelas(12);
      setVdAddCondicoes("");
      return;
    }
    const cat = vdCatalogo.find((x) => x.id === vdAddSelect);
    if (cat) vdSetAddCentavos(Math.round((cat.valorVenda || 0) * 100));
    setVdAddCondicoes("");
  }, [vdAddSelect, vdCatalogo, vdSetAddCentavos]);

  const precisaAvisoFimFixoMensal =
    mode === "edit" &&
    typeof onProrrogarFixoMensal === "function" &&
    (recorrenciaGrupo?.length ?? 0) > 0 &&
    lancamentoAlertaFimFixoMensal(initial, recorrenciaGrupo ?? []) &&
    !fixoAvisoDismissed;

  useEffect(() => {
    if (precisaAvisoFimFixoMensal) {
      setFixoMensalAvisoOpen(true);
      setMesesProrrogarFixo(12);
    } else {
      setFixoMensalAvisoOpen(false);
    }
  }, [precisaAvisoFimFixoMensal, initial.id]);

  const fecharAvisoFixoMensal = useCallback(() => {
    setFixoAvisoDismissed(true);
    setFixoMensalAvisoOpen(false);
  }, []);

  const handleProrrogarFixoMensal = useCallback(async () => {
    if (!onProrrogarFixoMensal || mesesProrrogarFixo < 1) return;
    setProrrogandoFixo(true);
    try {
      const ok = await onProrrogarFixoMensal(Math.floor(mesesProrrogarFixo));
      if (ok) {
        setFixoAvisoDismissed(true);
        setFixoMensalAvisoOpen(false);
      }
    } finally {
      setProrrogandoFixo(false);
    }
  }, [mesesProrrogarFixo, onProrrogarFixoMensal]);

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

  const prazoVenc = useMemo(() => {
    if (status === "pago") {
      return { text: "", variant: "neutral" as const };
    }
    return textoPrazoVencimento(vencimento);
  }, [vencimento, status]);

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

  const vinculadoSolucaoPorId = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const row of propostaSolucoesResumo ?? []) {
      m.set(row.leadSolucaoId, row.vinculado);
    }
    return m;
  }, [propostaSolucoesResumo]);

  const solucaoPropostaOptions = useMemo((): SearchableOption[] => {
    if (!solucoesAprovacao?.length) return [];
    return solucoesAprovacao.map((s) => {
      const vinculado = vinculadoSolucaoPorId.get(s.leadSolucaoId) ?? false;
      return {
        value: s.leadSolucaoId,
        label: s.nome,
        subtitle: vinculado ? "Lançado" : "Pendente",
        subtitleClassName: vinculado
          ? "font-medium text-emerald-700 dark:text-emerald-400"
          : "font-medium text-amber-700 dark:text-amber-300",
        icon: vinculado ? BadgeCheck : AlertTriangle,
        iconClassName: vinculado
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-amber-600 dark:text-amber-500",
      };
    });
  }, [solucoesAprovacao, vinculadoSolucaoPorId]);

  const vdPagamentoNegociacaoOptions: SearchableOption[] = useMemo(
    () => [
      {
        value: "mensal",
        label: "Mensal",
        icon: ({ className }) => <RefreshCw className={`!text-blue-500 ${className ?? ""}`} />,
      },
      {
        value: "unica",
        label: "Única",
        icon: ({ className }) => <Circle className={`!text-emerald-500 ${className ?? ""}`} />,
      },
      {
        value: "parcelado",
        label: "Parcelado",
        icon: ({ className }) => <ListOrdered className={`!text-violet-500 ${className ?? ""}`} />,
      },
    ],
    []
  );

  const vdCatalogDisponiveis = useMemo(() => {
    const idsNaLista = new Set(
      vdSolucoes.map((s) => s.solucaoCatalogoId).filter((x): x is string => Boolean(x))
    );
    return vdCatalogo.filter((c) => !idsNaLista.has(c.id));
  }, [vdCatalogo, vdSolucoes]);

  const vdSolAddOptions: SearchableOption[] = useMemo(() => {
    const fromCat = vdCatalogDisponiveis.map((s) => ({
      value: s.id,
      label: s.nome,
      subtitle: formatCurrency(s.valorVenda),
      icon: FileText,
    }));
    const personalizar: SearchableOption = {
      value: VD_PERSONALIZAR,
      label: "Personalizar venda (sem solução cadastrada)",
      subtitle: "Nome, valor e condições de pagamento",
      icon: FileText,
    };
    return [personalizar, ...fromCat];
  }, [vdCatalogDisponiveis]);

  const vdSelectedCatalogSol = useMemo(() => {
    if (!vdAddSelect || vdAddSelect === VD_PERSONALIZAR) return undefined;
    return vdCatalogo.find((s) => s.id === vdAddSelect);
  }, [vdAddSelect, vdCatalogo]);

  const vdValorTotalSolucoes = useMemo(
    () => vdSolucoes.reduce((acc, s) => acc + (s.valor ?? 0), 0),
    [vdSolucoes]
  );

  const vdConsultorOptions: SearchableOption[] = useMemo(
    () => [
      { value: "", label: "Selecione o consultor", icon: Users },
      ...consultoresComissaoRh.map((c) => ({
        value: c.id,
        label: c.nome.trim(),
        icon: UserRound,
      })),
    ],
    [consultoresComissaoRh]
  );

  const vdSolucaoPickOptions = useMemo(
    (): SearchableOption[] =>
      vendaDiretaSolucoes.map((s) => ({
        value: s.id,
        label: s.nome.trim(),
        icon: FileText,
      })),
    [vendaDiretaSolucoes]
  );

  const patchVdSolucao = useCallback((idx: number, patch: Partial<VdPropostaSol>) => {
    setVdSolucoes((list) => list.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  }, []);

  const cancelarVdAdd = useCallback(() => {
    setVdAddSelect("");
    setVdAddCondicoes("");
    vdSetAddCentavos(null);
  }, [vdSetAddCentavos]);

  const adicionarVdSolucaoCatalogo = useCallback(() => {
    const sol = vdSelectedCatalogSol;
    if (!sol || !vdAddCondicoes.trim()) return;
    const valorNum = vdAddGetValorReais(sol.valorVenda);
    const logoTrim = sol.logoUrl?.trim();
    const parcelasLinha =
      sol.recorrencia === "parcelado" ? Math.max(2, sol.parcelasPadrao ?? 12) : null;
    const nova: VdPropostaSol = {
      key: newVdRowKey(),
      solucaoCatalogoId: sol.id,
      nome: sol.nome,
      ...(logoTrim ? { logoUrl: logoTrim } : {}),
      valor: valorNum,
      condicoesPagamento: vdAddCondicoes.trim(),
      recorrenciaPagamento: sol.recorrencia,
      parcelas: parcelasLinha,
    };
    setVdSolucoes((prev) => [...prev, nova]);
    cancelarVdAdd();
  }, [vdAddCondicoes, vdAddGetValorReais, vdSelectedCatalogSol, cancelarVdAdd]);

  const adicionarVdSolucaoPersonalizada = useCallback(() => {
    if (!vdPersNome.trim()) return;
    const valorNum = vdAddGetValorReais(0);
    if (!(valorNum > 0) || !vdAddCondicoes.trim()) return;
    const parcelasLinha =
      vdPersRec === "parcelado" ? Math.max(2, Math.min(60, vdPersParcelas)) : null;
    const nova: VdPropostaSol = {
      key: newVdRowKey(),
      solucaoCatalogoId: null,
      nome: vdPersNome.trim(),
      valor: valorNum,
      condicoesPagamento: vdAddCondicoes.trim(),
      recorrenciaPagamento: vdPersRec,
      parcelas: parcelasLinha,
    };
    setVdSolucoes((prev) => [...prev, nova]);
    cancelarVdAdd();
  }, [vdAddCondicoes, vdAddGetValorReais, vdPersNome, vdPersParcelas, vdPersRec, cancelarVdAdd]);

  const postVendaDiretaSeNecessario = useCallback(async (): Promise<
    { ok: true; payloadOverrides?: VendaDiretaPayloadOverrides } | { ok: false }
  > => {
    setVdError("");
    const solucoesPayload = vdSolucoes
      .map((s) => ({
        nome: s.nome.trim(),
        valor: s.valor,
        solucaoCatalogoId: s.solucaoCatalogoId?.trim() || null,
        recorrenciaPagamento: s.recorrenciaPagamento,
        parcelas: s.recorrenciaPagamento === "parcelado" ? s.parcelas : null,
        condicoesPagamento: s.condicoesPagamento.trim() || null,
      }))
      .filter((row) => row.nome && row.valor > 0);

    if (!solucoesPayload.length) {
      return { ok: true };
    }

    if (vendaDiretaLeadId) {
      return { ok: true };
    }

    if (!clienteId.trim()) {
      setVdError("Selecione o cliente na aba «Dados do lançamento» antes de salvar com venda para comissão.");
      return { ok: false };
    }

    const participacoes = vdPartRows
      .filter((p) => p.consultorId.trim())
      .map((p) => ({
        consultorId: p.consultorId.trim(),
        percentual: parsePtFloat(p.percentStr),
      }));

    if (!participacoes.length) {
      setVdError("Informe ao menos um consultor com percentual.");
      return { ok: false };
    }
    if (participacoes.some((p) => !Number.isFinite(p.percentual))) {
      setVdError("Percentuais inválidos. Use vírgula para decimais (ex.: 33,33).");
      return { ok: false };
    }
    const somaPct = participacoes.reduce((a, p) => a + p.percentual, 0);
    if (Math.abs(somaPct - 100) > 0.02) {
      setVdError(`Os percentuais devem somar 100%. Atual: ${somaPct.toFixed(2)}%.`);
      return { ok: false };
    }

    setVdSubmitting(true);
    try {
      const res = await fetch("/api/financeiro/venda-direta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId: clienteId.trim(),
          tituloLead: tituloVd.trim() || null,
          solucoes: solucoesPayload,
          participacoes,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { vendaDireta?: { leadId: string; solucoes: Array<{ id: string; nome: string }> } };
        error?: { message?: string };
      };
      if (!res.ok || !json?.success || !json.data?.vendaDireta?.leadId) {
        setVdError(json?.error?.message ?? "Não foi possível registrar a venda direta.");
        return { ok: false };
      }
      const vd = json.data.vendaDireta;
      const solucoes = vd.solucoes ?? [];
      setVendaDiretaLeadId(vd.leadId);
      setVendaDiretaSolucoes(solucoes);
      return { ok: true, payloadOverrides: { vendaLeadId: vd.leadId, vendaSolucoes: solucoes } };
    } catch {
      setVdError("Falha de rede ao registrar a venda direta.");
      return { ok: false };
    } finally {
      setVdSubmitting(false);
    }
  }, [clienteId, tituloVd, vendaDiretaLeadId, vdPartRows, vdSolucoes]);

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

  const buildPayload = (vendaOverrides?: VendaDiretaPayloadOverrides): Lancamento[] => {
    const valorNum = (Number.parseInt(valorDigits || "0", 10) || 0) / 100;
    const fornecedorNome =
      tipo === "saida" ? resolveFornecedorNome(fornecedorKey, fornecedoresRh).trim() || undefined : undefined;
    const meioNome = meioPagamentoId
      ? meiosPagamento.find((m) => m.id === meioPagamentoId)?.nome
      : undefined;

    const vdLeadEff = vendaOverrides?.vendaLeadId ?? vendaDiretaLeadId;
    const vdSolEff = vendaOverrides?.vendaSolucoes ?? vendaDiretaSolucoes;

    const leadIdForPayload =
      tipo === "entrada" ? (initial.leadIdOrigem ?? vdLeadEff ?? undefined) : undefined;
    let leadSolucaoForPayload: string | undefined;
    if (tipo === "entrada" && leadIdForPayload) {
      if (initial.leadIdOrigem) {
        leadSolucaoForPayload = linhaAprovacaoSelecionada ?? initial.leadSolucaoId ?? undefined;
      } else if (vdLeadEff && vdSolEff.length) {
        leadSolucaoForPayload =
          vdSolEff.length === 1 ? vdSolEff[0]?.id : vdLeadSolucaoPick || vdSolEff[0]?.id;
      }
    }

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
      leadIdOrigem: leadIdForPayload,
      leadSolucaoId: leadSolucaoForPayload,
    };

    if (!isCreate) return [base];

    const baseList = buildLancamentosFromForm(
      tipo as LancamentoTipo,
      base.descricao,
      base.vencimento,
      base.valor,
      tipoRecorrencia,
      tipoRecorrencia === "parcelado" ? Math.max(2, parcelas) : LANCAMENTO_FIXO_MENSAL_PROJECAO_MESES,
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

  const tabItems = useMemo(() => {
    const base: { id: LancamentoFormTab; label: string; Icon: typeof ClipboardList }[] = [
      { id: "principal", label: "Dados do lançamento", Icon: ClipboardList },
      { id: "pagamento", label: "Pagamento e status", Icon: CreditCard },
    ];
    if (showPropostaComissoesTab) {
      base.push({ id: "comissoes", label: "Comissões", Icon: BadgePercent });
    }
    if (showVendaComissaoTab) {
      base.push({ id: "venda_comissao", label: "Venda Direta", Icon: ShoppingCart });
    }
    return base;
  }, [showPropostaComissoesTab, showVendaComissaoTab]);

  return (
    <>
      <Dialog
        open={fixoMensalAvisoOpen}
        onClose={fecharAvisoFixoMensal}
        title="Recorrência fixa mensal"
        zIndexClass="z-[70]"
        maxWidth="sm:max-w-lg"
      >
        <div className="space-y-4 px-6 py-4">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
            A última competência desta recorrência fixa mensal está na janela de vencimento (entre 30 dias antes e o
            próprio dia do vencimento).
          </p>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            O que você deseja fazer? Você pode <span className="font-medium">não alterar nada</span> por enquanto ou{" "}
            <span className="font-medium">prorrogar</span> recebimento ou pagamento adicionando novas linhas no
            financeiro.
          </p>
          <div>
            <label htmlFor="fixo-meses-prorrogar" className={formLabelClass}>
              Se for prorrogar: quantos meses adicionar?
            </label>
            <input
              id="fixo-meses-prorrogar"
              type="number"
              min={1}
              max={120}
              value={mesesProrrogarFixo}
              onChange={(e) =>
                setMesesProrrogarFixo(Math.max(1, Math.min(120, Math.floor(Number(e.target.value) || 1))))
              }
              className={clsx(formInputClass, "mt-1 max-w-[8rem]")}
            />
          </div>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={fecharAvisoFixoMensal}
              className={formModalCancelButtonClass}
              disabled={prorrogandoFixo}
            >
              Não, prefiro não fazer nada agora
            </button>
            <button
              type="button"
              onClick={() => void handleProrrogarFixoMensal()}
              className={formModalSubmitButtonClass}
              disabled={prorrogandoFixo || mesesProrrogarFixo < 1}
            >
              {prorrogandoFixo ? "Salvando…" : "Sim, prorrogar"}
            </button>
          </div>
        </div>
      </Dialog>
    <form
      className="flex h-full min-h-0 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        void (async () => {
          if (isCreate && showPropostaComissoesTab && comissaoBloqueiaSalvar) {
            setFormTab("comissoes");
            return;
          }
          if (showVendaComissaoTab) {
            const vdPost = await postVendaDiretaSeNecessario();
            if (!vdPost.ok) {
              setFormTab("venda_comissao");
              return;
            }
            onSave(buildPayload(vdPost.payloadOverrides));
            return;
          }
          onSave(buildPayload());
        })();
      }}
    >
      <div
        role="tablist"
        aria-label="Seções do lançamento"
        className="flex w-full shrink-0 flex-wrap border-b border-slate-300 bg-slate-50/50 dark:border-slate-600 dark:bg-slate-800/50"
      >
        {tabItems.map(({ id: tid, label, Icon }) => {
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
                  layoutId={`financeiro-lancamento-tab-${formTabId}`}
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
      <div className={formTab !== "principal" ? "hidden" : ""}>
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
                <label htmlFor="lanc-linha-proposta" className={formLabelClass}>
                  Itens da proposta no fluxo de caixa
                </label>
                <p className={formHelperTextClass}>
                  Cada opção indica se o item já está{" "}
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">Lançado</span> ou ainda{" "}
                  <span className="font-medium text-amber-700 dark:text-amber-300">Pendente</span> de vínculo com o
                  fluxo.
                </p>
                <div className="mt-2">
                  <SearchableSelect
                    triggerButtonId="lanc-linha-proposta"
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
              Entrada ou saída <span className="text-red-600 dark:text-red-400">*</span>
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
              Descrição <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <div className="relative mt-1">
              <Text className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="lanc-desc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className={formInputWithIconClass}
                placeholder="Texto que identifique este lançamento no extrato e nos relatórios (ex.: NF, mensalidade, reembolso…)"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="lanc-valor" className={formLabelClass}>
                Valor (R$) <span className="text-red-600 dark:text-red-400">*</span>
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
                Vencimento <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <div className="mt-1">
                <DateField
                  id="lanc-venc"
                  value={vencimento}
                  onChange={setVencimento}
                  placeholder="Selecione a data"
                />
              </div>
              {status !== "pago" && (
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
              )}
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

          {isCreate && vendaDiretaLeadId && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm dark:border-emerald-500/30 dark:bg-emerald-950/30">
              <p className={formSectionHeadingClass}>Venda direta (comissão)</p>
              <p className="mt-1 text-slate-700 dark:text-slate-200">
                Lead técnico registrado para comissão. Ao salvar o lançamento, o caixa fica vinculado a essa venda.
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-4">
                <Link
                  href={`/comercial?leadId=${encodeURIComponent(vendaDiretaLeadId)}`}
                  className="inline-flex font-medium text-[#6D28D9] underline hover:text-purple-800 dark:text-violet-300 dark:hover:text-violet-200"
                >
                  Abrir lead no Comercial
                </Link>
                {vendaDiretaSolucoes.length > 1 ? (
                  <div className="min-w-[min(100%,18rem)] flex-1">
                    <label htmlFor="vd-pick-sol-principal" className={formLabelClass}>
                      Solução vinculada ao caixa
                    </label>
                    <div className="mt-1">
                      <SearchableSelect
                        triggerButtonId="vd-pick-sol-principal"
                        options={vdSolucaoPickOptions}
                        value={vdLeadSolucaoPick}
                        onChange={setVdLeadSolucaoPick}
                        placeholder="Selecione a solução…"
                        searchPlaceholder="Buscar…"
                        searchable={vdSolucaoPickOptions.length > 6}
                        leadingIcon={FileText}
                      />
                    </div>
                  </div>
                ) : null}
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
      </div>





      <div className={formTab !== "pagamento" ? "hidden" : ""}>
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
                  Situação <span className="text-red-600 dark:text-red-400">*</span>
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
      </div>
      {showPropostaComissoesTab ? (
      <div className={formTab !== "comissoes" ? "hidden" : ""}>
        <div
          id={`${formTabId}-comissoes-panel`}
          role="tabpanel"
          aria-labelledby={`${formTabId}-tab-comissoes`}
          className="min-w-0 space-y-5 p-4 lg:p-6"
        >
          {leadIdComissao ? (
            <LeadComissaoParticipacaoPanel
              key={leadIdComissao}
              leadId={leadIdComissao}
              embedded
              onBloqueioSalvarLancamentoChange={isCreate ? onParticipacaoBloqueio : undefined}
            />
          ) : null}
        </div>
      </div>
      ) : null}

      {showVendaComissaoTab ? (
        <div className={formTab !== "venda_comissao" ? "hidden" : ""}>
          <div
            id={`${formTabId}-venda_comissao-panel`}
            role="tabpanel"
            aria-labelledby={`${formTabId}-tab-venda_comissao`}
            className="min-w-0 space-y-5 p-4 lg:p-6"
          >
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                Venda direta sem lead comercial
              </p>
              <p className={clsx(formHelperTextClass, "mt-1")}>
                Criar lançamento (origem Financeiro), com as mesmas regras de venda pelo Comercial.
              </p>
            </div>

            {vendaDiretaLeadId ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/30">
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                  Venda registrada para comissão
                </p>
                <p className={clsx(formHelperTextClass, "mt-1 text-emerald-900/90 dark:text-emerald-100/90")}>
                  Revise as participações na aba «Comissões». Para alterar soluções ou percentuais, cancele este
                  lançamento e inicie outro.
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Link
                    href={`/comercial?leadId=${encodeURIComponent(vendaDiretaLeadId)}`}
                    className="inline-flex text-sm font-medium text-[#6D28D9] underline hover:text-purple-800 dark:text-violet-300 dark:hover:text-violet-200"
                  >
                    Abrir lead no Comercial
                  </Link>
                </div>
                {vendaDiretaSolucoes.length > 1 ? (
                  <div className="mt-4">
                    <label htmlFor="vd-pick-sol-tab" className={formLabelClass}>
                      Solução vinculada ao caixa (várias linhas na proposta)
                    </label>
                    <div className="mt-1">
                      <SearchableSelect
                        triggerButtonId="vd-pick-sol-tab"
                        options={vdSolucaoPickOptions}
                        value={vdLeadSolucaoPick}
                        onChange={setVdLeadSolucaoPick}
                        placeholder="Selecione a solução…"
                        searchPlaceholder="Buscar…"
                        searchable={vdSolucaoPickOptions.length > 6}
                        leadingIcon={FileText}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="vd-titulo" className={formLabelClass}>
                    Título do lead (opcional)
                  </label>
                  <input
                    id="vd-titulo"
                    value={tituloVd}
                    onChange={(e) => setTituloVd(e.target.value)}
                    className={clsx(formInputClass, "mt-1")}
                    placeholder="Ex.: Contrato avulso — implantação"
                    maxLength={500}
                  />
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <label className={comercialLabelClass}>Buscar solução para adicionar</label>
                    {vdCatalogLoading ? (
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Carregando catálogo…</p>
                    ) : (
                      <SearchableSelect
                        options={vdSolAddOptions}
                        value={vdAddSelect}
                        onChange={setVdAddSelect}
                        placeholder="Selecione uma solução..."
                        searchPlaceholder="Filtrar solução..."
                        emptyLabel="Nenhuma solução disponível."
                        leadingIcon={FileText}
                      />
                    )}

                    {vdSelectedCatalogSol && vdAddSelect !== VD_PERSONALIZAR ? (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-900">
                        <div className="flex flex-wrap items-end gap-2">
                          <div className="flex w-full min-w-0 items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                            {vdSelectedCatalogSol.logoUrl?.trim() ? (
                              <img
                                src={vdSelectedCatalogSol.logoUrl.trim()}
                                alt=""
                                className="h-8 w-8 shrink-0 rounded object-contain"
                              />
                            ) : null}
                            <span className="min-w-0">{vdSelectedCatalogSol.nome}</span>
                          </div>
                          <p className="w-full text-xs text-slate-500 dark:text-slate-400">
                            Referência do catálogo: {REC_COMERCIAL_VD_LABEL[vdSelectedCatalogSol.recorrencia]}
                            {vdSelectedCatalogSol.recorrencia === "parcelado"
                              ? ` · ${vdSelectedCatalogSol.parcelasPadrao ?? 12} parcelas`
                              : ""}
                            . Ajustável após incluir na oportunidade.
                          </p>
                          <div className="min-w-0 flex-1">
                            <label className={comercialLabelClass}>Valor (R$) — apenas números</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              value={vdAddValorDisplay}
                              onChange={(e) => vdAddValorOnDigits(e.target.value)}
                              placeholder={formatCurrency(vdSelectedCatalogSol.valorVenda)}
                              className={`${comercialInputCompactClass} font-mono tabular-nums`}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <label className={comercialLabelClass}>
                              Condições de pagamento <span className="text-red-600 dark:text-red-400">*</span>
                            </label>
                            <input
                              type="text"
                              value={vdAddCondicoes}
                              onChange={(e) => setVdAddCondicoes(e.target.value)}
                              placeholder="Ex: 50% à vista, 50% em 30 dias"
                              className={comercialInputCompactClass}
                            />
                          </div>
                          <div className="mt-3 flex w-full flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={cancelarVdAdd}
                              className={formModalCancelButtonClass}
                            >
                              <span className="inline-flex items-center gap-2">
                                <X className="h-4 w-4" aria-hidden />
                                Cancelar
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={adicionarVdSolucaoCatalogo}
                              disabled={!vdAddCondicoes.trim()}
                              className="rounded-lg bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-slate-900"
                            >
                              <span className="inline-flex items-center gap-2">
                                <Plus className="h-4 w-4 shrink-0" aria-hidden />
                                Adicionar
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {vdAddSelect === VD_PERSONALIZAR ? (
                      <div className="mt-4 space-y-4">
                        <div>
                          <label htmlFor="vd-pers-nome" className={formLabelClass}>
                            Nome da solução <span className="text-red-600 dark:text-red-400">*</span>
                          </label>
                          <div className="relative mt-1">
                            <Text className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                              id="vd-pers-nome"
                              type="text"
                              value={vdPersNome}
                              onChange={(e) => setVdPersNome(e.target.value)}
                              placeholder="Como aparecerá na proposta"
                              className={formInputWithIconClass}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                          <div className="min-w-0 flex-1 sm:min-w-[12rem]">
                            <label className={formLabelClass}>Valor (R$) — apenas números</label>
                            <div className="relative mt-1">
                              <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="off"
                                value={vdAddValorDisplay}
                                onChange={(e) => vdAddValorOnDigits(e.target.value)}
                                placeholder="R$ 0,00"
                                className={`${formInputWithIconClass} font-mono tabular-nums`}
                              />
                            </div>
                          </div>
                          <div className="min-w-0 w-full shrink-0 sm:w-auto sm:min-w-[10rem]">
                              <label className={formLabelClass}>Pagamento (negociação)</label>
                              <div className="mt-1">
                                <SearchableSelect
                                  fullWidth={false}
                                  options={vdPagamentoNegociacaoOptions}
                                  value={vdPersRec}
                                  onChange={(v) => {
                                    const r = v as LeadRecorrenciaPagamento;
                                    setVdPersRec(r);
                                    if (r !== "parcelado") setVdPersParcelas(12);
                                  }}
                                  placeholder="Selecione…"
                                  searchPlaceholder="Buscar…"
                                  searchable={false}
                                  leadingIcon={Wallet}
                                />
                              </div>
                            </div>
                            {vdPersRec === "parcelado" ? (
                              <div className="w-full shrink-0 sm:w-[7.5rem]">
                                <label htmlFor="vd-pers-parcelas" className={formLabelClass}>
                                  Parcelas
                                </label>
                                <input
                                  id="vd-pers-parcelas"
                                  type="number"
                                  min={2}
                                  max={60}
                                  value={vdPersParcelas}
                                  onChange={(e) =>
                                    setVdPersParcelas(Math.min(60, Math.max(2, parseInt(e.target.value, 10) || 2)))
                                  }
                                  className={clsx(formInputClass, "mt-1 w-full")}
                                />
                              </div>
                            ) : null}
                        </div>
                        <div>
                          <label htmlFor="vd-pers-cond" className={formLabelClass}>
                            Condições de pagamento <span className="text-red-600 dark:text-red-400">*</span>
                          </label>
                          <div className="relative mt-1">
                            <Text
                              className={clsx(
                                "pointer-events-none absolute left-3 h-4 w-4 text-slate-400",
                                formTextareaLeadingIconTopClass
                              )}
                            />
                            <textarea
                              id="vd-pers-cond"
                              value={vdAddCondicoes}
                              onChange={(e) => setVdAddCondicoes(e.target.value)}
                              rows={3}
                              placeholder="Ex: 50% à vista, 50% em 30 dias"
                              className={`${formTextareaClass} min-h-[88px] resize-y pl-9`}
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2 pt-1">
                          <button type="button" onClick={cancelarVdAdd} className={formModalCancelButtonClass}>
                            <span className="inline-flex items-center gap-2">
                              <X className="h-4 w-4" aria-hidden />
                              Cancelar
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={adicionarVdSolucaoPersonalizada}
                            disabled={
                              !vdPersNome.trim() ||
                              !vdAddCondicoes.trim() ||
                              !(vdAddGetValorReais(0) > 0)
                            }
                            className={formModalSubmitButtonClass}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Plus className="h-4 w-4 shrink-0" aria-hidden />
                              Adicionar
                            </span>
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <div className="mb-2">
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Soluções vinculadas
                      </h3>
                    </div>
                    {vdSolucoes.length === 0 ? (
                      <p className="py-2 text-sm text-slate-500 dark:text-slate-400">
                        Nenhuma solução adicionada ainda.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-600 dark:border-slate-600 dark:bg-slate-900">
                        {vdSolucoes.map((s, idx) => (
                          <div key={s.key} className="px-4 py-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex min-w-0 flex-1 gap-3">
                                {s.logoUrl?.trim() ? (
                                  <img
                                    src={s.logoUrl.trim()}
                                    alt=""
                                    className="mt-0.5 h-10 w-10 shrink-0 rounded-lg border border-slate-100 bg-white object-contain dark:border-slate-600"
                                  />
                                ) : (
                                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-[10px] font-medium text-slate-400 dark:border-slate-600 dark:bg-slate-800">
                                    —
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium leading-snug text-slate-900 dark:text-slate-100">{s.nome}</p>
                                  <p className="mt-1 text-sm font-medium tabular-nums text-slate-700 dark:text-slate-200">
                                    {formatCurrency(s.valor ?? 0)}
                                  </p>
                                  {s.condicoesPagamento ? (
                                    <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                                      <span className="font-medium text-slate-500 dark:text-slate-500">
                                        Condições:{" "}
                                      </span>
                                      {s.condicoesPagamento}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setVdSolucoes((list) => list.filter((_, i) => i !== idx))}
                                className="shrink-0 self-start rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                                aria-label="Remover solução"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="mt-4 flex flex-col gap-3 sm:mt-3 sm:flex-row sm:items-end">
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                  Pagamento (negociação)
                                </span>
                                <SearchableSelect
                                  fullWidth={false}
                                  options={vdPagamentoNegociacaoOptions}
                                  value={s.recorrenciaPagamento ?? "unica"}
                                  onChange={(v) => {
                                    const r = v as LeadRecorrenciaPagamento;
                                    patchVdSolucao(idx, {
                                      recorrenciaPagamento: r,
                                      parcelas: r === "parcelado" ? Math.max(2, s.parcelas ?? 12) : null,
                                    });
                                  }}
                                  placeholder="Selecione…"
                                  searchPlaceholder="Buscar…"
                                  searchable={false}
                                  leadingIcon={Wallet}
                                />
                              </div>
                              {(s.recorrenciaPagamento ?? "unica") === "parcelado" && (
                                <div className="w-full shrink-0 sm:w-[7.5rem]">
                                  <label className={comercialLabelClass}>Parcelas</label>
                                  <input
                                    type="number"
                                    min={2}
                                    max={60}
                                    value={Math.max(2, s.parcelas ?? 12)}
                                    onChange={(e) =>
                                      patchVdSolucao(idx, {
                                        parcelas: Math.min(
                                          60,
                                          Math.max(2, parseInt(e.target.value, 10) || 2)
                                        ),
                                      })
                                    }
                                    className={`${comercialInputCompactClass} w-full`}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {vdValorTotalSolucoes > 0 && (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-600">
                        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Total da oportunidade
                        </span>
                        <span className="text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                          {formatCurrency(vdValorTotalSolucoes)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Consultor e Comissão</h3>
                    <button
                      type="button"
                      onClick={() =>
                        setVdPartRows((rows) => [...rows, { key: newVdRowKey(), consultorId: "", percentStr: "" }])
                      }
                      className={clsx(formModalCancelButtonClass, "inline-flex shrink-0 items-center gap-2")}
                    >
                      <Plus className="h-4 w-4 shrink-0" aria-hidden />
                      Consultor
                    </button>
                  </div>
                  <div className="mt-3 space-y-3">
                    {vdPartRows.map((row) => (
                      <div key={row.key} className="flex flex-wrap items-end gap-2">
                        <div className="min-w-[min(100%,14rem)] flex-1">
                          <SearchableSelect
                            options={vdConsultorOptions}
                            value={row.consultorId}
                            onChange={(v) =>
                              setVdPartRows((rows) =>
                                rows.map((r) => (r.key === row.key ? { ...r, consultorId: v } : r))
                              )
                            }
                            placeholder="Consultor…"
                            searchPlaceholder="Buscar…"
                            leadingIcon={UserRound}
                          />
                        </div>
                        <div className="w-[5.75rem] shrink-0">
                          <label htmlFor={`vd-pct-${row.key}`} className="sr-only">
                            Percentual
                          </label>
                          <div className="relative mt-1">
                            <input
                              id={`vd-pct-${row.key}`}
                              value={row.percentStr}
                              onChange={(e) =>
                                setVdPartRows((rows) =>
                                  rows.map((r) => (r.key === row.key ? { ...r, percentStr: e.target.value } : r))
                                )
                              }
                              className={clsx(formInputCompactClass, "w-full pr-7 text-right tabular-nums")}
                              inputMode="decimal"
                              autoComplete="off"
                            />
                            <span
                              className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-sm text-slate-500 dark:text-slate-400"
                              aria-hidden
                            >
                              %
                            </span>
                          </div>
                        </div>
                        {vdPartRows.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => setVdPartRows((rows) => rows.filter((r) => r.key !== row.key))}
                            className="mb-0.5 inline-flex rounded p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                            aria-label="Remover consultor"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                {vdError ? (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-100">
                    {vdError}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}

      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 lg:px-6">
        {isCreate && showPropostaComissoesTab && comissaoBloqueiaSalvar && comissaoBloqueioMotivo ? (
          <p className="text-center text-xs text-amber-800 dark:text-amber-200 sm:text-left">{comissaoBloqueioMotivo}</p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <button
          type="button"
          onClick={onCancel}
          className={formModalCancelButtonClass}
        >
          <span className="inline-flex items-center gap-2">
            <X className="h-4 w-4 shrink-0" aria-hidden />
            Cancelar
          </span>
        </button>
        <button
          type="submit"
          disabled={(isCreate && showPropostaComissoesTab && comissaoBloqueiaSalvar) || vdSubmitting}
          title={
            isCreate && showPropostaComissoesTab && comissaoBloqueiaSalvar && comissaoBloqueioMotivo
              ? comissaoBloqueioMotivo
              : undefined
          }
          className={clsx(
            formModalSubmitButtonClass,
            ((isCreate && showPropostaComissoesTab && comissaoBloqueiaSalvar) || vdSubmitting) &&
              "cursor-not-allowed opacity-60"
          )}
        >
          <span className="inline-flex items-center gap-2">
            <Save className="h-4 w-4 shrink-0" aria-hidden />
            {vdSubmitting ? "Salvando…" : "Salvar"}
          </span>
        </button>
        </div>
      </div>
    </form>
    </>
  );
}
