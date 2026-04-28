import type { ModuloPermissao } from "./types";

export const MODULOS: ModuloPermissao[] = [
  "comercial",
  "financeiro",
  "tarefas",
  "clientes",
  "helpdesk",
  "posVenda",
  "rh",
  "configuracoes",
];

export const MODULO_LABELS: Record<ModuloPermissao, string> = {
  comercial: "Comercial",
  financeiro: "Financeiro",
  tarefas: "Tarefas",
  clientes: "Clientes",
  helpdesk: "Suporte",
  posVenda: "Pós-venda",
  rh: "RH e Parceiros",
  configuracoes: "Configurações",
};

