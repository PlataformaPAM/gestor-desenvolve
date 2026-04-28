"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useId } from "react";
import clsx from "clsx";
import { motion } from "framer-motion";
import { FileText, History, Eye } from "lucide-react";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import { MultiFileAttachment } from "@/components/ui/multifile-attachment";
import {
  SearchableMultiSelect,
  SearchableSelect,
  type SearchableOption,
} from "@/components/ui/searchable-select";
import {
  PRIORIDADE_LABELS,
  STATUS_LABELS,
  CATEGORIA_LABELS,
} from "@/lib/suporte/constants";
import type {
  Ticket,
  TicketPrioridade,
  TicketStatus,
  TicketCategoria,
  TicketResponsavel,
  HistoricoEntrada,
} from "@/lib/suporte/types";

export type TicketFormPayload = {
  clienteId: string;
  clienteNome: string;
  assunto: string;
  descricao: string;
  prioridade: TicketPrioridade;
  categoria: TicketCategoria;
  status: TicketStatus;
  responsaveis: TicketResponsavel[];
  previsaoConclusao: string;
  historico: HistoricoEntrada[];
  arquivos?: File[];
};

type TicketFormSheetProps = {
  open: boolean;
  onClose: () => void;
  onSave: (data: TicketFormPayload) => void;
  clientes?: Array<{ id: string; nome: string; empresa?: string }>;
  equipe?: TicketResponsavel[];
  usuarioAtual?: TicketResponsavel;
  /** Ticket existente para visualizar/editar; null = novo ticket */
  initialTicket?: Ticket | null;
  /** Título do Sheet (opcional; senão usa "Ticket ID" ou "Novo Ticket") */
  title?: React.ReactNode;
};

type TabId = "detalhes" | "interacoes";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";
const labelClass = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

function openPlaceholderPreview(filename: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.title = filename;
  w.document.body.innerHTML = `<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \\"Liberation Mono\\", \\"Courier New\\", monospace; padding: 16px;">Preview indisponivel para este anexo: ${filename}</pre>`;
}

