import type { ClienteHealth, TarefaRegua } from "./types";

export const TIPO_TAREFA_LABELS: Record<TarefaRegua["tipo"], string> = {
  boas_vindas: "Ligação de Boas-vindas",
  agenda_reuniao: "Agenda Reunião",
  checkup_30: "Check-up de 30 dias",
  checkup_90: "Check-up de 90 dias",
  renovacao_contrato: "Renovação de Contrato",
  pesquisa_satisfacao: "Pesquisa de Satisfação",
  feedback: "Feedback",
  outro: "Outra",
};

export const CATEGORIA_LABELS: Record<NonNullable<TarefaRegua["categoria"]>, string> = {
  onboarding: "Onboarding",
  relacionamento: "Relacionamento",
  alerta_risco: "Alerta de Risco",
};

export const HEALTH_LABELS: Record<ClienteHealth["healthScore"], string> = {
  engajado: "Engajado",
  neutro: "Neutro",
  risco: "Risco de cancelamento",
};
