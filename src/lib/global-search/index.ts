import {
  canViewResourceClient,
  type ClientAuthSession,
} from "@/lib/configuracoes/permission-client";

export type SearchModule = "clientes" | "comercial" | "tarefas";

export type SearchResultItem = {
  id: string;
  modulo: SearchModule;
  label: string;
  href: string;
};

export type GroupedSearchResults = {
  clientes: SearchResultItem[];
  comercial: SearchResultItem[];
  tarefas: SearchResultItem[];
};

const SEARCH_MODULE_RESOURCES: Record<SearchModule, string> = {
  clientes: "clientes.cadastro",
  comercial: "comercial.pipeline",
  tarefas: "tarefas.internas",
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function matchQuery(text: string, query: string): boolean {
  if (!query.trim()) return false;
  return normalize(text).includes(normalize(query));
}

function canSearchModule(session: ClientAuthSession, modulo: SearchModule): boolean {
  return canViewResourceClient(session, SEARCH_MODULE_RESOURCES[modulo]);
}

/**
 * Busca global com regra de segurança: só procura e retorna resultados
 * de módulos para os quais o usuário tem permissão granular (Ver).
 */
export function globalSearch(
  query: string,
  session: ClientAuthSession
): GroupedSearchResults {
  const q = query.trim();
  const results: GroupedSearchResults = {
    clientes: [],
    comercial: [],
    tarefas: [],
  };

  if (!q) return results;

  // Busca global com dados reais será implementada em endpoint dedicado.
  // Enquanto isso, retornamos vazio para evitar resultados inconsistentes.
  if (canSearchModule(session, "clientes") && matchQuery("clientes", q)) results.clientes = [];
  if (canSearchModule(session, "comercial") && matchQuery("comercial", q)) results.comercial = [];
  if (canSearchModule(session, "tarefas") && matchQuery("tarefas", q)) results.tarefas = [];

  return results;
}

/** Retorna lista plana de todos os itens (para navegação por índice). */
export function flattenResults(
  grouped: GroupedSearchResults
): SearchResultItem[] {
  return [
    ...grouped.clientes,
    ...grouped.comercial,
    ...grouped.tarefas,
  ];
}
