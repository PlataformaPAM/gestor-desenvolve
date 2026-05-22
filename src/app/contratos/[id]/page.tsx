"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import clsx from "clsx";
import { motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Circle,
  CircleSlash2,
  FileText,
  Handshake,
  History,
  Plus,
  Settings2,
  Text,
  Wallet,
  XCircle,
  MessageSquare,
  Save,
  X,
} from "lucide-react";
import { usePageHeader } from "@/contexts/page-header-context";
import { CONTRATOS_RESOURCE, useContratosRbac, useResourcePageGuard } from "@/hooks/use-rbac-resource";
import { emitAlertsUpdated } from "@/lib/alerts/live-sync";
import { CONTRATO_STATUS_LABEL } from "@/lib/contratos/constants";
import { ADITIVO_TIPO_OPTIONS, getAditivoTipoMeta } from "@/lib/contratos/aditivo-tipos";
import { formatCurrency } from "@/lib/comercial/utils";
import { formatDateDMY } from "@/lib/format/dates";
import { MultiFileAttachment } from "@/components/ui/multifile-attachment";
import { DateField } from "@/components/ui/date-field";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import {
  formInputClass,
  formLabelClass,
  formModalCancelButtonClass,
  formModalSubmitButtonClass,
  formTextareaClass,
} from "@/components/ui/field-patterns";

/** Igual ao campo Valor (R$) do formulário de lançamento do Financeiro */
const formInputWithIconClass = `${formInputClass} pl-9`;

type AditivoRow = {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  valorAnterior: number | null;
  valorNovo: number | null;
  createdAt: string;
};

type ContratoDetalhe = {
  id: string;
  codigo: string;
  codigoSistema?: string;
  codigoPersonalizado?: string | null;
  leadId: string | null;
  clienteId: string;
  origem: string;
  geraPosVenda: boolean;
  titulo: string | null;
  status: string;
  valorTotal: number;
  dataInicio: string | null;
  dataFim: string | null;
  observacoes: string | null;
  condicoesGerais: string | null;
  createdAt: string;
  updatedAt: string;
  registroCriadoPorNome: string | null;
  cliente: { id: string; nome: string; empresa: string; cpfCnpj: string };
  lead: {
    id: string;
    name: string;
    stageId: string;
    valorTotal: number;
    value: number;
    financeiroFluxo: {
      status: string;
      bloqueadoEdicao: boolean;
      solicitadoEm: string | null;
      aprovadoEm: string | null;
    } | null;
  } | null;
  itens: Array<{
    id: string;
    nome: string;
    valor: number | null;
    condicoesPagamento: string | null;
    solucaoCatalogoId: string | null;
  }>;
  aditivos?: AditivoRow[];
};

type ContratoTab = "dados" | "gestao" | "aditivo" | "historico";

const FLUXO_FIN_LABEL: Record<string, string> = {
  nenhum: "Sem solicitação",
  pendente_aprovacao: "Aguardando Financeiro",
  lancado: "Lançado no caixa",
  devolvido: "Devolvido ao Comercial",
};

const STATUS_EDITAVEL = Object.keys(CONTRATO_STATUS_LABEL);

function digitsOnly(v: string): string {
  return v.replace(/\D/g, "");
}

