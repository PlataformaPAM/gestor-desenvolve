export type ComissaoBaseCalculo = "bruto" | "liquido";

export type ComissaoStatus = "prevista" | "elegivel" | "aprovada" | "paga" | "cancelada_tecnica";

export type ComissaoRegra = {
  id: string;
  consultorId: string;
  consultorNome?: string;
  solucaoCatalogoId?: string;
  solucaoNome?: string;
  categoriaSolucao?: string;
  baseCalculo: ComissaoBaseCalculo;
  percentualComissao: number;
  /** Com base líquida: percentual (0–100) descontado do bruto antes da comissão. Com base bruta: omitido. */
  despesaFixa?: number;
  vigenciaInicio: string;
  vigenciaFim?: string;
  ativo: boolean;
  prioridade: number;
  observacoes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ComissaoParticipacaoVenda = {
  id: string;
  leadId: string;
  leadSolucaoId?: string;
  consultorId: string;
  consultorNome?: string;
  percentualParticipacao: number;
  ativo: boolean;
  observacoes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ComissaoEvento = {
  id: string;
  status: ComissaoStatus;
  competenciaAno: number;
  competenciaMes: number;
  dataRecebimento: string;
  origemLancamentoId: string;
  leadId: string;
  leadNome?: string;
  leadSolucaoId?: string;
  solucaoNome?: string;
  consultorId: string;
  consultorNome?: string;
  regraId?: string;
  participacaoId?: string;
  lotePagamentoId?: string;
  baseCalculo: ComissaoBaseCalculo;
  percentualComissao: number;
  percentualParticipacao: number;
  /** Snapshot da regra: com base líquida, percentual (0–100) sobre o bruto. */
  despesaFixa?: number;
  valorBase: number;
  valorComissao: number;
  observacao?: string;
  aprovadoEm?: string;
  pagoEm?: string;
  canceladoEm?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ComissaoResumo = {
  previsto: number;
  elegivel: number;
  aprovado: number;
  pago: number;
};

