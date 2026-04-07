import type { PipelineStageId } from "./types";

/**
 * Tarefas obrigatórias por etapa (governança de vendas).
 * Cada lead precisa concluir 100% do checklist da etapa atual para avançar.
 */
export const STAGE_CHECKLISTS: Record<PipelineStageId, string[]> = {
  prospecao: ["Descobrir dor principal", "Mapear decisor", "Confirmar budget"],
  qualificacao: ["Cadastrar/vincular cliente", "Validar necessidade", "Documentar critérios de sucesso"],
  proposta: ["Enviar proposta formal", "Agendar apresentação", "Enviar documentação"],
  contratacao: ["Aprovação jurídica", "Assinatura do contrato", "Kick-off agendado"],
  fechado: [],
  perdido: [],
};

/** Retorna quantidade de tarefas concluídas do lead na etapa dada */
export function getChecklistCompletedCount(
  checklistProgress: Record<string, boolean>,
  stageId: PipelineStageId,
  taskLabels: string[]
): number {
  if (taskLabels.length === 0) return 0;
  return taskLabels.filter((_, idx) => checklistProgress[`${stageId}-${idx}`]).length;
}

/** Retorna se o checklist da etapa está 100% concluído */
export function isStageChecklistComplete(
  checklistProgress: Record<string, boolean>,
  stageId: PipelineStageId,
  taskLabels: string[]
): boolean {
  if (taskLabels.length === 0) return true;
  return taskLabels.every((_, idx) => checklistProgress[`${stageId}-${idx}`]);
}
