"use client";

import type { ElementType, RefObject } from "react";
import { useId, useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, MessageSquare, Eye, X, Save, Plus, User, Users, Building2, Tags } from "lucide-react";
import type { Tarefa, UsuarioTarefa } from "@/lib/tarefas/types";
import { STATUS_LABELS } from "@/lib/tarefas/constants";
import { TAREFA_CATEGORIAS } from "@/lib/tarefas/categorias";
import { MultiFileAttachment } from "@/components/ui/multifile-attachment";
import { AlertDialog } from "@/components/ui/alert-dialog";
import {
  SearchableMultiSelect,
  SearchableSelect,
  type SearchableOption,
} from "@/components/ui/searchable-select";
import { DateField } from "@/components/ui/date-field";
import clsx from "clsx";
import {
  formInputClass,
  formLabelClass,
  formModalCancelButtonClass,
  formModalSubmitButtonClass,
  formTextareaClass,
} from "@/components/ui/field-patterns";
import {
  iconForCategoria,
  iconForStatus,
  STATUS_LEADING_ICON,
} from "@/lib/tarefas/option-icons";

/** Destaque suave para campo obrigatório não preenchido após tentativa de salvar */
function requiredFieldWarningWrap(active: boolean): string {
  return clsx(
    "w-full rounded-xl border-2 transition-[border-color,background-color,box-shadow] duration-150",
    active
      ? "border-red-400/55 bg-red-50/40 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.12)] dark:border-red-500/45 dark:bg-red-950/25 dark:shadow-[inset_0_0_0_1px_rgba(248,113,113,0.08)]"
      : "border-transparent bg-transparent"
  );
}

