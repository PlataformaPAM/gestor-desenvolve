"use client";

import { useEffect, useId, useMemo, useState } from "react";
import clsx from "clsx";
import { motion } from "framer-motion";
import {
  Landmark,
  Tags,
  CreditCard,
  Trash2,
  Plus,
  Check,
  X,
  ChevronRight,
  Wallet,
  PiggyBank,
  Circle,
  ArrowDownLeft,
  ArrowUpRight,
  GitCompareArrows,
  ScanLine,
  Barcode,
  ArrowRightLeft,
  FileText,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import { Toast } from "@/components/ui/toast";
import { AlertDialog } from "@/components/ui/alert-dialog";
import type {
  FinanceiroCategoriaTipo,
  FinanceiroConta,
  FinanceiroCategoria,
  FinanceiroMeioPagamento,
} from "@/lib/financeiro/types";
import {
  COLOR_OPTIONS,
  CONTA_PRESETS,
  type ContaPreset,
  defaultCategoriaVisual,
  normalizeContaPresetId,
  type VisualMeta,
  visualStorageKey,
  FINANCEIRO_CONTA_VISUALS_UPDATE_EVENT,
} from "@/lib/financeiro/visuals";
import {
  formInputClass,
  formLabelClass,
  formModalSubmitButtonClass,
} from "@/components/ui/field-patterns";
import {
  SearchableSelect,
  type SearchableOption,
} from "@/components/ui/searchable-select";
import { iconForMeioPagamentoNome, meioPagamentoIconColorClass } from "@/lib/financeiro/meio-pagamento-icon";

const formInputWithIconClass = `${formInputClass} pl-9`;

const CATEGORIA_TIPO_OPTIONS: SearchableOption[] = [
  {
    value: "entrada",
    label: "Entrada",
    icon: ({ className }) => (
      <TrendingUp className={clsx(className, "!text-emerald-600 dark:!text-emerald-400")} />
    ),
  },
  {
    value: "saida",
    label: "Saída",
    icon: ({ className }) => (
      <TrendingDown className={clsx(className, "!text-red-600 dark:!text-red-400")} />
    ),
  },
  {
    value: "ambos",
    label: "Ambos",
    icon: ({ className }) => (
      <GitCompareArrows className={clsx(className, "!text-amber-600 dark:!text-amber-400")} />
    ),
  },
];

type TabId = "contas" | "categorias" | "meios";

type PendingDeleteFinanceiro =
  | { tipo: "conta"; id: string; nome: string }
  | { tipo: "categoria"; id: string; nome: string }
  | { tipo: "meio"; id: string; nome: string };

type FinanceiroConfigDrawerProps = {
  open: boolean;
  onClose: () => void;
  contas: FinanceiroConta[];
  categorias: FinanceiroCategoria[];
  meiosPagamento: FinanceiroMeioPagamento[];
  onAtualizado: () => Promise<void>;
};

function centsFromCurrencyInput(v: string): number {
  const digits = v.replace(/\D/g, "");
  return Number.parseInt(digits || "0", 10);
}

function formatCurrencyFromCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  const payload = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return payload?.error?.message ?? fallback;
}

function iconFromKey(icon: string): React.ElementType {
  const key = icon.toLowerCase();
  if (key === "wallet") return Wallet;
  if (key === "piggy-bank") return PiggyBank;
  if (key === "credit-card") return CreditCard;
  if (key === "arrow-down-left") return ArrowDownLeft;
  if (key === "arrow-up-right") return ArrowUpRight;
  if (key === "git-compare-arrows") return GitCompareArrows;
  if (key === "scan-line") return ScanLine;
  if (key === "barcode") return Barcode;
  if (key === "arrow-right-left") return ArrowRightLeft;
  if (key === "file-text") return FileText;
  if (key === "circle") return Circle;
  return Landmark;
}

function sanitizeContaStored(raw: VisualMeta & { logoPath?: string }): VisualMeta {
  const presetId = normalizeContaPresetId(raw.presetId);
  const preset = CONTA_PRESETS.find((p) => p.id === presetId) ?? CONTA_PRESETS[2];
  return {
    icon: preset.icon,
    color: raw.color || preset.defaultColor,
    presetId,
  };
}

