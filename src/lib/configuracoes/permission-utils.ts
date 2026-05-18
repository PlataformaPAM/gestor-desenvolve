import type { ModuloPermissao } from "@/lib/configuracoes/types";

export const DB_PERMISSION_MODULES = [
  "comercial",
  "financeiro",
  "tarefas",
  "clientes",
  "helpdesk",
  "posVenda",
  "rh",
  "configuracoes",
] as const satisfies readonly ModuloPermissao[];

export const CONFIGURACOES_CHILD_KEYS = [
  "configuracoes_construtor_documentos",
  "configuracoes_logs",
  "configuracoes_perfis",
  "configuracoes_usuarios",
] as const satisfies readonly ModuloPermissao[];

export const EXTRA_PERMISSION_KEYS = [
  "relatorios",
  "contratos",
  "solucoes",
  ...CONFIGURACOES_CHILD_KEYS,
  "portal_cliente",
] as const satisfies readonly ModuloPermissao[];

export function buildDefaultPermissoes(): Record<ModuloPermissao, boolean> {
  return {
    comercial: false,
    financeiro: false,
    tarefas: false,
    clientes: false,
    contratos: false,
    helpdesk: false,
    posVenda: false,
    solucoes: false,
    rh: false,
    configuracoes: false,
    relatorios: false,
    configuracoes_construtor_documentos: false,
    configuracoes_logs: false,
    configuracoes_perfis: false,
    configuracoes_usuarios: false,
    portal_cliente: false,
  };
}

export function withDerivedConfiguracoes(
  permisssoesParciais: Partial<Record<ModuloPermissao, boolean>>
): Record<ModuloPermissao, boolean> {
  const merged = { ...buildDefaultPermissoes(), ...permisssoesParciais };
  // Mantém tudo estritamente individual por decisão de produto.
  return merged;
}

export function isAdminProfileName(perfilNome: string): boolean {
  const nome = perfilNome.trim().toLowerCase();
  if (!nome) return false;
  if (nome === "administrador" || nome === "admin") return true;
  return nome.includes("administrador") || /\badmin\b/.test(nome);
}

export function withAdminOverride(
  permissoes: Partial<Record<ModuloPermissao, boolean>>,
  perfilNome: string
): Record<ModuloPermissao, boolean> {
  const merged = withDerivedConfiguracoes(permissoes);
  if (!isAdminProfileName(perfilNome)) return merged;
  return Object.fromEntries(
    Object.keys(merged).map((key) => [key, true])
  ) as Record<ModuloPermissao, boolean>;
}
