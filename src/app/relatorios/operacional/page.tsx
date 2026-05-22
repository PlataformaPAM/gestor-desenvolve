"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Download, FileText, Filter, Send } from "lucide-react";
import {
  OPERACIONAL_REPORTS,
  type OperacionalReportId,
  type OperacionalSituacao,
} from "@/lib/relatorios/operacional-catalogo";
import { usePageHeader } from "@/contexts/page-header-context";
import { useRelatorioRbac } from "@/hooks/use-rbac-resource";

type ClienteOption = { id: string; nome: string; empresa?: string };
type ModeloDocumento = { id: string; nome: string };

function mensagemErroPtBr(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const msg = (err.message || "").trim();
  if (!msg) return fallback;
  if (msg.includes("Failed to fetch")) return "Falha de conexão com o servidor. Tente novamente.";
  if (msg.includes("is not defined")) return "Erro interno ao gerar o relatório. Tente novamente.";
  return msg;
}

function asDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function RelatoriosOperacionalPage() {
  const podeVer = useRelatorioRbac("relatorios.operacional");
  const router = useRouter();
  const { setPrimaryAction } = usePageHeader();
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [modelosDocumento, setModelosDocumento] = useState<ModeloDocumento[]>([]);

  const [reportId, setReportId] = useState<OperacionalReportId>("backlog_geral");
  const [periodoInicio, setPeriodoInicio] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return asDateInput(d);
  });
  const [periodoFim, setPeriodoFim] = useState(() => asDateInput(new Date()));
  const [clienteId, setClienteId] = useState("");
  const [situacao, setSituacao] = useState<OperacionalSituacao>("todos");
  const [modeloId, setModeloId] = useState("");
  const [emailDestino, setEmailDestino] = useState("");

  const [busyPreview, setBusyPreview] = useState(false);
  const [busyPdf, setBusyPdf] = useState(false);
  const [busyEmail, setBusyEmail] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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

  const reportAtual = useMemo(() => OPERACIONAL_REPORTS.find((x) => x.id === reportId), [reportId]);

  const payload = useMemo(
    () => ({
      reportId,
      clienteId,
      modeloId,
      periodoInicio,
      periodoFim,
      situacao,
    }),
    [clienteId, modeloId, periodoFim, periodoInicio, reportId, situacao]
  );

  const handlePreview = async () => {
    if (!modeloId) return setStatusMessage("Selecione um modelo de documento.");
    setBusyPreview(true);
    setStatusMessage(null);
    const popup = window.open("", "_blank");
    try {
      const res = await fetch("/api/relatorios/operacional/preview", {
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
      setStatusMessage(mensagemErroPtBr(err, "Falha ao gerar prévia."));
    } finally {
      setBusyPreview(false);
    }
  };

  const handlePdf = async () => {
    if (!modeloId) return setStatusMessage("Selecione um modelo de documento.");
    setBusyPdf(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/relatorios/operacional/pdf", {
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
      a.download = `relatorio-operacional-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      setStatusMessage("PDF exportado com sucesso.");
    } catch (err) {
      setStatusMessage(mensagemErroPtBr(err, "Falha ao exportar PDF."));
    } finally {
      setBusyPdf(false);
    }
  };

  const handleEnviar = async () => {
    if (!modeloId) return setStatusMessage("Selecione um modelo de documento.");
    if (!emailDestino.trim()) return setStatusMessage("Informe um e-mail de destino.");
    setBusyEmail(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/relatorios/operacional/enviar-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, toEmail: emailDestino.trim() }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) throw new Error(json?.error?.message || "Falha ao enviar e-mail.");
      setStatusMessage("Relatório enviado com sucesso.");
    } catch (err) {
      setStatusMessage(mensagemErroPtBr(err, "Falha ao enviar e-mail."));
    } finally {
      setBusyEmail(false);
    }
  };

  if (!podeVer) return null;

  return (
    <section className="w-full min-w-0 space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Relatórios Operacionais</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Escolha um relatório pronto e aplique filtros por cliente, período e situação para gerar, exportar ou enviar.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 xl:col-span-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Filtros</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Período inicial" icon={<CalendarRange className="h-4 w-4" />}>
              <input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Período final" icon={<CalendarRange className="h-4 w-4" />}>
              <input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Cliente" icon={<Filter className="h-4 w-4" />}>
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={inputClass}>
                <option value="">Todos os clientes</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.empresa?.trim() || c.nome}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Situação" icon={<Filter className="h-4 w-4" />}>
              <select value={situacao} onChange={(e) => setSituacao(e.target.value as OperacionalSituacao)} className={inputClass}>
                <option value="todos">Todos</option>
                <option value="abertos">Abertos</option>
                <option value="atrasados">Atrasados</option>
              </select>
            </Field>
          </div>
          <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-sm text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-200">
            Relatório selecionado: <strong>{reportAtual?.titulo ?? "N/A"}</strong>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ações</h3>
          <div className="mt-4 space-y-3">
            <Field label="Modelo de documento" icon={<FileText className="h-4 w-4" />}>
              <select value={modeloId} onChange={(e) => setModeloId(e.target.value)} className={inputClass}>
                <option value="">Selecionar modelo...</option>
                {modelosDocumento.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="button"
              onClick={handlePreview}
              disabled={busyPreview}
              className="w-full rounded-lg bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
            >
              {busyPreview ? "Gerando..." : "Visualizar"}
            </button>
            <button
              type="button"
              onClick={handlePdf}
              disabled={busyPdf}
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <span className="inline-flex items-center gap-2">
                <Download className="h-4 w-4" />
                {busyPdf ? "Exportando..." : "Exportar PDF"}
              </span>
            </button>
            <Field label="Enviar para e-mail" icon={<Send className="h-4 w-4" />}>
              <input
                type="email"
                value={emailDestino}
                onChange={(e) => setEmailDestino(e.target.value)}
                placeholder="cliente@empresa.com"
                className={inputClass}
              />
            </Field>
            <button
              type="button"
              onClick={handleEnviar}
              disabled={busyEmail}
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <span className="inline-flex items-center gap-2">
                <Send className="h-4 w-4" />
                {busyEmail ? "Enviando..." : "Enviar por e-mail"}
              </span>
            </button>
            {statusMessage ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-200">
                {statusMessage}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {OPERACIONAL_REPORTS.map((report) => {
          const active = report.id === reportId;
          return (
            <button
              key={report.id}
              type="button"
              onClick={() => setReportId(report.id)}
              className={`rounded-xl border p-4 text-left transition ${
                active
                  ? "border-violet-300 bg-violet-50/70 dark:border-violet-700 dark:bg-violet-950/30"
                  : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70"
              }`}
            >
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{report.titulo}</p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{report.descricao}</p>
            </button>
          );
        })}
      </div>

    </section>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
