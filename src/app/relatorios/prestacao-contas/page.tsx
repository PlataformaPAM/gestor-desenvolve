"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { CalendarRange, Download, FileText, Send } from "lucide-react";
import { usePageHeader } from "@/contexts/page-header-context";
import { useRelatorioRbac } from "@/hooks/use-rbac-resource";

type ClienteOption = { id: string; nome: string; empresa?: string };
type ModeloDocumento = { id: string; nome: string };

function asDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function RelatoriosPrestacaoContasPage() {
  const podeVer = useRelatorioRbac("relatorios.prestacao_contas");
  const router = useRouter();
  const { setPrimaryAction } = usePageHeader();
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [modelosDocumento, setModelosDocumento] = useState<ModeloDocumento[]>([]);
  const [periodoInicio, setPeriodoInicio] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return asDateInput(d);
  });
  const [periodoFim, setPeriodoFim] = useState(() => asDateInput(new Date()));
  const [clienteId, setClienteId] = useState("");
  const [modeloId, setModeloId] = useState("");
  const [emailDestino, setEmailDestino] = useState("");
  const [busyPreview, setBusyPreview] = useState(false);
  const [busyPdf, setBusyPdf] = useState(false);
  const [busyEmail, setBusyEmail] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<{
    resumo: {
      cliente: string;
      periodoInicio: string;
      periodoFim: string;
      totalEntregaveis: number;
      totalConcluidos: number;
      tarefasAtrasadas: number;
      ticketsAtrasados: number;
      slaCumprido: number;
    };
    charts: {
      barraStatus: Array<{ name: string; value: number }>;
      timeline: Array<{ semana: string; tarefas: number; tickets: number }>;
      porCategoria: Array<{ name: string; value: number }>;
      slaPorResponsavel: Array<{ responsavel: string; total: number; atrasados: number; sla: number }>;
    };
  } | null>(null);

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
    void Promise.allSettled([
      fetch("/api/clientes/bootstrap", { cache: "no-store" }),
      fetch("/api/configuracoes/documentos-modelos", { cache: "no-store" }),
    ]).then(async ([clientesRes, modelosRes]) => {
      if (!active) return;
      if (clientesRes.status === "fulfilled" && clientesRes.value.ok) {
        const body = (await clientesRes.value.json()) as { data?: { clientes?: ClienteOption[] } };
        setClientes(body?.data?.clientes ?? []);
      }
      if (modelosRes.status === "fulfilled" && modelosRes.value.ok) {
        const body = (await modelosRes.value.json()) as {
          data?: { modelos?: Array<{ id: string; nome: string }> };
          modelos?: Array<{ id: string; nome: string }>;
        };
        const list = body?.data?.modelos ?? body?.modelos ?? [];
        setModelosDocumento(list.map((m) => ({ id: m.id, nome: m.nome })));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const dashboardQuery = useMemo(() => {
    const qp = new URLSearchParams();
    if (clienteId) qp.set("clienteId", clienteId);
    qp.set("periodoInicio", periodoInicio);
    qp.set("periodoFim", periodoFim);
    return qp.toString();
  }, [clienteId, periodoInicio, periodoFim]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await fetch(`/api/relatorios/prestacao-contas/dashboard?${dashboardQuery}`, { cache: "no-store" });
      if (!res.ok || !active) return;
      const body = (await res.json()) as { data?: typeof dashboard };
      if (body?.data) setDashboard(body.data);
    })();
    return () => {
      active = false;
    };
  }, [dashboardQuery]);

  const payload = useMemo(
    () => ({ clienteId, modeloId, periodoInicio, periodoFim }),
    [clienteId, modeloId, periodoInicio, periodoFim]
  );

  const handlePreview = async () => {
    if (!clienteId || !modeloId) return setStatusMessage("Selecione cliente e modelo.");
    setBusyPreview(true);
    setStatusMessage(null);
    const popup = window.open("", "_blank");
    try {
      const res = await fetch("/api/relatorios/prestacao-contas/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { error?: { message?: string }; data?: { html?: string } };
      if (!res.ok || !json?.data?.html) throw new Error(json?.error?.message || "Falha ao gerar prévia.");
      const blob = new Blob([json.data.html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      if (popup) popup.location.href = url;
      else window.open(url, "_blank");
      window.setTimeout(() => URL.revokeObjectURL(url), 120000);
      setStatusMessage("Prévia gerada com sucesso.");
    } catch (err) {
      if (popup) popup.close();
      setStatusMessage(err instanceof Error ? err.message : "Falha ao gerar prévia.");
    } finally {
      setBusyPreview(false);
    }
  };

  const handlePdf = async () => {
    if (!clienteId || !modeloId) return setStatusMessage("Selecione cliente e modelo.");
    setBusyPdf(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/relatorios/prestacao-contas/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: { message?: string } };
        throw new Error(json?.error?.message || "Falha ao exportar PDF.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `prestacao-contas-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      setStatusMessage("PDF exportado com sucesso.");
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Falha ao exportar PDF.");
    } finally {
      setBusyPdf(false);
    }
  };

  const handleEnviar = async () => {
    if (!clienteId || !modeloId) return setStatusMessage("Selecione cliente e modelo.");
    if (!emailDestino.trim()) return setStatusMessage("Informe um e-mail de destino.");
    setBusyEmail(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/relatorios/prestacao-contas/enviar-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, toEmail: emailDestino.trim() }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) throw new Error(json?.error?.message || "Falha ao enviar e-mail.");
      setStatusMessage("Relatório enviado com sucesso.");
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Falha ao enviar e-mail.");
    } finally {
      setBusyEmail(false);
    }
  };

  if (!podeVer) return null;

  return (
    <section className="w-full min-w-0 space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Prestação de Contas</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Visão executiva por cliente com entregáveis, cumprimento de SLA e evolução semanal para comunicação mensal.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Cliente">
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={inputClass}>
              <option value="">Selecionar cliente...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.empresa?.trim() || c.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Período inicial">
            <input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Período final">
            <input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Modelo documento">
            <select value={modeloId} onChange={(e) => setModeloId(e.target.value)} className={inputClass}>
              <option value="">Selecionar modelo...</option>
              {modelosDocumento.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ações</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <button type="button" onClick={handlePreview} disabled={busyPreview} className="rounded-lg bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700">
            <span className="inline-flex items-center gap-2"><CalendarRange className="h-4 w-4" />{busyPreview ? "Gerando..." : "Visualizar"}</span>
          </button>
          <button type="button" onClick={handlePdf} disabled={busyPdf} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
            <span className="inline-flex items-center gap-2"><Download className="h-4 w-4" />{busyPdf ? "Exportando..." : "Exportar PDF"}</span>
          </button>
          <input type="email" value={emailDestino} onChange={(e) => setEmailDestino(e.target.value)} placeholder="cliente@empresa.com" className={inputClass} />
          <button type="button" onClick={handleEnviar} disabled={busyEmail} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
            <span className="inline-flex items-center gap-2"><Send className="h-4 w-4" />{busyEmail ? "Enviando..." : "Enviar por e-mail"}</span>
          </button>
        </div>
        {statusMessage ? (
          <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-200">
            {statusMessage}
          </p>
        ) : null}
      </div>

      {dashboard ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Entregáveis" value={String(dashboard.resumo.totalEntregaveis)} />
            <KpiCard label="Concluídos" value={String(dashboard.resumo.totalConcluidos)} />
            <KpiCard label="Atrasos (tarefas+tickets)" value={String(dashboard.resumo.tarefasAtrasadas + dashboard.resumo.ticketsAtrasados)} />
            <KpiCard label="SLA cumprido" value={`${dashboard.resumo.slaCumprido.toFixed(1)}%`} />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard title="Status dos entregáveis">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.charts.barraStatus}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="value" fill="#6D28D9" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
            <ChartCard title="Evolução semanal de entregáveis">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboard.charts.timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="semana" />
                    <YAxis />
                    <RechartsTooltip />
                    <Line type="monotone" dataKey="tarefas" stroke="#2563eb" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="tickets" stroke="#10b981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
            <ChartCard title="Entregáveis por categoria">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.charts.porCategoria}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">SLA por responsável</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="px-2 py-2">Responsável</th>
                    <th className="px-2 py-2">Total</th>
                    <th className="px-2 py-2">Atrasados</th>
                    <th className="px-2 py-2">SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.charts.slaPorResponsavel.map((row) => (
                    <tr key={row.responsavel} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-2 py-2">{row.responsavel}</td>
                      <td className="px-2 py-2">{row.total}</td>
                      <td className="px-2 py-2">{row.atrasados}</td>
                      <td className="px-2 py-2">{row.sla.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
        <FileText className="h-4 w-4" />
        {label}
      </label>
      {children}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
      <div className="mt-3">{children}</div>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
