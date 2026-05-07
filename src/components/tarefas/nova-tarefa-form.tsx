"use client";

import type { RefObject } from "react";
import { useRef, useState } from "react";
import clsx from "clsx";
import { Eye, Paperclip, X, User, Users, Building2, Tags, FileText } from "lucide-react";
import type { Tarefa, UsuarioTarefa } from "@/lib/tarefas/types";
import type { Cliente } from "@/lib/clientes/types";
import { TAREFA_CATEGORIAS } from "@/lib/tarefas/categorias";
import { iconForCategoria, STATUS_LEADING_ICON } from "@/lib/tarefas/option-icons";
import { AlertDialog } from "@/components/ui/alert-dialog";
import {
  SearchableMultiSelect,
  SearchableSelect,
  type SearchableOption,
} from "@/components/ui/searchable-select";
import { DateField } from "@/components/ui/date-field";
import {
  formAttachmentDropzoneClass,
  formAttachmentFileRowClass,
  formInputClass,
  formLabelClass,
  formModalCancelButtonClass,
  formModalSubmitButtonClass,
  formSectionLabelClass,
} from "@/components/ui/field-patterns";

/** Destaque suave para campo obrigatório não preenchido após tentativa de salvar */
const requiredFieldWarningWrap = (active: boolean) =>
  clsx(
    "w-full rounded-xl border-2 transition-[border-color,background-color,box-shadow] duration-150",
    active
      ? "border-red-400/55 bg-red-50/40 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.12)] dark:border-red-500/45 dark:bg-red-950/25 dark:shadow-[inset_0_0_0_1px_rgba(248,113,113,0.08)]"
      : "border-transparent bg-transparent"
  );

/** Rola até o primeiro campo inválido (ordem: Título → Categoria → Prazo final → Responsável) e foca o controle. */
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

type NovaTarefaFormProps = {
  usuarios: UsuarioTarefa[];
  clientes?: Pick<Cliente, "id" | "nome" | "empresa">[];
  /** ID do usuário logado — responsável vem preenchido com ele ao abrir */
  currentUserId?: string;
  onSave: (tarefa: Omit<Tarefa, "id"> & { clienteIds?: string[] }) => void;
  onCancel: () => void;
};

