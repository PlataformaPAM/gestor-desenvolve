/** Status da tarefa (colunas do Kanban) */
export type StatusTarefa =
  | "a_fazer"
  | "em_andamento"
  | "aguardando"
  | "validar"
  | "concluido"
  | "cancelado";

export type PrioridadeTarefa = "baixa" | "media" | "alta" | "urgente";

export type UsuarioTarefa = {
  id: string;
  nome: string;
};

export type SolucaoTarefa = {
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

export type TarefaAnexoItem = {
  name: string;
  url?: string;
};

export type Tarefa = {
  id: string;
  codigo?: string;
  categoria?: string;
  titulo: string;
  descricao?: string;
  status: StatusTarefa;
  prioridade: PrioridadeTarefa;
  dataInicio: string; // ISO — início planejado da tarefa
  dataFim: string; // ISO - Prazo final
  responsavel: UsuarioTarefa;
  colaboradores: UsuarioTarefa[];
  clienteId?: string;
  clienteIds?: string[];
  clienteNome?: string;
  /** @deprecated use solucaoIds */
  solucaoId?: string;
  solucaoIds?: string[];
  solucoes?: SolucaoTarefa[];
  /** Nomes dos anexos persistidos */
  anexos: string[];
  /** Metadados dos anexos (inclui URL para visualização) */
  anexoItens?: TarefaAnexoItem[];
  /** Anexos em memória (pendentes ou cache local) */
  arquivos?: File[];
  historico: HistoricoTarefa[];
  registroCriadoPorNome?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

/** Ordem das colunas no Kanban */
export const TAREFA_KANBAN_COLUMN_ORDER: StatusTarefa[] = [
  "a_fazer",
  "em_andamento",
  "aguardando",
  "validar",
  "concluido",
  "cancelado",
];
