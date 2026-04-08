import type { ColaboradorParceiro, TipoContrato } from "./types";

export const TIPO_CONTRATO_LABELS: Record<ColaboradorParceiro["tipoContrato"], string> = {
  clt: "CLT",
  pj: "PJ",
  estagio: "Estágio",
  parceiro: "Parceiro",
  fornecedor: "Fornecedor",
  socio: "Sócio",
  consultor: "Consultor",
  especialista: "Especialista",
  vendedor: "Vendedor",
  prestador_servico: "Prestador de Serviço",
  profissional_liberal: "Profissional Liberal",
};

/** Ordem alfabética por rótulo em pt-BR (aba Consultores / modal B2B consultor). */
export const TIPO_CONTRATO_OPCOES_CONSULTOR: TipoContrato[] = [
  "consultor",
  "especialista",
  "parceiro",
  "pj",
  "vendedor",
];

/** Ordem alfabética por rótulo em pt-BR (aba Fornecedores / modal B2B fornecedor). */
export const TIPO_CONTRATO_OPCOES_FORNECEDOR: TipoContrato[] = [
  "fornecedor",
  "parceiro",
  "pj",
  "prestador_servico",
  "profissional_liberal",
];

export const STATUS_LABELS: Record<ColaboradorParceiro["status"], string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  ferias: "Férias",
  afastado: "Afastado",
};

export const TIPO_PESSOA_LABELS: Record<ColaboradorParceiro["tipo"], string> = {
  equipe_interna: "Equipe",
  vendedor_externo: "Consultor",
  fornecedor_parceiro: "Fornecedor/Parceiro",
};

export function iniciais(nome: string): string {
  return nome
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
