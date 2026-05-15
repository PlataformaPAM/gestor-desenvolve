"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Filter, Search } from "lucide-react";
import type { Cliente } from "@/lib/clientes/types";
import { formatCurrency } from "@/lib/clientes/utils";
import type {
  FinanceiroCategoria,
  FinanceiroConta,
  FinanceiroMeioPagamento,
  FornecedorRhSlim,
  Lancamento,
} from "@/lib/financeiro/types";
import { usePageHeader } from "@/contexts/page-header-context";
import { LancamentosTable } from "@/components/financeiro/lancamentos-table";
import { LancamentoForm } from "@/components/financeiro/lancamento-form";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import { Toast } from "@/components/ui/toast";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { ClientePerfil360 } from "@/components/clientes/cliente-perfil-360";
import {
  descricaoParaExibicao,
  normalizeTextoAlertaMatch,
  parseValorReaisDeTexto,
  statusFinanceiroEfetivo,
} from "@/lib/financeiro/lancamento-utils";
import { subscribeAlertsUpdated } from "@/lib/alerts/live-sync";
import {
  appendFixoMensalLinhas,
  buildPayloadsForRecurrenceScope,
  getGroupMembers,
  getRecurrenceRootId,
  hasLancamentoEdicaoDiff,
  isRecorrenciaPagamento,
} from "@/lib/financeiro/recurrence-save";
import { RecurrenceScopeDialog } from "@/components/financeiro/recurrence-scope-dialog";

type ExtratoBootstrap = {
  data?: {
    lancamentos?: Lancamento[];
    clientes?: Cliente[];
    fornecedoresRh?: FornecedorRhSlim[];
    contas?: FinanceiroConta[];
    categorias?: FinanceiroCategoria[];
    meiosPagamento?: FinanceiroMeioPagamento[];
  };
};

function monthBounds(year: number, month: number) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start, end };
}

