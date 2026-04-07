"use client";

import { Suspense, useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { usePageHeader } from "@/contexts/page-header-context";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { AlertsTable, type AlertaRow } from "@/components/alertas/alerts-table";
import { emitAlertsUpdated } from "@/lib/alerts/live-sync";

type Alerta = AlertaRow;

type FiltroAlerta = "todas" | "nao_lidas" | "tarefas" | "financeiro" | "sistema" | "comercial" | "contratos" | "helpdesk" | "posVenda";

const FILTROS_QUERY: FiltroAlerta[] = [
  "todas",
  "nao_lidas",
  "tarefas",
  "financeiro",
  "sistema",
  "comercial",
  "contratos",
  "helpdesk",
  "posVenda",
];

function AlertasPageContent() {
  const searchParams = useSearchParams();
  const { setPrimaryAction } = usePageHeader();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [filtro, setFiltro] = useState<FiltroAlerta>("todas");
  const [filtroPrioridade, setFiltroPrioridade] = useState<"todas" | "urgente" | "alta" | "normal">("todas");
  const [alertaToDelete, setAlertaToDelete] = useState<Alerta | null>(null);

  useEffect(() => {
    const q = searchParams.get("filtro");
    if (q && (FILTROS_QUERY as string[]).includes(q)) {
      setFiltro(q as FiltroAlerta);
    }
  }, [searchParams]);

  useEffect(() => {
    setPrimaryAction(null);
    return () => setPrimaryAction(null);
  }, [setPrimaryAction]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/alertas/bootstrap", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { data?: { alertas?: Alerta[] } };
        if (!active) return;
        setAlertas(data?.data?.alertas ?? []);
      } catch {
        // noop
      }
    };
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const alertasFiltrados = useMemo(() => {
    const base = alertas.filter((a) => {
      if (filtro === "todas") return true;
      if (filtro === "nao_lidas") return !a.lida;
      return a.modulo === filtro;
    });
    const byPriority =
      filtroPrioridade === "todas"
        ? base
        : base.filter((a) => (a.prioridade ?? "normal") === filtroPrioridade);
    const prioWeight = (p: Alerta["prioridade"]) => (p === "urgente" ? 3 : p === "alta" ? 2 : 1);
    return [...byPriority].sort((a, b) => {
      if (a.lida !== b.lida) return a.lida ? 1 : -1;
      return prioWeight(b.prioridade) - prioWeight(a.prioridade);
    });
  }, [alertas, filtro, filtroPrioridade]);

  const countByFiltro = useMemo(() => {
    const totalNaoLidas = alertas.filter((a) => !a.lida).length;
    return {
      todas: totalNaoLidas,
      nao_lidas: totalNaoLidas,
      tarefas: alertas.filter((a) => a.modulo === "tarefas" && !a.lida).length,
      financeiro: alertas.filter((a) => a.modulo === "financeiro" && !a.lida).length,
      comercial: alertas.filter((a) => a.modulo === "comercial" && !a.lida).length,
      contratos: alertas.filter((a) => a.modulo === "contratos" && !a.lida).length,
      helpdesk: alertas.filter((a) => a.modulo === "helpdesk" && !a.lida).length,
      posVenda: alertas.filter((a) => a.modulo === "posVenda" && !a.lida).length,
      sistema: alertas.filter((a) => a.modulo === "sistema" && !a.lida).length,
    } satisfies Record<FiltroAlerta, number>;
  }, [alertas]);

  const handleMarcarTodasLidas = () => {
    setAlertas((prev) => prev.map((a) => ({ ...a, lida: true })));
    void fetch("/api/alertas/read-all", { method: "PATCH" });
    emitAlertsUpdated();
  };

  const handleMarcarComoLida = (id: string) => {
    setAlertas((prev) =>
      prev.map((a) => (a.id === id ? { ...a, lida: true } : a))
    );
    void fetch(`/api/alertas/${id}/read`, { method: "PATCH" });
    emitAlertsUpdated();
  };

  const handleExcluir = (id: string) => {
    setAlertas((prev) => prev.filter((a) => a.id !== id));
    void fetch(`/api/alertas/${id}`, { method: "DELETE" });
    emitAlertsUpdated();
  };

  const FILTROS: { id: FiltroAlerta; label: string }[] = [
    { id: "todas", label: "Todas" },
    { id: "nao_lidas", label: "Não Lidas" },
    { id: "tarefas", label: "Tarefas" },
    { id: "financeiro", label: "Financeiro" },
    { id: "comercial", label: "Comercial" },
    { id: "contratos", label: "Contratos" },
    { id: "helpdesk", label: "Helpdesk" },
    { id: "posVenda", label: "Pós-venda" },
    { id: "sistema", label: "Sistema" },
  ];

  return (
    <section className="w-full max-w-full space-y-6">
      {/* Header da página */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900">
          Minha caixa
        </h2>
        <button
          type="button"
          onClick={handleMarcarTodasLidas}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Marcar todas como lidas
        </button>
      </div>

      {/* Filtros (Tabs) */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              filtro === f.id
                ? "bg-[#6D28D9] text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            }`}
          >
            {f.label}
            {countByFiltro[f.id] > 0 && (
              <span className="ml-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {countByFiltro[f.id] > 99 ? "99+" : countByFiltro[f.id]}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prioridade</span>
        {(["todas", "urgente", "alta", "normal"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setFiltroPrioridade(p)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filtroPrioridade === p
                ? "bg-[#6D28D9] text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Lista de alertas (inbox style) */}
      <AlertsTable
        alertas={alertasFiltrados}
        onMarcarComoLida={handleMarcarComoLida}
        onExcluir={setAlertaToDelete}
      />

      <AlertDialog
        open={!!alertaToDelete}
        onClose={() => setAlertaToDelete(null)}
        onConfirm={() => {
          if (!alertaToDelete) return;
          handleExcluir(alertaToDelete.id);
          setAlertaToDelete(null);
        }}
        title="Excluir alerta?"
        description={
          alertaToDelete ? (
            <>
              <strong className="text-slate-900 dark:text-slate-100">Esta ação é irreversível.</strong> O alerta{" "}
              <strong className="text-slate-900 dark:text-slate-100">{alertaToDelete.titulo}</strong> será removido
              permanentemente e não poderá ser recuperado.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Sim, excluir permanentemente"
        destructive
      />
    </section>
  );
}

export default function AlertasPage() {
  return (
    <Suspense
      fallback={
        <section className="w-full max-w-full px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
          Carregando alertas…
        </section>
      }
    >
      <AlertasPageContent />
    </Suspense>
  );
}
