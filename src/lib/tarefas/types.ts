/** Status da tarefa (colunas do Kanban) */
export type StatusTarefa =
  | "a_fazer"
  | "em_andamento"
  | "impedimento"
  | "concluido";

export type PrioridadeTarefa = "baixa" | "media" | "alta" | "urgente";

export type UsuarioTarefa = {
  id: string;
  nome: string;
};

export type HistoricoTarefa = {
  id: string;
  data: string; // ISO
  acao: string;
  /** Nome de exibição de quem registrou o evento (edição/comentário). */
  autor?: string;
  /** Usuário que registrou (persistido em `TarefaHistorico.autorId`). */
  autorId?: string;
  /** Nomes dos arquivos anexados */
  anexos?: string[];
};

export type Tarefa = {
  id: string;
  codigo?: string;
  titulo: string;
  descricao?: string;
  status: StatusTarefa;
  prioridade: PrioridadeTarefa;
  dataInicio: string; // ISO
  dataFim: string; // ISO - Prazo
  responsavel: UsuarioTarefa;
  colaboradores: UsuarioTarefa[];
  clienteId?: string;
  clienteIds?: string[];
  clienteNome?: string;
  solucaoId?: string;
  /** Nomes dos anexos persistidos */
  anexos: string[];
  /** Anexos em memória */
  arquivos?: File[];
  historico: HistoricoTarefa[];
  registroCriadoPorNome?: string | null;
  createdAt?: string;
  updatedAt?: string;
};
