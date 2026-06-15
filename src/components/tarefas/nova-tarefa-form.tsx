"use client";

import type { RefObject } from "react";
import { useRef, useState } from "react";
import clsx from "clsx";
import { X, Save, User, Users, Building2, Tags, FileText, Package } from "lucide-react";
import type { Tarefa, UsuarioTarefa, SolucaoTarefa } from "@/lib/tarefas/types";
import type { Cliente } from "@/lib/clientes/types";
import { TAREFA_CATEGORIAS } from "@/lib/tarefas/categorias";
import { PRIORIDADE_LABELS } from "@/lib/tarefas/constants";
import {
  iconForCategoria,
  iconForPrioridade,
  PRIORIDADE_LEADING_ICON,
  STATUS_LEADING_ICON,
} from "@/lib/tarefas/option-icons";
import {
  SearchableMultiSelect,
  SearchableSelect,
  type SearchableOption,
} from "@/components/ui/searchable-select";
import { DateField } from "@/components/ui/date-field";
import { MultiFileAttachment } from "@/components/ui/multifile-attachment";
import {
  formInputClass,
  formLabelClass,
  formModalCancelButtonClass,
  formModalSubmitButtonClass,
  formTextareaClass,
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
  solucoes?: SolucaoTarefa[];
  /** ID do usuário logado — responsável vem preenchido com ele ao abrir */
  currentUserId?: string;
  onSave: (tarefa: Omit<Tarefa, "id"> & { clienteIds?: string[] }) => void;
  onCancel: () => void;
};

export function NovaTarefaForm({
  usuarios,
  clientes = [],
  solucoes = [],
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
  const [solucaoIds, setSolucaoIds] = useState<string[]>([]);
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [dataFim, setDataFim] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  /** Após tentar salvar com dados incompletos, destaca os campos que faltam */
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const sectionTituloRef = useRef<HTMLDivElement>(null);
  const sectionCategoriaRef = useRef<HTMLDivElement>(null);
  const sectionPrazoRef = useRef<HTMLDivElement>(null);
  const sectionInicioRef = useRef<HTMLDivElement>(null);
  const sectionResponsavelRef = useRef<HTMLDivElement>(null);

  const errTitulo = submitAttempted && !titulo.trim();
  const errCategoria = submitAttempted && !categoria.trim();
  const errPrazo = submitAttempted && !dataFim.trim();
  const errResponsavel =
    submitAttempted &&
    (!responsavelId || !usuarios.some((u) => u.id === responsavelId));

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
  const clienteIdsForSelect = (() => {
    const base = [...clienteIds];
    if (clientes.length > 0 && base.length === clientes.length) return ["__TODOS__", ...base];
    return base;
  })();
  const colaboradorOptions: SearchableOption[] = usuarios
    .filter((u) => u.id !== responsavelId)
    .map((u) => ({
      value: u.id,
      label: u.id === currentUserId ? `${u.nome} (você)` : u.nome,
      icon: Users,
    }));
  const solucaoOptions: SearchableOption[] = [...solucoes]
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }))
    .map((s) => ({
      value: s.id,
      label: s.nome,
      icon: Package,
    }));
  const prioridadeOptions: SearchableOption[] = (
    Object.entries(PRIORIDADE_LABELS) as [Tarefa["prioridade"], string][]
  ).map(([value, label]) => ({
    value,
    label,
    icon: iconForPrioridade(value),
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
    const inicio = dataInicio.trim()
      ? new Date(`${dataInicio.trim()}T00:00:00`).toISOString()
      : now;
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
      dataInicio: inicio,
      dataFim: fim,
      responsavel,
      colaboradores: colaboradores.filter((c) => c.id !== responsavelId),
      clienteId: clienteIdsFinal[0] || undefined,
      clienteIds: clienteIdsFinal,
      solucaoIds,
      solucoes: solucoes.filter((s) => solucaoIds.includes(s.id)),
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
            className={`${formTextareaClass} min-h-[80px] resize-y pl-10`}
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

      <div>
        <label htmlFor="tarefa-prioridade" className={formLabelClass}>
          Prioridade
        </label>
        <SearchableSelect
          options={prioridadeOptions}
          value={prioridade}
          onChange={(v) => setPrioridade(v as Tarefa["prioridade"])}
          placeholder="Selecione a prioridade..."
          searchPlaceholder="Buscar prioridade..."
          searchable={false}
          leadingIcon={PRIORIDADE_LEADING_ICON}
        />
      </div>

      <div ref={sectionInicioRef}>
        <label htmlFor="tarefa-inicio" className={formLabelClass}>
          Data início
        </label>
        <DateField id="tarefa-inicio" value={dataInicio} onChange={setDataInicio} />
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
        <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">
          Outros usuários do sistema vinculados à tarefa.
        </p>
        <SearchableMultiSelect
          options={colaboradorOptions}
          values={colaboradorIds}
          onChange={setColaboradorIds}
          placeholder="Selecionar usuários..."
          searchPlaceholder="Buscar usuário..."
          selectedLabel="Selecionados"
          leadingIcon={Users}
        />
      </div>

      <div>
        <label className={formLabelClass}>Soluções vinculadas</label>
        <SearchableMultiSelect
          options={solucaoOptions}
          values={solucaoIds}
          onChange={setSolucaoIds}
          placeholder="Selecionar soluções..."
          searchPlaceholder="Buscar solução..."
          selectedLabel="Selecionadas"
          leadingIcon={Package}
        />
      </div>

      <div>
        <label className={formLabelClass}>
          Clientes vinculados
        </label>
        <SearchableMultiSelect
          options={clienteOptions}
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

      <MultiFileAttachment
        existingFiles={[]}
        newFiles={arquivos}
        onNewFilesChange={setArquivos}
      />

      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 lg:px-6">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <button type="button" onClick={onCancel} className={formModalCancelButtonClass}>
          <span className="inline-flex items-center gap-2">
            <X className="h-4 w-4 shrink-0" aria-hidden />
            Cancelar
          </span>
        </button>
        <button type="submit" className={formModalSubmitButtonClass}>
          <span className="inline-flex items-center gap-2">
            <Save className="h-4 w-4 shrink-0" aria-hidden />
            Salvar
          </span>
        </button>
        </div>
      </div>
    </form>
  );
}
