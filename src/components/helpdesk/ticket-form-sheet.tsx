"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useId } from "react";
import clsx from "clsx";
import { motion } from "framer-motion";
import {
  FileText,
  History,
  Eye,
  Building2,
  AlertTriangle,
  Clock3,
  ShieldAlert,
  Circle,
  CircleDot,
  CircleHelp,
  CheckCircle2,
  MessageSquareReply,
  CircleSlash2,
  User,
  Users,
  Handshake,
  Wallet,
  Wrench,
  Lightbulb,
  MessageSquare,
  Save,
  X,
  Plus,
} from "lucide-react";
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
import {
  formInputClass,
  formLabelClass,
  formModalCancelButtonClass,
  formModalSubmitButtonClass,
  formTextareaClass,
} from "@/components/ui/field-patterns";

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
  /** Usuários ativos do sistema (não pessoas de RH). */
  usuarios?: TicketResponsavel[];
  /** @deprecated Use `usuarios`. */
  equipe?: TicketResponsavel[];
  usuarioAtual?: TicketResponsavel;
  /** Ticket existente para visualizar/editar; null = novo ticket */
  initialTicket?: Ticket | null;
  /** Título do Sheet (opcional; senão usa "Ticket ID" ou "Novo Ticket") */
  title?: React.ReactNode;
  hideClienteField?: boolean;
  hideResponsavelSection?: boolean;
  fixedCliente?: { id: string; nome: string } | null;
  readOnlyStatus?: boolean;
  hideSlaPreview?: boolean;
};

type TabId = "detalhes" | "interacoes";

