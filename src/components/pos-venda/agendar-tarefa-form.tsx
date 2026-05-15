"use client";

import { useEffect, useId, useState } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import {
  GripVertical,
  Layers,
  Plus,
  Building2,
  Target,
  MessageSquare,
  Handshake,
  CalendarCheck2,
  CalendarSync,
  FileSignature,
  SmilePlus,
  MessageCircleWarning,
  CircleHelp,
  FileText,
  ClipboardList,
  Clock,
  Flag,
  X,
  Save,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";
import { AlertDialog } from "@/components/ui/alert-dialog";
import type { PlaybookEtapa, PlaybookSubEtapa, TarefaRegua, TipoTarefaRégua } from "@/lib/pos-venda/types";
import { TIPO_TAREFA_LABELS } from "@/lib/pos-venda/constants";
import type { Cliente } from "@/lib/clientes/types";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { DateField } from "@/components/ui/date-field";
import {
  formInputClass,
  formLabelClass,
  formModalCancelButtonClass,
  formModalSubmitButtonClass,
  formTextareaClass,
} from "@/components/ui/field-patterns";

type AgendarTarefaFormProps = {
  clientes: Cliente[];
  onSave: (tarefa: Omit<TarefaRegua, "id"> & { intervaloRecorrenciaDias?: number }) => void;
  onCancel: () => void;
};

const TIPOS: TipoTarefaRégua[] = [
  "boas_vindas",
  "agenda_reuniao",
  "checkup_30",
  "checkup_90",
  "renovacao_contrato",
  "pesquisa_satisfacao",
  "feedback",
  "outro",
];

const TASK_VISUALS: Record<TipoTarefaRégua, { icon: LucideIcon; iconClassName: string }> = {
  boas_vindas: { icon: Handshake, iconClassName: "!text-emerald-600 dark:!text-emerald-400" },
  agenda_reuniao: { icon: CalendarCheck2, iconClassName: "!text-sky-600 dark:!text-sky-400" },
  checkup_30: { icon: CalendarSync, iconClassName: "!text-violet-600 dark:!text-violet-400" },
  checkup_90: { icon: CalendarSync, iconClassName: "!text-indigo-600 dark:!text-indigo-400" },
  renovacao_contrato: { icon: FileSignature, iconClassName: "!text-amber-600 dark:!text-amber-400" },
  pesquisa_satisfacao: { icon: SmilePlus, iconClassName: "!text-lime-600 dark:!text-lime-400" },
  feedback: { icon: MessageCircleWarning, iconClassName: "!text-rose-600 dark:!text-rose-400" },
  outro: { icon: CircleHelp, iconClassName: "!text-slate-500 dark:!text-slate-300" },
};

function createColoredIcon(Icon: LucideIcon, iconClassName: string) {
  return function ColoredIcon({ className }: { className?: string }) {
    return <Icon className={clsx(className, iconClassName)} />;
  };
}

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
  const clienteOptions: SearchableOption[] = clientes.map((c) => ({
    value: c.id,
    label: c.nome,
    subtitle: c.empresa,
    icon: Building2,
  }));
  const tipoOptions: SearchableOption[] = TIPOS.map((tipoValue) => ({
    value: tipoValue,
    label: TIPO_TAREFA_LABELS[tipoValue],
    icon: createColoredIcon(TASK_VISUALS[tipoValue].icon, TASK_VISUALS[tipoValue].iconClassName),
  }));

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
    <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col overflow-hidden">
      <div
        role="tablist"
        aria-label="Abas do agendamento"
        className="sticky top-0 z-30 flex shrink-0 border-b border-slate-300 bg-slate-50/95 backdrop-blur-sm dark:border-slate-600 dark:bg-slate-800/95"
      >
        {(
          [
            { id: "dados" as const, label: "Dados da ação", Icon: FileText },
            { id: "playbook" as const, label: "Playbook", Icon: Layers },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            role="tab"
            id={`${tabId}-${tab.id}`}
            aria-controls={`${tabId}-${tab.id}-panel`}
            aria-selected={activeTab === tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              "relative flex min-w-0 flex-1 items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "text-[#6D28D9] dark:text-violet-400"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            )}
          >
            {activeTab === tab.id ? <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6D28D9]" /> : null}
            <tab.Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-4 p-4 lg:p-6"
        id={`${tabId}-${activeTab}-panel`}
      >
      {activeTab === "dados" && (
      <>
      <div>
        <label htmlFor="agendar-cliente" className={formLabelClass}>
          Cliente <span className="text-rose-500">*</span>
        </label>
        <div id="agendar-cliente" className="mt-1">
          <SearchableSelect
            options={clienteOptions}
            value={clienteId}
            onChange={setClienteId}
            placeholder="Selecione um cliente"
            searchPlaceholder="Buscar cliente..."
            emptyLabel="Nenhum cliente encontrado."
            leadingIcon={Building2}
          />
        </div>
      </div>
      <div>
        <label htmlFor="agendar-tipo" className={formLabelClass}>
          Tipo de tarefa
        </label>
        <div id="agendar-tipo" className="mt-1">
          <SearchableSelect
            options={tipoOptions}
            value={tipo}
            onChange={(value) => setTipo(value as TipoTarefaRégua)}
            placeholder="Selecione o tipo"
            searchPlaceholder="Buscar tipo..."
            emptyLabel="Nenhum tipo encontrado."
            leadingIcon={TASK_VISUALS[tipo].icon}
          />
        </div>
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
        <label htmlFor="agendar-data" className={formLabelClass}>
          Data agendada <span className="text-rose-500">*</span>
        </label>
        <DateField id="agendar-data" value={dataAgendada} onChange={setDataAgendada} placeholder="Selecione a data" />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <div className="space-y-1">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={recorrente}
                onChange={(e) => setRecorrente(e.target.checked)}
                className="rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9]"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Régua recorrente</span>
            </label>
            <p className="ml-6 text-xs text-slate-500 dark:text-slate-400">
              A cada X dias, gerar esta tarefa para o cliente.
            </p>
          </div>
          {recorrente && (
            <div className="ml-6 sm:ml-0">
              <label htmlFor="intervalo-dias" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Intervalo de dias:
              </label>
              <div className="relative w-36">
                <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  id="intervalo-dias"
                  type="number"
                  min={7}
                  max={365}
                  value={intervaloDias}
                  onChange={(e) => setIntervaloDias(Math.max(7, parseInt(e.target.value, 10) || 7))}
                  className={`${formInputClass} pl-9`}
                  placeholder="Dias"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Roteiro de ação</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Defina objetivo e orientação para execução. Isso alimenta o fluxo de escalonamento do Pós-venda.
        </p>
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor="agendar-objetivo" className={formLabelClass}>
              Objetivo da ação
            </label>
            <div className="relative mt-1">
              <Target className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <textarea
                id="agendar-objetivo"
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                rows={3}
                className={`${formTextareaClass} pl-9`}
                placeholder="Ex.: Reverter risco de baixa adoção e alinhar plano dos próximos 15 dias."
              />
            </div>
          </div>
          <div>
            <label htmlFor="agendar-script" className={formLabelClass}>
              Script sugerido de contato
            </label>
            <div className="relative mt-1">
              <MessageSquare className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <textarea
                id="agendar-script"
                value={scriptSugerido}
                onChange={(e) => setScriptSugerido(e.target.value)}
                rows={4}
                className={`${formTextareaClass} pl-9`}
                placeholder="Ex.: Olá, [Nome], vamos revisar os pontos críticos e fechar um plano de recuperação hoje."
              />
            </div>
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
            <button type="button" onClick={addEtapaPai} className={formModalSubmitButtonClass}>
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4 shrink-0" aria-hidden />
                Adicionar Etapa Pai
              </span>
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
                              <div className="relative min-w-0 flex-1">
                                <Flag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                                <input
                                  type="text"
                                  value={etapa.titulo}
                                  onChange={(e) => updateEtapa(etapaIndex, { ...etapa, titulo: e.target.value })}
                                  placeholder="Ex.: Fase 1: Adoção inicial"
                                  className={`${formInputClass} pl-9`}
                                />
                              </div>
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
                                              <div className="relative">
                                                <ClipboardList className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                                                <input
                                                  type="text"
                                                  value={sub.tituloTarefa}
                                                  onChange={(e) => updateSubEtapa(etapaIndex, subIndex, { ...sub, tituloTarefa: e.target.value })}
                                                  placeholder="Título da tarefa"
                                                  className={`${formInputClass} pl-9`}
                                                />
                                              </div>
                                              <div className="relative">
                                                <FileText className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" aria-hidden />
                                                <textarea
                                                  value={sub.descricaoComoFazer}
                                                  onChange={(e) => updateSubEtapa(etapaIndex, subIndex, { ...sub, descricaoComoFazer: e.target.value })}
                                                  placeholder="Descrição / como fazer"
                                                  rows={2}
                                                  className={`${formTextareaClass} pl-9`}
                                                />
                                              </div>
                                              <div className="flex flex-wrap gap-4">
                                                <div className="w-28">
                                                  <label className="mb-0.5 block text-xs font-medium text-slate-500 dark:text-slate-400">SLA (dias)</label>
                                                  <div className="relative">
                                                    <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                                                    <input
                                                      type="number"
                                                      min={0}
                                                      value={sub.slaDias}
                                                      onChange={(e) => updateSubEtapa(etapaIndex, subIndex, { ...sub, slaDias: Number(e.target.value) || 0 })}
                                                      className={`${formInputClass} pl-9`}
                                                    />
                                                  </div>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                  <label className="mb-0.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Resultado esperado</label>
                                                  <div className="relative">
                                                    <Target className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                                                    <input
                                                      type="text"
                                                      value={sub.resultadoEsperado}
                                                      onChange={(e) => updateSubEtapa(etapaIndex, subIndex, { ...sub, resultadoEsperado: e.target.value })}
                                                      placeholder="Entregável ou critério de conclusão"
                                                      className={`${formInputClass} pl-9`}
                                                    />
                                                  </div>
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
              <button type="button" onClick={addEtapaPai} className={`${formModalSubmitButtonClass} mt-3`}>
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4 shrink-0" aria-hidden />
                  Adicionar Etapa Pai
                </span>
              </button>
            </div>
          )}
        </div>
      )}
      </div>

      <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:justify-end sm:gap-3 lg:px-6">
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
