export type PipelineStageId =
  | "prospecao"
  | "qualificacao"
  | "proposta"
  | "contratacao"
  | "fechado"
  | "perdido";

export type LeadPriority = "alta" | "media" | "baixa";

export type LeadOrigem =
  | "email"
  | "whatsapp"
  | "ligacao"
  | "instagram"
  | "facebook"
  | "site"
  | "email_marketing"
  | "evento"
  | "indicacao"
  | "outro";

export type LeadInteraction = {
  id: string;
  date: string; // ISO
  type: "etapa" | "contato" | "observacao" | "ganhou" | "sistema" | "arquivo" | "proposta";
  description: string;
  user?: string;
  anexos?: Array<string | { name: string; url: string }>;
  action?: "CREATE" | "UPDATE";
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  fieldKey?: string;
  /** Quem registrou (para persistência no PATCH; opcional em logs só locais). */
  userId?: string | null;
};

/** Chave: `${stageId}-${taskIndex}`; valor: concluído ou não */
export type LeadChecklistProgress = Record<string, boolean>;

export type LeadRecorrenciaPagamento = "mensal" | "unica" | "parcelado";

/** Solução vinculada à oportunidade; `id` é o registro LeadSolucao no banco (estável). */
export type LeadSolucaoRef = {
  id: string;
  solucaoCatalogoId?: string | null;
  nome: string;
  logoUrl?: string;
  valor?: number;
  condicoesPagamento?: string;
  /** Sugestão comercial (editável na proposta). */
  recorrenciaPagamento?: LeadRecorrenciaPagamento | null;
  /** Parcelas quando `recorrenciaPagamento === "parcelado"`. */
  parcelas?: number | null;
};

/** Papel do contato na oportunidade (seleção múltipla) */
export type PapelContatoOportunidade =
  | "gestor_principal"
  | "gestor_contrato"
  | "gestor_financeiro"
  | "tecnico"
  | "operador";

/** Contato vinculado à oportunidade (múltiplos; cada um pode ter vários papéis) */
export type ContatoOportunidade = {
  id: string;
  nome: string;
  cargo?: string;
  setor?: string;
  telefone: string;
  email: string;
  papeis: PapelContatoOportunidade[];
};

export type Lead = {
  id: string;
  /** Nome (Empresa/Contato) — exibição principal */
  name: string;
  value: number;
  /** Valor total da oportunidade (pode igualar value ou somar soluções) */
  valorTotal: number;
  stageId: PipelineStageId;
  priority: LeadPriority;
  enteredStageAt: string;
  /** Origem do lead (obrigatório) */
  origem: LeadOrigem;
  /** Preenchido na Qualificação; null no início */
  clienteId: string | null;
  /** Soluções atreladas à oportunidade */
  solucoes: LeadSolucaoRef[];
  /** Contatos da oportunidade (múltiplos, com papéis) */
  contatosOportunidade?: ContatoOportunidade[];
  /** Progresso das tarefas do checklist por etapa (chave: stageId-taskIndex) */
  checklistProgress: LeadChecklistProgress;
  /** Checklist rígido de contratação */
  contratoChecklist?: {
    aprovacaoCliente: boolean;
    recebimentoDocumentacao: boolean;
    envioDocumentacao: boolean;
    ordemCompra: boolean;
  };
  /** Arquivos anexados em contrato */
  contratoArquivos?: {
    minuta: string[];
    assinatura: string[];
  };
  /** Anexos do cliente (contratação) — nome e data; substitui o fluxo legado minuta/assinatura na UI */
  contratoAnexosCliente?: Array<{ nome: string; anexadoEm: string }>;
  /** Controle de proposta */
  propostaGeradaEm?: string;
  previsaoFechamento?: string;
  cpf?: string;
  company?: string;
  contact?: string;
  email?: string;
  phone?: string;
  /** Município/UF */
  municipioUf?: string;
  /** Entidade (ex.: razão social) */
  entidade?: string;
  /** Cargo do contato */
  cargo?: string;
  notes?: string;
  /** Integração Comercial -> Financeiro (aprovação, bloqueio e liberação) */
  financeiroFluxo?: {
    status: "nenhum" | "pendente_aprovacao" | "lancado" | "devolvido";
    bloqueadoEdicao: boolean;
    solicitadoEm?: string;
    aprovadoEm?: string;
    devolvidoEm?: string;
    motivoDevolucao?: string;
    liberacaoSolicitadaEm?: string;
    motivoSolicitacaoLiberacao?: string;
  };
  interactions?: LeadInteraction[];
  /** Quem criou o lead no banco (somente leitura); usado como responsável padrão quando não há transferência. */
  criadoPorId?: string | null;
  /** Metadados de auditoria (quem criou / datas; somente leitura na UI). */
  registroCriadoPorNome?: string | null;
  registroAtualizadoPorNome?: string | null;
  registroCriadoEm?: string;
  registroAtualizadoEm?: string;
};

export type LeadOwnershipSnapshot = {
  responsavelId?: string;
  responsavelNome?: string;
  colaboradores?: Array<{ id: string; nome: string }>;
};

export type PipelineStage = {
  id: PipelineStageId;
  label: string;
  order: number;
};