function openFilePreview(file: File) {
  const url = URL.createObjectURL(file);
  window.open(url, "_blank");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Calcula data de previsão conforme prioridade: Crítica +4h, Alta +24h, Média +3d, Baixa +7d */
function computePrevisaoByPrioridade(prioridade: TicketPrioridade): string {
  const now = new Date();
  const d = new Date(now);
  if (prioridade === "critica") d.setHours(d.getHours() + 4);
  else if (prioridade === "alta") d.setHours(d.getHours() + 24);
  else if (prioridade === "media") d.setDate(d.getDate() + 3);
  else d.setDate(d.getDate() + 7); // baixa
  return d.toISOString();
}

/** Formata ISO para exibição BR: 17/03/2026 às 14:30 */
function formatPrevisaoBr(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TicketFormSheet({
  open,
  onClose,
  onSave,
  clientes = [],
  equipe = [],
  usuarioAtual = { id: "usuario-atual", nome: "Usuário" },
  initialTicket = null,
  title: titleProp,
}: TicketFormSheetProps) {
  const id = useId();
  const [activeTab, setActiveTab] = useState<TabId>("detalhes");

  // Cliente
  const [clienteId, setClienteId] = useState("");
  const [clienteNome, setClienteNome] = useState("");

  // Classificação
  const [categoria, setCategoria] = useState<TicketCategoria>("duvida");
  const [prioridade, setPrioridade] = useState<TicketPrioridade>("media");
  const [status, setStatus] = useState<TicketStatus>("novo");
  const [previsaoConclusao, setPrevisaoConclusao] = useState<string>(() =>
    computePrevisaoByPrioridade("media")
  );

  // Conteúdo
  const [assunto, setAssunto] = useState("");
  const [descricao, setDescricao] = useState("");

  // Anexos (Detalhes)
  const [arquivos, setArquivos] = useState<File[]>([]);

  // Responsável principal (seleção única) + colaboradores (múltiplos)
  const [responsavelPrincipal, setResponsavelPrincipal] = useState<TicketResponsavel>(() => usuarioAtual);
  const [colaboradores, setColaboradores] = useState<TicketResponsavel[]>([]);

  // Histórico (timeline) — auditoria de ações e atualizações
  const [historico, setHistorico] = useState<HistoricoEntrada[]>([]);
  const prevStatusRef = useRef<TicketStatus | null>(null);
  const prevPrioridadeRef = useRef<TicketPrioridade | null>(null);
  const prevCategoriaRef = useRef<TicketCategoria | null>(null);
  const prevResponsavelPrincipalIdRef = useRef<string>(usuarioAtual.id);
  const prevColaboradoresIdsRef = useRef<string>("");

  // Interações tab: nova atualização
  const [novaAtualizacao, setNovaAtualizacao] = useState("");
  const [arquivosAtualizacao, setArquivosAtualizacao] = useState<File[]>([]);
  const [notificarCliente, setNotificarCliente] = useState(false);

  const clienteOptions: SearchableOption[] = useMemo(
    () =>
      clientes.map((c) => ({
        value: c.id,
        label: (c.empresa || c.nome).trim(),
        subtitle: c.empresa && c.nome && c.nome !== c.empresa ? c.nome : undefined,
      })),
    [clientes]
  );

  /** Lista completa para o select de Responsável Principal (logado + equipe), sem duplicados por id */
  const listaResponsaveisPrincipal = useMemo(() => {
    const byId = new Map<string, TicketResponsavel>();
    [usuarioAtual, ...equipe].forEach((m) => {
      if (!byId.has(m.id)) byId.set(m.id, m);
    });
    return Array.from(byId.values());
  }, [usuarioAtual, equipe]);
  const responsavelOptions: SearchableOption[] = useMemo(
    () =>
      listaResponsaveisPrincipal.map((r) => ({
        value: r.id,
        label: r.id === usuarioAtual.id ? `${r.nome} (você)` : r.nome,
      })),
    [listaResponsaveisPrincipal, usuarioAtual.id]
  );
  const colaboradorOptions: SearchableOption[] = useMemo(
    () =>
      equipe
        .filter((m) => m.id !== responsavelPrincipal.id)
        .map((m) => ({ value: m.id, label: m.nome })),
    [equipe, responsavelPrincipal.id]
  );
  const colaboradorIds = useMemo(() => colaboradores.map((c) => c.id), [colaboradores]);
  const categoriaOptions: SearchableOption[] = useMemo(
    () =>
      (Object.entries(CATEGORIA_LABELS) as [TicketCategoria, string][]).map(([value, label]) => ({
        value,
        label,
      })),
    []
  );
  const prioridadeOptions: SearchableOption[] = useMemo(
    () =>
      (Object.entries(PRIORIDADE_LABELS) as [TicketPrioridade, string][]).map(([value, label]) => ({
        value,
        label,
      })),
    []
  );
  const statusOptions: SearchableOption[] = useMemo(
    () =>
      (Object.entries(STATUS_LABELS) as [TicketStatus, string][]).map(([value, label]) => ({
        value,
        label,
      })),
    []
  );

  // Previsão dinâmica: reage à prioridade (Crítica +4h, Alta +24h, Média +3d, Baixa +7d)
  useEffect(() => {
    setPrevisaoConclusao(computePrevisaoByPrioridade(prioridade));
  }, [prioridade]);

  useEffect(() => {
    if (!open) return;
    setActiveTab("detalhes");
    if (!initialTicket) {
      setClienteId("");
      setClienteNome("");
      setCategoria("duvida");
      setPrioridade("media");
      setPrevisaoConclusao(computePrevisaoByPrioridade("media"));
      setStatus("novo");
      setAssunto("");
      setDescricao("");
      setArquivos([]);
      setResponsavelPrincipal(usuarioAtual);
      setColaboradores([]);
      setNovaAtualizacao("");
      setArquivosAtualizacao([]);
      setNotificarCliente(false);
      const now = new Date().toISOString();
      setHistorico([
        { id: `h-${Date.now()}`, data: now, acao: "Chamado criado", autor: "Sistema" },
      ]);
      prevStatusRef.current = "novo";
      prevPrioridadeRef.current = "media";
      prevCategoriaRef.current = "duvida";
      prevResponsavelPrincipalIdRef.current = usuarioAtual.id;
      prevColaboradoresIdsRef.current = "";
    } else {
      setClienteId(initialTicket.clienteId);
      setClienteNome(initialTicket.clienteNome);
      setCategoria(initialTicket.categoria);
      setPrioridade(initialTicket.prioridade);
      setPrevisaoConclusao(initialTicket.previsaoConclusao);
      setStatus(initialTicket.status);
      setAssunto(initialTicket.assunto);
      setDescricao(initialTicket.descricao);
      setArquivos(initialTicket.arquivos ?? []);
      const principal = initialTicket.responsaveis[0];
      const collab = initialTicket.responsaveis.slice(1);
      const principalRes = principal
        ? { id: principal.id, nome: principal.nome }
        : usuarioAtual;
      setResponsavelPrincipal(principalRes);
      setColaboradores(collab);
      setHistorico(initialTicket.historico ?? []);
      setArquivosAtualizacao([]);
      prevStatusRef.current = initialTicket.status;
      prevPrioridadeRef.current = initialTicket.prioridade;
      prevCategoriaRef.current = initialTicket.categoria;
      prevResponsavelPrincipalIdRef.current = principalRes.id;
      prevColaboradoresIdsRef.current = collab.map((c) => c.id).sort().join(",");
    }
  }, [open, initialTicket]);

  // Registro automático: mudança de status
  useEffect(() => {
    if (prevStatusRef.current === null) return;
    if (prevStatusRef.current === status) return;
    const nextLabel = STATUS_LABELS[status];
    setHistorico((prev) => [
      ...prev,
      {
        id: `h-${Date.now()}`,
        data: new Date().toISOString(),
        acao: `Status alterado para ${nextLabel}`,
        autor: usuarioAtual.nome,
      },
    ]);
    prevStatusRef.current = status;
  }, [status]);

  // Registro automático: mudança de prioridade
  useEffect(() => {
    if (prevPrioridadeRef.current === null) return;
    if (prevPrioridadeRef.current === prioridade) return;
    const nextLabel = PRIORIDADE_LABELS[prioridade];
    setHistorico((prev) => [
      ...prev,
      {
        id: `h-${Date.now()}`,
        data: new Date().toISOString(),
        acao: `Prioridade alterada para ${nextLabel}`,
        autor: usuarioAtual.nome,
      },
    ]);
    prevPrioridadeRef.current = prioridade;
  }, [prioridade]);

  // Registro automático: mudança de categoria
  useEffect(() => {
    if (prevCategoriaRef.current === null) return;
    if (prevCategoriaRef.current === categoria) return;
    const nextLabel = CATEGORIA_LABELS[categoria];
    setHistorico((prev) => [
      ...prev,
      {
        id: `h-${Date.now()}`,
        data: new Date().toISOString(),
        acao: `Categoria alterada para ${nextLabel}`,
        autor: usuarioAtual.nome,
      },
    ]);
    prevCategoriaRef.current = categoria;
  }, [categoria]);

  // Gatilho de histórico: Responsável Principal alterado
  useEffect(() => {
    if (prevResponsavelPrincipalIdRef.current === "") return;
    if (prevResponsavelPrincipalIdRef.current === responsavelPrincipal.id) return;
    const todosMembros = [usuarioAtual, ...equipe];
    const prevNome = todosMembros.find((m) => m.id === prevResponsavelPrincipalIdRef.current)?.nome ?? "Responsável";
    const nextNome = responsavelPrincipal.nome;
    setHistorico((prev) => [
      ...prev,
      {
        id: `h-${Date.now()}`,
        data: new Date().toISOString(),
        acao: `${prevNome} passou a responsabilidade para ${nextNome}`,
        autor: usuarioAtual.nome,
      },
    ]);
    prevResponsavelPrincipalIdRef.current = responsavelPrincipal.id;
  }, [responsavelPrincipal.id, responsavelPrincipal.nome]);

  // Registro automático: colaborador adicionado ou removido
  useEffect(() => {
    const ids = colaboradores.map((c) => c.id).sort().join(",");
    if (prevColaboradoresIdsRef.current === "" && ids === "") return;
    if (prevColaboradoresIdsRef.current === ids) return;
    const prevIds = prevColaboradoresIdsRef.current.split(",").filter(Boolean);
    const nextIds = colaboradores.map((c) => c.id);
    const added = nextIds.filter((id) => !prevIds.includes(id));
    const removed = prevIds.filter((id) => !nextIds.includes(id));
    const entries: HistoricoEntrada[] = [];
    const now = new Date().toISOString();
    added.forEach((id) => {
      const r = colaboradores.find((x) => x.id === id);
      if (r) entries.push({ id: `h-${Date.now()}-${id}`, data: now, acao: `Colaborador ${r.nome} adicionado ao ticket`, autor: usuarioAtual.nome });
    });
    removed.forEach((id) => {
      const nome = equipe.find((m) => m.id === id)?.nome ?? "Colaborador";
      entries.push({ id: `h-${Date.now()}-rm-${id}`, data: now, acao: `Colaborador ${nome} removido do ticket`, autor: usuarioAtual.nome });
    });
    if (entries.length) setHistorico((prev) => [...prev, ...entries]);
    prevColaboradoresIdsRef.current = ids;
  }, [colaboradores]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId || !clienteNome.trim() || !assunto.trim()) return;
    const responsaveisPayload = [responsavelPrincipal, ...colaboradores];
    const nowIso = new Date().toISOString();
    const mudancas: string[] = [];

    if (initialTicket) {
      if (initialTicket.assunto.trim() !== assunto.trim()) mudancas.push("Assunto alterado");
      if (initialTicket.descricao.trim() !== descricao.trim()) mudancas.push("Descrição do ticket atualizada");
    }

    const prevAnexos = (initialTicket?.arquivos ?? []).map((f) => f.name);
    const nextAnexos = arquivos.map((f) => f.name);
    const anexosAdicionados = nextAnexos.filter((n) => !prevAnexos.includes(n));
    if (anexosAdicionados.length > 0) {
      mudancas.push(`Anexos adicionados: ${anexosAdicionados.join(", ")}`);
    }

    const historicoFinal =
      mudancas.length > 0
        ? [
            ...historico,
            {
              id: `h-${Date.now()}-audit`,
              data: nowIso,
              acao: mudancas.join(" · "),
              autor: usuarioAtual.nome,
              anexos: anexosAdicionados.length ? anexosAdicionados : undefined,
            },
          ]
        : historico;

    onSave({
      clienteId,
      clienteNome: clienteNome.trim(),
      assunto: assunto.trim(),
      descricao: descricao.trim(),
      prioridade,
      categoria,
      status,
      responsaveis: responsaveisPayload,
      previsaoConclusao,
      historico: historicoFinal,
      arquivos,
    });
    onClose();
  };

  const handleAdicionarAtualizacao = () => {
    const texto = novaAtualizacao.trim();
    if (!texto && arquivosAtualizacao.length === 0) return;
    const now = new Date().toISOString();
    // Garante preview posterior: mantém os arquivos em memória no ticket
    if (arquivosAtualizacao.length) {
      setArquivos((prev) => {
        const existing = new Set(prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
        const next = [...prev];
        arquivosAtualizacao.forEach((f) => {
          const key = `${f.name}-${f.size}-${f.lastModified}`;
          if (!existing.has(key)) next.push(f);
        });
        return next;
      });
    }
    setHistorico((prev) => [
      ...prev,
      {
        id: `h-${Date.now()}`,
        data: now,
        acao: texto || "Atualização",
        autor: usuarioAtual.nome,
        detalhe: notificarCliente ? "Cliente notificado por e-mail." : undefined,
        anexos: arquivosAtualizacao.length ? arquivosAtualizacao.map((f) => f.name) : undefined,
      },
    ]);
    setNovaAtualizacao("");
    setArquivosAtualizacao([]);
  };

  function formatHistoricoData(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function iniciais(nome: string): string {
    return nome
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?";
  }

  const handleSelectCliente = (id: string) => {
    const c = clientes.find((item) => item.id === id);
    setClienteId(id);
    setClienteNome(c ? (c.empresa || c.nome).trim() : "");
  };
  const handleChangeColaboradores = (ids: string[]) => {
    const next = ids
      .map((id) => equipe.find((m) => m.id === id))
      .filter(Boolean) as TicketResponsavel[];
    setColaboradores(next);
  };

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: "detalhes", label: "Detalhes", icon: FileText },
    { id: "interacoes", label: "Histórico & Comentários", icon: History },
  ];

  const sheetTitle = titleProp ?? (initialTicket ? initialTicket.id : "Novo Ticket");

  return (
    <DrawerSheet
      open={open}
      onClose={onClose}
      title={sheetTitle}
      maxWidth="sm:max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <div className="shrink-0 border-b border-slate-200 dark:border-slate-700">
          <nav className="flex gap-1 p-2" aria-label="Abas do detalhe do ticket">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[#6D28D9]/10 text-[#6D28D9] dark:bg-violet-950/50 dark:text-violet-300"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "detalhes" && (
            <div className="space-y-6">
              {/* Cliente */}
              <div className="space-y-1">
                <label className={labelClass}>
                  Cliente *
                </label>
                <SearchableSelect
                  options={clienteOptions}
                  value={clienteId}
                  onChange={handleSelectCliente}
                  placeholder="Buscar por nome ou empresa..."
                  searchPlaceholder="Buscar cliente..."
                />
              </div>

              {/* Classificação — Grid 3 colunas */}
              <div>
                <p className={labelClass}>Classificação</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-600">
                      Categoria
                    </label>
                    <SearchableSelect
                      options={categoriaOptions}
                      value={categoria}
                      onChange={(v) => setCategoria(v as TicketCategoria)}
                      placeholder="Selecione a categoria..."
                      searchable={false}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-600">
                      Prioridade
                    </label>
                    <SearchableSelect
                      options={prioridadeOptions}
                      value={prioridade}
                      onChange={(v) => setPrioridade(v as TicketPrioridade)}
                      placeholder="Selecione a prioridade..."
                      searchable={false}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Previsão calculada pelo SLA: <strong>{formatPrevisaoBr(previsaoConclusao)}</strong>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-600">
                      Status
                    </label>
                    <SearchableSelect
                      options={statusOptions}
                      value={status}
                      onChange={(v) => setStatus(v as TicketStatus)}
                      placeholder="Selecione o status..."
                      searchable={false}
                    />
                  </div>
                </div>
              </div>

              {/* Assunto */}
              <div className="space-y-1">
                <label htmlFor="ticket-assunto" className={labelClass}>
                  Título *
                </label>
                <input
                  id="ticket-assunto"
                  type="text"
                  value={assunto}
                  onChange={(e) => setAssunto(e.target.value)}
                  placeholder="Resumo do ticket"
                  className={inputClass}
                  required
                />
              </div>

              {/* Descrição — Textarea */}
              <div className="space-y-1">
                <label htmlFor="ticket-descricao" className={labelClass}>
                  Descrição *
                </label>
                <textarea
                  id="ticket-descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Detalhe o problema ou solicitação..."
                  rows={5}
                  className={`${inputClass} min-h-[120px] resize-y`}
                  required
                />
              </div>

              {/* Anexos — Dropzone */}
              <MultiFileAttachment
                existingFiles={[]}
                newFiles={arquivos}
                onNewFilesChange={setArquivos}
              />

              {/* Responsável Principal + Colaboradores */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className={labelClass}>
                    Responsável
                  </label>
                  <SearchableSelect
                    options={responsavelOptions}
                    value={responsavelPrincipal.id}
                    onChange={(id) => {
                      const r = listaResponsaveisPrincipal.find((m) => m.id === id);
                      if (r) setResponsavelPrincipal(r);
                    }}
                    placeholder="Selecione o responsável..."
                    searchPlaceholder="Buscar responsável..."
                  />
                  <p className="text-xs text-slate-500">
                    Ao criar um novo ticket, o usuário logado é o padrão. Altere para transferir a responsabilidade.
                  </p>
                </div>
                <div className="space-y-2">
                  <span className={labelClass}>Colaboradores</span>
                  <p className="text-xs text-slate-500">
                    Outros membros da equipe que atuam no chamado em conjunto.
                  </p>
                  <SearchableMultiSelect
                    options={colaboradorOptions}
                    values={colaboradorIds}
                    onChange={handleChangeColaboradores}
                    placeholder="Selecionar colaboradores..."
                    searchPlaceholder="Buscar colaborador..."
                    selectedLabel="Selecionados"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "interacoes" && (
            <div className="space-y-6">
              {/* Nova interação — input rápido */}
              <div className="space-y-3">
                <textarea
                  value={novaAtualizacao}
                  onChange={(e) => setNovaAtualizacao(e.target.value)}
                  placeholder="Descreva a ação realizada, resposta ao cliente ou nota interna..."
                  rows={3}
                  className={`${inputClass} min-h-[80px] resize-y`}
                />
                <MultiFileAttachment
                  existingFiles={[]}
                  newFiles={arquivosAtualizacao}
                  onNewFilesChange={setArquivosAtualizacao}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleAdicionarAtualizacao}
                    disabled={!novaAtualizacao.trim() && arquivosAtualizacao.length === 0}
                    className="rounded-lg bg-[#6D28D9] px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Adicionar Atualização
                  </button>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={notificarCliente}
                    onChange={(e) => setNotificarCliente(e.target.checked)}
                    className="rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800"
                  />
                  Notificar cliente por e-mail
                </label>
              </div>

              {/* Timeline do histórico */}
              <div className="border-t border-slate-200 pt-6 dark:border-slate-700">
                <p className="mb-4 text-sm font-medium text-slate-700 dark:text-slate-300">Linha do tempo</p>
                <div className="relative border-l-2 border-slate-100 pl-6 dark:border-slate-700">
                  {historico.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma ação registrada ainda.</p>
                  ) : (
                    <ul className="space-y-6">
                      {[...historico]
                        .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                        .map((entrada) => (
                        <li key={entrada.id} className="relative">
                          <div className="absolute -left-[29px] top-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#6D28D9]/15 text-xs font-semibold text-[#6D28D9] shadow-sm dark:border-slate-900 dark:bg-violet-500/20 dark:text-violet-300">
                            {entrada.autor ? iniciais(entrada.autor) : "S"}
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                              {entrada.autor ?? "Sistema"}
                              {" · "}
                              {formatHistoricoData(entrada.data)}
                            </p>
                            <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                              {entrada.acao}
                            </p>
                            {entrada.detalhe && (
                              <div className="mt-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
                                {entrada.detalhe}
                              </div>
                            )}
                            {entrada.anexos?.length ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {entrada.anexos.map((nome) => (
                                  <button
                                    key={nome}
                                    type="button"
                                    onClick={() => {
                                      const f = arquivos.find((x) => x.name === nome);
                                      if (f) openFilePreview(f);
                                      else openPlaceholderPreview(nome);
                                    }}
                                    className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 transition-colors hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
                                  >
                                    <FileText className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{nome}</span>
                                    <Eye className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Ações — apenas na aba Detalhes */}
        {activeTab === "detalhes" && (
          <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 lg:px-6 lg:py-3">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
              >
                Salvar Ticket
              </button>
            </div>
          </div>
        )}
      </form>
    </DrawerSheet>
  );
}
