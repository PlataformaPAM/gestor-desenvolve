"use client";

import { useEffect, useState } from "react";
import { Target, MessageSquare, CheckCircle2, Clock, FileText, Trash2, X, Save, Plus } from "lucide-react";
import type { TarefaRegua } from "@/lib/pos-venda/types";
import { TIPO_TAREFA_LABELS } from "@/lib/pos-venda/constants";
import { MultiFileAttachment } from "@/components/ui/multifile-attachment";
import {
  formInputClass,
  formLabelClass,
  formModalCancelButtonClass,
  formModalSubmitButtonClass,
  formTextareaClass,
} from "@/components/ui/field-patterns";

type PlaybookDrawerProps = {
  tarefa: TarefaRegua | null;
  onRegistrarResultado: (tarefa: TarefaRegua, descricaoResultado: string) => void;
  onAdiar: (tarefa: TarefaRegua, motivoAdiar: string, dias: number) => void;
  onEnviarParaLixeira?: (motivo: string) => void;
  podeEnviarParaLixeira?: boolean;
  enviandoLixeira?: boolean;
  onFechar: () => void;
};

function substituirNome(script: string, nomeCliente: string): string {
  return script.replace(/\[Nome\]/g, nomeCliente).replace(/\[Sua Empresa\]/g, "nossa equipe");
}