function getContaVisual(nome: string, stored?: VisualMeta): VisualMeta {
  if (stored) return sanitizeContaStored(stored as VisualMeta & { logoPath?: string });
  const fallback = CONTA_PRESETS[2] ?? CONTA_PRESETS[0];
  return {
    icon: fallback.icon,
    color: fallback.defaultColor,
    presetId: fallback.id,
  };
}

function renderContaPresetVisual(preset: ContaPreset, color: string) {
  const Icon = iconFromKey(preset.icon);
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800"
      title={preset.label}
    >
      <Icon className="h-4 w-4" style={{ color }} />
    </span>
  );
}

export function FinanceiroConfigDrawer({
  open,
  onClose,
  contas,
  categorias,
  meiosPagamento,
  onAtualizado,
}: FinanceiroConfigDrawerProps) {
  const tabId = useId();
  const [tab, setTab] = useState<TabId>("contas");

  const [contasLocal, setContasLocal] = useState<FinanceiroConta[]>([]);
  const [categoriasLocal, setCategoriasLocal] = useState<FinanceiroCategoria[]>([]);
  const [meiosLocal, setMeiosLocal] = useState<FinanceiroMeioPagamento[]>([]);

  const [novaConta, setNovaConta] = useState({ nome: "", saldoInicialCents: 0 });
  const [novaCat, setNovaCat] = useState({ nome: "", tipo: "entrada" as FinanceiroCategoriaTipo });
  const [novoMeio, setNovoMeio] = useState("");
  const [contaPresetId, setContaPresetId] = useState(CONTA_PRESETS[0]?.id ?? "carteira");
  const [contaCorCustom, setContaCorCustom] = useState(CONTA_PRESETS[0]?.defaultColor ?? "#64748B");
  const [contaVisualById, setContaVisualById] = useState<Record<string, VisualMeta>>({});

  const [saving, setSaving] = useState<string>("");

  const [editingContaId, setEditingContaId] = useState("");
  const [editingCatId, setEditingCatId] = useState("");
  const [editingMeioId, setEditingMeioId] = useState("");

  const [editContaNome, setEditContaNome] = useState("");
  const [editContaSaldoCents, setEditContaSaldoCents] = useState(0);
  const [editCatNome, setEditCatNome] = useState("");
  const [editCatTipo, setEditCatTipo] = useState<FinanceiroCategoriaTipo>("entrada");
  const [editMeioNome, setEditMeioNome] = useState("");
  const [toast, setToast] = useState<{ visible: boolean; message: string; variant: "success" | "error" }>({
    visible: false,
    message: "",
    variant: "success",
  });
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteFinanceiro | null>(null);

  const showToast = (message: string, variant: "success" | "error") => {
    setToast({ visible: true, message, variant });
  };

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(visualStorageKey("conta"));
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, VisualMeta & { logoPath?: string }>;
      if (parsed && typeof parsed === "object") {
        const next: Record<string, VisualMeta> = {};
        for (const [id, v] of Object.entries(parsed)) {
          next[id] = sanitizeContaStored(v);
        }
        setContaVisualById(next);
      }
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(visualStorageKey("conta"), JSON.stringify(contaVisualById));
      window.dispatchEvent(new Event(FINANCEIRO_CONTA_VISUALS_UPDATE_EVENT));
    } catch {
      // noop
    }
  }, [contaVisualById]);

  useEffect(() => {
    setContasLocal(contas);
  }, [contas]);
  useEffect(() => {
    setCategoriasLocal(categorias);
  }, [categorias]);
  useEffect(() => {
    setMeiosLocal(meiosPagamento);
  }, [meiosPagamento]);

  const contasOrdenadas = useMemo(
    () => [...contasLocal].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)),
    [contasLocal]
  );
  const categoriasOrdenadas = useMemo(
    () => [...categoriasLocal].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)),
    [categoriasLocal]
  );
  const meiosOrdenados = useMemo(
    () => [...meiosLocal].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)),
    [meiosLocal]
  );

  const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: "contas", label: "Contas", icon: Landmark },
    { id: "categorias", label: "Categorias", icon: Tags },
    { id: "meios", label: "Meios de Pagamento", icon: CreditCard },
  ];

  const recarregar = async () => {
    await onAtualizado();
  };

  const criarConta = async () => {
    const nome = novaConta.nome.trim();
    if (!nome) return;
    setSaving("create-conta");
    const res = await fetch("/api/financeiro/contas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome,
        saldoInicial: novaConta.saldoInicialCents / 100,
      }),
    });
    if (!res.ok) {
      showToast(await parseErrorMessage(res, "Não foi possível salvar a conta."), "error");
      setSaving("");
      return;
    }
    const json = (await res.json().catch(() => null)) as { data?: { conta?: FinanceiroConta } } | null;
    if (json?.data?.conta) {
      const created = json.data.conta;
      setContasLocal((prev) => [...prev, created]);
      const preset = CONTA_PRESETS.find((p) => p.id === contaPresetId) ?? CONTA_PRESETS[0];
      if (preset) {
        setContaVisualById((prev) => ({
          ...prev,
          [created.id]: {
            icon: preset.icon,
            color: contaCorCustom,
            presetId: preset.id,
          },
        }));
      }
    }
    setNovaConta({ nome: "", saldoInicialCents: 0 });
    await recarregar();
    showToast("Conta criada com sucesso.", "success");
    setSaving("");
  };

  const salvarConta = async (id: string) => {
    const nome = editContaNome.trim();
    if (!nome) return;
    setSaving(`edit-conta-${id}`);
    const res = await fetch(`/api/financeiro/contas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, saldoInicial: editContaSaldoCents / 100 }),
    });
    if (!res.ok) {
      showToast(await parseErrorMessage(res, "Não foi possível editar a conta."), "error");
      setSaving("");
      return;
    }
    const json = (await res.json().catch(() => null)) as { data?: { conta?: FinanceiroConta } } | null;
    if (json?.data?.conta) {
      const updated = json.data.conta;
      setContasLocal((prev) => prev.map((x) => (x.id === id ? updated : x)));
    }
    setEditingContaId("");
    await recarregar();
    showToast("Conta atualizada com sucesso.", "success");
    setSaving("");
  };

  const executarExclusaoConta = async (id: string) => {
    const backup = contasLocal;
    setContasLocal((prev) => prev.filter((x) => x.id !== id));
    const res = await fetch(`/api/financeiro/contas/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setContasLocal(backup);
      showToast(await parseErrorMessage(res, "Não foi possível excluir a conta."), "error");
      return;
    }
    await recarregar();
    showToast("Conta excluída com sucesso.", "success");
  };

  const criarCategoria = async () => {
    const nome = novaCat.nome.trim();
    if (!nome) return;
    setSaving("create-categoria");
    const res = await fetch("/api/financeiro/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, tipo: novaCat.tipo }),
    });
    if (!res.ok) {
      showToast(await parseErrorMessage(res, "Não foi possível salvar a categoria."), "error");
      setSaving("");
      return;
    }
    const json = (await res.json().catch(() => null)) as { data?: { categoria?: FinanceiroCategoria } } | null;
    if (json?.data?.categoria) {
      setCategoriasLocal((prev) => [...prev, json.data!.categoria!]);
    }
    setNovaCat({ nome: "", tipo: "entrada" });
    await recarregar();
    showToast("Categoria criada com sucesso.", "success");
    setSaving("");
  };

  const salvarCategoria = async (id: string) => {
    const nome = editCatNome.trim();
    if (!nome) return;
    setSaving(`edit-categoria-${id}`);
    const res = await fetch(`/api/financeiro/categorias/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, tipo: editCatTipo }),
    });
    if (!res.ok) {
      showToast(await parseErrorMessage(res, "Não foi possível editar a categoria."), "error");
      setSaving("");
      return;
    }
    const json = (await res.json().catch(() => null)) as { data?: { categoria?: FinanceiroCategoria } } | null;
    if (json?.data?.categoria) {
      const updated = json.data.categoria;
      setCategoriasLocal((prev) => prev.map((x) => (x.id === id ? updated : x)));
    }
    setEditingCatId("");
    await recarregar();
    showToast("Categoria atualizada com sucesso.", "success");
    setSaving("");
  };

  const executarExclusaoCategoria = async (id: string) => {
    const backup = categoriasLocal;
    setCategoriasLocal((prev) => prev.filter((x) => x.id !== id));
    const res = await fetch(`/api/financeiro/categorias/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setCategoriasLocal(backup);
      showToast(await parseErrorMessage(res, "Não foi possível excluir a categoria."), "error");
      return;
    }
    await recarregar();
    showToast("Categoria excluída com sucesso.", "success");
  };

  const criarMeio = async () => {
    const nome = novoMeio.trim();
    if (!nome) return;
    setSaving("create-meio");
    const res = await fetch("/api/financeiro/meios-pagamento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    });
    if (!res.ok) {
      showToast(await parseErrorMessage(res, "Não foi possível salvar o meio de pagamento."), "error");
      setSaving("");
      return;
    }
    const json = (await res.json().catch(() => null)) as { data?: { meio?: FinanceiroMeioPagamento } } | null;
    if (json?.data?.meio) {
      setMeiosLocal((prev) => [...prev, json.data!.meio!]);
    }
    setNovoMeio("");
    await recarregar();
    showToast("Meio de pagamento criado com sucesso.", "success");
    setSaving("");
  };

  const salvarMeio = async (id: string) => {
    const nome = editMeioNome.trim();
    if (!nome) return;
    setSaving(`edit-meio-${id}`);
    const res = await fetch(`/api/financeiro/meios-pagamento/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    });
    if (!res.ok) {
      showToast(await parseErrorMessage(res, "Não foi possível editar o meio de pagamento."), "error");
      setSaving("");
      return;
    }
    const json = (await res.json().catch(() => null)) as { data?: { meio?: FinanceiroMeioPagamento } } | null;
    if (json?.data?.meio) {
      const updated = json.data.meio;
      setMeiosLocal((prev) => prev.map((x) => (x.id === id ? updated : x)));
    }
    setEditingMeioId("");
    await recarregar();
    showToast("Meio de pagamento atualizado com sucesso.", "success");
    setSaving("");
  };

  const executarExclusaoMeio = async (id: string) => {
    const backup = meiosLocal;
    setMeiosLocal((prev) => prev.filter((x) => x.id !== id));
    const res = await fetch(`/api/financeiro/meios-pagamento/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setMeiosLocal(backup);
      showToast(await parseErrorMessage(res, "Não foi possível excluir o meio de pagamento."), "error");
      return;
    }
    await recarregar();
    showToast("Meio de pagamento excluído com sucesso.", "success");
  };

  const confirmarExclusaoPendente = async () => {
    if (!pendingDelete) return;
    const p = pendingDelete;
    if (p.tipo === "conta") await executarExclusaoConta(p.id);
    else if (p.tipo === "categoria") await executarExclusaoCategoria(p.id);
    else await executarExclusaoMeio(p.id);
  };

  return (
    <DrawerSheet
      open={open}
      onClose={onClose}
      title="Configurações do Financeiro"
      mobileContentPaddingClassName="px-0"
      desktopContentPaddingClassName="px-0"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          role="tablist"
          aria-label="Configurações do financeiro"
          className="shrink-0 flex w-full flex-wrap border-b border-slate-300 bg-slate-50/50 dark:border-slate-600 dark:bg-slate-800/50"
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`${tabId}-${t.id}`}
                aria-selected={isActive}
                aria-controls={`${tabId}-${t.id}-panel`}
                onClick={() => setTab(t.id)}
                className={clsx(
                  "relative flex min-w-0 flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "text-[#6D28D9] dark:text-violet-300"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="financeiro-config-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6D28D9]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                  />
                )}
                <Icon className="h-4 w-4" />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 lg:p-6">
        {tab === "contas" && (
          <section id={`${tabId}-contas-panel`} role="tabpanel" aria-labelledby={`${tabId}-contas`} className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-900">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={`${tabId}-nova-conta-nome`} className={formLabelClass}>
                    Nome
                  </label>
                  <div className="relative mt-1">
                    <Landmark className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id={`${tabId}-nova-conta-nome`}
                      className={formInputWithIconClass}
                      placeholder="Ex.: Conta corrente"
                      value={novaConta.nome}
                      onChange={(e) => setNovaConta((p) => ({ ...p, nome: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor={`${tabId}-nova-conta-saldo`} className={formLabelClass}>
                    Saldo inicial
                  </label>
                  <div className="relative mt-1">
                    <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id={`${tabId}-nova-conta-saldo`}
                      className={formInputWithIconClass}
                      placeholder="R$ 0,00"
                      value={formatCurrencyFromCents(novaConta.saldoInicialCents)}
                      onChange={(e) => setNovaConta((p) => ({ ...p, saldoInicialCents: centsFromCurrencyInput(e.target.value) }))}
                      inputMode="numeric"
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <p className={formLabelClass}>Ícone</p>
                  <div className="mt-1 grid grid-cols-4 gap-2 sm:max-w-md">
                    {CONTA_PRESETS.map((p) => {
                      const selected = contaPresetId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setContaPresetId(p.id);
                            setContaCorCustom(p.defaultColor);
                          }}
                          className={clsx(
                            "inline-flex items-center justify-center rounded-xl border p-1.5",
                            selected
                              ? "border-[#6D28D9] ring-2 ring-[#6D28D9]/25"
                              : "border-slate-200 hover:border-slate-300 dark:border-slate-600"
                          )}
                          aria-label={p.label}
                          title={p.label}
                        >
                          {renderContaPresetVisual(p, selected ? contaCorCustom : p.defaultColor)}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <p className={formLabelClass}>Cor do ícone</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setContaCorCustom(c)}
                        className={clsx(
                          "h-6 w-6 rounded-full border",
                          contaCorCustom === c ? "border-slate-900 ring-2 ring-slate-300" : "border-slate-300"
                        )}
                        style={{ backgroundColor: c }}
                        aria-label={`Cor ${c}`}
                      />
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void criarConta()}
                  disabled={saving === "create-conta"}
                  className={clsx(formModalSubmitButtonClass, "sm:col-span-2")}
                >
                  <span className="inline-flex items-center gap-2">
                    <Plus className="h-4 w-4 shrink-0" aria-hidden />
                    Adicionar
                  </span>
                </button>
              </div>
            </div>
            {contasOrdenadas.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-600 dark:bg-slate-800/70"
              >
                {editingContaId === c.id ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px_auto]">
                    <div className="relative min-w-0">
                      <Landmark className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        className={formInputWithIconClass}
                        value={editContaNome}
                        onChange={(e) => setEditContaNome(e.target.value)}
                      />
                    </div>
                    <div className="relative min-w-0">
                      <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        className={formInputWithIconClass}
                        value={formatCurrencyFromCents(editContaSaldoCents)}
                        onChange={(e) => setEditContaSaldoCents(centsFromCurrencyInput(e.target.value))}
                        inputMode="numeric"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void salvarConta(c.id)}
                        disabled={saving === `edit-conta-${c.id}`}
                        className="rounded-lg bg-emerald-600 p-2 text-white hover:bg-emerald-700 disabled:opacity-50"
                        aria-label="Salvar"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingContaId("")}
                        className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                        aria-label="Cancelar"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingContaId(c.id);
                        setEditContaNome(c.nome);
                        setEditContaSaldoCents(Math.round(c.saldoInicial * 100));
                      }}
                      className="min-w-0 flex flex-1 items-center justify-between rounded-lg px-1 py-1 text-left hover:bg-slate-100/80 dark:hover:bg-slate-700/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {(() => {
                            const v = getContaVisual(c.nome, contaVisualById[c.id]);
                            const Icon = iconFromKey(v?.icon ?? "landmark");
                            return (
                              <span className="mr-1 inline-flex h-4 w-4 items-center justify-center align-[-2px]">
                                <Icon className="h-4 w-4" style={{ color: v?.color ?? "#64748B" }} />
                              </span>
                            );
                          })()}
                          {c.nome}{" "}
                          {c.padrao ? (
                            <span className="text-xs text-[#6D28D9] dark:text-violet-400">(padrão)</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c.saldoInicial)}
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPendingDelete({ tipo: "conta", id: c.id, nome: c.nome })}
                        className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                        aria-label="Excluir conta"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {tab === "categorias" && (
          <section id={`${tabId}-categorias-panel`} role="tabpanel" aria-labelledby={`${tabId}-categorias`} className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-900">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_minmax(160px,220px)_auto] sm:items-end">
                <div>
                  <label htmlFor={`${tabId}-nova-cat-nome`} className={formLabelClass}>
                    Nome
                  </label>
                  <div className="relative mt-1">
                    <Tags className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id={`${tabId}-nova-cat-nome`}
                      className={formInputWithIconClass}
                      placeholder="Ex.: Receita recorrente"
                      value={novaCat.nome}
                      onChange={(e) => setNovaCat((p) => ({ ...p, nome: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className={formLabelClass}>Tipo</label>
                  <div className="mt-1">
                    <SearchableSelect
                      options={CATEGORIA_TIPO_OPTIONS}
                      value={novaCat.tipo}
                      onChange={(v) => setNovaCat((p) => ({ ...p, tipo: v as FinanceiroCategoriaTipo }))}
                      placeholder="Tipo"
                      searchable={false}
                      leadingIcon={GitCompareArrows}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void criarCategoria()}
                  disabled={saving === "create-categoria"}
                  className={formModalSubmitButtonClass}
                >
                  <span className="inline-flex items-center gap-2">
                    <Plus className="h-4 w-4 shrink-0" aria-hidden />
                    Adicionar
                  </span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(88px,120px)] items-center px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <span>Categoria</span>
              <span className="text-right">Tipo</span>
            </div>
            {categoriasOrdenadas.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-600 dark:bg-slate-800/70"
              >
                {editingCatId === c.id ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_minmax(160px,220px)_auto] sm:items-end">
                    <div className="relative min-w-0">
                      <Tags className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        className={formInputWithIconClass}
                        value={editCatNome}
                        onChange={(e) => setEditCatNome(e.target.value)}
                      />
                    </div>
                    <SearchableSelect
                      options={CATEGORIA_TIPO_OPTIONS}
                      value={editCatTipo}
                      onChange={(v) => setEditCatTipo(v as FinanceiroCategoriaTipo)}
                      placeholder="Tipo"
                      searchable={false}
                      leadingIcon={GitCompareArrows}
                    />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void salvarCategoria(c.id)}
                        disabled={saving === `edit-categoria-${c.id}`}
                        className="rounded-lg bg-emerald-600 p-2 text-white hover:bg-emerald-700 disabled:opacity-50"
                        aria-label="Salvar"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCatId("")}
                        className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                        aria-label="Cancelar"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCatId(c.id);
                        setEditCatNome(c.nome);
                        setEditCatTipo(c.tipo);
                      }}
                      className="min-w-0 flex flex-1 items-center justify-between rounded-lg px-1 py-1 text-left hover:bg-slate-100/80 dark:hover:bg-slate-700/50"
                    >
                      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(88px,120px)] items-center gap-2">
                        <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {(() => {
                            const v = defaultCategoriaVisual(c.tipo);
                            const Icon = iconFromKey(v.icon);
                            return <Icon className="mr-1 inline h-4 w-4" style={{ color: v.color }} />;
                          })()}
                          {c.nome}
                        </div>
                        <span
                          className={clsx(
                            "text-right text-xs font-semibold",
                            c.tipo === "entrada" && "text-emerald-700 dark:text-emerald-300",
                            c.tipo === "saida" && "text-red-700 dark:text-red-300",
                            c.tipo === "ambos" && "text-amber-700 dark:text-amber-300"
                          )}
                        >
                          {c.tipo === "entrada" ? "Entrada" : c.tipo === "saida" ? "Saída" : "Ambos (definir)"}
                        </span>
                      </div>
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPendingDelete({ tipo: "categoria", id: c.id, nome: c.nome })}
                        className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                        aria-label="Excluir categoria"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {tab === "meios" && (
          <section id={`${tabId}-meios-panel`} role="tabpanel" aria-labelledby={`${tabId}-meios`} className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-900">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label htmlFor={`${tabId}-novo-meio`} className={formLabelClass}>
                    Nome
                  </label>
                  <div className="relative mt-1">
                    {(() => {
                      const MeioIcon = iconForMeioPagamentoNome(novoMeio.trim() || " ");
                      return (
                        <MeioIcon
                          className={clsx(
                            "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2",
                            meioPagamentoIconColorClass(novoMeio)
                          )}
                        />
                      );
                    })()}
                    <input
                      id={`${tabId}-novo-meio`}
                      className={formInputWithIconClass}
                      placeholder="Ex.: PIX, Boleto, Cartão…"
                      value={novoMeio}
                      onChange={(e) => setNovoMeio(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void criarMeio()}
                  disabled={saving === "create-meio"}
                  className={clsx(formModalSubmitButtonClass, "shrink-0")}
                >
                  <span className="inline-flex items-center gap-2">
                    <Plus className="h-4 w-4 shrink-0" aria-hidden />
                    Adicionar
                  </span>
                </button>
              </div>
            </div>
            {meiosOrdenados.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-600 dark:bg-slate-800/70"
              >
                {editingMeioId === m.id ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div className="relative min-w-0">
                      {(() => {
                        const MeioIcon = iconForMeioPagamentoNome(editMeioNome.trim() || " ");
                        return (
                          <MeioIcon
                            className={clsx(
                              "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2",
                              meioPagamentoIconColorClass(editMeioNome)
                            )}
                          />
                        );
                      })()}
                      <input
                        className={formInputWithIconClass}
                        value={editMeioNome}
                        onChange={(e) => setEditMeioNome(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void salvarMeio(m.id)}
                        disabled={saving === `edit-meio-${m.id}`}
                        className="rounded-lg bg-emerald-600 p-2 text-white hover:bg-emerald-700 disabled:opacity-50"
                        aria-label="Salvar"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingMeioId("")}
                        className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                        aria-label="Cancelar"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMeioId(m.id);
                        setEditMeioNome(m.nome);
                      }}
                      className="min-w-0 flex flex-1 items-center justify-between rounded-lg px-1 py-1 text-left hover:bg-slate-100/80 dark:hover:bg-slate-700/50"
                    >
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {(() => {
                          const MeioIcon = iconForMeioPagamentoNome(m.nome);
                          return (
                            <MeioIcon
                              className={clsx(
                                "mr-1 inline h-4 w-4 shrink-0",
                                meioPagamentoIconColorClass(m.nome)
                              )}
                            />
                          );
                        })()}
                        {m.nome}
                      </p>
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPendingDelete({ tipo: "meio", id: m.id, nome: m.nome })}
                        className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                        aria-label="Excluir meio"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}
        </div>
      </div>
      <Toast
        visible={toast.visible}
        message={toast.message}
        variant={toast.variant}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />

      <AlertDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmarExclusaoPendente()}
        title={
          pendingDelete?.tipo === "conta"
            ? "Excluir conta?"
            : pendingDelete?.tipo === "categoria"
              ? "Excluir categoria?"
              : "Excluir meio de pagamento?"
        }
        description={
          pendingDelete ? (
            <div className="space-y-2">
              <p>
                <strong className="text-slate-900 dark:text-slate-100">Esta ação é irreversível.</strong> O cadastro{" "}
                <strong className="text-slate-900 dark:text-slate-100">{pendingDelete.nome}</strong> será excluído
                permanentemente.
              </p>
              {pendingDelete.tipo === "conta" ? (
                <p className="text-slate-600 dark:text-slate-400">
                  Lançamentos que usavam esta conta podem ficar sem conta associada.
                </p>
              ) : null}
            </div>
          ) : null
        }
        cancelLabel="Cancelar"
        confirmLabel="Sim, excluir permanentemente"
        destructive
      />
    </DrawerSheet>
  );
}
