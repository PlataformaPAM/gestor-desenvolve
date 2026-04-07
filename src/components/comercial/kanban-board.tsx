"use client";

import { useCallback, useMemo } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import type { Lead, PipelineStage, PipelineStageId } from "@/lib/comercial/types";
import { KanbanColumn } from "./kanban-column";

type KanbanBoardProps = {
  stages: PipelineStage[];
  leads: Lead[];
  selectedLeadId: string | null;
  onSelectLead: (lead: Lead) => void;
  onMoveLead?: (leadId: string, newStageId: PipelineStageId) => void;
  isLoading?: boolean;
};

export function KanbanBoard({
  stages,
  leads,
  selectedLeadId,
  onSelectLead,
  onMoveLead,
  isLoading,
}: KanbanBoardProps) {
  const leadsByStage = useMemo(() => {
    const map = new Map<string, Lead[]>();
    stages.forEach((s) => map.set(s.id, []));
    leads.forEach((lead) => {
      const list = map.get(lead.stageId) ?? [];
      list.push(lead);
      map.set(lead.stageId, list);
    });
    return map;
  }, [stages, leads]);

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination, draggableId } = result;
      if (!destination || !onMoveLead) return;
      if (source.droppableId === destination.droppableId) return;
      onMoveLead(draggableId, destination.droppableId as PipelineStageId);
    },
    [onMoveLead]
  );

  const columnProps = (stage: PipelineStage, isMobileScroll: boolean) => ({
    stage,
    leads: leadsByStage.get(stage.id) ?? [],
    selectedLeadId,
    onSelectLead,
    isLoading,
    isMobileScroll,
    isDroppable: !isLoading && !!onMoveLead,
  });

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      {/* Desktop: 4 colunas lado a lado */}
      <div className="hidden lg:grid lg:grid-cols-4 gap-4">
        {stages.map((stage) => (
          <KanbanColumn key={stage.id} {...columnProps(stage, false)} />
        ))}
      </div>

      {/* Mobile: scroll horizontal com snap (coluna centralizada) */}
      <div className="lg:hidden overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 px-[max(0.5rem,calc(50vw-140px))]">
        <div className="flex gap-3 min-w-max py-1">
          {stages.map((stage) => (
            <KanbanColumn key={stage.id} {...columnProps(stage, true)} />
          ))}
        </div>
      </div>
    </DragDropContext>
  );
}