function scrollToFirstInvalidTaskField(
  steps: ReadonlyArray<{
    invalid: boolean;
    sectionRef: RefObject<HTMLElement | null>;
    focusSelector: string;
  }>
) {
  const step = steps.find((s) => s.invalid);
  const section = step?.sectionRef.current;
  if (!step || !section) return;
  section.scrollIntoView({ behavior: "smooth", block: "center" });
  requestAnimationFrame(() => {
    section.querySelector<HTMLElement>(step.focusSelector)?.focus({ preventScroll: true });
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

/** Formata ISO para exibição: 17/03/2026, 14:30 */
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

/** Converte ISO para valor de input date (yyyy-mm-dd) */
function isoToDateInput(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function openFilePreview(file: File): void {
  const url = URL.createObjectURL(file);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 15000);
}

/** Payload enviado ao salvar alterações (apenas campos editáveis) */
export type TarefaSalvarPayload = {
  titulo: string;
  descricao?: string;
  categoria?: string;
  status: Tarefa["status"];
  prioridade: Tarefa["prioridade"];
  responsavelId: string;
  clienteId?: string;
  clienteIds?: string[];
  dataInicio: string;
  dataFim: string;
  colaboradorIds: string[];
  /** Novos arquivos adicionados nesta edição (pendentes) */
  novosArquivos?: File[];
};

type TabId = "detalhes" | "historico";

type TarefaDetalheDrawerProps = {
  tarefa: Tarefa | null;
  usuariosMap: Map<string, UsuarioTarefa>;
  clientes?: Array<{ id: string; nome: string; empresa?: string }>;
  currentUserId?: string;
  onClose?: () => void;
  onTrocarResponsavel?: (tarefa: Tarefa, novoResponsavelId: string) => void;
  onAdicionarHistorico?: (tarefaId: string, acao: string, anexos?: string[]) => void;
  /** Chamado ao clicar Salvar na aba Detalhes com os valores atuais do formulário */
  onSalvar?: (tarefaId: string, payload: TarefaSalvarPayload) => void;
};

export function TarefaDetalheDrawer({
  tarefa,
  usuariosMap,
  clientes = [],
  currentUserId = "",
  onClose,
  onTrocarResponsavel,
  onAdicionarHistorico,
  onSalvar,
}: TarefaDetalheDrawerProps) {
  const tabBaseId = useId();
  const [activeTab, setActiveTab] = useState<TabId>("detalhes");
  const [comentario, setComentario] = useState("");
  const [arquivosComentario, setArquivosComentario] = useState<File[]>([]);
  const [pendingRemoveComentarioAnexo, setPendingRemoveComentarioAnexo] = useState<{
    index: number;
    nome: string;
  } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sectionTituloRef = useRef<HTMLDivElement>(null);
  const sectionCategoriaRef = useRef<HTMLDivElement>(null);
  const sectionPrazoRef = useRef<HTMLDivElement>(null);
  const sectionResponsavelRef = useRef<HTMLDivElement>(null);

  // Form state (aba Detalhes) — sincronizado com tarefa quando abre/muda
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [status, setStatus] = useState<Tarefa["status"]>("a_fazer");
  const [prioridade, setPrioridade] = useState<Tarefa["prioridade"]>("media");
  const [responsavelId, setResponsavelId] = useState("");
  const [clienteIds, setClienteIds] = useState<string[]>([]);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [colaboradorIds, setColaboradorIds] = useState<string[]>([]);
  // EXACT COPY (Helpdesk-style): 'arquivos' representa NOVOS arquivos selecionados (pendentes).
  const [arquivos, setArquivos] = useState<File[]>([]);
  /** Após tentar salvar com dados incompletos, destaca os campos que faltam */
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    if (!tarefa) return;
    setTitulo(tarefa.titulo);
    setDescricao(tarefa.descricao ?? "");
    setCategoria(tarefa.categoria ?? "");
    setStatus(tarefa.status);
    setPrioridade(tarefa.prioridade);
    setResponsavelId(tarefa.responsavel.id);
    setClienteIds(tarefa.clienteIds?.length ? tarefa.clienteIds : (tarefa.clienteId ? [tarefa.clienteId] : []));
    setDataInicio(isoToDateInput(tarefa.dataInicio));
    setDataFim(isoToDateInput(tarefa.dataFim));
    setColaboradorIds(tarefa.colaboradores?.map((c) => c.id) ?? []);
    setArquivosComentario([]);
    setArquivos([]);
    setSubmitAttempted(false);
  }, [tarefa?.id]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [tarefa?.historico?.length, activeTab]);

  if (!tarefa) return null;

  const errTitulo = submitAttempted && !titulo.trim();
  const errCategoria = submitAttempted && !categoria.trim();
  const errPrazo = submitAttempted && !dataFim.trim();
  const errResponsavel =
    submitAttempted &&
    (!responsavelId || !usuariosMap.has(responsavelId));

  const usuariosList = Array.from(usuariosMap.values());

  const handleEnviarComentario = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = comentario.trim();
    if (!text && arquivosComentario.length === 0) return;
    const textoComentario = text || "Atualização";
    const anexos = arquivosComentario.length ? arquivosComentario.map((f) => f.name) : undefined;
    // Garante preview posterior: mantém arquivos em memória na tarefa
    if (arquivosComentario.length) {
      setArquivos((prev) => {
        const existing = new Set(prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
        const next = [...prev];
        arquivosComentario.forEach((f) => {
          const key = `${f.name}-${f.size}-${f.lastModified}`;
          if (!existing.has(key)) next.push(f);
        });
        return next;
      });
    }
    onAdicionarHistorico?.(tarefa.id, textoComentario, anexos);
    setComentario("");
    setArquivosComentario([]);
  };

  const handleSalvar = () => {
    const invalid =
      !titulo.trim() ||
      !categoria.trim() ||
      !dataFim.trim() ||
      !responsavelId ||
      !usuariosMap.has(responsavelId);
    if (invalid) {
      setSubmitAttempted(true);
      queueMicrotask(() => {
        requestAnimationFrame(() => {
          scrollToFirstInvalidTaskField([
            { invalid: !titulo.trim(), sectionRef: sectionTituloRef, focusSelector: "#t-titulo" },
            { invalid: !categoria.trim(), sectionRef: sectionCategoriaRef, focusSelector: "button[type='button']" },
            { invalid: !dataFim.trim(), sectionRef: sectionPrazoRef, focusSelector: "#t-data-fim" },
            {
              invalid: !responsavelId || !usuariosMap.has(responsavelId),
              sectionRef: sectionResponsavelRef,
              focusSelector: "button[type='button']",
            },
          ]);
        });
      });
      return;
    }
    const dataInicioIso = dataInicio
      ? new Date(`${dataInicio}T00:00:00`).toISOString()
      : tarefa.dataInicio;
    const dataFimIso = new Date(`${dataFim.trim()}T23:59:59`).toISOString();
    setSubmitAttempted(false);
    onSalvar?.(tarefa.id, {
      titulo: titulo.trim(),
      descricao: descricao.trim() || undefined,
      categoria: categoria || undefined,
      status,
      prioridade,
      responsavelId,
      clienteId: clienteIds[0] || undefined,
      clienteIds,
      dataInicio: dataInicioIso,
      dataFim: dataFimIso,
      colaboradorIds,
      novosArquivos: arquivos,
    });
    setArquivos([]);
  };

  const historicoOrdenado = [...tarefa.historico].sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
  );
  const responsavelOptions: SearchableOption[] = usuariosList.map((u) => ({
    value: u.id,
    label: u.id === currentUserId ? `${u.nome} (você)` : u.nome,
    icon: User,
  }));
  const colaboradorOptions: SearchableOption[] = usuariosList
    .filter((u) => u.id !== responsavelId)
    .map((u) => ({
      value: u.id,
      label: u.id === currentUserId ? `${u.nome} (você)` : u.nome,
      icon: Users,
    }));
  const statusOptions: SearchableOption[] = (Object.entries(STATUS_LABELS) as [Tarefa["status"], string][])
    .map(([value, label]) => ({ value, label, icon: iconForStatus(value) }));
  const clienteOptions: SearchableOption[] = [...clientes]
    .sort((a, b) =>
      (a.empresa?.trim() || a.nome).localeCompare((b.empresa?.trim() || b.nome), "pt-BR", {
        sensitivity: "base",
      })
    )
    .map((c) => ({
      value: c.id,
      label: (c.empresa?.trim() || c.nome).trim(),
      subtitle: c.nome && c.empresa && c.nome !== c.empresa ? c.nome : undefined,
      icon: Building2,
    }));
  const clienteOptionsWithAll: SearchableOption[] = [
    { value: "__TODOS__", label: "Todos os Clientes", icon: Building2 },
    ...clienteOptions,
  ];
  const clienteIdsForSelect = (() => {
    const base = [...clienteIds];
    if (clientes.length > 0 && base.length === clientes.length) return ["__TODOS__", ...base];
    return base;
  })();

  const TABS: { id: TabId; label: string; Icon: ElementType }[] = [
    { id: "detalhes", label: "Detalhes", Icon: FileText },
    { id: "historico", label: "Interações", Icon: MessageSquare },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div
        role="tablist"
        aria-label="Abas do detalhe da tarefa"
        className="sticky top-0 z-30 flex w-full shrink-0 flex-wrap border-b border-slate-300 bg-slate-50/95 backdrop-blur-sm dark:border-slate-600 dark:bg-slate-800/95"
      >
        {TABS.map((tab) => {
          const Icon = tab.Icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${tabBaseId}-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`${tabBaseId}-${tab.id}-panel`}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "relative flex min-w-0 flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors",
                isActive
                  ? "text-[#6D28D9] dark:text-violet-400"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="tarefa-detalhe-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6D28D9]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === "detalhes" && (
        <div
          id={`${tabBaseId}-detalhes-panel`}
          role="tabpanel"
          aria-labelledby={`${tabBaseId}-detalhes`}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 lg:p-6">
            <div ref={sectionTituloRef}>
              <label htmlFor="t-titulo" className={formLabelClass}>
                Título{" "}
                <span className="text-red-600 dark:text-red-400" aria-hidden>
                  *
                </span>
              </label>
              <div className={requiredFieldWarningWrap(errTitulo)}>
                <div className="relative">
                  <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="t-titulo"
                    type="text"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    aria-invalid={errTitulo}
                    className={`${formInputClass} pl-10`}
                  />
                </div>
              </div>
            </div>
            <div>
              <label htmlFor="t-descricao" className={formLabelClass}>Descrição</label>
              <div className="relative">
                <FileText className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <textarea
                  id="t-descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={3}
                  placeholder="Ex.: Entrar em contato com clientes para validar pendências desta semana."
                  className={`${formInputClass} min-h-[80px] resize-y pl-10`}
                />
              </div>
            </div>
            <div ref={sectionCategoriaRef}>
              <label htmlFor="t-categoria" className={formLabelClass}>
                Categoria{" "}
                <span className="text-red-600 dark:text-red-400" aria-hidden>
                  *
                </span>
              </label>
              <div className={requiredFieldWarningWrap(errCategoria)}>
                <SearchableSelect
                  options={TAREFA_CATEGORIAS.map((c) => ({ value: c, label: c, icon: iconForCategoria(c) }))}
                  value={categoria}
                  onChange={setCategoria}
                  placeholder="Selecione a categoria..."
                  searchPlaceholder="Filtrar categoria..."
                  leadingIcon={Tags}
                />
              </div>
            </div>
            <div>
              <label htmlFor="t-status" className={formLabelClass}>Status</label>
              <SearchableSelect
                options={statusOptions}
                value={status}
                onChange={(v) => setStatus(v as Tarefa["status"])}
                searchable={false}
                leadingIcon={STATUS_LEADING_ICON}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="t-data-inicio" className={formLabelClass}>Data início</label>
                <DateField id="t-data-inicio" value={dataInicio} onChange={setDataInicio} />
              </div>
              <div ref={sectionPrazoRef}>
                <label htmlFor="t-data-fim" className={formLabelClass}>
                  Prazo final{" "}
                  <span className="text-red-600 dark:text-red-400" aria-hidden>
                    *
                  </span>
                </label>
                <div className={requiredFieldWarningWrap(errPrazo)}>
                  <DateField id="t-data-fim" value={dataFim} onChange={setDataFim} />
                </div>
              </div>
            </div>
            <div ref={sectionResponsavelRef}>
              <label htmlFor="t-responsavel" className={formLabelClass}>
                Responsável{" "}
                <span className="text-red-600 dark:text-red-400" aria-hidden>
                  *
                </span>
              </label>
              <div className={requiredFieldWarningWrap(errResponsavel)}>
                <SearchableSelect
                  options={responsavelOptions}
                  value={responsavelId}
                  onChange={setResponsavelId}
                  placeholder="Selecione o responsável..."
                  searchPlaceholder="Buscar responsável..."
                  leadingIcon={User}
                />
              </div>
            </div>
            <div>
              <label className={formLabelClass}>Colaboradores</label>
              <SearchableMultiSelect
                options={colaboradorOptions}
                values={colaboradorIds}
                onChange={setColaboradorIds}
                placeholder="Selecionar colaboradores..."
                searchPlaceholder="Buscar colaborador..."
                selectedLabel="Selecionados"
                leadingIcon={Users}
              />
            </div>
            <div>
              <label className={formLabelClass}>Clientes vinculados</label>
              <SearchableMultiSelect
                options={clienteOptionsWithAll}
                values={clienteIdsForSelect}
                onChange={(values) => {
                  const hasAll = values.includes("__TODOS__");
                  if (hasAll) {
                    setClienteIds(clientes.map((c) => c.id));
                    return;
                  }
                  setClienteIds(values.filter((id) => id !== "__TODOS__"));
                }}
                placeholder="Selecionar clientes..."
                searchPlaceholder="Buscar cliente..."
                selectedLabel="Selecionados"
                leadingIcon={Building2}
              />
            </div>

            {/* Anexos — EXACT COPY da lógica do Helpdesk (multi + preview + remover) */}
            <MultiFileAttachment
              existingFiles={tarefa.anexos ?? []}
              newFiles={arquivos}
              onNewFilesChange={setArquivos}
            />

          </div>
          {(onSalvar || onClose) && (
            <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 lg:px-6">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button type="button" onClick={onClose} className={formModalCancelButtonClass}>
                  <span className="inline-flex items-center gap-2">
                    <X className="h-4 w-4 shrink-0" aria-hidden />
                    Cancelar
                  </span>
                </button>
                {onSalvar ? (
                  <button type="button" onClick={handleSalvar} className={formModalSubmitButtonClass}>
                    <span className="inline-flex items-center gap-2">
                      <Save className="h-4 w-4 shrink-0" aria-hidden />
                      Salvar
                    </span>
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "historico" && (
        <div
          id={`${tabBaseId}-historico-panel`}
          role="tabpanel"
          aria-labelledby={`${tabBaseId}-historico`}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 lg:p-6">
            <div className="space-y-4">
              <div className="relative">
                <MessageSquare className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  rows={3}
                  placeholder="Descreva a ação realizada, resposta ao cliente ou nota interna..."
                  className={`${formTextareaClass} pl-9`}
                />
              </div>
              <MultiFileAttachment
                existingFiles={[]}
                newFiles={arquivosComentario}
                onNewFilesChange={setArquivosComentario}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleEnviarComentario()}
                  disabled={!comentario.trim() && arquivosComentario.length === 0}
                  className={formModalSubmitButtonClass}
                >
                  <span className="inline-flex items-center gap-2">
                    <Plus className="h-4 w-4 shrink-0" aria-hidden />
                    Adicionar
                  </span>
                </button>
              </div>
            </div>
            <ul className="relative mt-4 space-y-0 border-t border-slate-200 pt-6 dark:border-slate-700">
              <span className="absolute bottom-2 left-[11px] top-2 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
              {historicoOrdenado.length === 0 ? (
                <li className="text-sm text-slate-500 dark:text-slate-400">Nenhuma ação registrada ainda.</li>
              ) : (
                historicoOrdenado.map((entrada) => (
                  <li key={entrada.id} className="relative flex gap-3 pb-6 last:pb-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                      {entrada.autor ? iniciais(entrada.autor) : "S"}
                    </span>
                    <div>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {formatHistoricoData(entrada.data)} - {entrada.autor ?? "Sistema"}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm font-medium text-slate-900 dark:text-slate-100">
                        {entrada.acao}
                      </p>
                      {entrada.anexos?.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {entrada.anexos.map((nome) => (
                            <button
                              key={nome}
                              type="button"
                              onClick={() => {
                                const w = window.open("", "_blank");
                                if (!w) return;
                                w.document.title = nome;
                                w.document.body.innerHTML = `<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \\"Liberation Mono\\", \\"Courier New\\", monospace; padding: 16px;">Preview indisponivel para este anexo: ${nome}</pre>`;
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
      <AlertDialog
        open={!!pendingRemoveComentarioAnexo}
        onClose={() => setPendingRemoveComentarioAnexo(null)}
        onConfirm={() => {
          if (!pendingRemoveComentarioAnexo) return;
          const i = pendingRemoveComentarioAnexo.index;
          setArquivosComentario((prev) => prev.filter((_, j) => j !== i));
          setPendingRemoveComentarioAnexo(null);
        }}
        title="Remover anexo do comentário?"
        description={
          pendingRemoveComentarioAnexo ? (
            <>
              <strong className="text-slate-900 dark:text-slate-100">Esta ação é irreversível:</strong> o arquivo{" "}
              <strong className="text-slate-900 dark:text-slate-100">{pendingRemoveComentarioAnexo.nome}</strong> será
              retirado da lista antes de você publicar o comentário.
            </>
          ) : null
        }
        cancelLabel="Cancelar"
        confirmLabel="Sim, remover permanentemente"
        destructive
      />
    </div>
  );
}
