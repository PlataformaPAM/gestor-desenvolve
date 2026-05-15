import type { PipelineStage } from "./types";

export const PIPELINE_STAGES: PipelineStage[] = [
  { id: "prospecao", label: "Prospecção", order: 1 },
  { id: "qualificacao", label: "Qualificação", order: 2 },
  { id: "proposta", label: "Proposta", order: 3 },
  { id: "contratacao", label: "Contratação", order: 4 },
  { id: "fechado", label: "Fechado", order: 5 },
  { id: "perdido", label: "Perdido", order: 6 },
];
import type { LeadOrigem, LeadPriority, PapelContatoOportunidade } from "./types";

/** Opções de origem para select (Novo Lead e Dados Gerais), por ordem alfabética da etiqueta */
export const ORIGEM_OPCOES: { value: LeadOrigem; label: string }[] = [
  { value: "email", label: "E-mail" },
  { value: "email_marketing", label: "E-mail Marketing" },
  { value: "evento", label: "Evento" },
  { value: "facebook", label: "Facebook" },
  { value: "indicacao", label: "Indicação" },
  { value: "instagram", label: "Instagram" },
  { value: "ligacao", label: "Ligação" },
  { value: "outro", label: "Outro" },
  { value: "site", label: "Site" },
  { value: "whatsapp", label: "WhatsApp" },
];

/** Origens que exibem campo "Detalhar origem" */
export const ORIGEM_COM_DETALHE: LeadOrigem[] = ["evento", "indicacao", "outro"];

/** Mesmas etiquetas que Tarefas Internas (`@/lib/tarefas/constants`). */
export const PRIORIDADE_LABELS: Record<LeadPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

/** Checklist da Etapa exibido na aba Dados Gerais (chaves: geral-0 .. geral-3) */
export const CHECKLIST_DADOS_GERAIS = [
  "Descobrir dor principal",
  "Definir Solução/Serviço",
  "Definir regras da proposta",
  "Coleta de dados completos",
] as const;

/** Papéis do contato na oportunidade (multi-select) */
export const PAPEIS_CONTATO_OPORTUNIDADE: { value: PapelContatoOportunidade; label: string }[] = [
  { value: "gestor_principal", label: "Gestor Principal" },
  { value: "gestor_contrato", label: "Gestor do Contrato" },
  { value: "gestor_financeiro", label: "Gestor Financeiro" },
  { value: "tecnico", label: "Técnico" },
  { value: "operador", label: "Operador" },
];