function inDateRange(isoDate: string, start: Date, end: Date) {
  const d = new Date(isoDate);
  d.setHours(0, 0, 0, 0);
  const s = new Date(start);
  s.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(23, 59, 59, 999);
  return d >= s && d <= e;
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

function lancamentoTemVinculoFechamento(l: Lancamento, todos: Lancamento[]): boolean {
  if (l.leadIdOrigem) return true;
  if (!l.idPai) return false;
  const pai = todos.find((x) => x.id === l.idPai);
  return !!pai?.leadIdOrigem;
}

export default function FinanceiroExtratoPage() {
  const router = useRouter();
  const { setPrimaryAction, setSecondaryAction } = usePageHeader();
  const now = new Date();
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [fornecedoresRh, setFornecedoresRh] = useState<FornecedorRhSlim[]>([]);
  const [categorias, setCategorias] = useState<FinanceiroCategoria[]>([]);
  const [contas, setContas] = useState<FinanceiroConta[]>([]);
  const [meios, setMeios] = useState<FinanceiroMeioPagamento[]>([]);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<"todos" | "entrada" | "saida">("todos");
  const [status, setStatus] = useState<"todos" | Lancamento["status"]>("todos");
  const [categoriaId, setCategoriaId] = useState("todos");
  const [contaId, setContaId] = useState("todos");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const [drawerEditarOpen, setDrawerEditarOpen] = useState(false);
  const [lancamentoEmEdicao, setLancamentoEmEdicao] = useState<Lancamento | null>(null);
  const [cliente360, setCliente360] = useState<Cliente | null>(null);
  const [perfil360Open, setPerfil360Open] = useState(false);
  const [lancamentoParaExcluir, setLancamentoParaExcluir] = useState<Lancamento | null>(null);
  const [pendingLancamentoAction, setPendingLancamentoAction] = useState<Record<string, boolean>>({});
  const [pendingByLancamentoId, setPendingByLancamentoId] = useState<Record<string, number>>({});
  const [origemContratoIdEdit, setOrigemContratoIdEdit] = useState<string | null>(null);
  const [recurrenceScopeOpen, setRecurrenceScopeOpen] = useState(false);
  const [pendingRecurrence, setPendingRecurrence] = useState<{ initial: Lancamento; edited: Lancamento } | null>(
    null
  );
  const [recurrenceSaving, setRecurrenceSaving] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; variant: "success" | "error" }>({
    visible: false,
    message: "",
    variant: "success",
  });

  const showToast = useCallback((message: string, variant: "success" | "error") => {
    setToast({ visible: true, message, variant });
  }, []);

  useLayoutEffect(() => {
    setSecondaryAction(null);
  }, [setSecondaryAction]);

  useEffect(() => {
    setSecondaryAction(null);
    setPrimaryAction({
      label: "Voltar ao Financeiro",
      onClick: () => router.push("/financeiro"),
      showPlusIcon: false,
      tone: "navigation",
    });
    return () => {
      setPrimaryAction(null);
      setSecondaryAction(null);
    };
  }, [router, setPrimaryAction, setSecondaryAction]);

  const aplicarBootstrap = useCallback((data: ExtratoBootstrap["data"]) => {
    setLancamentos(data?.lancamentos ?? []);
    setClientes(data?.clientes ?? []);
    setFornecedoresRh(data?.fornecedoresRh ?? []);
    setCategorias(data?.categorias ?? []);
    setContas(data?.contas ?? []);
    setMeios(data?.meiosPagamento ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await fetch("/api/financeiro/bootstrap", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as ExtratoBootstrap;
      if (!active) return;
      aplicarBootstrap(json.data);
    })();
    return () => {
      active = false;
    };
  }, [aplicarBootstrap]);

  const refetchBootstrapSilencioso = useCallback(async () => {
    try {
      const res = await fetch("/api/financeiro/bootstrap", { cache: "no-store" });
      if (!res.ok) return;
      const json = await parseJsonSafe<ExtratoBootstrap>(res);
      aplicarBootstrap(json?.data);
    } catch {
      // noop
    }
  }, [aplicarBootstrap]);

  const { start, end } = useMemo(() => {
    if (customStart && customEnd) {
      return { start: new Date(customStart), end: new Date(customEnd) };
    }
    return monthBounds(year, month);
  }, [customStart, customEnd, year, month]);

  const clientesMap = useMemo(() => new Map(clientes.map((c) => [c.id, c] as const)), [clientes]);
  const categoriasMap = useMemo(() => new Map(categorias.map((c) => [c.id, c] as const)), [categorias]);
  const contasMap = useMemo(() => new Map(contas.map((c) => [c.id, c] as const)), [contas]);
  const meiosMap = useMemo(() => new Map(meios.map((m) => [m.id, m] as const)), [meios]);

  /** Lançamentos do período (mês ou intervalo De/Até) + demais filtros; ordenados por vencimento, próximo primeiro. */
  const lancamentosParaTabela = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return lancamentos
      .filter((l) => inDateRange(l.vencimento, start, end))
      .filter((l) => (tipo === "todos" ? true : l.tipo === tipo))
      .filter((l) => (status === "todos" ? true : statusFinanceiroEfetivo(l) === status))
      .filter((l) => (categoriaId === "todos" ? true : (l.categoriaId ?? "") === categoriaId))
      .filter((l) => (contaId === "todos" ? true : (l.contaId ?? "") === contaId))
      .filter((l) => {
        if (!q) return true;
        const cliente = l.clienteId ? clientesMap.get(l.clienteId) : null;
        const bag = [
          l.descricao,
          cliente?.nome ?? "",
          cliente?.empresa ?? "",
          l.fornecedor ?? "",
          categoriasMap.get(l.categoriaId ?? "")?.nome ?? "",
          contasMap.get(l.contaId ?? "")?.nome ?? "",
          meiosMap.get(l.meioPagamentoId ?? "")?.nome ?? l.formaPagamento ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return bag.includes(q);
      })
      .sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime());
  }, [
    busca,
    categoriaId,
    categoriasMap,
    clientesMap,
    contaId,
    contasMap,
    end,
    lancamentos,
    meiosMap,
    start,
    status,
    tipo,
  ]);

  const resumo = useMemo(() => {
    const entradas = lancamentosParaTabela.filter((r) => r.tipo === "entrada").reduce((s, r) => s + r.valor, 0);
    const saidas = lancamentosParaTabela.filter((r) => r.tipo === "saida").reduce((s, r) => s + r.valor, 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [lancamentosParaTabela]);

  const defaultContaId = useMemo(
    () => contas.find((c) => c.padrao && c.ativo)?.id ?? contas.find((c) => c.ativo)?.id ?? "",
    [contas]
  );

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

  const solicitarExclusaoLancamento = useCallback(
    (l: Lancamento) => {
      if (pendingLancamentoAction[l.id]) return;
      setLancamentoParaExcluir(l);
    },
    [pendingLancamentoAction]
  );

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
      setLancamentoParaExcluir(null);
      showToast("Lançamento excluído com sucesso.", "success");
      await refetchBootstrapSilencioso();
    },
    [pendingLancamentoAction, lancamentoEmEdicao?.id, showToast, refetchBootstrapSilencioso]
  );

  const alternarBaixaLancamento = async (l: Lancamento) => {
    if (pendingLancamentoAction[l.id]) return;
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
  };

  const monthOnlyLabel = new Date(year, month, 1).toLocaleDateString("pt-BR", { month: "long" });
  const monthRuler = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const offset = i - 2;
      const d = new Date(year, month + offset, 1);
      return {
        y: d.getFullYear(),
        m: d.getMonth(),
        label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        fullLabel: d.toLocaleDateString("pt-BR", { month: "long" }),
        isCurrent: offset === 0,
      };
    });
  }, [month, year]);

  return (
    <section className="w-full min-w-0 space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => {
                const d = new Date(year, month - 1, 1);
                setYear(d.getFullYear());
                setMonth(d.getMonth());
                setCustomStart("");
                setCustomEnd("");
              }}
              className="rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="hidden items-center gap-3 sm:flex">
              {monthRuler.slice(0, 2).map((x) => (
                <button
                  key={`${x.y}-${x.m}`}
                  type="button"
                  onClick={() => {
                    setYear(x.y);
                    setMonth(x.m);
                    setCustomStart("");
                    setCustomEnd("");
                  }}
                  className="text-sm font-medium capitalize text-slate-500 transition-colors hover:text-[#6D28D9] dark:text-slate-400 dark:hover:text-violet-300"
                >
                  {x.label}
                </button>
              ))}
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-[#6D28D9]/35 px-3 py-1.5">
              <span className="text-base font-semibold capitalize text-slate-900 dark:text-slate-100">
                {monthOnlyLabel}
              </span>
              <span className="text-sm font-semibold text-[#6D28D9] dark:text-violet-300">{year}</span>
            </div>
            <div className="hidden items-center gap-3 sm:flex">
              {monthRuler.slice(3).map((x) => (
                <button
                  key={`${x.y}-${x.m}`}
                  type="button"
                  onClick={() => {
                    setYear(x.y);
                    setMonth(x.m);
                    setCustomStart("");
                    setCustomEnd("");
                  }}
                  className="text-sm font-medium capitalize text-slate-500 transition-colors hover:text-[#6D28D9] dark:text-slate-400 dark:hover:text-violet-300"
                >
                  {x.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                const d = new Date(year, month + 1, 1);
                setYear(d.getFullYear());
                setMonth(d.getMonth());
                setCustomStart("");
                setCustomEnd("");
              }}
              className="rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => {
                const h = new Date();
                setYear(h.getFullYear());
                setMonth(h.getMonth());
                setCustomStart("");
                setCustomEnd("");
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-[#6D28D9] px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700"
            >
              <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
              Hoje
            </button>
            <label className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
              De
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            <label className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
              Até
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            <label className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
              Ano
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {Array.from({ length: 9 }, (_, i) => now.getFullYear() - 4 + i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/35 dark:bg-emerald-950/25">
          <p className="text-xs text-emerald-800 dark:text-emerald-200">Entradas</p>
          <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100">{formatCurrency(resumo.entradas)}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-500/35 dark:bg-red-950/25">
          <p className="text-xs text-red-800 dark:text-red-200">Saídas</p>
          <p className="text-xl font-bold text-red-900 dark:text-red-100">{formatCurrency(resumo.saidas)}</p>
        </div>
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-500/35 dark:bg-violet-950/25">
          <p className="text-xs text-violet-800 dark:text-violet-200">Saldo do período</p>
          <p className="text-xl font-bold text-violet-900 dark:text-violet-100">{formatCurrency(resumo.saldo)}</p>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar descrição, cliente, fornecedor..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as typeof tipo)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="todos">Tipo</option>
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="todos">Status</option>
            <option value="pendente">Pendente</option>
            <option value="atrasado">Atrasado</option>
            <option value="pago">Pago</option>
          </select>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            onClick={() => {
              setTipo("todos");
              setStatus("todos");
              setCategoriaId("todos");
              setContaId("todos");
              setBusca("");
            }}
          >
            <Filter className="h-4 w-4" />
            Limpar
          </button>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="todos">Categoria</option>
            {categorias
              .filter((c) => c.ativo)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
          </select>
          <select
            value={contaId}
            onChange={(e) => setContaId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="todos">Conta</option>
            {contas
              .filter((c) => c.ativo)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
          </select>
        </div>
      </div>

      <LancamentosTable
        lancamentos={lancamentosParaTabela}
        clientesMap={clientesMap}
        onVerCliente={openCliente360}
        onEditar={abrirEdicaoLancamento}
        onAlternarBaixa={alternarBaixaLancamento}
        onExcluir={solicitarExclusaoLancamento}
        disabledActionIds={pendingLancamentoAction}
        showTipo
        pendingByLancamentoId={pendingByLancamentoId}
        todosLancamentosParaAlerta={lancamentos}
      />

      <DrawerSheet
        open={drawerEditarOpen}
        onClose={() => {
          setDrawerEditarOpen(false);
          setLancamentoEmEdicao(null);
        }}
        title={lancamentoEmEdicao ? lancamentoEmEdicao.descricao : "Lançamento"}
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
              meiosPagamento={meios}
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

      <DrawerSheet
        open={perfil360Open}
        onClose={closePerfil360}
        title={cliente360 ? `Perfil 360 — ${cliente360.nome}` : "Perfil 360"}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ClientePerfil360 cliente={cliente360} />
        </div>
      </DrawerSheet>

      <Toast
        visible={toast.visible}
        message={toast.message}
        variant={toast.variant}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />

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
    </section>
  );
}
