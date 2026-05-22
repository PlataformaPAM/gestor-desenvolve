"use client";

import { useState, useMemo, useEffect, useCallback, useId, type ComponentType } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import clsx from "clsx";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
  GitCompareArrows,
  Telescope,
  SlidersHorizontal,
  CheckCircle2,
  BadgePercent,
  XCircle,
  Unlock,
  ShieldOff,
  RotateCcw,
  ScrollText,
  RefreshCw,
  Search,
  Calendar,
  CalendarCheck2,
  ListFilter,
  Users,
  UserRound,
  Building2,
  Landmark,
  Tag,
  Clock,
} from "lucide-react";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import { LancamentosTable } from "@/components/financeiro/lancamentos-table";
import { LancamentoForm, DEFAULT_NEW_LANCAMENTO } from "@/components/financeiro/lancamento-form";
import { FinanceiroConfigDrawer } from "@/components/financeiro/financeiro-config-drawer";
import { Toast } from "@/components/ui/toast";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { ClientePerfil360 } from "@/components/clientes/cliente-perfil-360";
import { usePageHeader } from "@/contexts/page-header-context";
import type {
  ConsultorComissaoSlim,
  FinanceiroCategoria,
  FinanceiroConta,
  FinanceiroMeioPagamento,
  FornecedorRhSlim,
  Lancamento,
} from "@/lib/financeiro/types";
import type { Cliente } from "@/lib/clientes/types";
import { formatCurrency } from "@/lib/clientes/utils";
import { calcularCaixaAtual, calcularPrevisaoPeriodo } from "@/lib/financeiro/caixa";
import { useAuth } from "@/contexts/auth-context";
import { useFinanceiroLancamentosRbac, useFinanceiroPageGuard } from "@/hooks/use-rbac-resource";
import {
  canViewFinanceiroAprovacoes,
  canViewFinanceiroComissoes,
  canViewFinanceiroExtrato,
  canViewFinanceiroLancamentos,
  hasAnyFinanceiroSubmodule,
} from "@/lib/financeiro/financeiro-nav";
import type { AprovacaoPendente, UnlockRequest } from "@/app/api/financeiro/_shared";
import { recorrenciaComercialParaFinanceiro } from "@/lib/comercial/recorrencia-financeiro";
import { LANCAMENTO_FIXO_MENSAL_PROJECAO_MESES } from "@/lib/financeiro/constants";
import {
  dedupeLancamentosPorId,
  descricaoParaExibicao,
  linhaLancamentoComAlertaVisual,
  normalizeTextoAlertaMatch,
  parseValorReaisDeTexto,
  statusFinanceiroEfetivo,
} from "@/lib/financeiro/lancamento-utils";
import {
  appendFixoMensalLinhas,
  buildPayloadsForRecurrenceScope,
  getGroupMembers,
  getRecurrenceRootId,
  hasLancamentoEdicaoDiff,
  isRecorrenciaPagamento,
} from "@/lib/financeiro/recurrence-save";
import { emitAlertsUpdated, subscribeAlertsUpdated } from "@/lib/alerts/live-sync";
import { RecurrenceScopeDialog } from "@/components/financeiro/recurrence-scope-dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { SearchableOption } from "@/components/ui/searchable-select";

type TabId = "entradas" | "saidas" | "fluxo";
type PeriodoId = "mes_atual" | "mes_passado" | "personalizado";
function getMonthRange(periodo: PeriodoId, customYear?: number, customMonth?: number): { start: Date; end: Date } {
  const now = new Date();
  let start: Date;
  let end: Date;
  if (periodo === "mes_atual") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (periodo === "mes_passado") {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0);
  } else {
    const y = customYear ?? now.getFullYear();
    const m = customMonth ?? now.getMonth();
    start = new Date(y, m, 1);
    end = new Date(y, m + 1, 0);
  }
  return { start, end };
}

function isInRange(isoDate: string, start: Date, end: Date): boolean {
  const d = new Date(isoDate);
  d.setHours(0, 0, 0, 0);
  const s = new Date(start);
  s.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(23, 59, 59, 999);
  return d >= s && d <= e;
}

