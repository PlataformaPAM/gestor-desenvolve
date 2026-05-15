export type LancamentoStatus = "pago" | "pendente" | "atrasado";

export type LancamentoTipo = "entrada" | "saida";

/** Único = padrão; Fixo Mensal = projetado mês a mês; Parcelado = N parcelas com vencimentos mensais */
export type TipoRecorrencia = "unico" | "fixo_mensal" | "parcelado";

/** Fornecedor ativo (RH → aba Fornecedores), usado no Financeiro. */
export type FornecedorRhSlim = {
  id: string;
  nome: string;
  cpfCnpj?: string;
};

/** Consultores RH elegíveis a comissão (lista do bootstrap Financeiro). */
export type ConsultorComissaoSlim = {
  id: string;
  nome: string;
};

export type Lancamento = {
  id: string;
  tipo: LancamentoTipo;
  descricao: string;
  /** ID do cliente quando for recebimento (entrada) de um cliente */
  clienteId?: string;
  /** Nome do fornecedor quando for saída (pagar) */
  fornecedor?: string;
  vencimento: string; // ISO date
  valor: number;
  status: LancamentoStatus;
  dataPagamento?: string; // ISO, quando status === 'pago'
  /** Indica recorrência ou parcela; usado para exibir ícone de repetição */
  tipoRecorrencia?: TipoRecorrencia;
  /** Total de parcelas (parcelado) ou meses projetados (fixo_mensal) */
  parcelas?: number;
  /** ID do primeiro lançamento do grupo (parcelado/fixo); presente nas parcelas/projeções */
  idPai?: string;
  /** Número da parcela (1-based) quando parcelado */
  parcelaNumero?: number;
  /** Metadados de integração Comercial -> Financeiro */
  leadIdOrigem?: string;
  /** Linha da proposta (LeadSolucao) à qual este lançamento está vinculado */
  leadSolucaoId?: string;
  formaPagamento?: string;
  condicoesPagamento?: string;
  prazoDias?: number;
  contaId?: string;
  categoriaId?: string;
  meioPagamentoId?: string;
  registroCriadoPorNome?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type FinanceiroConta = {
  id: string;
  nome: string;
  saldoInicial: number;
  padrao: boolean;
  ativo: boolean;
  ordem: number;
};

export type FinanceiroCategoriaTipo = "entrada" | "saida" | "ambos";

export type FinanceiroCategoria = {
  id: string;
  nome: string;
  tipo: FinanceiroCategoriaTipo;
  ativo: boolean;
  ordem: number;
};

export type FinanceiroMeioPagamento = {
  id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
};
