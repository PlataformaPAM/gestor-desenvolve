import type { ModuloPermissao } from "@/lib/configuracoes/types";

/**
 * Módulos que perfis criados no Portal do Cliente podem conceder.
 * Deve coincidir com os itens da sidebar do cliente que declaram `modulo`
 * (Portal, Suporte → helpdesk; Usuários → configuracoes).
 */
export const PORTAL_CLIENTE_PERFIL_MODULOS: ModuloPermissao[] = ["helpdesk", "configuracoes"];

/** Rótulos amigáveis no formulário de perfil do portal (alinhados à navegação). */
export const PORTAL_CLIENTE_PERFIL_LABELS: Partial<Record<ModuloPermissao, string>> = {
  helpdesk: "Suporte",
  configuracoes: "Usuários",
};
