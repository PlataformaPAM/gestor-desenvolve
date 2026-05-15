"use client";

import { useState, useEffect, useRef } from "react";
import type { ComponentType } from "react";
import clsx from "clsx";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  Plus,
  GripVertical,
  Package,
  Layers,
  ChevronRight,
  Pencil,
  Save,
  FileText,
  Link2,
  Tag,
  Wallet,
  Briefcase,
  GraduationCap,
  Hash,
  Cpu,
  CheckCircle2,
  CircleSlash2,
  Settings2,
  Handshake,
  UserRoundCheck,
  Wrench,
  X,
  Circle,
  RefreshCw,
  ListOrdered,
  Flag,
  ClipboardList,
  Clock,
  Target,
} from "lucide-react";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import { usePageHeader } from "@/contexts/page-header-context";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import {
  formInputClass,
  formLabelClass,
  formModalCancelButtonClass,
  formModalSubmitButtonClass,
  formTextareaClass,
} from "@/components/ui/field-patterns";

const formInputWithIconClass = `${formInputClass} pl-9`;

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** Igual ao campo Valor (R$) do lançamento financeiro: centavos → texto com R$. */
function formatCurrencyFromCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

// --- Types ---
export type RecorrenciaSolucao = "mensal" | "unica" | "parcelado";
export type TipoSolucao = "produto" | "servico";

export type PlaybookSubEtapa = {
  id: string;
  tituloTarefa: string;
  descricaoComoFazer: string;
  slaDias: number;
  resultadoEsperado: string;
};

export type PlaybookEtapa = {
  id: string;
  titulo: string;
  filhos: PlaybookSubEtapa[];
};

export type Solucao = {
  id: string;
  nome: string;
  logoUrl?: string;
  descricaoTecnica: string;
  categoria: string;
  tipo: TipoSolucao;
  valorVenda: number;
  recorrencia: RecorrenciaSolucao;
  /** Parcelas sugeridas na proposta quando recorrência é parcelado (mín. 2). */
  parcelasPadrao: number;
  regrasContrato: string;
  playbook: PlaybookEtapa[];
  ativo?: boolean;
};

const RECORRENCIA_LABELS: Record<RecorrenciaSolucao, string> = {
  unica: "Única",
  mensal: "Fixo mensal",
  parcelado: "Parcelado",
};

/** Mesmos ícones/cores do tipo de recorrência no Financeiro (Único / Fixo mensal / Parcelado). */
const RECORRENCIA_ICON: Record<RecorrenciaSolucao, ComponentType<{ className?: string }>> = {
  unica: Circle,
  mensal: RefreshCw,
  parcelado: ListOrdered,
};

const RECORRENCIA_ICON_COLOR: Record<RecorrenciaSolucao, string> = {
  unica: "!text-emerald-600 dark:!text-emerald-400",
  mensal: "!text-blue-600 dark:!text-blue-400",
  parcelado: "!text-violet-600 dark:!text-violet-400",
};

