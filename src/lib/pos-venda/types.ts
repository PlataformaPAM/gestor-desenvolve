export type TipoTarefaRégua =
  | "boas_vindas"
  | "checkup_30"
  | "checkup_90"
  | "renovacao_contrato"
  | "pesquisa_satisfacao"
  | "feedback"
  | "outro";

export type StatusTarefa = "pendente" | "concluida" | "adiada";

/** Azul = Onboarding, Roxo = Relacionamento, Laranja = Alerta Risco/Churn */
export type CategoriaTarefa = "onboarding" | "relacionamento" | "alerta_risco";

export type PlaybookSubEtapa = {
  id: string;
  tituloTarefa: string;
  descricaoComoFazer: string;
  slaDias: number;
  resultadoEsperado: string;
};

export type PlaybookEtapa = {
  id: string;
  titulo: string;
  filhos: PlaybookSubEtapa[];
};

export type TarefaRegua = {
  id: string;
  tipo: TipoTarefaRégua;
  titulo: string;
  clienteId: string;
  clienteNome: string;
  dataAgendada: string; // ISO date
  status: StatusTarefa;
  dataConclusao?: string; // ISO, quando concluída
  /** Categoria para cor na UI */
  categoria?: CategoriaTarefa;
  /** Por que estou fazendo isso (playbook) */
  objetivo?: string;
  /** Script sugerido; use [Nome] para substituir pelo nome do cliente */
  scriptSugerido?: string;
  /** Intervalo em dias para próxima ocorrência (régua recorrente) */
  intervaloRecorrenciaDias?: number;
  /** Tipo da próxima tarefa ao concluir (para agendar automaticamente) */
  proximaEtapaTipo?: TipoTarefaRégua;
  /** Urgência para "Ações Prioritárias" (maior = mais crítico) */
  prioridadeCritica?: number;
  /** Ex.: "Contrato vence em 15 dias" */
  motivoCritico?: string;
  removidaEm?: string;
  removidaMotivo?: string;
  removidaPor?: string;
  playbook?: PlaybookEtapa[];
};

/** Regra da régua: a cada X dias, gerar tarefa Y para o cliente */
export type RegraRecorrencia = {
  id: string;
  clienteId: string;
  clienteNome: string;
  tipoTarefa: TipoTarefaRégua;
  intervaloDias: number;
};

/** Evento na timeline de relacionamento */
export type EventoHistorico = {
  id: string;
  clienteId: string;
  tipo: "tarefa_concluida" | "contato" | "alerta";
  titulo: string;
  descricao?: string;
  data: string; // ISO
  tarefaId?: string;
  categoria?: CategoriaTarefa;
};

/** Verde = engajado, Amarelo = neutro, Vermelho = risco de cancelamento */
export type HealthScore = "engajado" | "neutro" | "risco";

export type ClienteHealth = {
  clienteId: string;
  clienteNome: string;
  clienteDocumento?: string;
  healthScore: HealthScore;
  score: number; // 0..100
  pendentes: number;
  atrasadas: number;
  concluidasTotal: number;
  motivoPrincipal?: string;
  proximaAcao?: string;
};
