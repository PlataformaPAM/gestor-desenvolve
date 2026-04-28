"use client";

import { useRef, useState, useEffect } from "react";
import { FileText, History, Paperclip, Eye, X } from "lucide-react";
import type { Tarefa, UsuarioTarefa } from "@/lib/tarefas/types";
import { STATUS_LABELS, PRIORIDADE_LABELS } from "@/lib/tarefas/constants";
import { MultiFileAttachment } from "@/components/ui/multifile-attachment";
import { AlertDialog } from "@/components/ui/alert-dialog";
import {
  SearchableMultiSelect,
  SearchableSelect,
  type SearchableOption,
} from "@/components/ui/searchable-select";
import { DateField } from "@/components/ui/date-field";
import clsx from "clsx";

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
  status: Tarefa["status"];
  prioridade: Tarefa["prioridade"];
  responsavelId: string;
  clienteId?: string;
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
  onTrocarResponsavel?: (tarefa: Tarefa, novoResponsavelId: string) => void;
  onAdicionarHistorico?: (tarefaId: string, acao: string, anexos?: string[]) => void;
  /** Chamado ao clicar Salvar na aba Detalhes com os valores atuais do formulário */
  onSalvar?: (tarefaId: string, payload: TarefaSalvarPayload) => void;
};

export function TarefaDetalheDrawer({
  tarefa,
  usuariosMap,
  clientes = [],
  onTrocarResponsavel,
  onAdicionarHistorico,
  onSalvar,
}: TarefaDetalheDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabId>("detalhes");
  const [comentario, setComentario] = useState("");
  const [arquivosComentario, setArquivosComentario] = useState<File[]>([]);
  const [pendingRemoveComentarioAnexo, setPendingRemoveComentarioAnexo] = useState<{
    index: number;
    nome: string;
  } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Form state (aba Detalhes) — sincronizado com tarefa quando abre/muda
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState<Tarefa["status"]>("a_fazer");
  const [prioridade, setPrioridade] = useState<Tarefa["prioridade"]>("media");
  const [responsavelId, setResponsavelId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [colaboradorIds, setColaboradorIds] = useState<string[]>([]);
  // EXACT COPY (Helpdesk-style): 'arquivos' representa NOVOS arquivos selecionados (pendentes).
  const [arquivos, setArquivos] = useState<File[]>([]);
  useEffect(() => {
    if (!tarefa) return;
    setTitulo(tarefa.titulo);
    setDescricao(tarefa.descricao ?? "");
    setStatus(tarefa.status);
    setPrioridade(tarefa.prioridade);
    setResponsavelId(tarefa.responsavel.id);
    setClienteId(tarefa.clienteId ?? "");
    setDataInicio(isoToDateInput(tarefa.dataInicio));
    setDataFim(isoToDateInput(tarefa.dataFim));
    setColaboradorIds(tarefa.colaboradores?.map((c) => c.id) ?? []);
    setArquivosComentario([]);
    setArquivos([]);
  }, [tarefa?.id]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [tarefa?.historico?.length, activeTab]);

  if (!tarefa) return null;

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
    const dataInicioIso = dataInicio
      ? new Date(`${dataInicio}T00:00:00`).toISOString()
      : tarefa.dataInicio;
    const dataFimIso = dataFim
      ? new Date(`${dataFim}T23:59:59`).toISOString()
      : tarefa.dataFim;
    onSalvar?.(tarefa.id, {
      titulo: titulo.trim(),
      descricao: descricao.trim() || undefined,
      status,
      prioridade,
      responsavelId,
      clienteId: clienteId || undefined,
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
  const responsavelOptions: SearchableOption[] = usuariosList.map((u) => ({ value: u.id, label: u.nome }));
  const colaboradorOptions: SearchableOption[] = usuariosList
    .filter((u) => u.id !== responsavelId)
    .map((u) => ({ value: u.id, label: u.nome }));
  const statusOptions: SearchableOption[] = (Object.entries(STATUS_LABELS) as [Tarefa["status"], string][])
    .map(([value, label]) => ({ value, label }));
  const prioridadeOptions: SearchableOption[] = (Object.entries(PRIORIDADE_LABELS) as [Tarefa["prioridade"], string][])
    .map(([value, label]) => ({ value, label }));
  const clienteOptions: SearchableOption[] = clientes.map((c) => ({
    value: c.id,
    label: (c.empresa?.trim() || c.nome).trim(),
    subtitle: c.nome && c.empresa && c.nome !== c.empresa ? c.nome : undefined,
  }));

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
  const labelClass = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

  return (
    <div className="flex h-full flex-col min-h-0">
      {/* Tabs */}
      <div className="shrink-0 border-b border-slate-200 dark:border-slate-700">
        <nav className="flex gap-1 p-2" aria-label="Abas do detalhe da tarefa">
          <button
            type="button"
            onClick={() => setActiveTab("detalhes")}
            className={clsx(
              "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === "detalhes"
                ? "bg-[#6D28D9]/10 text-[#6D28D9] dark:bg-violet-950/50 dark:text-violet-300"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            )}
          >
            <FileText className="h-4 w-4" />
            Detalhes
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("historico")}
            className={clsx(
              "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === "historico"
                ? "bg-[#6D28D9]/10 text-[#6D28D9] dark:bg-violet-950/50 dark:text-violet-300"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            )}
          >
            <History className="h-4 w-4" />
            Histórico & Comentários
          </button>
        </nav>
      </div>

      {activeTab === "detalhes" && (
        <div className="flex flex-1 flex-col min-h-0 overflow-y-auto">
          <div className="flex-1 p-4 lg:p-6 space-y-4">
            <div>
              <label htmlFor="t-titulo" className={labelClass}>Título</label>
              <input
                id="t-titulo"
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="t-descricao" className={labelClass}>Descrição</label>
              <textarea
                id="t-descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
                className={`${inputClass} min-h-[80px] resize-y`}
              />
            </div>
            <div>
              <label htmlFor="t-status" className={labelClass}>Status</label>
              <SearchableSelect
                options={statusOptions}
                value={status}
                onChange={(v) => setStatus(v as Tarefa["status"])}
                searchable={false}
              />
            </div>
            <div>
              <label htmlFor="t-prioridade" className={labelClass}>Prioridade</label>
              <SearchableSelect
                options={prioridadeOptions}
                value={prioridade}
                onChange={(v) => setPrioridade(v as Tarefa["prioridade"])}
                searchable={false}
              />
            </div>
            <div>
              <label htmlFor="t-responsavel" className={labelClass}>Responsável</label>
              <SearchableSelect
                options={responsavelOptions}
                value={responsavelId}
                onChange={setResponsavelId}
                placeholder="Selecione o responsável..."
                searchPlaceholder="Buscar responsável..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="t-data-inicio" className={labelClass}>Data início</label>
                <DateField id="t-data-inicio" value={dataInicio} onChange={setDataInicio} />
              </div>
              <div>
                <label htmlFor="t-data-fim" className={labelClass}>Prazo (data fim)</label>
                <DateField id="t-data-fim" value={dataFim} onChange={setDataFim} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Colaboradores</label>
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
              <label className={labelClass}>Cliente vinculado (opcional)</label>
              <SearchableSelect
                options={clienteOptions}
                value={clienteId}
                onChange={setClienteId}
                placeholder="Nenhum cliente"
                searchPlaceholder="Buscar cliente..."
              />
            </div>

            {/* Anexos — EXACT COPY da lógica do Helpdesk (multi + preview + remover) */}
            <MultiFileAttachment
              existingFiles={tarefa.anexos ?? []}
              newFiles={arquivos}
              onNewFilesChange={setArquivos}
            />

            {onSalvar && (
              <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
                <button
                  type="button"
                  onClick={handleSalvar}
                  className="rounded-lg bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] dark:focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                >
                  Salvar alterações
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "historico" && (
        <div className="flex flex-1 flex-col min-h-0">
          <p className="shrink-0 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Linha do tempo (mais recente no topo)
          </p>
          <div ref={listRef} className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
            <div className="relative border-l-2 border-slate-100 pl-6 dark:border-slate-700">
              {historicoOrdenado.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma ação registrada ainda.</p>
              ) : (
                <ul className="space-y-6">
                  {historicoOrdenado.map((entrada) => (
                    <li key={entrada.id} className="relative">
                      <div className="absolute -left-[29px] top-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#6D28D9]/15 text-xs font-semibold text-[#6D28D9] shadow-sm dark:border-slate-900 dark:bg-violet-500/20 dark:text-violet-300">
                        {entrada.autor ? iniciais(entrada.autor) : "S"}
                      </div>
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
                  ))}
                </ul>
              )}
            </div>
          </div>

          {onAdicionarHistorico && (
            <form
              onSubmit={handleEnviarComentario}
              className="shrink-0 border-t border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
            >
              <input
                id="file-upload-tarefa"
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (!files.length) return;
                  setArquivosComentario((prev) => {
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
              <div className="flex gap-2">
                <input
                  type="text"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Ex.: Liguei para o cliente, pediu para retornar amanhã"
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                <label
                  htmlFor="file-upload-tarefa"
                  className="cursor-pointer rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] dark:hover:bg-slate-800 dark:hover:text-slate-300"
                  aria-label="Anexar arquivo"
                >
                  <Paperclip className="h-5 w-5" />
                </label>
                <button
                  type="submit"
                  disabled={!comentario.trim() && arquivosComentario.length === 0}
                  className="rounded-lg bg-[#6D28D9] px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                >
                  Adicionar Comentário
                </button>
              </div>
              {arquivosComentario.length > 0 && (
                <ul className="mt-2 space-y-2">
                  {arquivosComentario.map((f, idx) => (
                    <li
                      key={`${f.name}-${f.size}-${f.lastModified}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
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
                          setPendingRemoveComentarioAnexo({ index: idx, nome: f.name })
                        }
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                        aria-label="Remover arquivo"
                      >
                        <X className="h-3.5 w-3.5" />
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </form>
          )}
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
