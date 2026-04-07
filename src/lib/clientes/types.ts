export type ClienteStatus = "ativo" | "inativo" | "inadimplente";

export type ClienteSegmento =
  | "varejo"
  | "industria"
  | "servicos"
  | "tecnologia"
  | "outros";

export type ClienteEndereco = {
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
};

export type PropostaResumo = {
  id: string;
  titulo: string;
  valor: number;
  dataProposta: string;
  status: "aceita" | "recusada" | "pendente";
};

export type FaturaResumo = {
  id: string;
  vencimento: string;
  valor: number;
  status: "paga" | "pendente" | "vencida";
};

export type TicketResumo = {
  id: string;
  assunto: string;
  dataAbertura: string;
  status: "aberto" | "em_andamento" | "resolvido";
};

/** Papel do contato na empresa (Qualificação de lead) — legado, preferir papeis[] */
export type ContatoPapel =
  | "gestor_empresa"
  | "gestor_contrato"
  | "responsavel_financeiro"
  | "outro";

/** Papéis do contato B2B (seleção múltipla) */
export type PapelContatoCliente =
  | "gestor_principal"
  | "gestor_contrato"
  | "gestor_financeiro"
  | "tecnico"
  | "operador";

export type Contato = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  setor?: string;
  cargo?: string;
  /** Papel único (legado); use papeis quando disponível */
  papel?: ContatoPapel;
  /** Papéis múltiplos (B2B) */
  papeis?: PapelContatoCliente[];
};

export type Cliente = {
  id: string;
  nome: string;
  empresa: string;
  cpfCnpj: string;
  status: ClienteStatus;
  valorMensal: number; // LTV mensal
  segmento: ClienteSegmento;
  email?: string;
  telefone?: string;
  /** URL do site oficial da empresa (B2B) */
  urlSiteOficial?: string;
  endereco?: ClienteEndereco;
  dataFechamento?: string; // ISO
  /** Contatos da empresa (múltiplos) */
  contatos?: Contato[];
  propostas?: PropostaResumo[];
  faturasPagas?: number;
  faturasPendentes?: number;
  faturas?: FaturaResumo[];
  tickets?: TicketResumo[];
  /** Quem criou o cadastro no sistema (listagens). */
  registroCriadoPorNome?: string | null;
  createdAt?: string;
  updatedAt?: string;
};
