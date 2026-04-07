"use client";

import { useEffect, useId, useState } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { GripVertical, Layers, Plus } from "lucide-react";
import clsx from "clsx";
import { AlertDialog } from "@/components/ui/alert-dialog";
import type { PlaybookEtapa, PlaybookSubEtapa, TarefaRegua, TipoTarefaRégua } from "@/lib/pos-venda/types";
import { TIPO_TAREFA_LABELS } from "@/lib/pos-venda/constants";
import type { Cliente } from "@/lib/clientes/types";

type AgendarTarefaFormProps = {
  clientes: Cliente[];
  onSave: (tarefa: Omit<TarefaRegua, "id"> & { intervaloRecorrenciaDias?: number }) => void;
  onCancel: () => void;
};

const TIPOS: TipoTarefaRégua[] = [
  "boas_vindas",
  "checkup_30",
  "checkup_90",
  "renovacao_contrato",
  "pesquisa_satisfacao",
  "feedback",
  "outro",
];

function nextWeek(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export function AgendarTarefaForm({ clientes, onSave, onCancel }: AgendarTarefaFormProps) {
  const tabId = useId();
  const [activeTab, setActiveTab] = useState<"dados" | "playbook">("dados");
  const [clienteId, setClienteId] = useState("");
  const [tipo, setTipo] = useState<TipoTarefaRégua>("boas_vindas");
  const [marcarAcaoPrioritariaHoje, setMarcarAcaoPrioritariaHoje] = useState(false);
  const [dataAgendada, setDataAgendada] = useState(nextWeek());
  const [recorrente, setRecorrente] = useState(false);
  const [intervaloDias, setIntervaloDias] = useState(45);
  const [objetivo, setObjetivo] = useState("");
  const [scriptSugerido, setScriptSugerido] = useState("");
  const [playbook, setPlaybook] = useState<PlaybookEtapa[]>([]);
  const [pendingRemove, setPendingRemove] = useState<
    | null
    | { kind: "etapa"; index: number; titulo: string }
    | { kind: "sub"; etapaIndex: number; subIndex: number; titulo: string }
  >(null);

  const cliente = clientes.find((c) => c.id === clienteId);

  useEffect(() => {
    // Heurística inicial: "feedback" tende a ser ação prioritária.
    setMarcarAcaoPrioritariaHoje(tipo === "feedback");
  }, [tipo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente) return;
    onSave({
      tipo,
      titulo: TIPO_TAREFA_LABELS[tipo],
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      dataAgendada,
      status: "pendente",
      categoria: tipo === "boas_vindas" ? "onboarding" : "relacionamento",
      objetivo: objetivo.trim() || undefined,
      scriptSugerido: scriptSugerido.trim() || undefined,
      prioridadeCritica: marcarAcaoPrioritariaHoje ? (tipo === "feedback" ? 9 : 7) : undefined,
      motivoCritico: objetivo.trim() || TIPO_TAREFA_LABELS[tipo],
      intervaloRecorrenciaDias: recorrente ? intervaloDias : undefined,
      playbook,
    });
  };

  const addEtapaPai = () => {
    const nova: PlaybookEtapa = { id: `etapa-${Date.now()}`, titulo: "Nova Fase", filhos: [] };
    setPlaybook((prev) => [...prev, nova]);
  };
  const updateEtapa = (index: number, etapa: PlaybookEtapa) =>
    setPlaybook((prev) => prev.map((p, i) => (i === index ? etapa : p)));
  const removeEtapa = (index: number) => setPlaybook((prev) => prev.filter((_, i) => i !== index));
  const addSubEtapa = (etapaIndex: number) => {
    const etapa = playbook[etapaIndex];
    if (!etapa) return;
    const nova: PlaybookSubEtapa = {
      id: `sub-${Date.now()}`,
      tituloTarefa: "",
      descricaoComoFazer: "",
      slaDias: 0,
      resultadoEsperado: "",
    };
    updateEtapa(etapaIndex, { ...etapa, filhos: [...etapa.filhos, nova] });
  };
  const updateSubEtapa = (etapaIndex: number, subIndex: number, sub: PlaybookSubEtapa) => {
    const etapa = playbook[etapaIndex];
    if (!etapa) return;
    updateEtapa(etapaIndex, {
      ...etapa,
      filhos: etapa.filhos.map((f, idx) => (idx === subIndex ? sub : f)),
    });
  };
  const removeSubEtapa = (etapaIndex: number, subIndex: number) => {
    const etapa = playbook[etapaIndex];
    if (!etapa) return;
    updateEtapa(etapaIndex, { ...etapa, filhos: etapa.filhos.filter((_, i) => i !== subIndex) });
  };
  const handlePlaybookDragEnd = (result: DropResult) => {
    const { source, destination, type } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    const next = JSON.parse(JSON.stringify(playbook)) as PlaybookEtapa[];
    if (type === "parent") {
      const [moved] = next.splice(source.index, 1);
      next.splice(destination.index, 0, moved);
      setPlaybook(next);
      return;
    }
    if (type === "child") {
      const sourceParentIndex = next.findIndex((s) => s.id === source.droppableId);
      const destParentIndex = next.findIndex((s) => s.id === destination.droppableId);
      if (sourceParentIndex === -1 || destParentIndex === -1) return;
      const [moved] = next[sourceParentIndex].filhos.splice(source.index, 1);
      next[destParentIndex].filhos.splice(destination.index, 0, moved);
      setPlaybook(next);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col">
      <div role="tablist" aria-label="Abas do agendamento" className="flex border-b border-slate-200 bg-slate-50/50">
        {[
          { id: "dados" as const, label: "Dados da ação" },
          { id: "playbook" as const, label: "Playbook" },
        ].map((tab) => (
          <button
            key={tab.id}
            role="tab"
            id={`${tabId}-${tab.id}`}
            aria-controls={`${tabId}-${tab.id}-panel`}
            aria-selected={activeTab === tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              "flex-1 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "border-b-2 border-[#6D28D9] text-[#6D28D9]"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 lg:p-6" id={`${tabId}-${activeTab}-panel`}>
      {activeTab === "dados" && (
      <>
      <div>
        <label htmlFor="agendar-cliente" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Cliente
        </label>
        <select
          id="agendar-cliente"
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          required
        >
          <option value="">Selecione um cliente</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome} - {c.empresa}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="agendar-tipo" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Tipo de tarefa
        </label>
        <select
          id="agendar-tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoTarefaRégua)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {TIPO_TAREFA_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-slate-900/30">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={marcarAcaoPrioritariaHoje}
            onChange={(e) => setMarcarAcaoPrioritariaHoje(e.target.checked)}
            className="rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9]"
          />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Marcar como ação prioritária
          </span>
        </label>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Somente tarefas marcadas aparecem no card de <span className="font-semibold">Ações Prioritárias</span>.
        </p>
      </div>

      <div>
        <label htmlFor="agendar-data" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Data agendada
        </label>
        <input
          id="agendar-data"
          type="date"
          value={dataAgendada}
          onChange={(e) => setDataAgendada(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          required
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={recorrente}
            onChange={(e) => setRecorrente(e.target.checked)}
            className="rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9]"
          />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Régua recorrente</span>
        </label>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          A cada X dias, gerar esta tarefa para o cliente.
        </p>
        {recorrente && (
          <div className="mt-2">
            <label htmlFor="intervalo-dias" className="block text-xs text-slate-600 dark:text-slate-300">
              Intervalo (dias)
            </label>
            <input
              id="intervalo-dias"
              type="number"
              min={7}
              max={365}
              value={intervaloDias}
              onChange={(e) => setIntervaloDias(Math.max(7, parseInt(e.target.value, 10) || 7))}
              className="mt-1 w-24 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/30">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Roteiro de ação</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Defina objetivo e orientação para execução. Isso alimenta o fluxo de escalonamento do Pós-venda.
        </p>
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor="agendar-objetivo" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Objetivo da ação
            </label>
            <textarea
              id="agendar-objetivo"
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="Ex.: Reverter risco de baixa adoção e alinhar plano dos próximos 15 dias."
            />
          </div>
          <div>
            <label htmlFor="agendar-script" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Script sugerido de contato
            </label>
            <textarea
              id="agendar-script"
              value={scriptSugerido}
              onChange={(e) => setScriptSugerido(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="Ex.: Olá, [Nome], vamos revisar os pontos críticos e fechar um plano de recuperação hoje."
            />
          </div>
        </div>
      </div>
      </>
      )}

      {activeTab === "playbook" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Monte o playbook desta ação exatamente para este cliente.
            </p>
            <button
              type="button"
              onClick={addEtapaPai}
              className="inline-flex items-center gap-2 rounded-lg bg-[#6D28D9] px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
            >
              <Layers className="h-4 w-4" />
              Adicionar Etapa Pai
            </button>
          </div>
          {playbook.length > 0 && (
            <DragDropContext onDragEnd={handlePlaybookDragEnd}>
              <Droppable droppableId="board" type="parent">
                {(parentDroppableProvided) => (
                  <div ref={parentDroppableProvided.innerRef} {...parentDroppableProvided.droppableProps} className="space-y-6">
                    {playbook.map((etapa, etapaIndex) => (
                      <Draggable key={etapa.id} draggableId={etapa.id} index={etapaIndex}>
                        {(parentProvided) => (
                          <div ref={parentProvided.innerRef} {...parentProvided.draggableProps} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex items-center gap-2">
                              <span {...parentProvided.dragHandleProps} className="cursor-grab text-slate-400">
                                <GripVertical className="h-4 w-4" />
                              </span>
                              <input
                                type="text"
                                value={etapa.titulo}
                                onChange={(e) => updateEtapa(etapaIndex, { ...etapa, titulo: e.target.value })}
                                placeholder="Ex.: Fase 1: Adoção inicial"
                                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => setPendingRemove({ kind: "etapa", index: etapaIndex, titulo: etapa.titulo || "esta etapa" })}
                                className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
                              >
                                ×
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => addSubEtapa(etapaIndex)}
                              className="mt-3 ml-6 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-[#6D28D9] hover:border-[#6D28D9] hover:bg-[#6D28D9]/5"
                            >
                              <Plus className="h-4 w-4" />
                              Adicionar Sub-etapa
                            </button>
                            <Droppable droppableId={etapa.id} type="child">
                              {(subDroppableProvided) => (
                                <div ref={subDroppableProvided.innerRef} {...subDroppableProvided.droppableProps} className="mt-4 space-y-4 border-l-2 border-slate-200 pl-4 ml-6 min-h-[40px]">
                                  {etapa.filhos.map((sub, subIndex) => (
                                    <Draggable key={sub.id} draggableId={sub.id} index={subIndex}>
                                      {(subProvided) => (
                                        <div ref={subProvided.innerRef} {...subProvided.draggableProps} className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                                          <div className="flex items-start gap-2">
                                            <span {...subProvided.dragHandleProps} className="mt-2 cursor-grab text-slate-400 shrink-0">
                                              <GripVertical className="h-4 w-4" />
                                            </span>
                                            <div className="min-w-0 flex-1 space-y-3">
                                              <input
                                                type="text"
                                                value={sub.tituloTarefa}
                                                onChange={(e) => updateSubEtapa(etapaIndex, subIndex, { ...sub, tituloTarefa: e.target.value })}
                                                placeholder="Título da tarefa"
                                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                              />
                                              <textarea
                                                value={sub.descricaoComoFazer}
                                                onChange={(e) => updateSubEtapa(etapaIndex, subIndex, { ...sub, descricaoComoFazer: e.target.value })}
                                                placeholder="Descrição / como fazer"
                                                rows={2}
                                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                              />
                                              <div className="flex flex-wrap gap-4">
                                                <div className="w-24">
                                                  <label className="mb-0.5 block text-xs font-medium text-slate-500">SLA (dias)</label>
                                                  <input
                                                    type="number"
                                                    min={0}
                                                    value={sub.slaDias}
                                                    onChange={(e) => updateSubEtapa(etapaIndex, subIndex, { ...sub, slaDias: Number(e.target.value) || 0 })}
                                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                                  />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                  <label className="mb-0.5 block text-xs font-medium text-slate-500">Resultado esperado</label>
                                                  <input
                                                    type="text"
                                                    value={sub.resultadoEsperado}
                                                    onChange={(e) => updateSubEtapa(etapaIndex, subIndex, { ...sub, resultadoEsperado: e.target.value })}
                                                    placeholder="Entregável ou critério de conclusão"
                                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                                  />
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() => setPendingRemove({ kind: "sub", etapaIndex, subIndex, titulo: sub.tituloTarefa || "esta sub-etapa" })}
                                                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
                                                >
                                                  ×
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </Draggable>
                                  ))}
                                  {subDroppableProvided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {parentDroppableProvided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
          {playbook.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
              <p className="text-sm text-slate-500">Nenhuma etapa de playbook ainda.</p>
              <button
                type="button"
                onClick={addEtapaPai}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#6D28D9] px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
              >
                <Layers className="h-4 w-4" />
                Adicionar Etapa Pai
              </button>
            </div>
          )}
        </div>
      )}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 p-4 sm:flex-row sm:justify-end sm:gap-3 lg:p-6">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-lg bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:ring-offset-2"
        >
          Agendar
        </button>
      </div>
      <AlertDialog
        open={!!pendingRemove}
        onClose={() => setPendingRemove(null)}
        onConfirm={() => {
          if (!pendingRemove) return;
          if (pendingRemove.kind === "etapa") removeEtapa(pendingRemove.index);
          else removeSubEtapa(pendingRemove.etapaIndex, pendingRemove.subIndex);
        }}
        title={pendingRemove?.kind === "sub" ? "Remover sub-etapa do playbook?" : "Remover fase do playbook?"}
        description={`Você está removendo ${pendingRemove?.titulo ?? "este item"} do playbook deste cliente.`}
        cancelLabel="Cancelar"
        confirmLabel="Sim, remover"
        destructive
      />
    </form>
  );
}
