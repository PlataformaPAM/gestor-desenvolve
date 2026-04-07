"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import clsx from "clsx";
import { motion } from "framer-motion";
import { Building2, FileText, Handshake, History, Settings2 } from "lucide-react";
import { usePageHeader } from "@/contexts/page-header-context";
import { CONTRATO_STATUS_LABEL } from "@/lib/contratos/constants";
import { formatCurrency } from "@/lib/comercial/utils";
import { formatDateDMY } from "@/lib/format/dates";
import { MultiFileAttachment } from "@/components/ui/multifile-attachment";

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

type ContratoTab = "dados" | "comercial" | "gestao" | "aditivo" | "historico";

const FLUXO_FIN_LABEL: Record<string, string> = {
  nenhum: "Sem solicitação",
  pendente_aprovacao: "Aguardando Financeiro",
  lancado: "Lançado no caixa",
  devolvido: "Devolvido ao Comercial",
};

const STATUS_EDITAVEL = Object.keys(CONTRATO_STATUS_LABEL);

function statusBadgeClass(status: string): string {
  if (status === "ativo")
    return "rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300";
  if (status === "pendente_financeiro")
    return "rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200";
  return "rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

export default function ContratoDetalhePage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const router = useRouter();
  const { setPrimaryAction, setSecondaryAction, setTitle } = usePageHeader();
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
  const [adTipo, setAdTipo] = useState("ajuste_valor");
  const [adTitulo, setAdTitulo] = useState("");
  const [adDesc, setAdDesc] = useState("");
  const [adValAnt, setAdValAnt] = useState("");
  const [adValNovo, setAdValNovo] = useState("");
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
      setEditValor(String(c.valorTotal));
      setEditInicio(c.dataInicio ? c.dataInicio.slice(0, 10) : "");
      setEditFim(c.dataFim ? c.dataFim.slice(0, 10) : "");
      setEditPosVenda(c.geraPosVenda);
      setEditObs(c.observacoes ?? "");
      setEditCond(c.condicoesGerais ?? "");
    }
  }, [id]);

  useEffect(() => {
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
  }, [router, setPrimaryAction, setSecondaryAction]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!contrato) return;
    const raw =
      contrato.titulo?.trim() ||
      contrato.lead?.name?.trim() ||
      contrato.cliente.empresa ||
      contrato.cliente.nome ||
      "Contrato";
    setTitle(raw.length > 72 ? `${raw.slice(0, 69)}…` : raw);
  }, [contrato, setTitle]);

  const salvarDados = async () => {
    if (!contrato || !id) return;
    const raw = editValor.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const valorTotal = raw === "" ? 0 : Number(raw);
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
        }),
      });
      if (!res.ok) return;
      await carregar();
    } finally {
      setSaving(false);
    }
  };

  const alterarStatusRapido = async (novoStatus: string) => {
    if (!contrato || !id || contrato.status === novoStatus) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contratos/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novoStatus }),
      });
      if (!res.ok) return;
      await carregar();
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
    if (!contrato || !id || !aditivo.titulo.trim()) return false;
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
      return true;
    } finally {
      setSaving(false);
    }
  };

  const salvarAditivo = async () => {
    if (!contrato || !id || !adTitulo.trim()) return;
    const va = adValAnt.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const vn = adValNovo.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const numAnt = va === "" ? null : Number(va);
    const numNovo = vn === "" ? null : Number(vn);
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
    setAdValAnt("");
    setAdValNovo("");
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
        titulo: `${a.tipo} — ${a.titulo}`,
        descricao: a.descricao ?? undefined,
      })) ?? []),
    ];
    return entries.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [contrato]);

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
  const tabs: Array<{ id: ContratoTab; label: string; icon: React.ElementType }> = [
    { id: "dados", label: "Dados Gerais", icon: FileText },
    { id: "comercial", label: "Comercial", icon: Handshake },
    { id: "gestao", label: "Gestão", icon: Settings2 },
    { id: "aditivo", label: "Aditivo", icon: FileText },
    { id: "historico", label: "Histórico", icon: History },
  ];

  return (
    <section className="w-full min-w-0 space-y-6">
      <div
        role="tablist"
        aria-label="Abas do contrato"
        className="flex flex-wrap border-b border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50"
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

      {activeTab === "dados" && (
        <div id={`${tabListId}-dados-panel`} role="tabpanel" aria-labelledby={`${tabListId}-tab-dados`} className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Dados gerais do contrato</h2>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-slate-500">Código</dt>
                  <dd className="font-mono text-slate-900 dark:text-slate-100">{contrato.codigo}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Cliente</dt>
                  <dd className="text-slate-900 dark:text-slate-100">{contrato.cliente.empresa || contrato.cliente.nome}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">CNPJ</dt>
                  <dd className="font-mono text-slate-900 dark:text-slate-100">{contrato.cliente.cpfCnpj}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Origem</dt>
                  <dd className="text-slate-900 dark:text-slate-100">
                    {contrato.origem === "cadastro_manual" ? "Cadastro direto" : "Via lead"}
                    {contrato.origem === "cadastro_manual" ? ` · Pós-venda: ${contrato.geraPosVenda ? "sim" : "não"}` : ""}
                  </dd>
                </div>
              </dl>

              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-slate-500">Status</dt>
                  <dd className="mt-1">
                    <select
                      value={editStatus}
                      onChange={(e) => {
                        setEditStatus(e.target.value);
                        void alterarStatusRapido(e.target.value);
                      }}
                      disabled={saving}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    >
                      {STATUS_EDITAVEL.map((s) => (
                        <option key={s} value={s}>
                          {CONTRATO_STATUS_LABEL[s] ?? s}
                        </option>
                      ))}
                    </select>
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Vigência</dt>
                  <dd className="text-slate-900 dark:text-slate-100">
                    {contrato.dataInicio ? formatDateDMY(contrato.dataInicio) : "—"} até {contrato.dataFim ? formatDateDMY(contrato.dataFim) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Valor</dt>
                  <dd className="text-slate-900 dark:text-slate-100">{formatCurrency(contrato.valorTotal)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Responsável</dt>
                  <dd className="text-slate-900 dark:text-slate-100">{contrato.registroCriadoPorNome?.trim() || "—"}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}

      {activeTab === "comercial" && (
        <div id={`${tabListId}-comercial-panel`} role="tabpanel" aria-labelledby={`${tabListId}-tab-comercial`} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:p-6">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Building2 className="h-4 w-4 text-slate-400" aria-hidden /> Cliente
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{contrato.cliente.empresa || contrato.cliente.nome}</p>
              <Link href="/clientes" className="mt-4 inline-flex text-sm font-medium text-[#6D28D9] hover:text-[#5B21B6]">Gestão de clientes →</Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:p-6">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Handshake className="h-4 w-4 text-slate-400" aria-hidden /> Comercial
              </div>
              {contrato.lead ? (
                <>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{contrato.lead.name}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Lead ID: {contrato.leadId}</p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Etapa: <strong>{contrato.lead.stageId}</strong></p>
                  {fluxo && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Fluxo financeiro: <strong>{FLUXO_FIN_LABEL[fluxo.status] ?? fluxo.status}</strong></p>}
                  <Link href={`/comercial?leadId=${encodeURIComponent(contrato.lead.id)}`} className="mt-4 inline-flex text-sm font-medium text-[#6D28D9] hover:text-[#5B21B6]">Abrir lead no Comercial →</Link>
                </>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-400">Contrato sem lead vinculado (cadastro direto).</p>
              )}
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-600 md:px-6"><h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Soluções contratadas</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead><tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/60"><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:px-6">Solução</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:px-6">Valor</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:px-6">Condições</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {contrato.itens.length === 0 ? <tr><td colSpan={3} className="px-4 py-10 text-center text-sm text-slate-500 md:px-6">Nenhum item registrado neste contrato.</td></tr> : contrato.itens.map((i) => (<tr key={i.id}><td className="px-4 py-4 text-sm font-medium text-slate-900 dark:text-slate-100 md:px-6">{i.nome}</td><td className="px-4 py-4 text-sm text-slate-800 dark:text-slate-200 md:px-6">{i.valor != null && i.valor > 0 ? formatCurrency(i.valor) : "—"}</td><td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400 md:px-6">{i.condicoesPagamento ?? "—"}</td></tr>))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "gestao" && (
      <div id={`${tabListId}-gestao-panel`} role="tabpanel" aria-labelledby={`${tabListId}-tab-gestao`} className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Valores e vigência
          </h2>
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

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Gestão e alterações
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Título</label>
            <input
              value={editTitulo}
              onChange={(e) => setEditTitulo(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Status</label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {STATUS_EDITAVEL.map((s) => (
                <option key={s} value={s}>
                  {CONTRATO_STATUS_LABEL[s] ?? s}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Valor total</label>
            <input
              value={editValor}
              onChange={(e) => setEditValor(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Início</label>
            <input
              type="date"
              value={editInicio}
              onChange={(e) => setEditInicio(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Fim</label>
            <input
              type="date"
              value={editFim}
              onChange={(e) => setEditFim(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <input
              id="pvenda"
              type="checkbox"
              checked={editPosVenda}
              onChange={(e) => setEditPosVenda(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#6D28D9]"
            />
            <label htmlFor="pvenda" className="text-sm text-slate-700 dark:text-slate-300">
              Contrato gera alertas / acompanhamento de Pós-venda
            </label>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Observações</label>
            <textarea
              value={editObs}
              onChange={(e) => setEditObs(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Condições gerais</label>
            <textarea
              value={editCond}
              onChange={(e) => setEditCond(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void salvarDados()}
          className="mt-4 rounded-xl bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#5B21B6] disabled:opacity-50"
        >
          {saving ? "Salvando…" : "Salvar alterações"}
        </button>
        </div>
      </div>
      )}

      {activeTab === "aditivo" && (
      <div id={`${tabListId}-aditivo-panel`} role="tabpanel" aria-labelledby={`${tabListId}-tab-aditivo`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Aditivos e registros formais
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Registre ajustes de valor, renovação, prorrogação ou alteração de condições; o histórico fica abaixo.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Tipo</label>
            <input
              value={adTipo}
              onChange={(e) => setAdTipo(e.target.value)}
              placeholder="ex.: renovacao, aditivo_prazo"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-slate-600">Título do aditivo</label>
            <input
              value={adTitulo}
              onChange={(e) => setAdTitulo(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-slate-600">Descrição</label>
            <textarea
              value={adDesc}
              onChange={(e) => setAdDesc(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Valor anterior (opc.)</label>
            <input
              value={adValAnt}
              onChange={(e) => setAdValAnt(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Valor novo (opc.)</label>
            <input
              value={adValNovo}
              onChange={(e) => setAdValNovo(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
        <button
          type="button"
          disabled={saving || !adTitulo.trim()}
          onClick={() => void salvarAditivo()}
          className="mt-4 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Registrar aditivo
        </button>

        <ul className="mt-6 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-700">
          {(contrato.aditivos ?? []).length === 0 ? (
            <li className="text-sm text-slate-500 dark:text-slate-400">Nenhum aditivo registrado ainda.</li>
          ) : (
            (contrato.aditivos ?? []).map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800/60"
              >
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  <span className="text-xs uppercase text-slate-500">{a.tipo}</span> — {a.titulo}
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
            ))
          )}
        </ul>
      </div>
      )}

      {activeTab === "historico" && (
        <div id={`${tabListId}-historico-panel`} role="tabpanel" aria-labelledby={`${tabListId}-tab-historico`} className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:p-6">
            <textarea
              value={histComentario}
              onChange={(e) => setHistComentario(e.target.value)}
              placeholder="Registre atualização, decisão ou observação deste contrato..."
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20"
            />
            <div className="mt-3">
              <MultiFileAttachment existingFiles={[]} newFiles={histArquivos} onNewFilesChange={setHistArquivos} />
            </div>
            <button type="button" onClick={() => void salvarHistorico()} disabled={saving || (!histComentario.trim() && histArquivos.length === 0)} className="mt-3 rounded-lg bg-[#6D28D9] px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">
              Adicionar atualização
            </button>
          </div>
          <ul className="space-y-3 border-t border-slate-200 pt-4">
            {historico.map((h) => (
              <li key={h.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs text-slate-500">{formatDateDMY(h.data)}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{h.titulo}</p>
                {h.descricao ? <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-400">{h.descricao}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
