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
  autor?: string;
  /** Nomes dos arquivos anexados */
  anexos?: string[];
};

export type Tarefa = {
  id: string;
  titulo: string;
  descricao?: string;
  status: StatusTarefa;
  prioridade: PrioridadeTarefa;
  dataInicio: string; // ISO
  dataFim: string; // ISO - Prazo
  responsavel: UsuarioTarefa;
  colaboradores: UsuarioTarefa[];
  clienteId?: string;
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
