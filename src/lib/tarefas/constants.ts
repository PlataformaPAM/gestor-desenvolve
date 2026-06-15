import type { Tarefa } from "./types";
import { TAREFA_KANBAN_COLUMN_ORDER } from "./types";

export type SlaTarefa = "atrasado" | "atencao" | "no_prazo";

export function getSlaTarefa(dataFim: string, status: Tarefa["status"]): SlaTarefa {
  if (status === "concluido" || status === "cancelado") return "no_prazo";
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const d = new Date(dataFim);
  d.setHours(0, 0, 0, 0);
  const diffMs = d.getTime() - hoje.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return "atrasado";
  if (diffDays <= 2) return "atencao";
  return "no_prazo";
}

export const STATUS_LABELS: Record<Tarefa["status"], string> = {
  a_fazer: "A Fazer",
  em_andamento: "Em Andamento",
  aguardando: "Aguardando",
  validar: "Validar",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export { TAREFA_KANBAN_COLUMN_ORDER };

export const PRIORIDADE_LABELS: Record<Tarefa["prioridade"], string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export const CURRENT_USER_ID = "u1";

/** Status considerados encerrados na visão Fechados */
export const TAREFA_STATUS_FECHADOS: Tarefa["status"][] = ["concluido", "cancelado"];