/** Categorias fixas para o select na aba Dados Básicos */
const CATEGORIAS_SOLUCAO = [
  "Assessoria",
  "Capacitação",
  "Consultoria",
  "Mentoria",
  "Serviço",
  "Software",
] as const;
export type CategoriaSolucao = (typeof CATEGORIAS_SOLUCAO)[number];
const CATEGORIA_OPTIONS: SearchableOption[] = [
  {
    value: "",
    label: "Selecione a categoria",
  },
  {
    value: "Assessoria",
    label: "Assessoria",
    icon: ({ className }) => <Handshake className={clsx(className, "!text-cyan-600 dark:!text-cyan-400")} />,
  },
  {
    value: "Capacitação",
    label: "Capacitação",
    icon: ({ className }) => <GraduationCap className={clsx(className, "!text-emerald-600 dark:!text-emerald-400")} />,
  },
  {
    value: "Consultoria",
    label: "Consultoria",
    icon: ({ className }) => <Briefcase className={clsx(className, "!text-violet-600 dark:!text-violet-400")} />,
  },
  {
    value: "Mentoria",
    label: "Mentoria",
    icon: ({ className }) => <UserRoundCheck className={clsx(className, "!text-amber-600 dark:!text-amber-400")} />,
  },
  {
    value: "Serviço",
    label: "Serviço",
    icon: ({ className }) => <Wrench className={clsx(className, "!text-orange-600 dark:!text-orange-400")} />,
  },
  {
    value: "Software",
    label: "Software",
    icon: ({ className }) => <Settings2 className={clsx(className, "!text-indigo-500 dark:!text-indigo-400")} />,
  },
];
const STATUS_OPTIONS: SearchableOption[] = [
  {
    value: "ativo",
    label: "Ativo",
    icon: ({ className }) => <CheckCircle2 className={clsx(className, "!text-emerald-600 dark:!text-emerald-400")} />,
  },
  {
    value: "inativo",
    label: "Inativo",
    icon: ({ className }) => <CircleSlash2 className={clsx(className, "!text-slate-500 dark:!text-slate-400")} />,
  },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function countPlaybookSteps(playbook: PlaybookEtapa[]): number {
  return playbook.reduce((acc, e) => acc + e.filhos.length, 0);
}

// --- Page ---
export default function SolucoesPage() {
  const { setPrimaryAction } = usePageHeader();
  const [solucoes, setSolucoes] = useState<Solucao[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingSolucao, setEditingSolucao] = useState<Solucao | null>(null);
  const [activeTab, setActiveTab] = useState<"dados" | "comercial" | "playbook">("dados");

  useEffect(() => {
    setPrimaryAction({
      label: "Nova Solução",
      showPlusIcon: true,
      onClick: () => {
        setEditingSolucao(null);
        setSheetOpen(true);
        setActiveTab("dados");
      },
    });
    return () => setPrimaryAction(null);
  }, [setPrimaryAction]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/solucoes/bootstrap", { cache: "no-store" });
        if (!res.ok) throw new Error("Falha");
        const data = (await res.json()) as { data?: { solucoes?: Solucao[] } };
        if (!active) return;
        setSolucoes(data?.data?.solucoes ?? []);
      } catch {
        if (!active) return;
        setSolucoes([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const openSheet = (solucao: Solucao) => {
    setEditingSolucao(solucao);
    setSheetOpen(true);
    setActiveTab("dados");
  };
  const handleToggleAtivo = (solucao: Solucao) => {
    const updated = { ...solucao, ativo: !(solucao.ativo ?? true) };
    setSolucoes((prev) => prev.map((s) => (s.id === solucao.id ? updated : s)));
    void fetch(`/api/solucoes/${solucao.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ solucao: updated }),
    });
  };

  const handleCloseSheet = () => {
    setSheetOpen(false);
    setEditingSolucao(null);
  };

  const handleSalvarSheet = (sol: Solucao) => {
    const finalSol = {
      ...sol,
      parcelasPadrao: sol.parcelasPadrao ?? 12,
      id:
        sol.id ||
        (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `sol-${Math.random().toString(36).slice(2, 10)}`),
    };
    if (solucoes.some((s) => s.id === finalSol.id)) {
      setSolucoes((prev) => prev.map((s) => (s.id === finalSol.id ? finalSol : s)));
      void (async () => {
        const res = await fetch(`/api/solucoes/${finalSol.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ solucao: finalSol }),
        });
        if (!res.ok) return;
        const bootstrap = await fetch("/api/solucoes/bootstrap", { cache: "no-store" });
        if (!bootstrap.ok) return;
        const data = (await bootstrap.json()) as { data?: { solucoes?: Solucao[] } };
        setSolucoes(data?.data?.solucoes ?? []);
      })();
    } else {
      setSolucoes((prev) => [...prev, finalSol]);
      void (async () => {
        const res = await fetch("/api/solucoes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ solucao: finalSol }),
        });
        if (!res.ok) return;
        const bootstrap = await fetch("/api/solucoes/bootstrap", { cache: "no-store" });
        if (!bootstrap.ok) return;
        const data = (await bootstrap.json()) as { data?: { solucoes?: Solucao[] } };
        setSolucoes(data?.data?.solucoes ?? []);
      })();
    }
    handleCloseSheet();
  };

  const sheetTitle =
    editingSolucao === null
      ? "Nova Solução"
      : editingSolucao.nome.trim() || "Nova Solução";
  const currentFormData = editingSolucao ?? {
    id: "",
    nome: "",
    logoUrl: "",
    descricaoTecnica: "",
    categoria: "",
    tipo: "servico" as TipoSolucao,
    valorVenda: 0,
    recorrencia: "unica" as RecorrenciaSolucao,
    parcelasPadrao: 12,
    regrasContrato: "",
    playbook: [],
    ativo: true,
  };

  return (
    <div className="min-h-full w-full bg-slate-50 dark:bg-slate-950">
      {/* Grid de cards — primeiro elemento abaixo do padding do shell */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {solucoes.map((sol) => (
            <div
              key={sol.id}
              role="button"
              tabIndex={0}
              onClick={() => openSheet(sol)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openSheet(sol);
                }
              }}
              className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:focus-visible:ring-offset-slate-950"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  {sol.logoUrl ? (
                    <img src={sol.logoUrl} alt={`Logo ${sol.nome}`} className="h-8 w-8 rounded object-contain" />
                  ) : (
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                      <Cpu className="h-4 w-4" />
                    </span>
                  )}
                  <h3 className="min-w-0 truncate font-semibold text-slate-900 dark:text-slate-100">{sol.nome}</h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Valor prévio: {formatCurrency(sol.valorVenda)}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Categoria: {sol.categoria || "Não informada"}</p>
                {countPlaybookSteps(sol.playbook) > 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Playbook: {countPlaybookSteps(sol.playbook)} etapa{countPlaybookSteps(sol.playbook) > 1 ? "s" : ""}
                  </p>
                ) : null}
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Status: {(sol.ativo ?? true) ? "Ativo" : "Inativo"}
                </p>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleAtivo(sol);
                  }}
                  className={`rounded-lg border px-2 py-1 text-xs font-semibold transition-colors ${
                    (sol.ativo ?? true)
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                      : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {(sol.ativo ?? true) ? "Ativo" : "Inativo"}
                </button>
                <span className="inline-flex items-center gap-1 text-slate-400" aria-hidden>
                  <Pencil className="h-4 w-4" />
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>
            </div>
        ))}
      </div>

      {solucoes.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          Nenhuma solução cadastrada.
        </div>
      )}

      {/* Sheet: criação/edição com 3 tabs */}
      <DrawerSheet
        open={sheetOpen}
        onClose={handleCloseSheet}
        title={sheetTitle}
        maxWidth="sm:max-w-3xl"
        mobileContentPaddingClassName="px-0"
        desktopContentPaddingClassName="px-0"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Tabs */}
          <div className="sticky top-0 z-30 flex shrink-0 border-b border-slate-300 bg-slate-50/95 backdrop-blur-sm dark:border-slate-600 dark:bg-slate-800/95">
            {(
              [
                { id: "dados" as const, label: "Dados Básicos" },
                { id: "comercial" as const, label: "Comercial" },
                { id: "playbook" as const, label: "Playbook (Pós-Venda)" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "relative flex-1 px-4 py-3 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "text-[#6D28D9] dark:text-violet-400"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                )}
              >
                {activeTab === tab.id ? <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6D28D9]" /> : null}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 lg:p-6">
              {activeTab === "dados" && (
                <SolucaoTabDados solucao={editingSolucao} onSolucaoChange={(s) => setEditingSolucao(s)} />
              )}
              {activeTab === "comercial" && (
                <SolucaoTabComercial solucao={editingSolucao} onSolucaoChange={(s) => setEditingSolucao(s)} />
              )}
              {activeTab === "playbook" && (
                <SolucaoTabPlaybook solucao={editingSolucao} onSolucaoChange={(s) => setEditingSolucao(s)} />
              )}
            </div>
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:justify-end sm:gap-3 lg:px-6">
              <button
                type="button"
                onClick={handleCloseSheet}
                className={formModalCancelButtonClass}
              >
                <span className="inline-flex items-center gap-2">
                  <X className="h-4 w-4 shrink-0" aria-hidden />
                  Cancelar
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleSalvarSheet(currentFormData)}
                className={formModalSubmitButtonClass}
              >
                <span className="inline-flex items-center gap-2">
                  <Save className="h-4 w-4 shrink-0" aria-hidden />
                  Salvar
                </span>
              </button>
            </div>
          </div>
        </div>
      </DrawerSheet>
    </div>
  );
}

// --- Tab 1: Dados Básicos ---
function SolucaoTabDados({
  solucao,
  onSolucaoChange,
}: {
  solucao: Solucao | null;
  onSolucaoChange: (s: Solucao | null) => void;
}) {
  const data = solucao ?? {
    id: "",
    nome: "",
    logoUrl: "",
    descricaoTecnica: "",
    categoria: "",
    tipo: "servico" as TipoSolucao,
    valorVenda: 0,
    recorrencia: "unica" as RecorrenciaSolucao,
    parcelasPadrao: 12,
    regrasContrato: "",
    playbook: [],
    ativo: true,
  };

  const update = (patch: Partial<Solucao>) => {
    if (solucao) onSolucaoChange({ ...solucao, ...patch });
    else onSolucaoChange({ ...data, ...patch, id: data.id || `sol-${Date.now()}` });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className={formLabelClass}>Nome</label>
        <div className="relative mt-1">
          <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={data.nome}
            onChange={(e) => update({ nome: e.target.value })}
            placeholder="Ex.: Consultoria Financeira"
            className={`${formInputClass} pl-9`}
          />
        </div>
      </div>
      <div>
        <label className={formLabelClass}>Descrição Técnica</label>
        <div className="relative mt-1">
          <FileText className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <textarea
            value={data.descricaoTecnica}
            onChange={(e) => update({ descricaoTecnica: e.target.value })}
            placeholder="Descreva a solução, escopo e entregas..."
            rows={4}
            className={`${formTextareaClass} pl-9`}
          />
        </div>
      </div>
      <div>
        <label className={formLabelClass}>Logo (URL)</label>
        <div className="relative mt-1">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="url"
            value={data.logoUrl ?? ""}
            onChange={(e) => update({ logoUrl: e.target.value })}
            placeholder="https://..."
            className={`${formInputClass} pl-9`}
          />
        </div>
      </div>
      <div>
        <label className={formLabelClass}>Categoria</label>
        <div className="mt-1">
          <SearchableSelect
            options={CATEGORIA_OPTIONS}
            value={data.categoria}
            onChange={(v) => update({ categoria: v })}
            searchable={false}
            placeholder="Selecione a categoria..."
            leadingIcon={Tag}
          />
        </div>
      </div>
      <div>
        <label className={formLabelClass}>Status</label>
        <div className="mt-1">
          <SearchableSelect
            options={STATUS_OPTIONS}
            value={(data.ativo ?? true) ? "ativo" : "inativo"}
            onChange={(v) => update({ ativo: v === "ativo" })}
            searchable={false}
            placeholder="Selecione o status"
            leadingIcon={(data.ativo ?? true) ? CheckCircle2 : CircleSlash2}
          />
        </div>
      </div>
    </div>
  );
}

// --- Tab 2: Comercial ---
function SolucaoTabComercial({
  solucao,
  onSolucaoChange,
}: {
  solucao: Solucao | null;
  onSolucaoChange: (s: Solucao | null) => void;
}) {
  const data = solucao ?? {
    id: "",
    nome: "",
    logoUrl: "",
    descricaoTecnica: "",
    categoria: "",
    tipo: "servico" as TipoSolucao,
    valorVenda: 0,
    recorrencia: "unica" as RecorrenciaSolucao,
    parcelasPadrao: 12,
    regrasContrato: "",
    playbook: [],
    ativo: true,
  };

  const syncKey = solucao?.id ?? "__novo__";
  const [valorDigits, setValorDigits] = useState(() =>
    String(Math.round((data.valorVenda || 0) * 100))
  );

  useEffect(() => {
    setValorDigits(String(Math.round((data.valorVenda || 0) * 100)));
  }, [syncKey]);

  const update = (patch: Partial<Solucao>) => {
    if (solucao) onSolucaoChange({ ...solucao, ...patch });
    else onSolucaoChange({ ...data, ...patch, id: data.id || `sol-${Date.now()}` });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className={formLabelClass}>Valor de Venda (R$)</label>
        <div className="relative mt-1">
          <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={formatCurrencyFromCents(Number.parseInt(valorDigits || "0", 10) || 0)}
            onChange={(e) => {
              const d = digitsOnly(e.target.value);
              setValorDigits(d);
              const cents = Number.parseInt(d || "0", 10) || 0;
              update({ valorVenda: cents / 100 });
            }}
            className={formInputWithIconClass}
            aria-label="Valor de venda em reais"
          />
        </div>
      </div>
      <div>
        <label className={formLabelClass}>Forma de pagamento (referência comercial)</label>
        <p className="mb-2 text-xs text-slate-500">
          Usado como sugestão na proposta; o Financeiro pode ajustar ao lançar no caixa.
        </p>
        <div className="flex flex-wrap gap-2">
          {(["unica", "mensal", "parcelado"] as RecorrenciaSolucao[]).map((r) => {
            const Icon = RECORRENCIA_ICON[r];
            const selected = data.recorrencia === r;
            return (
            <button
              key={r}
              type="button"
              onClick={() =>
                update({
                  recorrencia: r,
                  parcelasPadrao:
                    r === "parcelado" ? Math.max(2, data.parcelasPadrao ?? 12) : data.parcelasPadrao,
                })
              }
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                selected
                  ? "border-[#6D28D9] bg-[#6D28D9] text-white"
                  : "border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <Icon
                className={clsx(
                  "h-4 w-4 shrink-0",
                  selected ? "!text-white" : RECORRENCIA_ICON_COLOR[r]
                )}
                aria-hidden
              />
              {RECORRENCIA_LABELS[r]}
            </button>
            );
          })}
          {data.recorrencia === "parcelado" && (
            <div className="relative">
              <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="number"
                min={2}
                max={60}
                value={Math.max(2, data.parcelasPadrao ?? 12)}
                onChange={(e) =>
                  update({
                    parcelasPadrao: Math.min(60, Math.max(2, parseInt(e.target.value, 10) || 2)),
                  })
                }
                className={`w-36 ${formInputClass} pl-9`}
                placeholder="Parcelas"
              />
            </div>
          )}
        </div>
      </div>
      <div>
        <label className={formLabelClass}>Regras de Contrato</label>
        <div className="relative mt-1">
          <Tag className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <textarea
            value={data.regrasContrato}
            onChange={(e) => update({ regrasContrato: e.target.value })}
            placeholder="Condições de pagamento, reembolso, SLA..."
            rows={4}
            className={`${formTextareaClass} pl-9`}
          />
        </div>
      </div>
    </div>
  );
}

// --- Tab 3: Playbook (construtor hierárquico) ---
type PendingPlaybookRemove =
  | { kind: "etapa"; index: number; titulo: string }
  | { kind: "sub"; etapaIndex: number; subIndex: number; titulo: string };

function SolucaoTabPlaybook({
  solucao,
  onSolucaoChange,
}: {
  solucao: Solucao | null;
  onSolucaoChange: (s: Solucao | null) => void;
}) {
  const [pendingRemovePlaybook, setPendingRemovePlaybook] = useState<PendingPlaybookRemove | null>(null);
  const draftSolucaoIdRef = useRef<string | null>(null);
  const draftSolucaoSeq = useRef(0);
  const etapaIdSeq = useRef(0);

  useEffect(() => {
    if (solucao) draftSolucaoIdRef.current = null;
  }, [solucao]);

  const data = solucao ?? {
    id: "",
    nome: "",
    logoUrl: "",
    descricaoTecnica: "",
    categoria: "",
    tipo: "servico" as TipoSolucao,
    valorVenda: 0,
    recorrencia: "unica" as RecorrenciaSolucao,
    parcelasPadrao: 12,
    regrasContrato: "",
    playbook: [],
  };

  const update = (patch: Partial<Solucao>) => {
    if (solucao) onSolucaoChange({ ...solucao, ...patch });
    else {
      let nextId = data.id;
      if (!nextId) {
        if (!draftSolucaoIdRef.current) {
          draftSolucaoSeq.current += 1;
          draftSolucaoIdRef.current = `sol-draft-${draftSolucaoSeq.current}`;
        }
        nextId = draftSolucaoIdRef.current;
      }
      onSolucaoChange({ ...data, ...patch, id: nextId });
    }
  };

  const addEtapaPai = () => {
    etapaIdSeq.current += 1;
    const nova: PlaybookEtapa = {
      id: `etapa-${etapaIdSeq.current}`,
      titulo: "Nova Fase",
      filhos: [],
    };
    update({ playbook: [...data.playbook, nova] });
  };

  const updateEtapa = (index: number, etapa: PlaybookEtapa) => {
    const next = [...data.playbook];
    next[index] = etapa;
    update({ playbook: next });
  };

  const removeEtapa = (index: number) => {
    update({ playbook: data.playbook.filter((_, i) => i !== index) });
  };

  const addSubEtapa = (etapaIndex: number) => {
    const etapa = data.playbook[etapaIndex];
    if (!etapa) return;
    const nova: PlaybookSubEtapa = {
      id: `sub-${Date.now()}`,
      tituloTarefa: "",
      descricaoComoFazer: "",
      slaDias: 0,
      resultadoEsperado: "",
    };
    const updated = { ...etapa, filhos: [...etapa.filhos, nova] };
    updateEtapa(etapaIndex, updated);
  };

  const updateSubEtapa = (
    etapaIndex: number,
    subIndex: number,
    sub: PlaybookSubEtapa
  ) => {
    const etapa = data.playbook[etapaIndex];
    if (!etapa) return;
    const next = [...etapa.filhos];
    next[subIndex] = sub;
    updateEtapa(etapaIndex, { ...etapa, filhos: next });
  };

  const removeSubEtapa = (etapaIndex: number, subIndex: number) => {
    const etapa = data.playbook[etapaIndex];
    if (!etapa) return;
    updateEtapa(etapaIndex, {
      ...etapa,
      filhos: etapa.filhos.filter((_, i) => i !== subIndex),
    });
  };

  const handlePlaybookDragEnd = (result: DropResult) => {
    const { source, destination, type } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const playbookStages = data.playbook;
    const newStages = JSON.parse(JSON.stringify(playbookStages)) as PlaybookEtapa[];

    if (type === "parent") {
      const [movedStage] = newStages.splice(source.index, 1);
      newStages.splice(destination.index, 0, movedStage);
      update({ playbook: newStages });
      return;
    }

    if (type === "child") {
      const sourceParentIndex = newStages.findIndex((stage) => stage.id === source.droppableId);
      const destParentIndex = newStages.findIndex((stage) => stage.id === destination.droppableId);

      if (sourceParentIndex === -1 || destParentIndex === -1) return;

      const [movedSubStage] = newStages[sourceParentIndex].filhos.splice(source.index, 1);
      newStages[destParentIndex].filhos.splice(destination.index, 0, movedSubStage);

      update({ playbook: newStages });
      return;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="min-w-0 text-sm leading-relaxed text-slate-600">
          Monte o checklist de entrega (Pós-Venda). Etapas pai agrupam sub-etapas com SLA e resultado esperado.
        </p>
        <button
          type="button"
          onClick={addEtapaPai}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#6D28D9] px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
        >
          <Layers className="h-4 w-4" />
          Adicionar Etapa Pai
        </button>
      </div>

      {data.playbook.length > 0 && (
        <DragDropContext onDragEnd={handlePlaybookDragEnd}>
          <Droppable droppableId="board" type="parent">
            {(parentDroppableProvided) => (
              <div
                ref={parentDroppableProvided.innerRef}
                {...parentDroppableProvided.droppableProps}
                className="space-y-6"
              >
                {data.playbook.map((etapa, etapaIndex) => (
                  <Draggable
                    key={String(etapa.id)}
                    draggableId={String(etapa.id)}
                    index={etapaIndex}
                  >
                  {(parentProvided, parentSnapshot) => (
                    <div
                      ref={parentProvided.innerRef}
                      {...parentProvided.draggableProps}
                      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 transition-shadow ${
                        parentSnapshot.isDragging ? "shadow-lg bg-slate-50 dark:bg-slate-800" : ""
                      }`}
                    >
                      {/* Etapa Pai */}
                      <div className="flex items-center gap-2">
                        <span
                          {...parentProvided.dragHandleProps}
                          className="cursor-grab active:cursor-grabbing text-slate-400 touch-none"
                          aria-hidden
                        >
                          <GripVertical className="h-4 w-4" />
                        </span>
                        <div className="relative min-w-0 flex-1">
                          <Flag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                          <input
                            type="text"
                            value={etapa.titulo}
                            onChange={(e) =>
                              updateEtapa(etapaIndex, { ...etapa, titulo: e.target.value })
                            }
                            placeholder="Ex.: Fase 1: Onboarding"
                            className={`w-full ${formInputClass} pl-9 font-medium`}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingRemovePlaybook({
                              kind: "etapa",
                              index: etapaIndex,
                              titulo: etapa.titulo.trim() || "esta etapa",
                            })
                          }
                          className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          aria-label="Remover etapa"
                        >
                          ×
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => addSubEtapa(etapaIndex)}
                        className="mt-3 ml-6 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-[#6D28D9] hover:border-[#6D28D9] hover:bg-[#6D28D9]/5"
                      >
                        <Plus className="h-4 w-4" />
                        Adicionar Sub-etapa
                      </button>

                      {/* Sub-etapas (Droppable + Draggable) */}
                      <Droppable droppableId={etapa.id} type="child">
                        {(subDroppableProvided) => (
                          <div
                            ref={subDroppableProvided.innerRef}
                            {...subDroppableProvided.droppableProps}
                            className="mt-4 space-y-4 border-l-2 border-slate-200 pl-4 ml-6 min-h-[40px]"
                          >
                            {etapa.filhos.map((sub, subIndex) => (
                              <Draggable
                                key={String(sub.id)}
                                draggableId={String(sub.id)}
                                index={subIndex}
                              >
                                {(subProvided, subSnapshot) => (
                                  <div
                                    ref={subProvided.innerRef}
                                    {...subProvided.draggableProps}
                                    className={`rounded-lg border border-slate-100 p-4 transition-shadow ${
                                      subSnapshot.isDragging
                                        ? "shadow-lg bg-slate-50 dark:bg-slate-800"
                                        : "bg-slate-50/50 dark:bg-slate-800/40"
                                    }`}
                                  >
                                    <div className="flex items-start gap-2">
                                      <span
                                        {...subProvided.dragHandleProps}
                                        className="mt-2 cursor-grab active:cursor-grabbing text-slate-400 touch-none shrink-0"
                                        aria-hidden
                                      >
                                        <GripVertical className="h-4 w-4" />
                                      </span>
                                      <div className="min-w-0 flex-1 space-y-3">
                                        <div className="relative">
                                          <ClipboardList className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                                          <input
                                            type="text"
                                            value={sub.tituloTarefa}
                                            onChange={(e) =>
                                              updateSubEtapa(etapaIndex, subIndex, {
                                                ...sub,
                                                tituloTarefa: e.target.value,
                                              })
                                            }
                                            placeholder="Título da Tarefa"
                                            className={`w-full ${formInputClass} pl-9 font-medium`}
                                          />
                                        </div>
                                        <div>
                                          <label className={formLabelClass}>
                                            Descrição / Como Fazer
                                          </label>
                                          <div className="relative mt-1">
                                            <FileText className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" aria-hidden />
                                            <textarea
                                              value={sub.descricaoComoFazer}
                                              onChange={(e) =>
                                                updateSubEtapa(etapaIndex, subIndex, {
                                                  ...sub,
                                                  descricaoComoFazer: e.target.value,
                                                })
                                              }
                                              placeholder="Passo a passo ou orientação..."
                                              rows={2}
                                              className={`w-full ${formTextareaClass} pl-9`}
                                            />
                                          </div>
                                        </div>
                                        <div className="flex flex-wrap items-end gap-4">
                                          <div className="w-28 sm:w-32">
                                            <label className={formLabelClass} htmlFor={`sla-${etapa.id}-${sub.id}`}>
                                              SLA (dias)
                                            </label>
                                            <div className="relative mt-1">
                                              <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                                              <input
                                                id={`sla-${etapa.id}-${sub.id}`}
                                                type="number"
                                                min={0}
                                                value={sub.slaDias}
                                                onChange={(e) =>
                                                  updateSubEtapa(etapaIndex, subIndex, {
                                                    ...sub,
                                                    slaDias: Number(e.target.value) || 0,
                                                  })
                                                }
                                                className={`w-full ${formInputClass} pl-9 tabular-nums`}
                                              />
                                            </div>
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <label className={formLabelClass} htmlFor={`resultado-${etapa.id}-${sub.id}`}>
                                              Resultado Esperado
                                            </label>
                                            <div className="relative mt-1">
                                              <Target className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                                              <input
                                                id={`resultado-${etapa.id}-${sub.id}`}
                                                type="text"
                                                value={sub.resultadoEsperado}
                                                onChange={(e) =>
                                                  updateSubEtapa(etapaIndex, subIndex, {
                                                    ...sub,
                                                    resultadoEsperado: e.target.value,
                                                  })
                                                }
                                                placeholder="Entregável ou critério de conclusão"
                                                className={`w-full ${formInputClass} pl-9`}
                                              />
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setPendingRemovePlaybook({
                                                kind: "sub",
                                                etapaIndex,
                                                subIndex,
                                                titulo: sub.tituloTarefa.trim() || "esta sub-etapa",
                                              })
                                            }
                                            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                            aria-label="Remover sub-etapa"
                                          >
                                            ×
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {subDroppableProvided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  )}
                </Draggable>
              ))}
                {parentDroppableProvided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {data.playbook.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center dark:border-slate-600 dark:bg-slate-800/40">
          <Package className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Nenhuma etapa de playbook ainda.</p>
          <button
            type="button"
            onClick={addEtapaPai}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#6D28D9] px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
          >
            <Layers className="h-4 w-4" />
            Adicionar Etapa Pai
          </button>
        </div>
      )}

      <AlertDialog
        open={!!pendingRemovePlaybook}
        onClose={() => setPendingRemovePlaybook(null)}
        onConfirm={() => {
          if (!pendingRemovePlaybook) return;
          if (pendingRemovePlaybook.kind === "etapa") {
            removeEtapa(pendingRemovePlaybook.index);
          } else {
            removeSubEtapa(pendingRemovePlaybook.etapaIndex, pendingRemovePlaybook.subIndex);
          }
        }}
        title={
          pendingRemovePlaybook?.kind === "sub"
            ? "Remover sub-etapa do playbook?"
            : "Remover fase do playbook?"
        }
        description={
          pendingRemovePlaybook ? (
            <>
              <strong className="text-slate-900 dark:text-slate-100">Esta ação é irreversível ao salvar a solução:</strong>{" "}
              <strong className="text-slate-900 dark:text-slate-100">{pendingRemovePlaybook.titulo}</strong> e{" "}
              {pendingRemovePlaybook.kind === "etapa"
                ? "todas as sub-etapas dentro dela serão excluídas."
                : "seus dados serão excluídos do playbook."}
            </>
          ) : null
        }
        cancelLabel="Cancelar"
        confirmLabel="Sim, excluir permanentemente"
        destructive
      />
    </div>
  );
}
