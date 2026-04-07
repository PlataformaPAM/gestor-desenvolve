"use client";

import { useEffect, useState } from "react";
import { Target, MessageSquare, CheckCircle2, Clock, FileText } from "lucide-react";
import type { TarefaRegua } from "@/lib/pos-venda/types";
import { TIPO_TAREFA_LABELS } from "@/lib/pos-venda/constants";
import { MultiFileAttachment } from "@/components/ui/multifile-attachment";

type PlaybookDrawerProps = {
  tarefa: TarefaRegua | null;
  onRegistrarResultado: (tarefa: TarefaRegua, descricaoResultado: string) => void;
  onAdiar: (tarefa: TarefaRegua, motivoAdiar: string, dias: number) => void;
  onFechar: () => void;
};

function substituirNome(script: string, nomeCliente: string): string {
  return script.replace(/\[Nome\]/g, nomeCliente).replace(/\[Sua Empresa\]/g, "nossa equipe");
}

export function PlaybookDrawer({
  tarefa,
  onRegistrarResultado,
  onAdiar,
}: PlaybookDrawerProps) {
  const [modo, setModo] = useState<null | "registrar" | "adiar">(null);
  const [descricaoResultado, setDescricaoResultado] = useState("");
  const [motivoAdiar, setMotivoAdiar] = useState("");
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
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
        <div role="tablist" aria-label="Abas da tarefa" className="flex flex-wrap border-b border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/50">
          <button
            role="tab"
            aria-selected={aba === "playbook"}
            type="button"
            onClick={() => setAba("playbook")}
            className={`relative flex min-w-0 flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${aba === "playbook" ? "text-[#6D28D9]" : "text-slate-500 hover:text-slate-700 dark:text-slate-300"}`}
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
              className={`relative flex min-w-0 flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${aba === "historico" ? "text-[#6D28D9]" : "text-slate-500 hover:text-slate-700 dark:text-slate-300"}`}
            >
              {aba === "historico" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6D28D9]" />}
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span className="truncate">Interações / Histórico</span>
            </button>
          )}
        </div>
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
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Histórico desta tarefa</p>
            <div className="mt-3 space-y-3">
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={3}
                placeholder="Comente uma atualização desta tarefa..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
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
                  className="rounded-lg bg-[#6D28D9] px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {enviandoComentario ? "Salvando..." : "Adicionar comentário"}
                </button>
              </div>
            </div>
            <ul className="mt-4 space-y-3 border-t border-slate-200 pt-3 dark:border-slate-700">
              {historico.length === 0 && (
                <li className="text-sm text-slate-500 dark:text-slate-400">Nenhuma atualização registrada.</li>
              )}
              {historico.map((h) => (
                <li key={h.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
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
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-200 p-4 lg:p-6 space-y-2 dark:border-slate-700">
        {modo === null && (
          <>
            <button
              type="button"
              onClick={() => setModo("registrar")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9]"
            >
              <CheckCircle2 className="h-5 w-5" />
              Registrar resultado e agendar próxima etapa
            </button>
            <button
              type="button"
              onClick={() => setModo("adiar")}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Clock className="h-4 w-4" />
              Adiar
            </button>
          </>
        )}

        {modo === "registrar" && (
          <div className="space-y-3">
            <div>
              <label htmlFor="descricao-resultado" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Descrição do resultado (o que foi feito para finalizar)
              </label>
              <textarea
                id="descricao-resultado"
                value={descricaoResultado}
                onChange={(e) => setDescricaoResultado(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder="Ex.: alinhamos as expectativas, confirmamos o checklist e combinamos o próximo passo..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModo(null);
                  setDescricaoResultado("");
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!descricaoResultado.trim()}
                onClick={() => onRegistrarResultado(tarefa, descricaoResultado.trim())}
                className="rounded-lg bg-[#6D28D9] px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Confirmar resultado
              </button>
            </div>
          </div>
        )}

        {modo === "adiar" && (
          <div className="space-y-3">
            <div>
              <label htmlFor="dias-adiar" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Quantos dias deseja adiar?
              </label>
              <input
                id="dias-adiar"
                type="number"
                min={1}
                max={365}
                value={diasAdiar}
                onChange={(e) => setDiasAdiar(Math.max(1, Math.min(365, Number(e.target.value || 1))))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="motivo-adiar" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Motivo para reagendar (por que não foi finalizado)
              </label>
              <textarea
                id="motivo-adiar"
                value={motivoAdiar}
                onChange={(e) => setMotivoAdiar(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder="Ex.: cliente solicitou ajuste de data, precisamos de documento adicional..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModo(null);
                  setMotivoAdiar("");
                  setDiasAdiar(1);
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!motivoAdiar.trim() || !Number.isFinite(diasAdiar) || diasAdiar <= 0}
                onClick={() => onAdiar(tarefa, motivoAdiar.trim(), diasAdiar)}
                className="rounded-lg bg-[#6D28D9] px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Confirmar adiamento
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
