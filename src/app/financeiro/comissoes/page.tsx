"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  CheckCircle2,
  UserRound,
  Users,
  ListFilter,
  Hourglass,
  Unlock,
  Banknote,
  Ban,
  CalendarRange,
  CalendarDays,
} from "lucide-react";
import type { ComissaoEvento, ComissaoStatus } from "@/lib/comissoes/types";
import { formatCurrency } from "@/lib/clientes/utils";
import { Toast } from "@/components/ui/toast";
import { usePageHeader } from "@/contexts/page-header-context";
import { useAuth } from "@/contexts/auth-context";
import {
  canViewFinanceiroComissoes,
  canViewFinanceiroLancamentos,
} from "@/lib/financeiro/financeiro-nav";
import { useResourcePageGuard } from "@/hooks/use-rbac-resource";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { FormLabel } from "@/components/ui/form-fields/form-label";
import { formModalCancelButtonClass, formModalSubmitButtonClass } from "@/components/ui/field-patterns";

type Resumo = { previsto: number; elegivel: number; aprovado: number; pago: number };

type ApiEnvelope<T> = { success?: boolean; data?: T; error?: { code?: string; message?: string } };

async function parseApiResponse<T>(res: Response): Promise<
  { ok: true; body: ApiEnvelope<T> } | { ok: false; message: string }
> {
  const text = await res.text();
  if (!text.trim()) {
    return {
      ok: false,
      message: `Resposta vazia do servidor${res.status ? ` (${res.status})` : ""}.`,
    };
  }
  try {
    return { ok: true, body: JSON.parse(text) as ApiEnvelope<T> };
  } catch {
    return { ok: false, message: "Resposta inválida do servidor (não é JSON)." };
  }
}

const STATUS_LABEL: Record<ComissaoStatus, string> = {
  prevista: "Prevista",
  elegivel: "Elegível",
  aprovada: "Aprovada",
  paga: "Paga",
  cancelada_tecnica: "Cancelada",
};

const STATUS_OPTIONS: SearchableOption[] = [
  {
    value: "todos",
    label: "Todos os status",
    icon: ListFilter,
    iconClassName: "text-slate-500 dark:text-slate-400",
  },
  {
    value: "prevista",
    label: "Prevista",
    icon: Hourglass,
    iconClassName: "text-sky-600 dark:text-sky-400",
  },
  {
    value: "elegivel",
    label: "Elegível",
    icon: Unlock,
    iconClassName: "text-emerald-600 dark:text-emerald-400",
  },
  {
    value: "aprovada",
    label: "Aprovada",
    icon: CheckCircle2,
    iconClassName: "text-indigo-600 dark:text-indigo-400",
  },
  {
    value: "paga",
    label: "Paga",
    icon: Banknote,
    iconClassName: "text-green-600 dark:text-green-400",
  },
  {
    value: "cancelada_tecnica",
    label: "Cancelada",
    icon: Ban,
    iconClassName: "text-rose-600 dark:text-rose-400",
  },
];

const FINANCEIRO_COMISSOES_RESOURCE = "financeiro.comissoes";