export function NovaTarefaForm({
  usuarios,
  clientes = [],
  currentUserId = "",
  onSave,
  onCancel,
}: NovaTarefaFormProps) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<string>("");
  const [prioridade, setPrioridade] = useState<Tarefa["prioridade"]>("media");
  const [responsavelId, setResponsavelId] = useState(currentUserId);
  const [colaboradorIds, setColaboradorIds] = useState<string[]>([]);
  const [clienteIds, setClienteIds] = useState<string[]>([]);
  const [dataFim, setDataFim] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [pendingRemoveAnexo, setPendingRemoveAnexo] = useState<{
    index: number;
    nome: string;
  } | null>(null);
  /** Após tentar salvar com dados incompletos, destaca os campos que faltam */
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sectionTituloRef = useRef<HTMLDivElement>(null);
  const sectionCategoriaRef = useRef<HTMLDivElement>(null);
  const sectionPrazoRef = useRef<HTMLDivElement>(null);
  const sectionResponsavelRef = useRef<HTMLDivElement>(null);

  const errTitulo = submitAttempted && !titulo.trim();
  const errCategoria = submitAttempted && !categoria.trim();
  const errPrazo = submitAttempted && !dataFim.trim();
  const errResponsavel =
    submitAttempted &&
    (!responsavelId || !usuarios.some((u) => u.id === responsavelId));

  const openFilePreview = (file: File) => {
    const url = URL.createObjectURL(file);
    window.open(url, "_blank");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const responsavelOptions: SearchableOption[] = usuarios.map((u) => ({
    value: u.id,
    label: u.id === currentUserId ? `${u.nome} (você)` : u.nome,
    icon: User,
  }));
  const clienteOptions: SearchableOption[] = [
    { value: "__TODOS__", label: "Selecionar Todos", icon: Building2 },
    ...[...clientes]
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
      })),
  ];
  const colaboradorOptions: SearchableOption[] = usuarios
    .filter((u) => u.id !== responsavelId)
    .map((u) => ({
      value: u.id,
      label: u.id === currentUserId ? `${u.nome} (você)` : u.nome,
      icon: Users,
    }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const responsavel = usuarios.find((u) => u.id === responsavelId);
    const invalid =
      !titulo.trim() ||
      !categoria.trim() ||
      !dataFim.trim() ||
      !responsavelId ||
      !responsavel;
    if (invalid) {
      setSubmitAttempted(true);
      queueMicrotask(() => {
        requestAnimationFrame(() => {
          scrollToFirstInvalidTaskField([
            { invalid: !titulo.trim(), sectionRef: sectionTituloRef, focusSelector: "#tarefa-titulo" },
            { invalid: !categoria.trim(), sectionRef: sectionCategoriaRef, focusSelector: "button[type='button']" },
            { invalid: !dataFim.trim(), sectionRef: sectionPrazoRef, focusSelector: "#tarefa-prazo" },
            {
              invalid:
                !responsavelId ||
                !usuarios.some((u) => u.id === responsavelId),
              sectionRef: sectionResponsavelRef,
              focusSelector: "button[type='button']",
            },
          ]);
        });
      });
      return;
    }
    const colaboradores = colaboradorIds
      .map((id) => usuarios.find((u) => u.id === id))
      .filter(Boolean) as UsuarioTarefa[];
    const now = new Date().toISOString();
    setSubmitAttempted(false);
    const fim = new Date(`${dataFim.trim()}T23:59:59`).toISOString();
    const quemCriou =
      (currentUserId ? usuarios.find((u) => u.id === currentUserId) : undefined) ?? responsavel;
    const hasSelecionarTodos = clienteIds.includes("__TODOS__");
    const clienteIdsFinal = hasSelecionarTodos
      ? clientes.map((c) => c.id)
      : clienteIds.filter((id) => id !== "__TODOS__");

    onSave({
      titulo: titulo.trim(),
      descricao: descricao.trim() || undefined,
      categoria: categoria || undefined,
      status: "a_fazer",
      prioridade,
      dataInicio: now,
      dataFim: fim,
      responsavel,
      colaboradores: colaboradores.filter((c) => c.id !== responsavelId),
      clienteId: clienteIdsFinal[0] || undefined,
      clienteIds: clienteIdsFinal,
      anexos: arquivos.map((f) => f.name),
      arquivos,
      historico: [
        {
          id: `h-${Date.now()}`,
          data: now,
          acao: "Tarefa criada",
          autor: quemCriou.nome,
          autorId: quemCriou.id,
        },
      ],
    });
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 lg:p-6">
      <div ref={sectionTituloRef}>
        <label htmlFor="tarefa-titulo" className={formLabelClass}>
          Título{" "}
          <span className="text-red-600 dark:text-red-400" aria-hidden>
            *
          </span>
        </label>
        <div className={requiredFieldWarningWrap(errTitulo)}>
          <div className="relative">
            <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="tarefa-titulo"
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Revisar proposta comercial"
              aria-invalid={errTitulo}
              className={`${formInputClass} pl-10`}
            />
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="tarefa-desc" className={formLabelClass}>
          Descrição
        </label>
        <div className="relative">
          <FileText className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <textarea
            id="tarefa-desc"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={3}
            placeholder="Detalhes da tarefa..."
            className={`${formInputClass} min-h-[80px] resize-y pl-10`}
          />
        </div>
      </div>

      <div ref={sectionCategoriaRef}>
        <label className={formLabelClass}>
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
        <label className={formLabelClass}>
          Status
        </label>
        <SearchableSelect
          options={[{ value: "a_fazer", label: "A Fazer" }]}
          value="a_fazer"
          onChange={() => undefined}
          searchable={false}
          leadingIcon={STATUS_LEADING_ICON}
          disabled
        />
      </div>

      <div ref={sectionPrazoRef}>
        <label htmlFor="tarefa-prazo" className={formLabelClass}>
          Prazo final{" "}
          <span className="text-red-600 dark:text-red-400" aria-hidden>
            *
          </span>
        </label>
        <div className={requiredFieldWarningWrap(errPrazo)}>
          <DateField
            id="tarefa-prazo"
            value={dataFim}
            onChange={setDataFim}
          />
        </div>
      </div>

      <div ref={sectionResponsavelRef}>
        <label className={formLabelClass}>
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
        <label className={formLabelClass}>
          Colaboradores
        </label>
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
        <label className={formLabelClass}>
          Clientes vinculados
        </label>
        <SearchableMultiSelect
          options={clienteOptions}
          values={clienteIds}
          onChange={setClienteIds}
          placeholder="Selecionar clientes..."
          searchPlaceholder="Buscar cliente..."
          selectedLabel="Selecionados"
          leadingIcon={Building2}
        />
      </div>

      <div className="space-y-1">
        <span className={formSectionLabelClass}>Anexos</span>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (!files.length) return;
            setArquivos((prev) => {
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
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={formAttachmentDropzoneClass}
        >
          <Paperclip className="h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500" />
          <span>Arraste documentos ou clique para anexar</span>
        </button>
        {arquivos.length > 0 && (
          <ul className="mt-2 space-y-2">
            {arquivos.map((f, idx) => (
              <li
                key={`${f.name}-${f.size}-${f.lastModified}`}
                className={formAttachmentFileRowClass}
              >
                <button
                  type="button"
                  onClick={() => openFilePreview(f)}
                  className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-slate-50"
                  title="Visualizar"
                >
                  <Eye className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <span className="truncate max-w-[320px]">{f.name}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPendingRemoveAnexo({ index: idx, nome: f.name })}
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
      </div>

      </div>

      <div className="-mx-2 shrink-0 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:-mx-3 lg:px-6">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <button type="button" onClick={onCancel} className={formModalCancelButtonClass}>
          Cancelar
        </button>
        <button
          type="submit"
          className={formModalSubmitButtonClass}
        >
          Criar tarefa
        </button>
        </div>
      </div>
    </form>
    <AlertDialog
      open={!!pendingRemoveAnexo}
      onClose={() => setPendingRemoveAnexo(null)}
      onConfirm={() => {
        if (!pendingRemoveAnexo) return;
        const i = pendingRemoveAnexo.index;
        setArquivos((prev) => prev.filter((_, j) => j !== i));
        setPendingRemoveAnexo(null);
      }}
      title="Remover anexo?"
      description={
        pendingRemoveAnexo ? (
          <>
            <strong className="text-slate-900 dark:text-slate-100">Esta ação é irreversível:</strong> o arquivo{" "}
            <strong className="text-slate-900 dark:text-slate-100">{pendingRemoveAnexo.nome}</strong> será retirado da
            nova tarefa antes de salvar.
          </>
        ) : null
      }
      cancelLabel="Cancelar"
      confirmLabel="Sim, remover permanentemente"
      destructive
    />
    </>
  );
}
