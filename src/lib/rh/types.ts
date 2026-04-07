import type { Contato } from "@/lib/clientes/types";

export type TipoContrato =
  | "clt"
  | "pj"
  | "estagio"
  | "parceiro"
  | "fornecedor";

export type StatusColaborador = "ativo" | "inativo" | "ferias" | "afastado";

/** Tab: Equipe Interna | Vendedores/Externos | Fornecedores/Parceiros */
export type TipoPessoaRH = "equipe_interna" | "vendedor_externo" | "fornecedor_parceiro";

export type DadosBancarios = {
  banco?: string;
  agencia?: string;
  conta?: string;
  tipoConta?: "corrente" | "poupanca";
  pix?: string;
};

export type ColaboradorParceiro = {
  id: string;
  nome: string;
  cargoOuFuncao: string;
  tipoContrato: TipoContrato;
  status: StatusColaborador;
  tipo: TipoPessoaRH;
  email?: string;
  telefone?: string;
  cpfCnpj?: string;
  dadosBancarios?: DadosBancarios;
  /** URL ou nome do documento */
  documentos?: { nome: string; url?: string }[];
  /** Total de vendas do mês (para vendedores) */
  totalVendasMes?: number;
  /** Último acesso ao sistema (ISO); exibido na tabela */
  ultimoAcesso?: string;
  /** Contatos do fornecedor (mesmos campos da aba Contatos em Clientes) */
  contatos?: Contato[];
};