function normalizeText(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Recebimento criado a partir da aprovação do Comercial (ou parcela ligada a esse grupo). */
function lancamentoTemVinculoFechamento(l: Lancamento, todos: Lancamento[]): boolean {
  if (l.leadIdOrigem) return true;
  if (!l.idPai) return false;
  const pai = todos.find((x) => x.id === l.idPai);
  return !!pai?.leadIdOrigem;
}

export default function FinanceiroPage() {
  const { setPrimaryAction, setSecondaryAction } = usePageHeader();
  const tabListId = useId();
  const { session } = useAuth();
  const currentUserName = session.userName ?? "Financeiro";
  const { podeCriar: podeCriarLancamento, podeEditar: podeEditarLancamento, podeExcluir: podeExcluirLancamento } =
    useFinanceiroLancamentosRbac();
  const podeVerFinanceiro = useFinanceiroPageGuard();
  const podeLancamentos = canViewFinanceiroLancamentos(session);
  const podeAprovacoes = canViewFinanceiroAprovacoes(session);
  const podeComissoes = canViewFinanceiroComissoes(session);
  const podeExtrato = canViewFinanceiroExtrato(session);
  const [tab, setTab] = useState<TabId>("fluxo");
  const [periodo, setPeriodo] = useState<PeriodoId>("mes_atual");
  const [customYear, setCustomYear] = useState(new Date().getFullYear());
  const [customMonth, setCustomMonth] = useState(new Date().getMonth());
  const [filtroBusca, setFiltroBusca] = useState("");
  const [filtroParte, setFiltroParte] = useState<"todos" | "cliente" | "fornecedor">("todos");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | Lancamento["status"]>("todos");
  const [filtroConta, setFiltroConta] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [fornecedoresRh, setFornecedoresRh] = useState<FornecedorRhSlim[]>([]);
  const [contas, setContas] = useState<FinanceiroConta[]>([]);
  const [categorias, setCategorias] = useState<FinanceiroCategoria[]>([]);
  const [meiosPagamento, setMeiosPagamento] = useState<FinanceiroMeioPagamento[]>([]);
  const [consultoresComissaoRh, setConsultoresComissaoRh] = useState<ConsultorComissaoSlim[]>([]);
  const [drawerConfigOpen, setDrawerConfigOpen] = useState(false);
  const [drawerNovoOpen, setDrawerNovoOpen] = useState(false);
  const [drawerEditarOpen, setDrawerEditarOpen] = useState(false);
  const [lancamentoEmEdicao, setLancamentoEmEdicao] = useState<Lancamento | null>(null);
  const [cliente360, setCliente360] = useState<Cliente | null>(null);
  const [perfil360Open, setPerfil360Open] = useState(false);
  const [aprovacoesPendentes, setAprovacoesPendentes] = useState<AprovacaoPendente[]>([]);
  const [unlockRequests, setUnlockRequests] = useState<UnlockRequest[]>([]);
  const [motivosRecusa, setMotivosRecusa] = useState<Record<string, string>>({});
  const [recusaModalLeadId, setRecusaModalLeadId] = useState<string | null>(null);
  const [motivosNegarUnlock, setMotivosNegarUnlock] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [pendingLancamentoAction, setPendingLancamentoAction] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ visible: boolean; message: string; variant: "success" | "error" }>({
    visible: false,
    message: "",
    variant: "success",
  });
  const [aprovacaoParaLancar, setAprovacaoParaLancar] = useState<AprovacaoPendente | null>(null);
  const [aprovacaoLinhaSolucaoId, setAprovacaoLinhaSolucaoId] = useState<string | null>(null);
  const [aprovacaoFormEpoch, setAprovacaoFormEpoch] = useState(0);
  const [lancamentoParaExcluir, setLancamentoParaExcluir] = useState<Lancamento | null>(null);
  const [pendingByLancamentoId, setPendingByLancamentoId] = useState<Record<string, number>>({});
  const [origemContratoIdEdit, setOrigemContratoIdEdit] = useState<string | null>(null);
  const [recurrenceScopeOpen, setRecurrenceScopeOpen] = useState(false);
  const [pendingRecurrence, setPendingRecurrence] = useState<{ initial: Lancamento; edited: Lancamento } | null>(
    null
  );
  const [recurrenceSaving, setRecurrenceSaving] = useState(false);

  const showToast = useCallback((message: string, variant: "success" | "error") => {
    setToast({ visible: true, message, variant });
  }, []);

  useEffect(() => {
    if (podeLancamentos && podeCriarLancamento) {
      setSecondaryAction({
        ariaLabel: "Configurações do Financeiro — contas, categorias e meios de pagamento",
        onClick: () => setDrawerConfigOpen(true),
      });
      setPrimaryAction({
        label: "Novo Lançamento",
        onClick: () => setDrawerNovoOpen(true),
        showPlusIcon: true,
      });
    } else {
      setSecondaryAction(podeLancamentos ? {
        ariaLabel: "Configurações do Financeiro — contas, categorias e meios de pagamento",
        onClick: () => setDrawerConfigOpen(true),
      } : null);
      setPrimaryAction(null);
    }
    return () => {
      setSecondaryAction(null);
      setPrimaryAction(null);
    };
  }, [setPrimaryAction, setSecondaryAction, podeLancamentos, podeCriarLancamento]);

  const aplicarPayloadBootstrap = useCallback(
    (data: {
      lancamentos?: Lancamento[];
      clientes?: Cliente[];
      fornecedoresRh?: FornecedorRhSlim[];
      contas?: FinanceiroConta[];
      categorias?: FinanceiroCategoria[];
      meiosPagamento?: FinanceiroMeioPagamento[];
      aprovacoesPendentes?: AprovacaoPendente[];
      unlockRequests?: UnlockRequest[];
      consultoresComissaoRh?: ConsultorComissaoSlim[];
    }) => {
      setLancamentos(dedupeLancamentosPorId(data.lancamentos ?? []));
      setClientes(data.clientes ?? []);
      setFornecedoresRh(data.fornecedoresRh ?? []);
      setContas(data.contas ?? []);
      setCategorias(data.categorias ?? []);
      setMeiosPagamento(data.meiosPagamento ?? []);
      setAprovacoesPendentes(data.aprovacoesPendentes ?? []);
      setUnlockRequests(data.unlockRequests ?? []);
      setConsultoresComissaoRh(data.consultoresComissaoRh ?? []);
    },
    []
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/financeiro/bootstrap", { cache: "no-store" });
        if (!res.ok) return;
        const json = await parseJsonSafe<{
          data?: {
            lancamentos?: Lancamento[];
            clientes?: Cliente[];
            fornecedoresRh?: FornecedorRhSlim[];
            contas?: FinanceiroConta[];
            categorias?: FinanceiroCategoria[];
            meiosPagamento?: FinanceiroMeioPagamento[];
            aprovacoesPendentes?: AprovacaoPendente[];
            unlockRequests?: UnlockRequest[];
            consultoresComissaoRh?: ConsultorComissaoSlim[];
          };
        }>(res);
        if (!active) return;
        aplicarPayloadBootstrap(json?.data ?? {});
      } catch {
        // No-op
      }
    };
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [aplicarPayloadBootstrap]);

  const defaultContaId = useMemo(
    () => contas.find((c) => c.padrao && c.ativo)?.id ?? contas.find((c) => c.ativo)?.id ?? "",
    [contas]
  );
  const lancamentoInicialAprovacao = useMemo<Lancamento>(() => {
    if (!aprovacaoParaLancar) return DEFAULT_NEW_LANCAMENTO;
    const sel =
      aprovacaoParaLancar.solucoes.find((s) => s.leadSolucaoId === (aprovacaoLinhaSolucaoId ?? "")) ??
      aprovacaoParaLancar.solucoes[0];
    const tipoRec = recorrenciaComercialParaFinanceiro(sel?.recorrenciaPagamento ?? undefined);
    const parcelasFin =
      tipoRec === "parcelado"
        ? Math.max(2, sel?.parcelas ?? 12)
        : tipoRec === "fixo_mensal"
          ? LANCAMENTO_FIXO_MENSAL_PROJECAO_MESES
          : undefined;
    return {
      ...DEFAULT_NEW_LANCAMENTO,
      tipo: "entrada",
      descricao: sel
        ? `${sel.nome} — ${aprovacaoParaLancar.leadNome}`
        : aprovacaoParaLancar.leadNome,
      clienteId: aprovacaoParaLancar.clienteId,
      valor: sel?.valor ?? aprovacaoParaLancar.valorTotal,
      contaId: defaultContaId || undefined,
      leadIdOrigem: aprovacaoParaLancar.leadId,
      leadSolucaoId: sel?.leadSolucaoId,
      tipoRecorrencia: tipoRec,
      parcelas: parcelasFin,
      condicoesPagamento: sel?.condicoesPagamento,
    };
  }, [aprovacaoParaLancar, aprovacaoLinhaSolucaoId, defaultContaId]);

  const recarregarBootstrapManual = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/financeiro/bootstrap", { cache: "no-store" });
      if (!res.ok) {
        showToast("Não foi possível atualizar os dados do Financeiro.", "error");
        return;
      }
      const json = await parseJsonSafe<{
        data?: {
          lancamentos?: Lancamento[];
          clientes?: Cliente[];
          fornecedoresRh?: FornecedorRhSlim[];
          contas?: FinanceiroConta[];
          categorias?: FinanceiroCategoria[];
          meiosPagamento?: FinanceiroMeioPagamento[];
          aprovacoesPendentes?: AprovacaoPendente[];
          unlockRequests?: UnlockRequest[];
          consultoresComissaoRh?: ConsultorComissaoSlim[];
        };
      }>(res);
      aplicarPayloadBootstrap(json?.data ?? {});
      showToast("Dados do Financeiro atualizados.", "success");
    } catch {
      showToast("Não foi possível atualizar os dados do Financeiro.", "error");
    } finally {
      setRefreshing(false);
    }
  }, [aplicarPayloadBootstrap, showToast]);

  const refetchBootstrapSilencioso = useCallback(async () => {
    try {
      const res = await fetch("/api/financeiro/bootstrap", { cache: "no-store" });
      if (!res.ok) return;
      const json = await parseJsonSafe<{
        data?: {
          lancamentos?: Lancamento[];
          clientes?: Cliente[];
          fornecedoresRh?: FornecedorRhSlim[];
          contas?: FinanceiroConta[];
          categorias?: FinanceiroCategoria[];
          meiosPagamento?: FinanceiroMeioPagamento[];
          aprovacoesPendentes?: AprovacaoPendente[];
          unlockRequests?: UnlockRequest[];
          consultoresComissaoRh?: ConsultorComissaoSlim[];
        };
      }>(res);
      aplicarPayloadBootstrap(json?.data ?? {});
    } catch {
      // noop
    }
  }, [aplicarPayloadBootstrap]);

  const limparFiltros = useCallback(() => {
    setFiltroBusca("");
    setFiltroParte("todos");
    setFiltroStatus("todos");
    setPeriodo("mes_atual");
    setFiltroConta("todos");
    setFiltroCategoria("todos");
    setCustomYear(new Date().getFullYear());
    setCustomMonth(new Date().getMonth());
  }, []);

  const aceitarLeadComercial = (leadId: string) => {
    const item = aprovacoesPendentes.find((x) => x.leadId === leadId);
    if (!item) return;
    const covered = new Set(
      lancamentos
        .filter((l) => l.leadIdOrigem === leadId && l.leadSolucaoId)
        .map((l) => l.leadSolucaoId as string)
    );
    const next = item.solucoes.find((s) => !covered.has(s.leadSolucaoId)) ?? item.solucoes[0];
    setAprovacaoLinhaSolucaoId(next?.leadSolucaoId ?? null);
    setAprovacaoFormEpoch((e) => e + 1);
    setAprovacaoParaLancar(item);
    setDrawerNovoOpen(true);
    showToast("Preencha o lançamento e salve para concluir a aprovação financeira.", "success");
  };

  const recusarLeadComercial = (leadId: string) => {
    const motivo = (motivosRecusa[leadId] ?? "").trim();
    if (!motivo) {
      showToast("Informe o motivo da recusa.", "error");
      return;
    }
    void (async () => {
      const res = await fetch(`/api/financeiro/aprovacoes/${leadId}/recusar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo, userName: currentUserName }),
      });
      if (!res.ok) {
        showToast("Não foi possível recusar a aprovação.", "error");
        return;
      }
      setAprovacoesPendentes((prev) => prev.filter((x) => x.leadId !== leadId));
      setRecusaModalLeadId((curr) => (curr === leadId ? null : curr));
      showToast("Aprovação recusada e devolvida ao Comercial.", "success");
      emitAlertsUpdated();
    })();
  };

  const { start, end } = useMemo(
    () => getMonthRange(periodo, customYear, customMonth),
    [periodo, customYear, customMonth]
  );

  const mesFocoLabel = useMemo(() => {
    const { start: s } = getMonthRange(periodo, customYear, customMonth);
    const raw = s.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
    const cleaned = raw.replace(/\.$/, "");
    return cleaned.length ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : cleaned;
  }, [periodo, customYear, customMonth]);

  const goMonthDelta = useCallback(
    (delta: number) => {
      const { start: anchor } = getMonthRange(periodo, customYear, customMonth);
      const d = new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1);
      setPeriodo("personalizado");
      setCustomYear(d.getFullYear());
      setCustomMonth(d.getMonth());
    },
    [periodo, customYear, customMonth]
  );

  const goMesAtualCalendario = useCallback(() => {
    const n = new Date();
    setPeriodo("mes_atual");
    setCustomYear(n.getFullYear());
    setCustomMonth(n.getMonth());
  }, []);

  const financeiroStatusFilterOptions = useMemo<SearchableOption[]>(
    () => [
      { value: "todos", label: "Status", icon: ListFilter, iconClassName: "text-[#6D28D9]" },
      { value: "pendente", label: "Pendente", icon: Clock, iconClassName: "text-amber-600 dark:text-amber-400" },
      {
        value: "atrasado",
        label: "Atrasado",
        icon: AlertTriangle,
        iconClassName: "text-orange-600 dark:text-orange-400",
      },
      { value: "pago", label: "Pago", icon: CheckCircle2, iconClassName: "text-emerald-600 dark:text-emerald-400" },
    ],
    []
  );

  const financeiroParteFilterOptions = useMemo<SearchableOption[]>(
    () => [
      { value: "todos", label: "Todos", icon: Users, iconClassName: "text-slate-500 dark:text-slate-400" },
      { value: "cliente", label: "Cliente", icon: UserRound, iconClassName: "text-sky-600 dark:text-sky-400" },
      {
        value: "fornecedor",
        label: "Fornecedor",
        icon: Building2,
        iconClassName: "text-violet-600 dark:text-violet-400",
      },
    ],
    []
  );

  const financeiroContaFilterOptions = useMemo<SearchableOption[]>(() => {
    const base: SearchableOption[] = [
      { value: "todos", label: "Todas as contas", icon: Landmark, iconClassName: "text-[#6D28D9]" },
    ];
    const rows = contas
      .filter((c) => c.ativo)
      .sort((a, b) => a.ordem - b.ordem)
      .map((c) => ({
        value: c.id,
        label: c.nome,
        icon: Wallet,
        iconClassName: "text-slate-600 dark:text-slate-300",
      }));
    return [...base, ...rows];
  }, [contas]);

  const financeiroCategoriaFilterOptions = useMemo<SearchableOption[]>(() => {
    const base: SearchableOption[] = [
      { value: "todos", label: "Todas as categorias", icon: Tag, iconClassName: "text-[#6D28D9]" },
    ];
    const rows = categorias
      .filter((c) => c.ativo)
      .sort((a, b) => a.ordem - b.ordem)
      .map((c) => ({
        value: c.id,
        label: c.nome,
        icon: Tag,
        iconClassName: "text-slate-600 dark:text-slate-300",
      }));
    return [...base, ...rows];
  }, [categorias]);

  const lancamentosNoPeriodo = useMemo(() => {
    return lancamentos.filter((l) => isInRange(l.vencimento, start, end));
  }, [lancamentos, start, end]);

  /** Período selecionado + lançamentos vencidos (não pagos) com vencimento antes de hoje, ainda fora do período. */
  const lancamentosParaTabela = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const ids = new Set(lancamentosNoPeriodo.map((l) => l.id));
    const vencidosFora = lancamentos.filter((l) => {
      if (l.status === "pago") return false;
      if (ids.has(l.id)) return false;
      const v = new Date(l.vencimento);
      v.setHours(0, 0, 0, 0);
      return v < hoje;
    });
    return [...lancamentosNoPeriodo, ...vencidosFora];
  }, [lancamentos, lancamentosNoPeriodo]);

  const lancamentosFiltrados = useMemo(() => {
    const busca = normalizeText(filtroBusca);
    const clientesById = new Map(clientes.map((c) => [c.id, c] as const));
    const fornecedorCpfByNome = new Map(
      fornecedoresRh.map((f) => [normalizeText(f.nome), f.cpfCnpj ?? ""] as const)
    );

    return lancamentosParaTabela.filter((l) => {
      if (filtroParte === "cliente" && l.tipo !== "entrada") return false;
      if (filtroParte === "fornecedor" && l.tipo !== "saida") return false;
      if (filtroStatus !== "todos" && statusFinanceiroEfetivo(l) !== filtroStatus) return false;
      if (filtroConta !== "todos" && (l.contaId ?? "") !== filtroConta) return false;
      if (filtroCategoria !== "todos" && (l.categoriaId ?? "") !== filtroCategoria) return false;
      if (!busca) return true;

      const cliente = l.clienteId ? clientesById.get(l.clienteId) : null;
      const fornecedorCpf = l.fornecedor ? fornecedorCpfByNome.get(normalizeText(l.fornecedor)) ?? "" : "";
      const textoIndexado = normalizeText(
        [
          l.descricao,
          cliente?.nome ?? "",
          cliente?.empresa ?? "",
          cliente?.cpfCnpj ?? "",
          l.fornecedor ?? "",
          fornecedorCpf,
        ].join(" ")
      );
      return textoIndexado.includes(busca);
    });
  }, [
    clientes,
    filtroBusca,
    filtroCategoria,
    filtroConta,
    filtroParte,
    filtroStatus,
    fornecedoresRh,
    lancamentosParaTabela,
  ]);

  const contagemAlertaPorTab = useMemo(() => {
    const ok = (l: Lancamento) => linhaLancamentoComAlertaVisual(l, pendingByLancamentoId, lancamentos);
    return {
      fluxo: lancamentosFiltrados.filter(ok).length,
      entradas: lancamentosFiltrados.filter((l) => l.tipo === "entrada" && ok(l)).length,
      saidas: lancamentosFiltrados.filter((l) => l.tipo === "saida" && ok(l)).length,
    } satisfies Record<TabId, number>;
  }, [lancamentosFiltrados, pendingByLancamentoId, lancamentos]);

  const lancamentosPorTab = useMemo(() => {
    const base =
      tab === "entradas"
        ? lancamentosFiltrados.filter((l) => l.tipo === "entrada")
        : tab === "saidas"
          ? lancamentosFiltrados.filter((l) => l.tipo === "saida")
          : [...lancamentosFiltrados];
    return [...base].sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime());
  }, [tab, lancamentosFiltrados]);

  const caixaAtual = useMemo(
    () => calcularCaixaAtual(lancamentos, contas),
    [lancamentos, contas]
  );

  const previsaoFimPeriodo = useMemo(
    () => calcularPrevisaoPeriodo(caixaAtual, lancamentosNoPeriodo),
    [caixaAtual, lancamentosNoPeriodo]
  );

  const resumoOperacional = useMemo(() => {
    const pagos = lancamentosNoPeriodo.filter((l) => l.status === "pago");
    const atrasados = lancamentosNoPeriodo.filter((l) => l.status === "atrasado");
    return {
      pagosQtd: pagos.length,
      pagosValor: pagos.reduce((s, l) => s + l.valor, 0),
      atrasadosQtd: atrasados.length,
      atrasadosValor: atrasados.reduce((s, l) => s + l.valor, 0),
    };
  }, [lancamentosNoPeriodo]);

  const entradasSaidasMes = useMemo(() => {
    const entradasTotal = lancamentosNoPeriodo.filter((l) => l.tipo === "entrada").reduce((s, l) => s + l.valor, 0);
    const entradasPagas = lancamentosNoPeriodo
      .filter((l) => l.tipo === "entrada" && l.status === "pago")
      .reduce((s, l) => s + l.valor, 0);
    const saidasTotal = lancamentosNoPeriodo.filter((l) => l.tipo === "saida").reduce((s, l) => s + l.valor, 0);
    const saidasPagas = lancamentosNoPeriodo
      .filter((l) => l.tipo === "saida" && l.status === "pago")
      .reduce((s, l) => s + l.valor, 0);
    return {
      entradasTotal,
      entradasPagas,
      entradasAberto: Math.max(0, entradasTotal - entradasPagas),
      saidasTotal,
      saidasPagas,
      saidasAberto: Math.max(0, saidasTotal - saidasPagas),
    };
  }, [lancamentosNoPeriodo]);

  const comparativoMensalData = useMemo(
    () => [
      { name: "Entradas", total: entradasSaidasMes.entradasTotal, pago: entradasSaidasMes.entradasPagas },
      { name: "Saídas", total: entradasSaidasMes.saidasTotal, pago: entradasSaidasMes.saidasPagas },
    ],
    [entradasSaidasMes]
  );

  const projecaoDiariaData = useMemo(() => {
    const byDay = new Map<string, { dia: string; entradas: number; saidas: number }>();
    lancamentosNoPeriodo.forEach((l) => {
      const key = l.vencimento;
      const curr = byDay.get(key) ?? { dia: formatShortDate(key), entradas: 0, saidas: 0 };
      if (l.tipo === "entrada") curr.entradas += l.valor;
      else curr.saidas += l.valor;
      byDay.set(key, curr);
    });
    return [...byDay.entries()]
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([, row]) => ({ ...row, saldo: row.entradas - row.saidas }))
      .slice(0, 12);
  }, [lancamentosNoPeriodo]);

  const clientesMap = useMemo(() => {
    const m = new Map<string, Cliente>();
    clientes.forEach((c) => m.set(c.id, c));
    return m;
  }, [clientes]);

  useEffect(() => {
    let active = true;
    const loadFinanceiroAlertMarkers = async () => {
      try {
        const res = await fetch("/api/alertas/bootstrap", { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as {
          data?: {
            alertas?: Array<{ id: string; titulo: string; descricao: string; modulo: string; lida: boolean }>;
          };
        };
        if (!active) return;
        const all = payload?.data?.alertas ?? [];
        const rows = all.filter((a) => a.modulo === "financeiro" && !a.lida);

        const next: Record<string, number> = {};

        for (const a of rows) {
          const txt = normalizeTextoAlertaMatch(`${a.titulo} ${a.descricao}`);
          let hit = false;

          for (const l of lancamentos) {
            const d = normalizeTextoAlertaMatch(descricaoParaExibicao(l.descricao));
            if (d.length >= 4 && txt.includes(d)) {
              next[l.id] = (next[l.id] ?? 0) + 1;
              hit = true;
            }
          }

          if (!hit) {
            const valAlert = parseValorReaisDeTexto(`${a.titulo} ${a.descricao}`);
            if (valAlert != null) {
              for (const l of lancamentos) {
                if (Math.abs(l.valor - valAlert) < 0.015) {
                  next[l.id] = (next[l.id] ?? 0) + 1;
                  hit = true;
                  break;
                }
              }
            }
          }
        }

        setPendingByLancamentoId(next);
      } catch {
        // noop
      }
    };
    void loadFinanceiroAlertMarkers();
    const unsub = subscribeAlertsUpdated(() => {
      void loadFinanceiroAlertMarkers();
    });
    const timer = window.setInterval(() => void loadFinanceiroAlertMarkers(), 30000);
    return () => {
      active = false;
      unsub();
      window.clearInterval(timer);
    };
  }, [lancamentos]);

  const openCliente360 = (cliente: Cliente) => {
    setCliente360(cliente);
    setPerfil360Open(true);
  };

  const closePerfil360 = () => {
    setPerfil360Open(false);
    setCliente360(null);
  };

  const abrirEdicaoLancamento = (lancamento: Lancamento) => {
    if (!podeEditarLancamento) return;
    setLancamentoEmEdicao(lancamento);
    setDrawerEditarOpen(true);
  };

  const salvarEdicaoLancamentosLista = useCallback(
    async (payloads: Lancamento[]) => {
      if (payloads.length === 0) return;
      setRecurrenceSaving(true);
      try {
        for (const payload of payloads) {
          const res = await fetch(`/api/financeiro/lancamentos/${payload.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lancamento: payload }),
          });
          const json = await parseJsonSafe<{ success?: boolean; data?: { lancamento?: Lancamento } }>(res);
          if (!res.ok || !json?.success || !json.data?.lancamento) {
            throw new Error("save");
          }
        }
        await refetchBootstrapSilencioso();
        setDrawerEditarOpen(false);
        setLancamentoEmEdicao(null);
        showToast(
          payloads.length > 1
            ? `${payloads.length} lançamentos atualizados com sucesso.`
            : "Lançamento atualizado com sucesso.",
          "success"
        );
        emitAlertsUpdated();
      } catch {
        await refetchBootstrapSilencioso();
        showToast("Não foi possível salvar as alterações.", "error");
      } finally {
        setRecurrenceSaving(false);
      }
    },
    [refetchBootstrapSilencioso, showToast]
  );

  const iniciarSalvarEdicao = useCallback(
    (edited: Lancamento) => {
      if (!lancamentoEmEdicao) return;
      const initial = lancamentoEmEdicao;
      if (isRecorrenciaPagamento(initial) && hasLancamentoEdicaoDiff(initial, edited)) {
        setPendingRecurrence({ initial, edited });
        setRecurrenceScopeOpen(true);
        return;
      }
      void salvarEdicaoLancamentosLista([edited]);
    },
    [lancamentoEmEdicao, salvarEdicaoLancamentosLista]
  );

  const recorrenciaGrupoEdicao = useMemo(() => {
    if (!lancamentoEmEdicao || lancamentoEmEdicao.tipoRecorrencia !== "fixo_mensal") return undefined;
    const rootId = getRecurrenceRootId(lancamentoEmEdicao);
    return getGroupMembers(rootId, lancamentos);
  }, [lancamentoEmEdicao, lancamentos]);

  const prorrogarFixoMensal = useCallback(
    async (meses: number): Promise<boolean> => {
      if (!lancamentoEmEdicao) {
        showToast("Não foi possível prorrogar a recorrência.", "error");
        return false;
      }
      const root = getRecurrenceRootId(lancamentoEmEdicao);
      const novos = appendFixoMensalLinhas(root, meses, lancamentos);
      if (novos.length === 0) {
        showToast("Informe pelo menos 1 mês para prorrogar.", "error");
        return false;
      }
      try {
        const res = await fetch("/api/financeiro/lancamentos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lancamentos: novos }),
        });
        const json = await parseJsonSafe<{ success?: boolean }>(res);
        if (!res.ok || !json?.success) {
          showToast("Não foi possível prorrogar a recorrência.", "error");
          return false;
        }
        await refetchBootstrapSilencioso();
        showToast(`${novos.length} competência(ns) adicionada(s) à recorrência fixa mensal.`, "success");
        return true;
      } catch {
        showToast("Não foi possível prorrogar a recorrência.", "error");
        return false;
      }
    },
    [lancamentoEmEdicao, lancamentos, refetchBootstrapSilencioso, showToast]
  );

  useEffect(() => {
    const lid = lancamentoEmEdicao?.leadIdOrigem?.trim();
    if (!lid) {
      setOrigemContratoIdEdit(null);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const res = await fetch(`/api/contratos/by-lead/${encodeURIComponent(lid)}`, { cache: "no-store" });
        if (!res.ok) {
          if (active) setOrigemContratoIdEdit(null);
          return;
        }
        const json = await parseJsonSafe<{ data?: { contratoId?: string | null } }>(res);
        if (!active) return;
        setOrigemContratoIdEdit(json?.data?.contratoId ?? null);
      } catch {
        if (active) setOrigemContratoIdEdit(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [lancamentoEmEdicao?.leadIdOrigem]);

  const solicitarExclusaoLancamento = useCallback((l: Lancamento) => {
    if (!podeExcluirLancamento || pendingLancamentoAction[l.id]) return;
    setLancamentoParaExcluir(l);
  }, [pendingLancamentoAction, podeExcluirLancamento]);

  const executarExclusaoLancamento = useCallback(
    async (l: Lancamento) => {
      if (pendingLancamentoAction[l.id]) return;
      setPendingLancamentoAction((prev) => ({ ...prev, [l.id]: true }));
      const res = await fetch(`/api/financeiro/lancamentos/${encodeURIComponent(l.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        showToast("Não foi possível excluir o lançamento.", "error");
        setPendingLancamentoAction((prev) => ({ ...prev, [l.id]: false }));
        return;
      }
      setLancamentos((prev) => prev.filter((x) => x.id !== l.id));
      if (lancamentoEmEdicao?.id === l.id) {
        setDrawerEditarOpen(false);
        setLancamentoEmEdicao(null);
      }
      setPendingLancamentoAction((prev) => ({ ...prev, [l.id]: false }));
      showToast("Lançamento excluído com sucesso.", "success");
      await refetchBootstrapSilencioso();
    },
    [pendingLancamentoAction, lancamentoEmEdicao?.id, showToast, refetchBootstrapSilencioso]
  );

  const alternarBaixaLancamento = async (l: Lancamento) => {
    if (!podeEditarLancamento || pendingLancamentoAction[l.id]) return;
    const isPago = l.status === "pago";
    const hoje = new Date().toISOString().slice(0, 10);
    const payload: Lancamento = {
      ...l,
      status: isPago ? "pendente" : "pago",
      dataPagamento: isPago ? undefined : `${hoje}T12:00:00.000Z`,
    };
    const anterior = l;
    setPendingLancamentoAction((prev) => ({ ...prev, [l.id]: true }));
    setLancamentos((prev) => prev.map((x) => (x.id === l.id ? payload : x)));
    const res = await fetch(`/api/financeiro/lancamentos/${l.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lancamento: payload }),
    });
    const json = await parseJsonSafe<{ success?: boolean; data?: { lancamento?: Lancamento } }>(res);
    if (!res.ok || !json || !json.success || !json.data?.lancamento) {
      setLancamentos((prev) => prev.map((x) => (x.id === l.id ? anterior : x)));
      setPendingLancamentoAction((prev) => ({ ...prev, [l.id]: false }));
      showToast("Não foi possível alterar a baixa do lançamento.", "error");
      return;
    }
    const lancamentoAtualizado = json.data.lancamento;
    setLancamentos((prev) =>
      prev.map((x) => (x.id === lancamentoAtualizado.id ? lancamentoAtualizado : x))
    );
    setPendingLancamentoAction((prev) => ({ ...prev, [l.id]: false }));
    showToast(
      lancamentoAtualizado.status === "pago"
        ? "Lançamento marcado como pago."
        : "Lançamento marcado como pendente.",
      "success"
    );
    emitAlertsUpdated();
  };

  const TABS: { id: TabId; label: string; icon: ComponentType<{ className?: string }> }[] = [
    { id: "fluxo", label: "Fluxo de Caixa", icon: GitCompareArrows },
    { id: "entradas", label: "Entradas (Receber)", icon: ArrowDownLeft },
    { id: "saidas", label: "Saídas (Pagar)", icon: ArrowUpRight },
  ];

  if (!podeVerFinanceiro) return null;

  return (
    <section className="w-full min-w-0 space-y-6">
      {podeAprovacoes && aprovacoesPendentes.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 dark:border-amber-500/40 dark:bg-amber-950/35">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Aprovações do Comercial pendentes
            </h3>
            <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {aprovacoesPendentes.length > 99 ? "99+" : aprovacoesPendentes.length}
            </span>
          </div>

          <div className="space-y-2">
            {aprovacoesPendentes.map((p) => (
                <div
                  key={p.leadId}
                  className="grid gap-3 rounded-lg border border-amber-200 bg-white p-3 text-sm dark:border-amber-500/30 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,120px)_minmax(0,150px)_minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Lead</p>
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">{p.leadNome}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Cliente</p>
                    <p className="truncate text-slate-800 dark:text-slate-200">{p.clienteNome}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Valor global</p>
                    <p className="font-medium text-slate-800 dark:text-slate-200">{formatCurrency(p.valorTotal)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Solicitado em</p>
                    <p className="text-slate-800 dark:text-slate-200">{new Date(p.solicitadoEm).toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Responsável</p>
                    <p className="truncate text-slate-800 dark:text-slate-200">{p.responsavelNome || "—"}</p>
                  </div>
                  <div className="flex items-end justify-end gap-2 sm:col-span-2 lg:col-span-1">
                    <button
                      type="button"
                      onClick={() => aceitarLeadComercial(p.leadId)}
                      className="inline-flex items-center gap-2 rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                      Aprovar
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecusaModalLeadId(p.leadId)}
                      className="inline-flex items-center gap-2 rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                    >
                      <XCircle className="h-4 w-4 shrink-0" aria-hidden />
                      Recusar
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <AlertDialog
        open={!!recusaModalLeadId}
        onClose={() => setRecusaModalLeadId(null)}
        onConfirm={() => {
          if (recusaModalLeadId) recusarLeadComercial(recusaModalLeadId);
        }}
        title="Recusar aprovação do Comercial?"
        description={
          recusaModalLeadId ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Informe o motivo da recusa para devolver ao Comercial.
              </p>
              <input
                type="text"
                placeholder="Motivo da recusa (obrigatório)"
                value={motivosRecusa[recusaModalLeadId] ?? ""}
                onChange={(e) =>
                  setMotivosRecusa((prev) => ({ ...prev, [recusaModalLeadId]: e.target.value }))
                }
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          ) : null
        }
        cancelLabel="Cancelar"
        confirmLabel="Confirmar recusa"
        destructive
      />

      {podeAprovacoes && unlockRequests.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-500/35 dark:bg-amber-950/35">
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Solicitações de liberação do Comercial</h3>
          <div className="mt-3 space-y-3">
            {unlockRequests.map((r) => (
              <div key={r.id} className="rounded-lg border border-amber-200 bg-white p-3 dark:border-amber-500/30 dark:bg-slate-900">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{r.leadNome}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Motivo solicitado: {r.motivo}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        const res = await fetch(`/api/financeiro/unlock/${r.leadId}`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ aprovado: true, userName: currentUserName }),
                        });
                        if (!res.ok) {
                          showToast("Não foi possível liberar a edição do lead.", "error");
                          return;
                        }
                        setUnlockRequests((prev) => prev.filter((x) => x.leadId !== r.leadId));
                        showToast("Edição do lead liberada com sucesso.", "success");
                      })();
                    }}
                    className="inline-flex items-center gap-2 rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    <Unlock className="h-4 w-4 shrink-0" aria-hidden />
                    Liberar edição
                  </button>
                  <input
                    type="text"
                    placeholder="Motivo para negar"
                    value={motivosNegarUnlock[r.leadId] ?? ""}
                    onChange={(e) =>
                      setMotivosNegarUnlock((prev) => ({ ...prev, [r.leadId]: e.target.value }))
                    }
                    className="w-full min-w-0 flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:min-w-[220px]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        const motivo = (motivosNegarUnlock[r.leadId] ?? "").trim() || "Solicitação negada pelo Financeiro.";
                        const res = await fetch(`/api/financeiro/unlock/${r.leadId}`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ aprovado: false, motivo, userName: currentUserName }),
                        });
                        if (!res.ok) {
                          showToast("Não foi possível negar a liberação.", "error");
                          return;
                        }
                        setUnlockRequests((prev) => prev.filter((x) => x.leadId !== r.leadId));
                        showToast("Solicitação de liberação negada.", "success");
                      })();
                    }}
                    className="inline-flex items-center gap-2 rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                  >
                    <ShieldOff className="h-4 w-4 shrink-0" aria-hidden />
                    Negar liberação
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!podeLancamentos ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          Você tem acesso às aprovações do Comercial nesta área. Os lançamentos e o fluxo de caixa exigem permissão em{" "}
          <strong>Financeiro → Lançamentos</strong>.
        </p>
      ) : null}

      {podeLancamentos ? (
      <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <Wallet className="h-5 w-5 text-[#6D28D9]" />
            <span className="text-sm font-medium">Saldo atual (Caixa)</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(caixaAtual)}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Posição disponível hoje.</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-950/35">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <TrendingUp className="h-5 w-5" />
            <span className="text-sm font-medium">Entradas no mês</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-800 dark:text-emerald-200">
            {formatCurrency(entradasSaidasMes.entradasTotal)}
          </p>
          <p className="mt-1 text-xs text-emerald-800/90 dark:text-emerald-200/90">
            Pago: {formatCurrency(entradasSaidasMes.entradasPagas)} • Em aberto: {formatCurrency(entradasSaidasMes.entradasAberto)}
          </p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 shadow-sm dark:border-red-500/30 dark:bg-red-950/35">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <TrendingDown className="h-5 w-5" />
            <span className="text-sm font-medium">Saídas no mês</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-red-800 dark:text-red-200">
            {formatCurrency(entradasSaidasMes.saidasTotal)}
          </p>
          <p className="mt-1 text-xs text-red-800/90 dark:text-red-200/90">
            Pago: {formatCurrency(entradasSaidasMes.saidasPagas)} • Em aberto: {formatCurrency(entradasSaidasMes.saidasAberto)}
          </p>
        </div>
        <div className="rounded-xl border border-[#6D28D9]/30 bg-[#6D28D9]/5 p-4 shadow-sm dark:border-violet-500/35 dark:bg-violet-950/30">
          <div className="flex items-center gap-2 text-[#6D28D9] dark:text-violet-300">
            <Telescope className="h-5 w-5" />
            <span className="text-sm font-medium">Previsão final do mês</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-[#6D28D9] dark:text-violet-300">
            {formatCurrency(previsaoFimPeriodo)}
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Diferença mês (entradas - saídas): {formatCurrency(entradasSaidasMes.entradasTotal - entradasSaidasMes.saidasTotal)}
          </p>
        </div>
      </div>

      {resumoOperacional.atrasadosQtd > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/35">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm font-semibold">Alerta imediato: títulos atrasados</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-amber-800 dark:text-amber-200">{resumoOperacional.atrasadosQtd}</p>
            <p className="text-sm text-amber-700 dark:text-amber-300">{formatCurrency(resumoOperacional.atrasadosValor)}</p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="grid w-full min-w-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-3">
          {/* Buscar */}
          <div className="relative z-0 min-h-[42px] min-w-0 w-full">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6D28D9] dark:text-violet-400"
              aria-hidden
            />
            <input
              value={filtroBusca}
              onChange={(e) => setFiltroBusca(e.target.value)}
              placeholder="Buscar…"
              className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          {/* Navegação mês + demais filtros (coluna própria; nunca sobrepõe a busca) */}
          <div className="flex w-full min-w-0 flex-wrap items-stretch gap-2 justify-start lg:w-max lg:max-w-full lg:flex-nowrap lg:justify-end">
            {/* período / ano */}
            <div className="flex min-h-[42px] min-w-0 shrink-0 items-center gap-0.5 rounded-xl border border-slate-200 bg-white px-0.5 py-0.5 shadow-sm dark:border-slate-600 dark:bg-slate-800">
              <Calendar className="ml-1 hidden h-4 w-4 shrink-0 text-[#6D28D9] dark:text-violet-400 sm:block" aria-hidden />
              <button
                type="button"
                onClick={() => goMonthDelta(-1)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-violet-50 hover:text-[#6D28D9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9]/25 dark:text-slate-300 dark:hover:bg-violet-950/50 dark:hover:text-violet-300"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <span
                className="min-w-[6.5rem] select-none px-1 text-center text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-100 sm:min-w-[7.25rem] sm:text-sm"
                title={getMonthRange(periodo, customYear, customMonth).start.toLocaleDateString("pt-BR", {
                  month: "long",
                  year: "numeric",
                })}
              >
                {mesFocoLabel}
              </span>
              <button
                type="button"
                onClick={() => goMonthDelta(1)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-violet-50 hover:text-[#6D28D9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9]/25 dark:text-slate-300 dark:hover:bg-violet-950/50 dark:hover:text-violet-300"
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <button
              type="button"
              onClick={goMesAtualCalendario}
              disabled={periodo === "mes_atual"}
              className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm transition-colors hover:border-[#6D28D9]/40 hover:bg-violet-50/90 hover:text-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 disabled:cursor-default disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-violet-950/40 dark:hover:text-violet-200 sm:text-sm"
            >
              <CalendarCheck2 className="h-4 w-4 shrink-0 text-[#6D28D9] dark:text-violet-400" aria-hidden />
              Mês atual
            </button>

            <div className="w-full min-w-0 sm:min-w-[10.5rem] sm:max-w-[15rem] lg:min-w-[11rem]">
              <SearchableSelect
                options={financeiroStatusFilterOptions}
                value={filtroStatus}
                onChange={(v) => setFiltroStatus(v as "todos" | Lancamento["status"])}
                placeholder="Status"
                searchable={false}
                searchPlaceholder="Buscar status…"
                emptyLabel="Nenhum status."
                leadingIcon={ListFilter}
                leadingIconClassName="text-[#6D28D9] dark:text-violet-400"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAdvancedFilters((v) => !v)}
              className={clsx(
                "inline-flex min-h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20",
                showAdvancedFilters
                  ? "border-[#6D28D9]/50 bg-violet-50 text-[#6D28D9] dark:border-violet-500/50 dark:bg-violet-950/45 dark:text-violet-200"
                  : "border-slate-200 bg-white text-slate-700 hover:border-[#6D28D9]/35 hover:bg-violet-50/80 hover:text-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-violet-500/35 dark:hover:bg-violet-950/35 dark:hover:text-violet-200"
              )}
              aria-expanded={showAdvancedFilters}
              aria-label="Mais filtros"
            >
              <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden />
              <span className="whitespace-nowrap">{showAdvancedFilters ? "Menos filtros" : "Mais filtros"}</span>
            </button>

            <button
              type="button"
              onClick={limparFiltros}
              className="inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <RotateCcw className="h-4 w-4 shrink-0 text-[#6D28D9] dark:text-violet-400" aria-hidden />
              Limpar
            </button>
          </div>
        </div>

        {showAdvancedFilters && (
          <div className="mt-3 grid w-full min-w-0 grid-cols-1 gap-3 border-t border-slate-200 pt-3 dark:border-slate-600 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <Users className="h-3.5 w-3.5 text-[#6D28D9] dark:text-violet-400" aria-hidden />
                Cliente / Fornecedor
              </span>
              <SearchableSelect
                options={financeiroParteFilterOptions}
                value={filtroParte}
                onChange={(v) => setFiltroParte(v as "todos" | "cliente" | "fornecedor")}
                placeholder="Todos"
                searchable={false}
                searchPlaceholder="Buscar…"
                emptyLabel="Nenhuma opção."
                leadingIcon={Users}
                leadingIconClassName="text-[#6D28D9] dark:text-violet-400"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <Landmark className="h-3.5 w-3.5 text-[#6D28D9] dark:text-violet-400" aria-hidden />
                Conta
              </span>
              <SearchableSelect
                options={financeiroContaFilterOptions}
                value={filtroConta}
                onChange={(v) => setFiltroConta(v)}
                placeholder="Todas as contas"
                searchable
                searchPlaceholder="Buscar conta…"
                emptyLabel="Nenhuma conta encontrada."
                leadingIcon={Landmark}
                leadingIconClassName="text-[#6D28D9] dark:text-violet-400"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <Tag className="h-3.5 w-3.5 text-[#6D28D9] dark:text-violet-400" aria-hidden />
                Categorias
              </span>
              <SearchableSelect
                options={financeiroCategoriaFilterOptions}
                value={filtroCategoria}
                onChange={(v) => setFiltroCategoria(v)}
                placeholder="Todas as categorias"
                searchable
                searchPlaceholder="Buscar categoria…"
                emptyLabel="Nenhuma categoria encontrada."
                leadingIcon={Tag}
                leadingIconClassName="text-[#6D28D9] dark:text-violet-400"
              />
            </div>
          </div>
        )}

        <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
          {/* Abas (padrão Lead / sistema) */}
          <div
            role="tablist"
            aria-label="Abas de lançamentos"
            className="inline-flex overflow-hidden rounded-lg border border-slate-300 bg-slate-50/50 dark:border-slate-600 dark:bg-slate-800/60"
          >
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              const nAlerta = contagemAlertaPorTab[t.id];
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`${tabListId}-${t.id}`}
                  aria-selected={isActive}
                  aria-controls={`${tabListId}-${t.id}-panel`}
                  onClick={() => setTab(t.id)}
                  className={clsx(
                    "relative flex min-w-0 items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4",
                    isActive ? "text-[#6D28D9]" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="financeiro-main-tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6D28D9]"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                    />
                  )}
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t.label}</span>
                  {nAlerta > 0 && (
                    <span className="ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {nAlerta > 99 ? "99+" : nAlerta}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {podeExtrato && (
            <Link
              href="/financeiro/extrato"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              <ScrollText className="h-4 w-4 shrink-0" aria-hidden />
              Ver Extrato
            </Link>
            )}
            {podeComissoes && (
            <Link
              href="/financeiro/comissoes"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <BadgePercent className="h-4 w-4 shrink-0" aria-hidden />
              Comissões
            </Link>
            )}
            <button
              type="button"
              onClick={() => void recarregarBootstrapManual()}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg bg-[#6D28D9] px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={clsx("h-4 w-4 shrink-0", refreshing && "animate-spin")} aria-hidden />
              {refreshing ? "Atualizando..." : "Atualizar agora"}
            </button>
          </div>
        </div>
      </div>

      <div
        role="tabpanel"
        id={`${tabListId}-${tab}-panel`}
        aria-labelledby={`${tabListId}-${tab}`}
        className="min-w-0"
      >
        <LancamentosTable
          lancamentos={lancamentosPorTab}
          clientesMap={clientesMap}
          onVerCliente={openCliente360}
          onEditar={podeEditarLancamento ? abrirEdicaoLancamento : undefined}
          onAlternarBaixa={podeEditarLancamento ? alternarBaixaLancamento : undefined}
          onExcluir={podeExcluirLancamento ? solicitarExclusaoLancamento : undefined}
          disabledActionIds={pendingLancamentoAction}
          showTipo={tab === "fluxo"}
          pendingByLancamentoId={pendingByLancamentoId}
          todosLancamentosParaAlerta={lancamentos}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Entradas x Saídas (Total e Pago)</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Comparativo do período selecionado.</p>
          <div className="mt-4 h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparativoMensalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" />
                <YAxis />
                <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="total" name="Total" fill="#6D28D9" radius={[6, 6, 0, 0]} />
                <Bar dataKey="pago" name="Pago" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Projeção diária do período</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Saldo por vencimento (entradas - saídas).</p>
          <div className="mt-4 h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projecaoDiariaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="dia" />
                <YAxis />
                <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                <Line type="monotone" dataKey="entradas" stroke="#10b981" strokeWidth={2} dot={false} name="Entradas" />
                <Line type="monotone" dataKey="saidas" stroke="#ef4444" strokeWidth={2} dot={false} name="Saídas" />
                <Line type="monotone" dataKey="saldo" stroke="#6D28D9" strokeWidth={2.5} dot={false} name="Saldo" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      </>
      ) : null}

      {/* Drawer: Novo Lançamento (aberto pelo botão + Novo no Header) */}
      {podeLancamentos ? (
      <DrawerSheet
        open={drawerNovoOpen}
        onClose={() => {
          setDrawerNovoOpen(false);
          setAprovacaoParaLancar(null);
          setAprovacaoLinhaSolucaoId(null);
        }}
        title={aprovacaoParaLancar ? `Novo Lançamento — ${aprovacaoParaLancar.leadNome}` : "Novo Lançamento"}
        scrollBody={false}
        mobileContentPaddingClassName="px-0"
        desktopContentPaddingClassName="px-0"
      >
        <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <LancamentoForm
            key={`novo-${aprovacaoParaLancar?.leadId ?? "livre"}-${aprovacaoLinhaSolucaoId ?? "auto"}-${aprovacaoFormEpoch}`}
            mode="create"
            initial={aprovacaoParaLancar ? lancamentoInicialAprovacao : DEFAULT_NEW_LANCAMENTO}
            clientes={clientes}
            fornecedoresRh={fornecedoresRh}
            contas={contas}
            categorias={categorias}
            meiosPagamento={meiosPagamento}
            defaultContaId={defaultContaId}
            solucoesAprovacao={
              aprovacaoParaLancar && aprovacaoParaLancar.solucoes.length > 1
                ? aprovacaoParaLancar.solucoes.map((s) => ({ leadSolucaoId: s.leadSolucaoId, nome: s.nome }))
                : undefined
            }
            propostaSolucoesResumo={
              aprovacaoParaLancar && aprovacaoParaLancar.solucoes.length > 0
                ? aprovacaoParaLancar.solucoes.map((s) => ({
                    leadSolucaoId: s.leadSolucaoId,
                    nome: s.nome,
                    vinculado: lancamentos.some(
                      (l) => l.leadIdOrigem === aprovacaoParaLancar.leadId && l.leadSolucaoId === s.leadSolucaoId
                    ),
                  }))
                : undefined
            }
            linhaAprovacaoSelecionada={aprovacaoLinhaSolucaoId ?? undefined}
            onLinhaAprovacaoChange={(idLinha) => {
              setAprovacaoLinhaSolucaoId(idLinha);
              setAprovacaoFormEpoch((e) => e + 1);
            }}
            onSave={(novos) => {
              void (async () => {
                const res = await fetch("/api/financeiro/lancamentos", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ lancamentos: novos }),
                });
                const json = await parseJsonSafe<{
                  success?: boolean;
                  data?: { lancamentos?: Lancamento[] };
                }>(res);
                if (!res.ok || !json || !json.success) {
                  showToast("Não foi possível criar o lançamento.", "error");
                  return;
                }
                const salvos = json.data?.lancamentos?.length ? json.data.lancamentos : novos;
                if (aprovacaoParaLancar) {
                  const leadIdApr = aprovacaoParaLancar.leadId;
                  const merged = dedupeLancamentosPorId([...lancamentos, ...salvos]);
                  const vinc = new Set(
                    merged
                      .filter((l) => l.leadIdOrigem === leadIdApr && l.leadSolucaoId)
                      .map((l) => l.leadSolucaoId as string)
                  );
                  const lines = aprovacaoParaLancar.solucoes;
                  const allCovered =
                    lines.length === 0
                      ? salvos.some((s) => s.leadIdOrigem === leadIdApr)
                      : lines.every((ln) => vinc.has(ln.leadSolucaoId));

                  if (!allCovered) {
                    const nextLine = lines.find((ln) => !vinc.has(ln.leadSolucaoId));
                    setAprovacaoLinhaSolucaoId(nextLine?.leadSolucaoId ?? null);
                    setAprovacaoFormEpoch((e) => e + 1);
                    showToast(
                      "Lançamento salvo. Continue com as demais soluções antes de concluir a aprovação.",
                      "success"
                    );
                    await refetchBootstrapSilencioso();
                    return;
                  }

                  const approveRes = await fetch(`/api/financeiro/aprovacoes/${leadIdApr}/aceitar`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userName: currentUserName }),
                  });
                  if (!approveRes.ok) {
                    showToast("Lançamento salvo, mas não foi possível concluir a aprovação financeira.", "error");
                    await refetchBootstrapSilencioso();
                    return;
                  }
                  const approvedJson = (await approveRes.json()) as {
                    data?: { posVendaTarefasCriadas?: number };
                  };
                  const posVendaCriadas = approvedJson?.data?.posVendaTarefasCriadas ?? 0;
                  setDrawerNovoOpen(false);
                  setAprovacaoParaLancar(null);
                  setAprovacaoLinhaSolucaoId(null);
                  showToast(
                    posVendaCriadas > 0
                      ? `Aprovação concluída, contrato ativado e ${posVendaCriadas} tarefa(s) de Pós-venda criada(s).`
                      : "Aprovação concluída e contrato ativado.",
                    "success"
                  );
                  await refetchBootstrapSilencioso();
                  emitAlertsUpdated();
                  return;
                }
                setDrawerNovoOpen(false);
                setAprovacaoParaLancar(null);
                setAprovacaoLinhaSolucaoId(null);
                showToast("Lançamento criado com sucesso.", "success");
                await refetchBootstrapSilencioso();
                emitAlertsUpdated();
              })();
            }}
            onCancel={() => {
              setDrawerNovoOpen(false);
              setAprovacaoParaLancar(null);
              setAprovacaoLinhaSolucaoId(null);
            }}
            consultoresComissaoRh={consultoresComissaoRh}
          />
          </div>
        </div>
      </DrawerSheet>
      ) : null}

      {podeLancamentos ? (
      <DrawerSheet
        open={drawerEditarOpen}
        onClose={() => {
          setDrawerEditarOpen(false);
          setLancamentoEmEdicao(null);
        }}
        title={lancamentoEmEdicao ? lancamentoEmEdicao.descricao : "Lançamento"}
        mobileContentPaddingClassName="px-0"
        desktopContentPaddingClassName="px-0"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {lancamentoEmEdicao && (
            <LancamentoForm
              key={`${lancamentoEmEdicao.id}-rh${fornecedoresRh.length}`}
              mode="edit"
              initial={lancamentoEmEdicao}
              clientes={clientes}
              fornecedoresRh={fornecedoresRh}
              contas={contas}
              categorias={categorias}
              meiosPagamento={meiosPagamento}
              defaultContaId={defaultContaId}
              onCancel={() => {
                setDrawerEditarOpen(false);
                setLancamentoEmEdicao(null);
              }}
              onSave={(itens) => {
                if (!itens[0]) return;
                void iniciarSalvarEdicao(itens[0]);
              }}
              origemContratoId={origemContratoIdEdit}
              recorrenciaGrupo={recorrenciaGrupoEdicao}
              onProrrogarFixoMensal={
                lancamentoEmEdicao?.tipoRecorrencia === "fixo_mensal" ? prorrogarFixoMensal : undefined
              }
            />
          )}
        </div>
      </DrawerSheet>
      ) : null}

      {podeLancamentos ? (
      <>
      <RecurrenceScopeDialog
        open={recurrenceScopeOpen}
        disabled={recurrenceSaving}
        onClose={() => {
          if (recurrenceSaving) return;
          setRecurrenceScopeOpen(false);
          setPendingRecurrence(null);
        }}
        onConfirm={(scope) => {
          if (!pendingRecurrence || recurrenceSaving) return;
          const { initial, edited } = pendingRecurrence;
          const payloads = buildPayloadsForRecurrenceScope(scope, initial, edited, lancamentos);
          setRecurrenceScopeOpen(false);
          setPendingRecurrence(null);
          void salvarEdicaoLancamentosLista(payloads);
        }}
      />

      <FinanceiroConfigDrawer
        open={drawerConfigOpen}
        onClose={() => setDrawerConfigOpen(false)}
        contas={contas}
        categorias={categorias}
        meiosPagamento={meiosPagamento}
        onAtualizado={recarregarBootstrapManual}
      />
      </>
      ) : null}

      {/* Drawer: Perfil 360 do cliente (link a partir da tabela) */}
      {podeLancamentos ? (
      <DrawerSheet
        open={perfil360Open}
        onClose={closePerfil360}
        title={cliente360 ? `Perfil 360 — ${cliente360.nome}` : "Perfil 360"}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ClientePerfil360 cliente={cliente360} />
        </div>
      </DrawerSheet>
      ) : null}
      <Toast
        visible={toast.visible}
        message={toast.message}
        variant={toast.variant}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />

      {podeLancamentos ? (
      <AlertDialog
        open={!!lancamentoParaExcluir}
        onClose={() => setLancamentoParaExcluir(null)}
        onConfirm={() => {
          const alvo = lancamentoParaExcluir;
          if (alvo) void executarExclusaoLancamento(alvo);
        }}
        title="Excluir lançamento?"
        description={
          lancamentoParaExcluir ? (
            <div className="space-y-3">
              <p>
                Esta ação é <strong className="text-slate-900 dark:text-slate-100">irreversível</strong>: o
                lançamento sai definitivamente do caixa e não pode ser recuperado.
              </p>
              {lancamentoTemVinculoFechamento(lancamentoParaExcluir, lancamentos) ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/45 dark:text-amber-100">
                  Este recebimento está vinculado a uma oportunidade em <strong>Fechado</strong>. Se, após a
                  exclusão, não restar <strong>nenhum</strong> lançamento financeiro ligado a essa venda, o{" "}
                  <strong>Comercial é desbloqueado</strong> para edição, o <strong>contrato</strong> volta para{" "}
                  <strong>pendência financeira</strong> e será preciso <strong>aprovar e lançar de novo</strong> no
                  Financeiro.
                </p>
              ) : null}
            </div>
          ) : null
        }
        cancelLabel="Cancelar"
        confirmLabel="Sim, excluir permanentemente"
        destructive
      />
      ) : null}
    </section>
  );
}
