"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { usePageHeader } from "@/contexts/page-header-context";
import { useRelatorioRbac } from "@/hooks/use-rbac-resource";

type DashboardPayload = {
  resumo: {
    receitaPrevista: number;
    saidasPrevistas: number;
    saldoPrevisto: number;
    inadimplencia: number;
    tarefasAtrasadas: number;
    ticketsAtrasados: number;
    taxaConversao: number;
    clientesMonitorados: number;
  };
  charts: {
    distributivoScore: Array<{ faixa: string; total: number }>;
  };
  scorePorCliente: Array<{
    clienteId: string;
    cliente: string;
    score: number;
    sla: number;
    adimplencia: number;
    atrasos: number;
    entregas: number;
    inadimplente: number;
  }>;
};

function money(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function RelatoriosSaudeEmpresaPage() {
  const podeVer = useRelatorioRbac("relatorios.saude_empresa");
  const router = useRouter();
  const { setPrimaryAction } = usePageHeader();
  const [data, setData] = useState<DashboardPayload | null>(null);

  useEffect(() => {
    setPrimaryAction({
      label: "Voltar ao Relatórios",
      onClick: () => router.push("/relatorios"),
      showPlusIcon: false,
      tone: "navigation",
    });
    return () => setPrimaryAction(null);
  }, [router, setPrimaryAction]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await fetch("/api/relatorios/saude-empresa/dashboard", { cache: "no-store" });
      if (!res.ok || !active) return;
      const body = (await res.json()) as { data?: DashboardPayload };
      if (body?.data) setData(body.data);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!podeVer) return null;

  return (
    <section className="w-full min-w-0 space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Saúde da Empresa</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Painel executivo consolidado para acompanhar operação, financeiro, comercial e risco por cliente.
        </p>
      </div>

      {data ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Saldo previsto do mês" value={money(data.resumo.saldoPrevisto)} />
            <Kpi label="Inadimplência" value={money(data.resumo.inadimplencia)} tone="danger" />
            <Kpi label="Atrasos operacionais" value={String(data.resumo.tarefasAtrasadas + data.resumo.ticketsAtrasados)} />
            <Kpi label="Conversão comercial" value={`${data.resumo.taxaConversao.toFixed(1)}%`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Distribuição de score por cliente</h3>
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.distributivoScore}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="faixa" />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="total" fill="#6D28D9" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Radar de ação imediata</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                <li>- Clientes monitorados: <strong>{data.resumo.clientesMonitorados}</strong></li>
                <li>- Receita prevista: <strong>{money(data.resumo.receitaPrevista)}</strong></li>
                <li>- Saídas previstas: <strong>{money(data.resumo.saidasPrevistas)}</strong></li>
                <li>- Tarefas atrasadas: <strong>{data.resumo.tarefasAtrasadas}</strong></li>
                <li>- Tickets atrasados: <strong>{data.resumo.ticketsAtrasados}</strong></li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Score de saúde por cliente (pior para melhor)</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="px-2 py-2">Cliente</th>
                    <th className="px-2 py-2">Score</th>
                    <th className="px-2 py-2">SLA</th>
                    <th className="px-2 py-2">Adimplência</th>
                    <th className="px-2 py-2">Atrasos</th>
                    <th className="px-2 py-2">Entregas</th>
                    <th className="px-2 py-2">Inadimplente</th>
                  </tr>
                </thead>
                <tbody>
                  {data.scorePorCliente.map((row) => (
                    <tr key={row.clienteId} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-2 py-2">{row.cliente}</td>
                      <td className="px-2 py-2 font-semibold">{row.score.toFixed(1)}</td>
                      <td className="px-2 py-2">{row.sla.toFixed(1)}%</td>
                      <td className="px-2 py-2">{row.adimplencia.toFixed(1)}%</td>
                      <td className="px-2 py-2">{row.atrasos}</td>
                      <td className="px-2 py-2">{row.entregas}</td>
                      <td className="px-2 py-2">{money(row.inadimplente)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          Carregando indicadores de saúde da empresa...
        </div>
      )}
    </section>
  );
}

function Kpi({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "danger" }) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${tone === "danger" ? "border-red-200 bg-red-50/70 dark:border-red-700/40 dark:bg-red-950/20" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}