const inputClass = formInputClass;
const labelClass = formLabelClass;

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
  usuarios: usuariosProp,
  equipe: equipeLegacy = [],
  usuarioAtual = { id: "usuario-atual", nome: "Usuário" },
  initialTicket = null,
  title: titleProp,
  hideClienteField = false,
  hideResponsavelSection = false,
  fixedCliente = null,
  readOnlyStatus = false,
  hideSlaPreview = false,
}: TicketFormSheetProps) {
  const usuarios = usuariosProp ?? equipeLegacy;
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
  const prevOpenRef = useRef(false);
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
        icon: Building2,
      })),
    [clientes]
  );

  /** Lista completa para o select de Responsável (logado + usuários do sistema), sem duplicados por id */
  const listaResponsaveisPrincipal = useMemo(() => {
    const byId = new Map<string, TicketResponsavel>();
    [usuarioAtual, ...usuarios].forEach((m) => {
      if (!byId.has(m.id)) byId.set(m.id, m);
    });
    return Array.from(byId.values());
  }, [usuarioAtual, usuarios]);
  const responsavelOptions: SearchableOption[] = useMemo(
    () =>
      listaResponsaveisPrincipal.map((r) => ({
        value: r.id,
        label: r.id === usuarioAtual.id ? `${r.nome} (você)` : r.nome,
        icon: User,
      })),
    [listaResponsaveisPrincipal, usuarioAtual.id]
  );
  const colaboradorOptions: SearchableOption[] = useMemo(
    () =>
      usuarios
        .filter((m) => m.id !== responsavelPrincipal.id)
        .map((m) => ({ value: m.id, label: m.nome, icon: Users })),
    [usuarios, responsavelPrincipal.id]
  );
  const colaboradorIds = useMemo(() => colaboradores.map((c) => c.id), [colaboradores]);
  const categoriaOptions: SearchableOption[] = useMemo(
    () =>
      (Object.entries(CATEGORIA_LABELS) as [TicketCategoria, string][]).map(([value, label]) => ({
        value,
        label,
        icon:
          value === "comercial"
            ? ({ className }) => <Handshake className={clsx(className, "!text-violet-600 dark:!text-violet-400")} />
            : value === "financeiro"
              ? ({ className }) => <Wallet className={clsx(className, "!text-emerald-600 dark:!text-emerald-400")} />
              : value === "suporte_tecnico"
                ? ({ className }) => <Wrench className={clsx(className, "!text-blue-600 dark:!text-blue-400")} />
                : value === "duvida"
                  ? ({ className }) => <CircleHelp className={clsx(className, "!text-amber-600 dark:!text-amber-400")} />
                  : value === "sugestao"
                    ? ({ className }) => <Lightbulb className={clsx(className, "!text-fuchsia-600 dark:!text-fuchsia-400")} />
                    : ({ className }) => <Building2 className={clsx(className, "!text-slate-500 dark:!text-slate-400")} />,
      })),
    []
  );
  const prioridadeOptions: SearchableOption[] = useMemo(
    () =>
      (Object.entries(PRIORIDADE_LABELS) as [TicketPrioridade, string][]).map(([value, label]) => ({
        value,
        label,
        icon:
          value === "critica"
            ? ({ className }) => <ShieldAlert className={clsx(className, "!text-red-600 dark:!text-red-400")} />
            : value === "alta"
              ? ({ className }) => <AlertTriangle className={clsx(className, "!text-orange-600 dark:!text-orange-400")} />
              : value === "media"
                ? ({ className }) => <Clock3 className={clsx(className, "!text-amber-600 dark:!text-amber-400")} />
                : ({ className }) => <Circle className={clsx(className, "!text-slate-500 dark:!text-slate-400")} />,
      })),
    []
  );
  const statusOptions: SearchableOption[] = useMemo(
    () =>
      (Object.entries(STATUS_LABELS) as [TicketStatus, string][]).map(([value, label]) => ({
        value,
        label,
        icon:
          value === "novo"
            ? ({ className }) => <CircleDot className={clsx(className, "!text-blue-600 dark:!text-blue-400")} />
            : value === "em_andamento"
              ? ({ className }) => <Clock3 className={clsx(className, "!text-sky-600 dark:!text-sky-400")} />
              : value === "aguardando_cliente"
                ? ({ className }) => <MessageSquareReply className={clsx(className, "!text-amber-600 dark:!text-amber-400")} />
                : value === "aguardando_equipe"
                  ? ({ className }) => <Users className={clsx(className, "!text-violet-600 dark:!text-violet-400")} />
                  : value === "pendente"
                    ? ({ className }) => <AlertTriangle className={clsx(className, "!text-orange-600 dark:!text-orange-400")} />
                    : value === "respondido"
                      ? ({ className }) => <CheckCircle2 className={clsx(className, "!text-emerald-600 dark:!text-emerald-400")} />
                      : value === "finalizado"
                        ? ({ className }) => <History className={clsx(className, "!text-teal-600 dark:!text-teal-400")} />
            : value === "nao_solucionado"
              ? ({ className }) => <CircleSlash2 className={clsx(className, "!text-red-600 dark:!text-red-400")} />
                        : ({ className }) => <Circle className={clsx(className, "!text-slate-500 dark:!text-slate-400")} />,
      })),
    []
  );

  // Previsão dinâmica: reage à prioridade (Crítica +4h, Alta +24h, Média +3d, Baixa +7d)
  useEffect(() => {
    setPrevisaoConclusao(computePrevisaoByPrioridade(prioridade));
  }, [prioridade]);

  useEffect(() => {
    if (!open) {
      prevOpenRef.current = false;
      return;
    }
    if (!prevOpenRef.current) {
      setActiveTab("detalhes");
      prevOpenRef.current = true;
    }
    if (!initialTicket) {
      setClienteId(fixedCliente?.id ?? "");
      setClienteNome(fixedCliente?.nome ?? "");
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
  }, [open, initialTicket, fixedCliente, usuarioAtual]);

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
    const todosMembros = [usuarioAtual, ...usuarios];
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
      const nome = usuarios.find((m) => m.id === id)?.nome ?? "Usuário";
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
      .map((id) => usuarios.find((m) => m.id === id))
      .filter(Boolean) as TicketResponsavel[];
    setColaboradores(next);
  };

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: "detalhes", label: "Detalhes", icon: FileText },
    { id: "interacoes", label: "Interações", icon: MessageSquare },
  ];

  const sheetTitle = titleProp ?? (initialTicket ? initialTicket.id : "Novo Ticket");

  return (
    <DrawerSheet
      open={open}
      onClose={onClose}
      title={sheetTitle}
      maxWidth="sm:max-w-3xl"
      mobileContentPaddingClassName="px-0"
      desktopContentPaddingClassName="px-0"
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          role="tablist"
          aria-label="Abas do detalhe do ticket"
          className="sticky top-0 z-30 flex w-full shrink-0 flex-wrap border-b border-slate-300 bg-slate-50/95 backdrop-blur-sm dark:border-slate-600 dark:bg-slate-800/95"
        >
          <nav className="flex w-full" aria-label="Abas do detalhe do ticket">
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
                    "relative flex min-w-0 flex-1 items-center justify-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors sm:px-4",
                    isActive
                      ? "text-[#6D28D9] dark:text-violet-400"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  )}
                >
                  {isActive ? <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6D28D9]" /> : null}
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 lg:p-6">
          {activeTab === "detalhes" && (
            <div className="space-y-6">
              {/* Cliente */}
              {!hideClienteField && (
                <div className="space-y-1">
                  <label className={labelClass}>
                    Cliente <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <SearchableSelect
                    options={clienteOptions}
                    value={clienteId}
                    onChange={handleSelectCliente}
                    placeholder="Buscar por nome ou empresa..."
                    searchPlaceholder="Buscar cliente..."
                    leadingIcon={Building2}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className={labelClass}>Categoria</label>
                    <SearchableSelect
                      options={categoriaOptions}
                      value={categoria}
                      onChange={(v) => setCategoria(v as TicketCategoria)}
                      placeholder="Selecione a categoria..."
                      searchable={false}
                      leadingIcon={CircleDot}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>Prioridade</label>
                    <SearchableSelect
                      options={prioridadeOptions}
                      value={prioridade}
                      onChange={(v) => setPrioridade(v as TicketPrioridade)}
                      placeholder="Selecione a prioridade..."
                      searchable={false}
                      leadingIcon={Clock3}
                    />
                    {!hideSlaPreview && (
                      <p className="mt-1 text-xs text-slate-500">
                        Previsão calculada pelo SLA: <strong>{formatPrevisaoBr(previsaoConclusao)}</strong>
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>Status</label>
                    {readOnlyStatus ? (
                      <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                        {STATUS_LABELS[status]}
                      </div>
                    ) : (
                      <SearchableSelect
                        options={statusOptions}
                        value={status}
                        onChange={(v) => setStatus(v as TicketStatus)}
                        placeholder="Selecione o status..."
                        searchable={false}
                        leadingIcon={Circle}
                      />
                    )}
                  </div>
              </div>

              {/* Assunto */}
              <div className="space-y-1">
                <label htmlFor="ticket-assunto" className={labelClass}>
                  Título <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <div className="relative">
                  <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="ticket-assunto"
                    type="text"
                    value={assunto}
                    onChange={(e) => setAssunto(e.target.value)}
                    placeholder="Resumo do ticket"
                    className={`${inputClass} pl-9`}
                    required
                  />
                </div>
              </div>

              {/* Descrição — Textarea */}
              <div className="space-y-1">
                <label htmlFor="ticket-descricao" className={labelClass}>
                  Descrição <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <div className="relative">
                  <FileText className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <textarea
                    id="ticket-descricao"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Detalhe o problema ou solicitação..."
                    rows={5}
                    className={`${formTextareaClass} min-h-[120px] resize-y pl-9`}
                    required
                  />
                </div>
              </div>

              {/* Responsável Principal + Colaboradores */}
              {!hideResponsavelSection && (
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
                      leadingIcon={User}
                    />
                    <p className="text-xs text-slate-500">
                      Ao criar um novo ticket, o usuário logado é o padrão. Altere para transferir a responsabilidade.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <span className={labelClass}>Colaboradores</span>
                    <p className="text-xs text-slate-500">
                      Outros usuários do sistema que atuam no chamado em conjunto.
                    </p>
                    <SearchableMultiSelect
                      options={colaboradorOptions}
                      values={colaboradorIds}
                      onChange={handleChangeColaboradores}
                      placeholder="Selecionar usuários..."
                      searchPlaceholder="Buscar usuário..."
                      selectedLabel="Selecionados"
                      leadingIcon={Users}
                    />
                  </div>
                </div>
              )}

              {/* Anexos — Dropzone */}
              <MultiFileAttachment
                existingFiles={[]}
                newFiles={arquivos}
                onNewFilesChange={setArquivos}
              />
            </div>
          )}

          {activeTab === "interacoes" && (
            <div className="space-y-6">
              {/* Nova interação — input rápido */}
              <div className="space-y-3">
                <div className="relative">
                  <MessageSquare className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <textarea
                    value={novaAtualizacao}
                    onChange={(e) => setNovaAtualizacao(e.target.value)}
                    placeholder="Descreva a ação realizada, resposta ao cliente ou nota interna..."
                    rows={3}
                    className={`${formTextareaClass} min-h-[80px] resize-y pl-9`}
                  />
                </div>
                <MultiFileAttachment
                  existingFiles={[]}
                  newFiles={arquivosAtualizacao}
                  onNewFilesChange={setArquivosAtualizacao}
                />
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <label className="mr-auto flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={notificarCliente}
                      onChange={(e) => setNotificarCliente(e.target.checked)}
                      className="rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800"
                    />
                    Notificar cliente por e-mail
                  </label>
                  <button
                    type="button"
                    onClick={handleAdicionarAtualizacao}
                    disabled={!novaAtualizacao.trim() && arquivosAtualizacao.length === 0}
                    className={`${formModalSubmitButtonClass} disabled:pointer-events-none disabled:opacity-50`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Plus className="h-4 w-4 shrink-0" aria-hidden />
                      Adicionar
                    </span>
                  </button>
                </div>
              </div>

              {/* Timeline do histórico */}
              <div className="border-t border-slate-200 pt-6 dark:border-slate-700">
                <p className="mb-4 text-sm font-medium text-slate-700 dark:text-slate-300">Linha do tempo</p>
                <ul className="relative space-y-0">
                  <span className="absolute bottom-2 left-[11px] top-2 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
                  {historico.length === 0 ? (
                    <li className="text-sm text-slate-500 dark:text-slate-400">Nenhuma ação registrada ainda.</li>
                  ) : (
                    [...historico]
                      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                      .map((entrada) => (
                      <li key={entrada.id} className="relative flex gap-3 pb-6 last:pb-0">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                          {entrada.autor ? iniciais(entrada.autor) : "S"}
                        </span>
                        <div className="min-w-0 flex-1 pt-0.5">
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
                    ))
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Ações — apenas na aba Detalhes */}
        {activeTab === "detalhes" && (
          <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 lg:px-6">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={onClose}
                className={formModalCancelButtonClass}
              >
                <span className="inline-flex items-center gap-2">
                  <X className="h-4 w-4 shrink-0" aria-hidden />
                  Cancelar
                </span>
              </button>
              <button
                type="submit"
                className={formModalSubmitButtonClass}
              >
                <span className="inline-flex items-center gap-2">
                  <Save className="h-4 w-4 shrink-0" aria-hidden />
                  Salvar
                </span>
              </button>
            </div>
          </div>
        )}
      </form>
    </DrawerSheet>
  );
}
