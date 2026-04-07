export type TicketPrioridade = "baixa" | "media" | "alta" | "critica";

export type TicketStatus =
  | "novo"
  | "em_andamento"
  | "aguardando_cliente"
  | "aguardando_equipe"
  | "pendente"
  | "respondido"
  | "finalizado"
  | "nao_solucionado";

export type TicketCategoria =
  | "comercial"
  | "financeiro"
  | "suporte_tecnico"
  | "duvida"
  | "sugestao";

/** Usuário responsável pelo ticket (para avatar e listagem) */
export type TicketResponsavel = {
  id: string;
  nome: string;
};

/** Entrada do histórico de ações do ticket (auditoria) */
export type HistoricoEntrada = {
  id: string;
  data: string; // ISO
  acao: string;
  autor?: string;
  detalhe?: string;
  /** Nomes dos arquivos anexados */
  anexos?: string[];
};

export type ComentarioTicket = {
  id: string;
  autor: string;
  autorTipo: "cliente" | "atendente" | "sistema";
  texto: string;
  data: string; // ISO
  /** Nomes dos arquivos anexados */
  anexos?: string[];
};

export type Ticket = {
  id: string;
  clienteId: string;
  clienteNome: string;
  assunto: string;
  descricao: string;
  status: TicketStatus;
  prioridade: TicketPrioridade;
  categoria: TicketCategoria;
  responsaveis: TicketResponsavel[];
  dataCriacao: string; // ISO
  previsaoConclusao: string; // ISO
  /** Anexos do ticket em memória */
  arquivos?: File[];
  historico: HistoricoEntrada[];
  /** Última atualização (para ordenação/exibição) */
  ultimaAtualizacao: string; // ISO
  comentarios: ComentarioTicket[];
  registroCriadoPorNome?: string | null;
  createdAt?: string;
  updatedAt?: string;
};
