import type { ColaboradorParceiro } from "./types";

export const TIPO_CONTRATO_LABELS: Record<ColaboradorParceiro["tipoContrato"], string> = {
  clt: "CLT",
  pj: "PJ",
  estagio: "Estágio",
  parceiro: "Parceiro",
  fornecedor: "Fornecedor",
};

export const STATUS_LABELS: Record<ColaboradorParceiro["status"], string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  ferias: "Férias",
  afastado: "Afastado",
};

export const TIPO_PESSOA_LABELS: Record<ColaboradorParceiro["tipo"], string> = {
  equipe_interna: "Equipe Interna",
  vendedor_externo: "Vendedor/Externo",
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