export function PlaybookDrawer({
  tarefa,
  onRegistrarResultado,
  onAdiar,
  onEnviarParaLixeira,
  podeEnviarParaLixeira = false,
  enviandoLixeira = false,
}: PlaybookDrawerProps) {
  const [modo, setModo] = useState<null | "registrar" | "adiar" | "lixeira">(null);
  const [descricaoResultado, setDescricaoResultado] = useState("");
  const [motivoAdiar, setMotivoAdiar] = useState("");
  const [motivoLixeira, setMotivoLixeira] = useState("");
  const [diasAdiar, setDiasAdiar] = useState(1);
  const [historico, setHistorico] = useState<
    Array<{ id: string; data: string; acao: string; autorNome?: string; anexos?: Array<{ name: string; url?: string }> }>
  >([]);
  const [comentario, setComentario] = useState("");
  const [arquivosComentario, setArquivosComentario] = useState<File[]>([]);
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  const [aba, setAba] = useState<"playbook" | "historico">("playbook");

  useEffect(() => {
    setModo(null);
    setDescricaoResultado("");
    setMotivoAdiar("");
    setMotivoLixeira("");
    setDiasAdiar(1);
    setAba("playbook");
  }, [tarefa?.id]);

  useEffect(() => {
    let active = true;
    if (!tarefa?.id || tarefa.id.startsWith("alert-")) {
      setHistorico([]);
      return () => {
        active = false;
      };
    }
    void (async () => {
      try {
        const res = await fetch(`/api/pos-venda/tarefas/${tarefa.id}/historico`, { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as {
          data?: { historico?: Array<{ id: string; data: string; acao: string; autorNome?: string; anexos?: Array<{ name: string; url?: string }> }> };
        };
        if (!active) return;
        setHistorico(payload?.data?.historico ?? []);
      } catch {
        // no-op
      }
    })();
    return () => {
      active = false;
    };
  }, [tarefa?.id]);

  if (!tarefa) return null;

  const scriptExibido = tarefa.scriptSugerido
    ? substituirNome(tarefa.scriptSugerido, tarefa.clienteNome)
    : null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div
        role="tablist"
        aria-label="Abas da tarefa"
        className="sticky top-0 z-30 flex shrink-0 flex-wrap border-b border-slate-300 bg-slate-50/95 backdrop-blur-sm dark:border-slate-600 dark:bg-slate-800/95"
      >
        <button
          role="tab"
          aria-selected={aba === "playbook"}
          type="button"
          onClick={() => setAba("playbook")}
          className={`relative flex min-w-0 flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${aba === "playbook" ? "text-[#6D28D9] dark:text-violet-400" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}
        >
          {aba === "playbook" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6D28D9]" />}
          <FileText className="h-4 w-4 shrink-0" />
          <span className="truncate">Dados da ação</span>
        </button>
        {!tarefa.id.startsWith("alert-") && (
          <button
            role="tab"
            aria-selected={aba === "historico"}
            type="button"
            onClick={() => setAba("historico")}
            className={`relative flex min-w-0 flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${aba === "historico" ? "text-[#6D28D9] dark:text-violet-400" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}
          >
            {aba === "historico" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6D28D9]" />}
            <MessageSquare className="h-4 w-4 shrink-0" />
            <span className="truncate">Interações</span>
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-4 lg:p-6">
        {aba === "playbook" && (
          <>
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{tarefa.clienteNome}</p>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {TIPO_TAREFA_LABELS[tarefa.tipo]}
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Agendada para {new Date(tarefa.dataAgendada).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>

        {tarefa.objetivo && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <Target className="h-5 w-5 text-[#6D28D9]" />
              <span className="text-sm font-semibold">Objetivo</span>
            </div>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">Por que estou fazendo isso?</p>
            <p className="mt-1 text-slate-900 dark:text-slate-100">{tarefa.objetivo}</p>
          </div>
        )}

        {scriptExibido && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <MessageSquare className="h-5 w-5 text-[#6D28D9]" />
              <span className="text-sm font-semibold">Script sugerido</span>
            </div>
            <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap italic dark:text-slate-300">
              &ldquo;{scriptExibido}&rdquo;
            </p>
          </div>
        )}

        {tarefa.playbook && tarefa.playbook.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Playbook personalizado do cliente</p>
            <div className="mt-3 space-y-3">
              {tarefa.playbook.map((etapa) => (
                <div key={etapa.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{etapa.titulo}</p>
                  <ul className="mt-2 space-y-2">
                    {etapa.filhos.map((sub) => (
                      <li key={sub.id} className="rounded-md bg-slate-50 p-2 text-xs dark:bg-slate-900/70">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{sub.tituloTarefa}</p>
                        <p className="mt-0.5 text-slate-600 dark:text-slate-300">{sub.descricaoComoFazer}</p>
                        <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                          SLA: {sub.slaDias} dia(s) - Resultado: {sub.resultadoEsperado || "não definido"}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-500/40 dark:bg-emerald-950/50">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            Ao registrar o resultado, a próxima etapa será agendada automaticamente
            {tarefa.proximaEtapaTipo && (
              <> ({TIPO_TAREFA_LABELS[tarefa.proximaEtapaTipo]} em {tarefa.intervaloRecorrenciaDias} dias)</>
            )}.
          </p>
        </div>
          </>
        )}
        {!tarefa.id.startsWith("alert-") && aba === "historico" && (
          <div className="space-y-4">
            <div className="relative">
              <MessageSquare className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={3}
                placeholder="Comente uma atualização desta tarefa..."
                className={`${formTextareaClass} pl-9`}
              />
            </div>
            <MultiFileAttachment existingFiles={[]} newFiles={arquivosComentario} onNewFilesChange={setArquivosComentario} />
            <div className="flex justify-end">
              <button
                type="button"
                disabled={enviandoComentario || (!comentario.trim() && arquivosComentario.length === 0)}
                onClick={() => {
                  void (async () => {
                    setEnviandoComentario(true);
                    try {
                      const anexos = arquivosComentario.map((f) => ({ name: f.name }));
                      const res = await fetch(`/api/pos-venda/tarefas/${tarefa.id}/historico`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          acao: comentario.trim() || "Comentário com anexos.",
                          anexos,
                        }),
                      });
                      if (!res.ok) return;
                      const payload = (await res.json()) as {
                        data?: { created?: { id: string; data: string; acao: string; autorNome?: string; anexos?: Array<{ name: string; url?: string }> } };
                      };
                      const created = payload?.data?.created;
                      if (created) setHistorico((prev) => [created, ...prev]);
                      setComentario("");
                      setArquivosComentario([]);
                    } finally {
                      setEnviandoComentario(false);
                    }
                  })();
                }}
                className={formModalSubmitButtonClass}
              >
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4 shrink-0" aria-hidden />
                  {enviandoComentario ? "Salvando..." : "Adicionar"}
                </span>
              </button>
            </div>
            <ul className="relative space-y-0 border-t border-slate-200 pt-6 dark:border-slate-700">
              <span className="absolute bottom-2 left-[11px] top-2 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
              {historico.length === 0 && (
                <li className="text-sm text-slate-500 dark:text-slate-400">Nenhuma atualização registrada.</li>
              )}
              {historico.map((h) => (
                <li key={h.id} className="relative flex gap-3 pb-6 last:pb-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                    <MessageSquare className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(h.data).toLocaleString("pt-BR")} · {h.autorNome || "Sistema"}
                  </p>
                  <p className="mt-1 text-sm text-slate-800 dark:text-slate-100">{h.acao}</p>
                  {!!h.anexos?.length && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {h.anexos.map((a, idx) => (
                        <span
                          key={`${h.id}-${idx}-${a.name}`}
                          className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-300"
                        >
                          {a.name}
                        </span>
                      ))}
                    </div>
                  )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 lg:p-6">
        {modo === null && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {podeEnviarParaLixeira && onEnviarParaLixeira ? (
              <button
                type="button"
                onClick={() => setModo("lixeira")}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50 sm:w-auto sm:whitespace-nowrap"
              >
                <Trash2 className="h-4 w-4" />
                Enviar para lixeira
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setModo("adiar")}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-700 sm:w-auto sm:whitespace-nowrap"
            >
              <Clock className="h-4 w-4" />
              Adiar
            </button>
            <button
              type="button"
              onClick={() => setModo("registrar")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] sm:flex-1"
            >
              <CheckCircle2 className="h-5 w-5" />
              Registrar resultado e agendar próxima etapa
            </button>
          </div>
        )}

        {modo === "registrar" && (
          <div className="space-y-3">
            <div>
              <label htmlFor="descricao-resultado" className={formLabelClass}>
                Descrição do resultado (o que foi feito para finalizar)
              </label>
              <div className="relative">
                <FileText className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <textarea
                  id="descricao-resultado"
                  value={descricaoResultado}
                  onChange={(e) => setDescricaoResultado(e.target.value)}
                  rows={4}
                  className={`${formTextareaClass} pl-9`}
                  placeholder="Ex.: alinhamos as expectativas, confirmamos o checklist e combinamos o próximo passo..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModo(null);
                  setDescricaoResultado("");
                }}
                className={formModalCancelButtonClass}
              >
                <span className="inline-flex items-center gap-2">
                  <X className="h-4 w-4 shrink-0" aria-hidden />
                  Cancelar
                </span>
              </button>
              <button
                type="button"
                disabled={!descricaoResultado.trim()}
                onClick={() => onRegistrarResultado(tarefa, descricaoResultado.trim())}
                className={formModalSubmitButtonClass}
              >
                <span className="inline-flex items-center gap-2">
                  <Save className="h-4 w-4 shrink-0" aria-hidden />
                  Confirmar resultado
                </span>
              </button>
            </div>
          </div>
        )}

        {modo === "adiar" && (
          <div className="space-y-3">
            <div>
              <label htmlFor="dias-adiar" className={formLabelClass}>
                Quantos dias deseja adiar?
              </label>
              <div className="relative">
                <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="dias-adiar"
                  type="number"
                  min={1}
                  max={365}
                  value={diasAdiar}
                  onChange={(e) => setDiasAdiar(Math.max(1, Math.min(365, Number(e.target.value || 1))))}
                  className={`${formInputClass} pl-9`}
                />
              </div>
            </div>
            <div>
              <label htmlFor="motivo-adiar" className={formLabelClass}>
                Motivo para reagendar (por que não foi finalizado)
              </label>
              <div className="relative">
                <MessageSquare className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <textarea
                  id="motivo-adiar"
                  value={motivoAdiar}
                  onChange={(e) => setMotivoAdiar(e.target.value)}
                  rows={4}
                  className={`${formTextareaClass} pl-9`}
                  placeholder="Ex.: cliente solicitou ajuste de data, precisamos de documento adicional..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModo(null);
                  setMotivoAdiar("");
                  setDiasAdiar(1);
                }}
                className={formModalCancelButtonClass}
              >
                <span className="inline-flex items-center gap-2">
                  <X className="h-4 w-4 shrink-0" aria-hidden />
                  Cancelar
                </span>
              </button>
              <button
                type="button"
                disabled={!motivoAdiar.trim() || !Number.isFinite(diasAdiar) || diasAdiar <= 0}
                onClick={() => onAdiar(tarefa, motivoAdiar.trim(), diasAdiar)}
                className={formModalSubmitButtonClass}
              >
                <span className="inline-flex items-center gap-2">
                  <Save className="h-4 w-4 shrink-0" aria-hidden />
                  Confirmar adiamento
                </span>
              </button>
            </div>
          </div>
        )}
        {modo === "lixeira" && (
          <div className="space-y-3">
            <div>
              <label htmlFor="motivo-lixeira" className={formLabelClass}>
                Motivo para enviar para lixeira
              </label>
              <div className="relative">
                <MessageSquare className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <textarea
                  id="motivo-lixeira"
                  value={motivoLixeira}
                  onChange={(e) => setMotivoLixeira(e.target.value)}
                  rows={4}
                  className={`${formTextareaClass} pl-9`}
                  placeholder="Descreva o motivo da remoção."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModo(null);
                  setMotivoLixeira("");
                }}
                className={formModalCancelButtonClass}
              >
                <span className="inline-flex items-center gap-2">
                  <X className="h-4 w-4 shrink-0" aria-hidden />
                  Cancelar
                </span>
              </button>
              <button
                type="button"
                disabled={enviandoLixeira || !motivoLixeira.trim()}
                onClick={() => onEnviarParaLixeira?.(motivoLixeira.trim())}
                className={formModalSubmitButtonClass}
              >
                <span className="inline-flex items-center gap-2">
                  <Save className="h-4 w-4 shrink-0" aria-hidden />
                  {enviandoLixeira ? "Enviando..." : "Confirmar envio"}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
