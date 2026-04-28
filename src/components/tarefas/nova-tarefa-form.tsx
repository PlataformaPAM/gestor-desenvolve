"use client";

import { useRef, useState } from "react";
import { Eye, Paperclip, X } from "lucide-react";
import type { Tarefa, UsuarioTarefa } from "@/lib/tarefas/types";
import type { Cliente } from "@/lib/clientes/types";
import { PRIORIDADE_LABELS } from "@/lib/tarefas/constants";
import { AlertDialog } from "@/components/ui/alert-dialog";
import {
  SearchableMultiSelect,
  SearchableSelect,
  type SearchableOption,
} from "@/components/ui/searchable-select";
import { DateField } from "@/components/ui/date-field";

type NovaTarefaFormProps = {
  usuarios: UsuarioTarefa[];
  clientes?: Pick<Cliente, "id" | "nome" | "empresa">[];
  /** ID do usuário logado — responsável vem preenchido com ele ao abrir */
  currentUserId?: string;
  onSave: (tarefa: Omit<Tarefa, "id">) => void;
  onCancel: () => void;
};

const PRIORIDADES: Tarefa["prioridade"][] = ["baixa", "media", "alta", "urgente"];

export function NovaTarefaForm({
  usuarios,
  clientes = [],
  currentUserId = "",
  onSave,
  onCancel,
}: NovaTarefaFormProps) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<Tarefa["prioridade"]>("media");
  const [responsavelId, setResponsavelId] = useState(currentUserId);
  const [colaboradorIds, setColaboradorIds] = useState<string[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [pendingRemoveAnexo, setPendingRemoveAnexo] = useState<{
    index: number;
    nome: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFilePreview = (file: File) => {
    const url = URL.createObjectURL(file);
    window.open(url, "_blank");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const responsavelOptions: SearchableOption[] = usuarios.map((u) => ({ value: u.id, label: u.nome }));
  const clienteOptions: SearchableOption[] = clientes.map((c) => ({
    value: c.id,
    label: (c.empresa?.trim() || c.nome).trim(),
    subtitle: c.nome && c.empresa && c.nome !== c.empresa ? c.nome : undefined,
  }));
  const colaboradorOptions: SearchableOption[] = usuarios
    .filter((u) => u.id !== responsavelId)
    .map((u) => ({ value: u.id, label: u.nome }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !responsavelId) return;
    const responsavel = usuarios.find((u) => u.id === responsavelId);
    if (!responsavel) return;
    const colaboradores = colaboradorIds
      .map((id) => usuarios.find((u) => u.id === id))
      .filter(Boolean) as UsuarioTarefa[];
    const now = new Date().toISOString();
    const fim = dataFim.trim()
      ? new Date(`${dataFim.trim()}T23:59:59`).toISOString()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const quemCriou =
      (currentUserId ? usuarios.find((u) => u.id === currentUserId) : undefined) ?? responsavel;
    onSave({
      titulo: titulo.trim(),
      descricao: descricao.trim() || undefined,
      status: "a_fazer",
      prioridade,
      dataInicio: now,
      dataFim: fim,
      responsavel,
      colaboradores: colaboradores.filter((c) => c.id !== responsavelId),
      clienteId: clienteId || undefined,
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

  const inputClass =
    "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6 p-4 lg:p-6">
      <div>
        <label htmlFor="tarefa-titulo" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Título
        </label>
        <input
          id="tarefa-titulo"
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex.: Revisar proposta comercial"
          className={inputClass}
          required
        />
      </div>

      <div>
        <label htmlFor="tarefa-desc" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Descrição (opcional)
        </label>
        <textarea
          id="tarefa-desc"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={2}
          placeholder="Detalhes da tarefa..."
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Responsável
        </label>
        <SearchableSelect
          options={responsavelOptions}
          value={responsavelId}
          onChange={setResponsavelId}
          placeholder="Selecione o responsável..."
          searchPlaceholder="Buscar responsável..."
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Colaboradores (opcional)
        </label>
        <SearchableMultiSelect
          options={colaboradorOptions}
          values={colaboradorIds}
          onChange={setColaboradorIds}
          placeholder="Selecionar colaboradores..."
          searchPlaceholder="Buscar colaborador..."
          selectedLabel="Selecionados"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Cliente vinculado (opcional)
        </label>
        <SearchableSelect
          options={clienteOptions}
          value={clienteId}
          onChange={setClienteId}
          placeholder="Nenhum cliente"
          searchPlaceholder="Buscar cliente..."
        />
      </div>

      <div>
        <label htmlFor="tarefa-prazo" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Prazo (data fim)
        </label>
        <DateField
          id="tarefa-prazo"
          value={dataFim}
          onChange={setDataFim}
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Se vazio, será definido em 7 dias.</p>
      </div>

      <div className="space-y-1">
        <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">Anexos</span>
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
          className="flex w-full items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 py-6 text-sm text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100/80 hover:text-slate-700 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800"
        >
          <Paperclip className="h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500" />
          <span>Arraste documentos ou clique para anexar</span>
        </button>
        {arquivos.length > 0 && (
          <ul className="mt-2 space-y-2">
            {arquivos.map((f, idx) => (
              <li
                key={`${f.name}-${f.size}-${f.lastModified}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
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

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Prioridade
        </label>
        <SearchableSelect
          options={PRIORIDADES.map((p) => ({ value: p, label: PRIORIDADE_LABELS[p] }))}
          value={prioridade}
          onChange={(v) => setPrioridade(v as Tarefa["prioridade"])}
          placeholder="Selecione a prioridade..."
          searchable={false}
        />
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!titulo.trim() || !responsavelId}
          className="rounded-lg bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-slate-900"
        >
          Criar tarefa
        </button>
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
