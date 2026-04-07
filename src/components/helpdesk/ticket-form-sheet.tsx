"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useId } from "react";
import clsx from "clsx";
import { motion } from "framer-motion";
import { FileText, Paperclip, UserPlus, Users, MessageSquare, Eye, X } from "lucide-react";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import { MultiFileAttachment } from "@/components/ui/multifile-attachment";
import { AlertDialog } from "@/components/ui/alert-dialog";
import {
  PRIORIDADE_LABELS,
  STATUS_LABELS,
  CATEGORIA_LABELS,
} from "@/lib/helpdesk/constants";
import type {
  Ticket,
  TicketPrioridade,
  TicketStatus,
  TicketCategoria,
  TicketResponsavel,
  HistoricoEntrada,
} from "@/lib/helpdesk/types";

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
  title?: string;
};

type TabId = "detalhes" | "interacoes";

type PendingRemoveTicket =
  | { kind: "colaborador"; id: string; nome: string }
  | { kind: "arquivo_interacao"; index: number; nome: string };

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

  // Cliente (Select / busca)
  const [clienteId, setClienteId] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [buscaCliente, setBuscaCliente] = useState("");
  const [abertoCliente, setAbertoCliente] = useState(false);
  const clienteRef = useRef<HTMLDivElement>(null);

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
  const [abertoColaboradores, setAbertoColaboradores] = useState(false);
  const colaboradoresRef = useRef<HTMLDivElement>(null);

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
  const [pendingRemoveTicket, setPendingRemoveTicket] = useState<PendingRemoveTicket | null>(null);

  const clientesFiltrados = useMemo(() => {
    if (!buscaCliente.trim()) return clientes.slice(0, 10);
    const q = buscaCliente.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        (c.empresa || "").toLowerCase().includes(q)
    ).slice(0, 10);
  }, [buscaCliente, clientes]);

  /** Lista completa para o select de Responsável Principal (logado + equipe), sem duplicados por id */
  const listaResponsaveisPrincipal = useMemo(() => {
    const byId = new Map<string, TicketResponsavel>();
    [usuarioAtual, ...equipe].forEach((m) => {
      if (!byId.has(m.id)) byId.set(m.id, m);
    });
    return Array.from(byId.values());
  }, [usuarioAtual, equipe]);
  /** Colaboradores disponíveis para adicionar (exclui o principal) */
  const colaboradoresDisponiveis = useMemo(
    () =>
      equipe.filter(
        (m) => m.id !== responsavelPrincipal.id && !colaboradores.some((c) => c.id === m.id)
      ),
    [responsavelPrincipal.id, colaboradores, equipe]
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
      setBuscaCliente("");
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
      setBuscaCliente("");
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

  useEffect(() => {
    if (!abertoCliente) return;
    const handle = (e: MouseEvent) => {
      if (!clienteRef.current?.contains(e.target as Node)) setAbertoCliente(false);
    };
    document.addEventListener("click", handle);
    return () => document.removeEventListener("click", handle);
  }, [abertoCliente]);

  useEffect(() => {
    if (!abertoColaboradores) return;
    const handle = (e: MouseEvent) => {
      if (!colaboradoresRef.current?.contains(e.target as Node)) setAbertoColaboradores(false);
    };
    document.addEventListener("click", handle);
    return () => document.removeEventListener("click", handle);
  }, [abertoColaboradores]);

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

  const handleSelectCliente = (id: string, nome: string) => {
    setClienteId(id);
    setClienteNome(nome);
    setBuscaCliente("");
    setAbertoCliente(false);
  };

  // (input onChange agora fica dentro do MultiFileAttachment)

  const addColaborador = (r: TicketResponsavel) => {
    setColaboradores((prev) => (prev.some((x) => x.id === r.id) ? prev : [...prev, r]));
    setAbertoColaboradores(false);
  };

  const removeColaborador = (id: string) => {
    setColaboradores((prev) => prev.filter((r) => r.id !== id));
  };
  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: "detalhes", label: "Detalhes do Ticket", icon: FileText },
    { id: "interacoes", label: "Interações / Histórico", icon: MessageSquare },
  ];

  const sheetTitle = titleProp ?? (initialTicket ? `Ticket ${initialTicket.id}` : "Novo Ticket");

  return (
    <DrawerSheet
      open={open}
      onClose={onClose}
      title={sheetTitle}
      maxWidth="sm:max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <div
          role="tablist"
          className="flex border-b border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50"
        >
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
                  "relative flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "text-[#6D28D9] dark:text-violet-400"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId={`ticket-form-tab-${id}`}
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6D28D9]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                  />
                )}
                <Icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "detalhes" && (
            <div className="space-y-6">
              {/* Cliente — Select (busca) */}
              <div ref={clienteRef} className="space-y-1">
                <label htmlFor="ticket-cliente" className={labelClass}>
                  Cliente *
                </label>
                <div className="relative">
                  <input
                    id="ticket-cliente"
                    type="text"
                    value={abertoCliente ? buscaCliente : clienteNome}
                    onChange={(e) => {
                      setBuscaCliente(e.target.value);
                      setAbertoCliente(true);
                      if (!e.target.value) setClienteId("");
                    }}
                    onFocus={() => setAbertoCliente(true)}
                    placeholder="Buscar por nome ou empresa..."
                    className={inputClass}
                    autoComplete="off"
                  />
                  {abertoCliente && (
                    <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900">
                      {clientesFiltrados.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() =>
                              handleSelectCliente(c.id, c.empresa || c.nome)
                            }
                            className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-violet-50 dark:hover:bg-violet-950/40"
                          >
                            <span className="font-medium text-slate-900 dark:text-slate-100">
                              {c.empresa || c.nome}
                            </span>
                            {c.empresa && c.nome && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {c.nome}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                      {clientesFiltrados.length === 0 && (
                        <li className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                          Nenhum cliente encontrado.
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </div>

              {/* Classificação — Grid 3 colunas */}
              <div>
                <p className={labelClass}>Classificação</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label htmlFor="ticket-categoria" className="text-xs text-slate-600">
                      Categoria
                    </label>
                    <select
                      id="ticket-categoria"
                      value={categoria}
                      onChange={(e) =>
                        setCategoria(e.target.value as TicketCategoria)
                      }
                      className={inputClass}
                    >
                      {(Object.entries(CATEGORIA_LABELS) as [TicketCategoria, string][]).map(
                        ([val, label]) => (
                          <option key={val} value={val}>
                            {label}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="ticket-prioridade" className="text-xs text-slate-600">
                      Prioridade
                    </label>
                    <select
                      id="ticket-prioridade"
                      value={prioridade}
                      onChange={(e) =>
                        setPrioridade(e.target.value as TicketPrioridade)
                      }
                      className={inputClass}
                    >
                      {(Object.entries(PRIORIDADE_LABELS) as [TicketPrioridade, string][]).map(
                        ([val, label]) => (
                          <option key={val} value={val}>
                            {label}
                          </option>
                        )
                      )}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">
                      Previsão calculada pelo SLA: <strong>{formatPrevisaoBr(previsaoConclusao)}</strong>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="ticket-status" className="text-xs text-slate-600">
                      Status
                    </label>
                    <select
                      id="ticket-status"
                      value={status}
                      onChange={(e) =>
                        setStatus(e.target.value as TicketStatus)
                      }
                      className={inputClass}
                    >
                      {(Object.entries(STATUS_LABELS) as [TicketStatus, string][]).map(
                        ([val, label]) => (
                          <option key={val} value={val}>
                            {label}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>
              </div>

              {/* Assunto */}
              <div className="space-y-1">
                <label htmlFor="ticket-assunto" className={labelClass}>
                  Assunto *
                </label>
                <input
                  id="ticket-assunto"
                  type="text"
                  value={assunto}
                  onChange={(e) => setAssunto(e.target.value)}
                  placeholder="Resumo do problema ou solicitação"
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
                  <label htmlFor="ticket-responsavel-principal" className={labelClass}>
                    Responsável Principal
                  </label>
                  <select
                    id="ticket-responsavel-principal"
                    value={responsavelPrincipal.id}
                    onChange={(e) => {
                      const id = e.target.value;
                      const r = listaResponsaveisPrincipal.find((m) => m.id === id);
                      if (r) setResponsavelPrincipal(r);
                    }}
                    className={inputClass}
                  >
                    {listaResponsaveisPrincipal.map((r, idx) => (
                      <option key={`${r.id}-${idx}`} value={r.id}>
                        {r.id === usuarioAtual.id ? `${r.nome} (você)` : r.nome}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">
                    Ao criar um novo ticket, o usuário logado é o padrão. Altere para transferir a responsabilidade.
                  </p>
                </div>
                <div ref={colaboradoresRef} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-500" />
                    <span className={labelClass}>Colaboradores</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Outros membros da equipe que atuam no chamado em conjunto.
                  </p>
                  {colaboradores.length > 0 && (
                    <ul className="flex flex-wrap gap-2">
                      {colaboradores.map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center gap-2 rounded-full bg-slate-100 py-1.5 pl-3 pr-1.5 text-sm text-slate-800"
                        >
                          <span>{r.nome}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingRemoveTicket({ kind: "colaborador", id: r.id, nome: r.nome })
                            }
                            className="rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                            aria-label={`Remover ${r.nome}`}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setAbertoColaboradores((v) => !v)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <UserPlus className="h-4 w-4" />
                      Adicionar Colaborador
                    </button>
                    {abertoColaboradores && colaboradoresDisponiveis.length > 0 && (
                      <ul className="absolute left-0 top-full z-10 mt-1 min-w-[180px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900">
                        {colaboradoresDisponiveis.map((m) => (
                          <li key={m.id}>
                            <button
                              type="button"
                              onClick={() => addColaborador(m)}
                              className="w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-violet-50 dark:text-slate-200 dark:hover:bg-violet-950/40"
                            >
                              {m.nome}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {abertoColaboradores && colaboradoresDisponiveis.length === 0 && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Nenhum colaborador disponível para adicionar.
                      </p>
                    )}
                  </div>
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
                <input
                  id="file-upload-helpdesk"
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (!files.length) return;
                    setArquivosAtualizacao((prev) => {
                      const existing = new Set(prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
                      const next = [...prev];
                      files.forEach((f) => {
                        const key = `${f.name}-${f.size}-${f.lastModified}`;
                        if (!existing.has(key)) next.push(f);
                      });
                      return next;
                    });
                    e.target.value = "";
                  }}
                />
                {arquivosAtualizacao.length > 0 && (
                  <ul className="space-y-2">
                    {arquivosAtualizacao.map((f, idx) => (
                      <li
                        key={`${f.name}-${f.size}-${f.lastModified}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                      >
                        <button
                          type="button"
                          onClick={() => openFilePreview(f)}
                          className="inline-flex items-center gap-2 font-medium text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-slate-50"
                          title="Visualizar"
                        >
                          <Eye className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                          <span className="truncate max-w-[320px]">{f.name}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingRemoveTicket({
                              kind: "arquivo_interacao",
                              index: idx,
                              nome: f.name,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                          aria-label="Remover arquivo"
                        >
                          <X className="h-3.5 w-3.5" />
                          Remover
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <label
                    htmlFor="file-upload-helpdesk"
                    className="cursor-pointer rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                    aria-label="Anexar arquivo"
                  >
                    <Paperclip className="h-5 w-5" />
                  </label>
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
      <AlertDialog
        open={!!pendingRemoveTicket}
        onClose={() => setPendingRemoveTicket(null)}
        onConfirm={() => {
          if (!pendingRemoveTicket) return;
          if (pendingRemoveTicket.kind === "colaborador") {
            removeColaborador(pendingRemoveTicket.id);
          } else {
            const i = pendingRemoveTicket.index;
            setArquivosAtualizacao((prev) => prev.filter((_, j) => j !== i));
          }
        }}
        title={
          pendingRemoveTicket?.kind === "colaborador"
            ? "Remover colaborador?"
            : "Remover anexo?"
        }
        description={
          pendingRemoveTicket?.kind === "colaborador" ? (
            <>
              <strong className="text-slate-900 dark:text-slate-100">Esta ação é irreversível neste formulário:</strong>{" "}
              <strong className="text-slate-900 dark:text-slate-100">{pendingRemoveTicket.nome}</strong> deixa de
              figurar como colaborador. Ao salvar o ticket, a alteração fica permanente.
            </>
          ) : pendingRemoveTicket ? (
            <>
              <strong className="text-slate-900 dark:text-slate-100">Esta ação é irreversível:</strong> o arquivo{" "}
              <strong className="text-slate-900 dark:text-slate-100">{pendingRemoveTicket.nome}</strong> será retirado da
              atualização antes do envio.
            </>
          ) : null
        }
        cancelLabel="Cancelar"
        confirmLabel="Sim, remover permanentemente"
        destructive
      />
    </DrawerSheet>
  );
}