function formatCurrencyInput(v: string): string {
  const cents = Number.parseInt(digitsOnly(v) || "0", 10);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatCurrencyFromNumber(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

function parseCurrencyInput(v: string): number {
  const normalized = v.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

/** Mesma regra do `LancamentoForm` (Financeiro): exibe "R$ 0,00" a partir de centavos inteiros. */
function formatCurrencyFromCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function statusBadgeClass(status: string): string {
  if (status === "ativo")
    return "rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300";
  if (status === "pendente_financeiro")
    return "rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200";
  return "rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

type ContratoDetalheViewProps = {
  id: string;
  embedded?: boolean;
};

export function ContratoDetalheView({ id, embedded = false }: ContratoDetalheViewProps) {
  const router = useRouter();
  const { setPrimaryAction, setSecondaryAction, setTitle } = usePageHeader();
  const { podeEditar } = useContratosRbac();
  const tabListId = useId();
  const [activeTab, setActiveTab] = useState<ContratoTab>("dados");
  const [contrato, setContrato] = useState<ContratoDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editTitulo, setEditTitulo] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editValor, setEditValor] = useState("");
  const [editInicio, setEditInicio] = useState("");
  const [editFim, setEditFim] = useState("");
  const [editPosVenda, setEditPosVenda] = useState(true);
  const [editObs, setEditObs] = useState("");
  const [editCond, setEditCond] = useState("");
  const [editCodigoPersonalizado, setEditCodigoPersonalizado] = useState("");
  const [adTipo, setAdTipo] = useState("ajuste_valor");
  const [adTitulo, setAdTitulo] = useState("");
  const [adDesc, setAdDesc] = useState("");
  /** Somente dígitos (centavos), como no modal de lançamento do Financeiro; vazio = opcional sem valor. */
  const [adValAntDigits, setAdValAntDigits] = useState("");
  const [adValNovoDigits, setAdValNovoDigits] = useState("");
  const [histComentario, setHistComentario] = useState("");
  const [histArquivos, setHistArquivos] = useState<File[]>([]);

  const carregar = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/contratos/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!res.ok) {
      setErro("Contrato não encontrado.");
      return;
    }
    const json = (await res.json()) as { data?: { contrato?: ContratoDetalhe } };
    const c = json?.data?.contrato ?? null;
    setContrato(c);
    setErro(null);
    if (c) {
      setEditTitulo(c.titulo ?? "");
      setEditStatus(c.status);
      setEditValor(formatCurrencyFromNumber(c.valorTotal));
      setEditInicio(c.dataInicio ? c.dataInicio.slice(0, 10) : "");
      setEditFim(c.dataFim ? c.dataFim.slice(0, 10) : "");
      setEditPosVenda(c.geraPosVenda);
      setEditObs(c.observacoes ?? "");
      setEditCond(c.condicoesGerais ?? "");
      setEditCodigoPersonalizado(c.codigoPersonalizado ?? "");
    }
  }, [id]);

  useEffect(() => {
    if (embedded) return;
    setSecondaryAction(null);
    setPrimaryAction({
      label: "Voltar ao Contratos",
      onClick: () => router.push("/contratos"),
      showPlusIcon: false,
      tone: "navigation",
    });
    return () => {
      setPrimaryAction(null);
      setSecondaryAction(null);
    };
  }, [embedded, router, setPrimaryAction, setSecondaryAction]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (embedded) return;
    if (!contrato) return;
    const raw =
      contrato.titulo?.trim() ||
      contrato.lead?.name?.trim() ||
      contrato.cliente.empresa ||
      contrato.cliente.nome ||
      "Contrato";
    setTitle(raw.length > 72 ? `${raw.slice(0, 69)}…` : raw);
  }, [contrato, embedded, setTitle]);

  const salvarDados = async () => {
    if (!podeEditar || !contrato || !id) return;
    const valorTotal = parseCurrencyInput(editValor);
    if (Number.isNaN(valorTotal)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contratos/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: editTitulo.trim() || null,
          status: editStatus,
          valorTotal,
          dataInicio: editInicio || null,
          dataFim: editFim || null,
          geraPosVenda: editPosVenda,
          observacoes: editObs.trim() || null,
          condicoesGerais: editCond.trim() || null,
          codigoPersonalizado: editCodigoPersonalizado.trim() || null,
        }),
      });
      if (!res.ok) return;
      await carregar();
      emitAlertsUpdated();
    } finally {
      setSaving(false);
    }
  };

  const alterarStatusRapido = async (novoStatus: string) => {
    if (!podeEditar || !contrato || !id || contrato.status === novoStatus) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contratos/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novoStatus }),
      });
      if (!res.ok) return;
      await carregar();
      emitAlertsUpdated();
    } finally {
      setSaving(false);
    }
  };

  const registrarAditivo = async (aditivo: {
    tipo: string;
    titulo: string;
    descricao?: string;
    valorAnterior?: number | null;
    valorNovo?: number | null;
  }) => {
    if (!podeEditar || !contrato || !id || !aditivo.titulo.trim()) return false;
    setSaving(true);
    try {
      const res = await fetch(`/api/contratos/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aditivo,
        }),
      });
      if (!res.ok) return false;
      await carregar();
      emitAlertsUpdated();
      return true;
    } finally {
      setSaving(false);
    }
  };

  const salvarAditivo = async () => {
    if (!contrato || !id || !adTitulo.trim()) return;
    const numAnt =
      adValAntDigits === ""
        ? null
        : (Number.parseInt(adValAntDigits || "0", 10) || 0) / 100;
    const numNovo =
      adValNovoDigits === ""
        ? null
        : (Number.parseInt(adValNovoDigits || "0", 10) || 0) / 100;
    const ok = await registrarAditivo({
      tipo: adTipo.trim(),
      titulo: adTitulo.trim(),
      descricao: adDesc.trim() || undefined,
      valorAnterior: numAnt !== null && !Number.isNaN(numAnt) ? numAnt : null,
      valorNovo: numNovo !== null && !Number.isNaN(numNovo) ? numNovo : null,
    });
    if (!ok) return;
    setAdTitulo("");
    setAdDesc("");
    setAdValAntDigits("");
    setAdValNovoDigits("");
  };

  const salvarHistorico = async () => {
    if (!histComentario.trim() && histArquivos.length === 0) return;
    const anexosTxt = histArquivos.length
      ? `\n\nAnexos:\n${histArquivos.map((f) => `- ${f.name}`).join("\n")}`
      : "";
    const ok = await registrarAditivo({
      tipo: "comentario",
      titulo: "Comentário de gestão",
      descricao: `${histComentario.trim() || "Atualização registrada."}${anexosTxt}`,
    });
    if (!ok) return;
    setHistComentario("");
    setHistArquivos([]);
  };

  const historico = useMemo(() => {
    if (!contrato) return [] as Array<{ id: string; data: string; titulo: string; descricao?: string }>;
    const entries: Array<{ id: string; data: string; titulo: string; descricao?: string }> = [
      {
        id: `create-${contrato.id}`,
        data: contrato.createdAt,
        titulo: "Contrato criado",
        descricao: contrato.registroCriadoPorNome
          ? `Criado por ${contrato.registroCriadoPorNome}.`
          : "Criação registrada no sistema.",
      },
      ...(contrato.updatedAt !== contrato.createdAt
        ? [{ id: `update-${contrato.id}`, data: contrato.updatedAt, titulo: "Contrato atualizado" }]
        : []),
      ...((contrato.aditivos ?? []).map((a) => ({
        id: a.id,
        data: a.createdAt,
        titulo: `${getAditivoTipoMeta(a.tipo).label} — ${a.titulo}`,
        descricao: a.descricao ?? undefined,
      })) ?? []),
    ];
    return entries.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [contrato]);

  const statusOptions: SearchableOption[] = useMemo(
    () =>
      STATUS_EDITAVEL.map((s) => ({
        value: s,
        label: CONTRATO_STATUS_LABEL[s] ?? s,
        icon:
          s === "ativo"
            ? ({ className }) => <CheckCircle2 className={clsx(className, "!text-emerald-600 dark:!text-emerald-400")} />
            : s === "pendente_financeiro"
              ? ({ className }) => <AlertCircle className={clsx(className, "!text-amber-600 dark:!text-amber-400")} />
              : s === "suspenso"
                  ? ({ className }) => <AlertTriangle className={clsx(className, "!text-blue-600 dark:!text-blue-400")} />
                : s === "cancelado"
                    ? ({ className }) => <XCircle className={clsx(className, "!text-red-600 dark:!text-red-400")} />
                  : s === "nao_efetivado"
                      ? ({ className }) => <Circle className={clsx(className, "!text-fuchsia-600 dark:!text-fuchsia-400")} />
                    : ({ className }) => <CircleSlash2 className={clsx(className, "!text-slate-500 dark:!text-slate-400")} />,
      })),
    []
  );
  const statusLeadingIcon = useMemo(() => {
    if (editStatus === "ativo") {
      return ({ className }: { className?: string }) => (
        <CheckCircle2 className={clsx(className, "!text-emerald-600 dark:!text-emerald-400")} />
      );
    }
    if (editStatus === "pendente_financeiro") {
      return ({ className }: { className?: string }) => (
        <AlertCircle className={clsx(className, "!text-amber-600 dark:!text-amber-400")} />
      );
    }
    if (editStatus === "suspenso") {
      return ({ className }: { className?: string }) => (
        <AlertTriangle className={clsx(className, "!text-blue-600 dark:!text-blue-400")} />
      );
    }
    if (editStatus === "cancelado") {
      return ({ className }: { className?: string }) => (
        <XCircle className={clsx(className, "!text-red-600 dark:!text-red-400")} />
      );
    }
    if (editStatus === "nao_efetivado") {
      return ({ className }: { className?: string }) => (
        <Circle className={clsx(className, "!text-fuchsia-600 dark:!text-fuchsia-400")} />
      );
    }
    return ({ className }: { className?: string }) => (
      <CircleSlash2 className={clsx(className, "!text-slate-500 dark:!text-slate-400")} />
    );
  }, [editStatus]);
  const hasHistoricoInput = histComentario.trim().length > 0 || histArquivos.length > 0;
  const hasFooterActions =
    podeEditar && embedded && (activeTab === "gestao" || activeTab === "aditivo");

  const resetCurrentTab = () => {
    if (!contrato) return;
    if (activeTab === "gestao") {
      setEditTitulo(contrato.titulo ?? "");
      setEditStatus(contrato.status);
      setEditValor(formatCurrencyFromNumber(contrato.valorTotal));
      setEditInicio(contrato.dataInicio ? contrato.dataInicio.slice(0, 10) : "");
      setEditFim(contrato.dataFim ? contrato.dataFim.slice(0, 10) : "");
      setEditPosVenda(contrato.geraPosVenda);
      setEditObs(contrato.observacoes ?? "");
      setEditCond(contrato.condicoesGerais ?? "");
      setEditCodigoPersonalizado(contrato.codigoPersonalizado ?? "");
      return;
    }
    if (activeTab === "aditivo") {
      setAdTipo("ajuste_valor");
      setAdTitulo("");
      setAdDesc("");
      setAdValAntDigits("");
      setAdValNovoDigits("");
      return;
    }
    if (activeTab === "historico") {
      setHistComentario("");
      setHistArquivos([]);
    }
  };

  const runFooterPrimaryAction = () => {
    if (!podeEditar) return;
    if (activeTab === "gestao") {
      void salvarDados();
      return;
    }
    if (activeTab === "aditivo") {
      void salvarAditivo();
      return;
    }
  };

  if (erro) {
    return (
      <section className="w-full min-w-0 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          {erro}
        </div>
      </section>
    );
  }

  if (!contrato) {
    return (
      <section className="w-full min-w-0 space-y-4">
        <div className="h-4 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-700" aria-hidden />
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm text-slate-600 dark:text-slate-400">Carregando contrato…</p>
        </div>
      </section>
    );
  }

  const fluxo = contrato.lead?.financeiroFluxo;
  const camposSomenteLeitura = saving || !podeEditar;
  const tabs: Array<{ id: ContratoTab; label: string; icon: React.ElementType }> = [
    { id: "dados", label: "Dados Gerais", icon: FileText },
    { id: "gestao", label: "Gestão", icon: Settings2 },
    { id: "aditivo", label: "Aditivo", icon: FileText },
    { id: "historico", label: "Interações", icon: MessageSquare },
  ];

  return (
    <section
      className={clsx(
        "w-full min-w-0",
        embedded ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "flex flex-col space-y-6"
      )}
    >
      <div
        role="tablist"
        aria-label="Abas do contrato"
        className="sticky top-0 z-30 flex shrink-0 flex-wrap border-b border-slate-300 bg-slate-50/95 backdrop-blur-sm dark:border-slate-600 dark:bg-slate-800/95"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`${tabListId}-tab-${t.id}`}
              aria-selected={isActive}
              aria-controls={`${tabListId}-${t.id}-panel`}
              onClick={() => setActiveTab(t.id)}
              className={clsx(
                "relative flex min-w-0 flex-1 items-center justify-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors sm:px-4",
                isActive ? "text-[#6D28D9] dark:text-violet-400" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId={`contrato-detalhe-tab-${tabListId}`}
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6D28D9]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{t.label}</span>
            </button>
          );
        })}
      </div>

      <div
        className={clsx(
          embedded ? "min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 lg:p-6" : "p-4 lg:p-6"
        )}
      >
      {activeTab === "dados" && (
        <div id={`${tabListId}-dados-panel`} role="tabpanel" aria-labelledby={`${tabListId}-tab-dados`} className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Dados gerais do contrato</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className={formLabelClass}>Código</label>
                <div className={clsx(formInputClass, "font-mono")}>{contrato.codigo}</div>
              </div>
              <div className="space-y-1">
                <label className={formLabelClass}>Cliente</label>
                <div className={formInputClass}>{contrato.cliente.empresa || contrato.cliente.nome}</div>
              </div>
              <div className="space-y-1">
                <label className={formLabelClass}>CNPJ</label>
                <div className={clsx(formInputClass, "font-mono")}>{contrato.cliente.cpfCnpj}</div>
              </div>
              <div className="space-y-1">
                <label className={formLabelClass}>Origem</label>
                <div className={formInputClass}>
                  {contrato.origem === "cadastro_manual" ? "Cadastro direto" : "Via lead"}
                  {contrato.origem === "cadastro_manual" ? ` · Pós-venda: ${contrato.geraPosVenda ? "sim" : "não"}` : ""}
                </div>
              </div>
              <div className="relative z-30 space-y-1">
                <label className={formLabelClass}>Status</label>
                <div className="mt-1">
                  <SearchableSelect
                    options={statusOptions}
                    value={editStatus}
                    onChange={(v) => {
                      setEditStatus(v);
                      void alterarStatusRapido(v);
                    }}
                    searchable={false}
                    disabled={saving || !podeEditar}
                    leadingIcon={statusLeadingIcon}
                    placeholder="Selecione o status"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className={formLabelClass}>Vigência</label>
                <div className={formInputClass}>
                  {contrato.dataInicio ? formatDateDMY(contrato.dataInicio) : "—"} até {contrato.dataFim ? formatDateDMY(contrato.dataFim) : "—"}
                </div>
              </div>
              <div className="space-y-1">
                <label className={formLabelClass}>Valor</label>
                <div className={formInputClass}>{formatCurrency(contrato.valorTotal)}</div>
              </div>
              <div className="space-y-1">
                <label className={formLabelClass}>Responsável</label>
                <div className={formInputClass}>{contrato.registroCriadoPorNome?.trim() || "—"}</div>
              </div>
            </div>
          <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Contexto comercial</h3>
            {contrato.lead ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className={formLabelClass}>Lead</label>
                  <div className={formInputClass}>{contrato.lead.name}</div>
                </div>
                <div className="space-y-1">
                  <label className={formLabelClass}>Etapa</label>
                  <div className={formInputClass}>{contrato.lead.stageId}</div>
                </div>
                {fluxo ? (
                  <div className="space-y-1 md:col-span-2">
                    <label className={formLabelClass}>Fluxo financeiro</label>
                    <div className={formInputClass}>{FLUXO_FIN_LABEL[fluxo.status] ?? fluxo.status}</div>
                  </div>
                ) : null}
                <Link href={`/comercial?leadId=${encodeURIComponent(contrato.lead.id)}`} className="inline-flex text-sm font-medium text-[#6D28D9] hover:text-[#5B21B6] md:col-span-2">
                  Abrir lead no Comercial →
                </Link>
              </div>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Contrato sem lead vinculado (cadastro direto).
              </p>
            )}
          </div>
          <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Soluções contratadas</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/60">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:px-6">Solução</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:px-6">Valor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:px-6">Condições</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {contrato.itens.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-500 md:px-6">
                        Nenhum item registrado neste contrato.
                      </td>
                    </tr>
                  ) : (
                    contrato.itens.map((i) => (
                      <tr key={i.id}>
                        <td className="px-4 py-4 text-sm font-medium text-slate-900 dark:text-slate-100 md:px-6">{i.nome}</td>
                        <td className="px-4 py-4 text-sm text-slate-800 dark:text-slate-200 md:px-6">
                          {i.valor != null && i.valor > 0 ? formatCurrency(i.valor) : "—"}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400 md:px-6">
                          {i.condicoesPagamento ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "gestao" && (
      <div id={`${tabListId}-gestao-panel`} role="tabpanel" aria-labelledby={`${tabListId}-tab-gestao`} className="space-y-4">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Valores e vigência</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Valor total (contrato)</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatCurrency(contrato.valorTotal)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Início / fim</dt>
              <dd className="mt-1 text-slate-800 dark:text-slate-200">
                {contrato.dataInicio ? formatDateDMY(contrato.dataInicio) : "—"} até{" "}
                {contrato.dataFim ? formatDateDMY(contrato.dataFim) : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Gestão e alterações</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <label className={formLabelClass}>Título</label>
            <div className="relative mt-1">
              <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={editTitulo}
                onChange={(e) => setEditTitulo(e.target.value)}
                placeholder="Ex.: Contrato de serviços ou projeto"
                className={`${formInputClass} pl-9`}
                disabled={camposSomenteLeitura}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className={formLabelClass}>Status</label>
            <SearchableSelect
              options={statusOptions}
              value={editStatus}
              onChange={setEditStatus}
              searchable={false}
              disabled={camposSomenteLeitura}
              leadingIcon={statusLeadingIcon}
              placeholder="Selecione o status"
            />
          </div>
          <div className="space-y-1">
            <label className={formLabelClass}>Código personalizado (exceção)</label>
            <div className="relative mt-1">
              <Text className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={editCodigoPersonalizado}
                onChange={(e) => setEditCodigoPersonalizado(e.target.value)}
                placeholder="Ex.: OFÍCIO-0001/2025"
                className={`${formInputClass} pl-9`}
                disabled={camposSomenteLeitura}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quando informado, o código final fica: {contrato?.codigoSistema ?? contrato?.codigo ?? "CTT-AAAA-0000"}_
              {editCodigoPersonalizado.trim() || "personalizado"}
            </p>
          </div>
          <div className="space-y-1">
            <label className={formLabelClass}>Valor total</label>
            <div className="relative mt-1">
              <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={editValor}
                onChange={(e) => setEditValor(e.target.value)}
                placeholder="R$ 0,00"
                className={`${formInputClass} pl-9`}
                inputMode="decimal"
                disabled={camposSomenteLeitura}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className={formLabelClass}>Contrato gera alertas</label>
            <label className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <input
                id="pvenda"
                type="checkbox"
                checked={editPosVenda}
                onChange={(e) => setEditPosVenda(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#6D28D9]"
                disabled={camposSomenteLeitura}
              />
              Gera alertas no Pós-venda
            </label>
          </div>
          <div className="space-y-1">
            <label className={formLabelClass}>Início</label>
            <div className="mt-1">
              <DateField
                value={editInicio}
                onChange={setEditInicio}
                placeholder="Selecione a data"
                disabled={camposSomenteLeitura}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className={formLabelClass}>Fim</label>
            <div className="mt-1">
              <DateField
                value={editFim}
                onChange={setEditFim}
                placeholder="Selecione a data"
                disabled={camposSomenteLeitura}
              />
            </div>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className={formLabelClass}>Condições gerais</label>
            <div className="relative mt-1">
              <FileText className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <textarea
                value={editCond}
                onChange={(e) => setEditCond(e.target.value)}
                rows={3}
                placeholder="SLA, multas, renovação automática, forma de pagamento…"
                className={`${formTextareaClass} pl-9`}
                disabled={camposSomenteLeitura}
              />
            </div>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className={formLabelClass}>Observações</label>
            <div className="relative mt-1">
              <Text className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <textarea
                value={editObs}
                onChange={(e) => setEditObs(e.target.value)}
                rows={3}
                placeholder="Notas internas sobre negociação, follow-up ou alertas…"
                className={`${formTextareaClass} pl-9`}
                disabled={camposSomenteLeitura}
              />
            </div>
          </div>
        </div>
        </div>
      </div>
      )}

      {activeTab === "aditivo" && (
      <div id={`${tabListId}-aditivo-panel`} role="tabpanel" aria-labelledby={`${tabListId}-tab-aditivo`} className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Aditivos e registros formais
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Registre ajustes de valor, renovação, prorrogação ou alteração de condições; o histórico fica abaixo.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className={formLabelClass}>Tipo</label>
            <div className="mt-1">
              <SearchableSelect
                options={ADITIVO_TIPO_OPTIONS}
                value={adTipo}
                onChange={setAdTipo}
                searchable
                searchPlaceholder="Buscar tipo de aditivo…"
                placeholder="Selecione o tipo"
                disabled={camposSomenteLeitura}
              />
            </div>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className={formLabelClass}>Título do aditivo</label>
            <div className="relative mt-1">
              <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={adTitulo}
                onChange={(e) => setAdTitulo(e.target.value)}
                placeholder="Ex.: Prorrogação de vigência ou reajuste"
                className={`${formInputClass} pl-9`}
                disabled={camposSomenteLeitura}
              />
            </div>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className={formLabelClass}>Descrição</label>
            <div className="relative mt-1">
              <Text className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <textarea
                value={adDesc}
                onChange={(e) => setAdDesc(e.target.value)}
                rows={2}
                placeholder="Descreva o que foi acordado neste aditivo…"
                className={`${formTextareaClass} pl-9`}
                disabled={camposSomenteLeitura}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="ad-valor-original" className={formLabelClass}>
              Valor original (R$)
            </label>
            <div className="relative mt-1">
              <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="ad-valor-original"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={formatCurrencyFromCents(Number.parseInt(adValAntDigits || "0", 10) || 0)}
                onChange={(e) => setAdValAntDigits(digitsOnly(e.target.value))}
                className={formInputWithIconClass}
                aria-label="Valor original em reais"
                disabled={camposSomenteLeitura}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="ad-valor-novo" className={formLabelClass}>
              Novo valor (R$)
            </label>
            <div className="relative mt-1">
              <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="ad-valor-novo"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={formatCurrencyFromCents(Number.parseInt(adValNovoDigits || "0", 10) || 0)}
                onChange={(e) => setAdValNovoDigits(digitsOnly(e.target.value))}
                className={formInputWithIconClass}
                aria-label="Novo valor em reais"
                disabled={camposSomenteLeitura}
              />
            </div>
          </div>
        </div>
        {(contrato.aditivos ?? []).length > 0 ? (
          <ul className="mt-6 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-700">
            {(contrato.aditivos ?? []).map((a) => {
              const tipoMeta = getAditivoTipoMeta(a.tipo);
              const TipoIcon = tipoMeta.Icon;
              return (
              <li
                key={a.id}
                className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800/60"
              >
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-slate-900 dark:text-slate-100">
                  <span
                    className={clsx(
                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                      tipoMeta.chipClass
                    )}
                  >
                    <TipoIcon className={clsx("h-3 w-3 shrink-0", tipoMeta.iconClass)} aria-hidden />
                    {tipoMeta.badgeLabel}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500" aria-hidden>
                    —
                  </span>
                  <span className="min-w-0">{a.titulo}</span>
                </p>
                {a.descricao && (
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{a.descricao}</p>
                )}
                <p className="mt-1 text-[11px] text-slate-500">
                  {formatDateDMY(a.createdAt)}
                  {a.valorAnterior != null || a.valorNovo != null
                    ? ` · Valor ${a.valorAnterior != null ? formatCurrency(a.valorAnterior) : "—"} → ${a.valorNovo != null ? formatCurrency(a.valorNovo) : "—"}`
                    : ""}
                </p>
              </li>
            );
            })}
          </ul>
        ) : null}
      </div>
      )}

      {activeTab === "historico" && (
        <div id={`${tabListId}-historico-panel`} role="tabpanel" aria-labelledby={`${tabListId}-tab-historico`} className="space-y-4">
          <div>
            <div className="relative">
              <MessageSquare className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <textarea
                value={histComentario}
                onChange={(e) => setHistComentario(e.target.value)}
                placeholder="Registre atualização, decisão ou observação deste contrato..."
                rows={3}
                className={`${formTextareaClass} pl-9`}
                disabled={camposSomenteLeitura}
              />
            </div>
            <div className="mt-3">
              <MultiFileAttachment existingFiles={[]} newFiles={histArquivos} onNewFilesChange={setHistArquivos} />
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => void salvarHistorico()}
                disabled={camposSomenteLeitura || saving || !hasHistoricoInput}
                className={formModalSubmitButtonClass}
              >
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4 shrink-0" aria-hidden />
                  {saving ? "Salvando..." : "Adicionar"}
                </span>
              </button>
            </div>
          </div>
          <ul className="relative space-y-0 border-t border-slate-200 pt-6 dark:border-slate-700">
            <span className="absolute bottom-2 left-[11px] top-2 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
            {historico.length === 0 ? (
              <li className="text-sm text-slate-500 dark:text-slate-400">Nenhuma interação registrada ainda.</li>
            ) : (
              historico.map((h) => (
                <li key={h.id} className="relative flex gap-3 pb-6 last:pb-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                    <History className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{formatDateDMY(h.data)}</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{h.titulo}</p>
                    {h.descricao ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-400">{h.descricao}</p>
                    ) : null}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
      </div>
      {hasFooterActions && (
        <div
          className={clsx(
            "flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:justify-end sm:gap-3 lg:px-6",
            embedded ? "" : "sticky bottom-0 z-20"
          )}
        >
          <button type="button" className={formModalCancelButtonClass} onClick={resetCurrentTab} disabled={saving}>
            <span className="inline-flex items-center gap-2">
              <X className="h-4 w-4 shrink-0" aria-hidden />
              Cancelar
            </span>
          </button>
          <button
            type="button"
            className={formModalSubmitButtonClass}
            onClick={runFooterPrimaryAction}
            disabled={saving || (activeTab === "aditivo" && !adTitulo.trim())}
          >
            <span className="inline-flex items-center gap-2">
              <Save className={clsx("h-4 w-4 shrink-0", saving && "animate-pulse")} aria-hidden />
              {saving ? "Salvando…" : "Salvar"}
            </span>
          </button>
        </div>
      )}
    </section>
  );
}

export default function ContratoDetalhePage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const podeVer = useResourcePageGuard(CONTRATOS_RESOURCE);
  if (!podeVer) return null;
  return <ContratoDetalheView id={id} />;
}