export default function FinanceiroComissoesPage() {
  const router = useRouter();
  const { session } = useAuth();
  const { setPrimaryAction, setSecondaryAction } = usePageHeader();
  const podeVer = useResourcePageGuard(FINANCEIRO_COMISSOES_RESOURCE, "/acesso-negado");
  const podeVoltarAoFinanceiro = canViewFinanceiroLancamentos(session);
  const now = new Date();
  const anoMinimo = 2026;
  const [ano, setAno] = useState(Math.max(now.getFullYear(), anoMinimo));
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [consultorId, setConsultorId] = useState("");
  const [status, setStatus] = useState<ComissaoStatus | "todos">("todos");
  const [consultores, setConsultores] = useState<Array<{ id: string; nome: string }>>([]);
  const [eventos, setEventos] = useState<ComissaoEvento[]>([]);
  const [resumo, setResumo] = useState<Resumo>({ previsto: 0, elegivel: 0, aprovado: 0, pago: 0 });
  const [selecionados, setSelecionados] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; variant: "success" | "error" }>({
    visible: false,
    message: "",
    variant: "success",
  });

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        ano: String(ano),
        mes: String(mes),
        ...(consultorId ? { consultorId } : {}),
        ...(status !== "todos" ? { status } : {}),
      });
      const res = await fetch(`/api/financeiro/comissoes?${qs.toString()}`, { cache: "no-store" });
      const parsed = await parseApiResponse<{
        eventos?: ComissaoEvento[];
        consultores?: Array<{ id: string; nome: string }>;
        resumo?: Resumo;
      }>(res);
      if (!parsed.ok) {
        setToast({ visible: true, message: parsed.message, variant: "error" });
        return;
      }
      const { body } = parsed;
      if (!res.ok || body.success === false) {
        setToast({
          visible: true,
          message: body.error?.message ?? "Não foi possível carregar as comissões.",
          variant: "error",
        });
        return;
      }
      setEventos(body.data?.eventos ?? []);
      setConsultores(body.data?.consultores ?? []);
      setResumo(body.data?.resumo ?? { previsto: 0, elegivel: 0, aprovado: 0, pago: 0 });
      setSelecionados({});
    } finally {
      setLoading(false);
    }
  }, [ano, mes, consultorId, status]);

  useEffect(() => {
    if (podeVoltarAoFinanceiro) {
      setPrimaryAction({
        label: "Voltar ao Financeiro",
        onClick: () => router.push("/financeiro"),
        showPlusIcon: false,
        tone: "navigation",
      });
    } else {
      setPrimaryAction(null);
    }
    return () => {
      setPrimaryAction(null);
      setSecondaryAction(null);
    };
  }, [router, setPrimaryAction, setSecondaryAction, podeVoltarAoFinanceiro]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const idsSelecionados = useMemo(
    () => Object.entries(selecionados).filter(([, checked]) => checked).map(([id]) => id),
    [selecionados]
  );

  const podeAprovarSelecao = useMemo(() => {
    if (!idsSelecionados.length) return false;
    return idsSelecionados.every((id) => eventos.find((e) => e.id === id)?.status === "elegivel");
  }, [idsSelecionados, eventos]);

  const podePagarSelecao = useMemo(() => {
    if (!idsSelecionados.length) return false;
    return idsSelecionados.every((id) => {
      const st = eventos.find((e) => e.id === id)?.status;
      return st === "aprovada" || st === "elegivel";
    });
  }, [idsSelecionados, eventos]);

  const anoOptions = useMemo((): SearchableOption[] => {
    const yEnd = Math.max(new Date().getFullYear(), anoMinimo) + 5;
    const out: SearchableOption[] = [];
    for (let y = anoMinimo; y <= yEnd; y++) {
      out.push({
        value: String(y),
        label: String(y),
        icon: CalendarRange,
        iconClassName: "text-indigo-600 dark:text-indigo-400",
      });
    }
    return out;
  }, []);

  const mesOptions = useMemo((): SearchableOption[] => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const label = new Date(2024, i, 1).toLocaleDateString("pt-BR", { month: "long" });
      return {
        value: String(m),
        label: label.charAt(0).toUpperCase() + label.slice(1),
        icon: CalendarDays,
        iconClassName: "text-teal-600 dark:text-teal-400",
      };
    });
  }, []);

  const consultorOptions = useMemo((): SearchableOption[] => {
    return [
      {
        value: "",
        label: "Todos os consultores",
        icon: Users,
        iconClassName: "text-violet-600 dark:text-violet-400",
      },
      ...consultores.map((c) => ({
        value: c.id,
        label: c.nome,
        icon: UserRound,
        iconClassName: "text-slate-500 dark:text-slate-400",
      })),
    ];
  }, [consultores]);

  const executar = async (acao: "aprovar_lote" | "marcar_pago") => {
    if (!idsSelecionados.length) return;
    const qtd = idsSelecionados.length;
    const res = await fetch("/api/financeiro/comissoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao, ids: idsSelecionados }),
    });
    const parsed = await parseApiResponse<{ updated?: number; loteId?: string | null }>(res);
    if (!parsed.ok) {
      setToast({ visible: true, message: parsed.message, variant: "error" });
      return;
    }
    if (!res.ok || parsed.body.success === false) {
      setToast({
        visible: true,
        message: parsed.body.error?.message ?? "Não foi possível executar a ação.",
        variant: "error",
      });
      return;
    }
    const msgAprovar =
      qtd === 1 ? "Comissão aprovada." : "Comissões aprovadas.";
    const msgPagar =
      qtd === 1 ? "Comissão marcada como paga." : "Comissões marcadas como pagas.";
    setToast({
      visible: true,
      message: acao === "aprovar_lote" ? msgAprovar : msgPagar,
      variant: "success",
    });
    await carregar();
  };

  if (!podeVer) return null;

  return (
    <section className="flex w-full min-w-0 flex-col gap-4 min-h-[calc(100dvh-10.5rem)]">
      <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:flex-1">
              <div>
                <FormLabel>Ano</FormLabel>
                <div className="mt-1">
                  <SearchableSelect
                    options={anoOptions}
                    value={String(ano)}
                    onChange={(v) => setAno(Number(v))}
                    placeholder="Ano…"
                    searchPlaceholder="Buscar ano…"
                    searchable={false}
                    leadingIcon={CalendarRange}
                    leadingIconClassName="text-indigo-600 dark:text-indigo-400"
                  />
                </div>
              </div>
              <div>
                <FormLabel>Mês</FormLabel>
                <div className="mt-1">
                  <SearchableSelect
                    options={mesOptions}
                    value={String(mes)}
                    onChange={(v) => setMes(Number(v))}
                    placeholder="Mês…"
                    searchPlaceholder="Buscar mês…"
                    searchable={false}
                    leadingIcon={CalendarDays}
                    leadingIconClassName="text-teal-600 dark:text-teal-400"
                  />
                </div>
              </div>
              <div>
                <FormLabel>Consultor</FormLabel>
                <div className="mt-1">
                  <SearchableSelect
                    options={consultorOptions}
                    value={consultorId}
                    onChange={setConsultorId}
                    placeholder="Selecionar consultor…"
                    searchPlaceholder="Buscar consultor…"
                    emptyLabel="Nenhum consultor encontrado."
                    leadingIcon={UserRound}
                  />
                </div>
              </div>
              <div>
                <FormLabel>Status</FormLabel>
                <div className="mt-1">
                  <SearchableSelect
                    options={STATUS_OPTIONS}
                    value={status}
                    onChange={(v) => setStatus(v as ComissaoStatus | "todos")}
                    placeholder="Status…"
                    searchPlaceholder="Buscar status…"
                    searchable={false}
                    leadingIcon={ListFilter}
                    leadingIconClassName="text-slate-500 dark:text-slate-400"
                  />
                </div>
              </div>
            </div>
            <div className="flex shrink-0 xl:pl-4">
              <button
                type="button"
                onClick={() => void carregar()}
                className={`${formModalCancelButtonClass} inline-flex items-center gap-2`}
              >
                <RefreshCw className={loading ? "h-4 w-4 shrink-0 animate-spin" : "h-4 w-4 shrink-0"} aria-hidden />
                Atualizar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Previsto", v: resumo.previsto },
              { label: "Elegível", v: resumo.elegivel },
              { label: "Aprovado", v: resumo.aprovado },
              { label: "Pago", v: resumo.pago },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800/50"
              >
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{c.label}</p>
                <p className="mt-1 text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatCurrency(c.v)}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-700/80">
            <button
              type="button"
              disabled={!idsSelecionados.length || !podeAprovarSelecao}
              onClick={() => void executar("aprovar_lote")}
              className={`${formModalCancelButtonClass} inline-flex items-center gap-2 disabled:opacity-50`}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              Aprovar selecionadas
            </button>
            <button
              type="button"
              disabled={!idsSelecionados.length || !podePagarSelecao}
              onClick={() => void executar("marcar_pago")}
              className={`${formModalSubmitButtonClass} inline-flex items-center gap-2 disabled:opacity-50`}
            >
              <Banknote className="h-4 w-4 shrink-0" aria-hidden />
              {idsSelecionados.length === 1 ? "Marcar paga" : "Marcar pagas"}
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
            <tr className="text-left text-slate-600 dark:text-slate-300">
              <th className="px-3 py-2.5">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9]"
                  checked={eventos.length > 0 && idsSelecionados.length === eventos.length}
                  onChange={(e) =>
                    setSelecionados(
                      e.target.checked ? Object.fromEntries(eventos.map((ev) => [ev.id, true])) : {}
                    )
                  }
                />
              </th>
              <th className="px-3 py-2.5 font-medium">Consultor</th>
              <th className="px-3 py-2.5 font-medium">Lead / solução</th>
              <th className="px-3 py-2.5 font-medium">Recebimento</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Comissão</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((ev) => (
              <tr key={ev.id} className="border-t border-slate-200 dark:border-slate-700">
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9]"
                    checked={!!selecionados[ev.id]}
                    onChange={(e) => setSelecionados((prev) => ({ ...prev, [ev.id]: e.target.checked }))}
                  />
                </td>
                <td className="px-3 py-2.5 text-slate-900 dark:text-slate-100">{ev.consultorNome || "—"}</td>
                <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                  <p>{ev.leadNome || ev.leadId}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{ev.solucaoNome || "Sem solução"}</p>
                </td>
                <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                  {new Date(ev.dataRecebimento).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{STATUS_LABEL[ev.status]}</td>
                <td className="px-3 py-2.5 font-medium tabular-nums text-slate-900 dark:text-slate-100">
                  {formatCurrency(ev.valorComissao)}
                </td>
              </tr>
            ))}
            {eventos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-slate-500 dark:text-slate-400">
                  Nenhuma comissão encontrada para os filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Toast
        visible={toast.visible}
        message={toast.message}
        variant={toast.variant}
        onDismiss={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </section>
  );
}
