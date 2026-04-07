import type { Cliente, PapelContatoCliente } from "./types";

export const PAPEIS_CONTATO_CLIENTE: { value: PapelContatoCliente; label: string }[] = [
  { value: "gestor_principal", label: "Gestor Principal" },
  { value: "gestor_contrato", label: "Gestor do Contrato" },
  { value: "gestor_financeiro", label: "Gestor Financeiro" },
  { value: "tecnico", label: "Técnico" },
  { value: "operador", label: "Operador" },
];

export const SEGMENTO_LABELS: Record<Cliente["segmento"], string> = {
  varejo: "Varejo",
  industria: "Indústria",
  servicos: "Serviços",
  tecnologia: "Tecnologia",
  outros: "Outros",
};

export const STATUS_LABELS: Record<Cliente["status"], string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  inadimplente: "Inadimplente",
};
