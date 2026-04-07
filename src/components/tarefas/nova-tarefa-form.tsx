"use client";

import { useRef, useState } from "react";
import { Eye, Paperclip, X } from "lucide-react";
import type { Tarefa, UsuarioTarefa } from "@/lib/tarefas/types";
import { PRIORIDADE_LABELS } from "@/lib/tarefas/constants";
import { AlertDialog } from "@/components/ui/alert-dialog";

type NovaTarefaFormProps = {
  usuarios: UsuarioTarefa[];
  /** ID do usuário logado — responsável vem preenchido com ele ao abrir */
  currentUserId?: string;
  onSave: (tarefa: Omit<Tarefa, "id">) => void;
  onCancel: () => void;
};

const PRIORIDADES: Tarefa["prioridade"][] = ["baixa", "media", "alta", "urgente"];

function iniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";
}

export function NovaTarefaForm({
  usuarios,
  currentUserId = "",
  onSave,
  onCancel,
}: NovaTarefaFormProps) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<Tarefa["prioridade"]>("media");
  const [responsavelId, setResponsavelId] = useState(currentUserId);
  const [colaboradorIds, setColaboradorIds] = useState<string[]>([]);
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

  const toggleColaborador = (id: string) => {
    setColaboradorIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !responsavelId) return;
    const responsavel = usuarios.find((u) => u.id === responsavelId);
    if (!responsavel) return;
    const colaboradores = colaboradorIds
      .map((id) => usuarios.find((u) => u.id === id))
      .filter(Boolean) as UsuarioTarefa[];
    const now = new Date().toISOString();
    const fim = dataFim.trim() ? new Date(dataFim.trim()).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    onSave({
      titulo: titulo.trim(),
      descricao: descricao.trim() || undefined,
      status: "a_fazer",
      prioridade,
      dataInicio: now,
      dataFim: fim,
      responsavel,
      colaboradores: colaboradores.filter((c) => c.id !== responsavelId),
      anexos: arquivos.map((f) => f.name),
      arquivos,
      historico: [
        { id: `h-${Date.now()}`, data: now, acao: "Tarefa criada", autor: responsavel.nome },
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
        <label htmlFor="tarefa-responsavel" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Responsável
        </label>
        <select
          id="tarefa-responsavel"
          value={responsavelId}
          onChange={(e) => setResponsavelId(e.target.value)}
          className={inputClass}
          required
        >
          <option value="">Selecione...</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Colaboradores (opcional)
        </label>
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2 dark:border-slate-600 dark:bg-slate-800/50">
          {usuarios
            .filter((u) => u.id !== responsavelId)
            .map((u) => (
              <label
                key={u.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-white dark:hover:bg-slate-700/80"
              >
                <input
                  type="checkbox"
                  checked={colaboradorIds.includes(u.id)}
                  onChange={() => toggleColaborador(u.id)}
                  className="rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800"
                />
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#6D28D9]/10 text-xs font-semibold text-[#6D28D9] dark:bg-violet-500/20 dark:text-violet-300">
                  {iniciais(u.nome)}
                </span>
                <span className="text-sm text-slate-900 dark:text-slate-100">{u.nome}</span>
              </label>
            ))}
        </div>
      </div>

      <div>
        <label htmlFor="tarefa-prazo" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Prazo (data fim)
        </label>
        <input
          id="tarefa-prazo"
          type="datetime-local"
          value={dataFim}
          onChange={(e) => setDataFim(e.target.value)}
          className={inputClass}
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
        <label htmlFor="tarefa-prioridade" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Prioridade
        </label>
        <select
          id="tarefa-prioridade"
          value={prioridade}
          onChange={(e) => setPrioridade(e.target.value as Tarefa["prioridade"])}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          {PRIORIDADES.map((p) => (
            <option key={p} value={p}>
              {PRIORIDADE_LABELS[p]}
            </option>
          ))}
        </select>
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
