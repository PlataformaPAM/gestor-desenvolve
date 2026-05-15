import type { ModuloPermissao } from "./types";

export const MODULOS: ModuloPermissao[] = [
  "comercial",
  "financeiro",
  "tarefas",
  "clientes",
  "contratos",
  "helpdesk",
  "posVenda",
  "solucoes",
  "rh",
  "configuracoes",
  "relatorios",
  "configuracoes_construtor_documentos",
  "configuracoes_logs",
  "configuracoes_perfis",
  "configuracoes_usuarios",
  "portal_cliente",
];

export const MODULO_LABELS: Record<ModuloPermissao, string> = {
  comercial: "Comercial",
  financeiro: "Financeiro",
  tarefas: "Tarefas",
  clientes: "Clientes",
  contratos: "Contratos",
  helpdesk: "Suporte",
  posVenda: "Pós-venda",
  solucoes: "Soluções",
  rh: "RH e Parceiros",
  configuracoes: "Configurações",
  relatorios: "Relatórios",
  configuracoes_construtor_documentos: "Configurações > Construtor de Documentos",
  configuracoes_logs: "Configurações > Logs do Sistema",
  configuracoes_perfis: "Configurações > Perfis de Acesso",
  configuracoes_usuarios: "Configurações > Usuários",
  portal_cliente: "Portal do Cliente",
};

