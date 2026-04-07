"use client";

import { useMemo } from "react";
import clsx from "clsx";
import { motion } from "framer-motion";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import type { Lead, PipelineStage } from "@/lib/comercial/types";
import { STAGE_COLORS } from "@/lib/comercial/stage-colors";
import { LeadCard, LeadCardSkeleton } from "./lead-card";

type KanbanColumnProps = {
  stage: PipelineStage;
  leads: Lead[];
  selectedLeadId: string | null;
  onSelectLead: (lead: Lead) => void;
  isLoading?: boolean;
  isMobileScroll?: boolean;
  isDroppable?: boolean;
};

export function KanbanColumn({
  stage,
  leads,
  selectedLeadId,
  onSelectLead,
  isLoading,
  isMobileScroll,
  isDroppable,
}: KanbanColumnProps) {
  const count = leads.length;

  const stageColors = STAGE_COLORS[stage.id];
  const header = (
    <div className="flex items-center justify-between mb-3">
      <h3 className={clsx("text-sm font-semibold", stageColors.text)}>
        {stage.label}
      </h3>
      <span
        className={clsx(
          "rounded-full px-2 py-0.5 text-xs font-medium",
          stageColors.badge
        )}
      >
        {count}
      </span>
    </div>
  );

  const cardList = isLoading ? (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <LeadCardSkeleton key={i} />
      ))}
    </div>
  ) : isDroppable ? (
    leads.map((lead, index) => (
      <Draggable key={lead.id} draggableId={lead.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className="mb-2 last:mb-0"
          >
            <LeadCard
              lead={lead}
              isSelected={selectedLeadId === lead.id}
              onSelect={() => onSelectLead(lead)}
              stageId={stage.id}
              isDragging={snapshot.isDragging}
            />
          </div>
        )}
      </Draggable>
    ))
  ) : (
    <div className="space-y-2">
      {leads.map((lead) => (
        <LeadCard
          key={lead.id}
          lead={lead}
          isSelected={selectedLeadId === lead.id}
          onSelect={() => onSelectLead(lead)}
          stageId={stage.id}
        />
      ))}
    </div>
  );

  const wrapperClass = isMobileScroll
    ? "flex-shrink-0 w-[280px] snap-center snap-always"
    : "flex-shrink-0 w-full min-w-0";

  const columnContent = (
    <div
      className={clsx(
        "rounded-xl border border-slate-200 p-3 h-full min-h-[140px]",
        STAGE_COLORS[stage.id].bg,
        STAGE_COLORS[stage.id].borderTop
      )}
    >
      {header}
      {isDroppable ? (
        <Droppable droppableId={stage.id}>
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="min-h-[60px] space-y-2"
            >
              {cardList}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      ) : (
        cardList
      )}
    </div>
  );

  return (
    <motion.div
      layout
      className={wrapperClass}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {columnContent}
    </motion.div>
  );
}
