export const TAREFA_CATEGORIAS = [
  "Administrativo",
  "Atualizar indicadores",
  "Comercial",
  "Dúvida",
  "Financeiro",
  "Marketing",
  "Material de apoio",
  "Outra",
  "Problemas técnicos",
  "Suporte",
] as const;

export type CategoriaTarefa = (typeof TAREFA_CATEGORIAS)[number];

const CATEGORY_PREFIX = "[CATEGORIA:";

/** Normaliza categorias legadas para o catálogo atual. */
export function normalizeCategoriaTarefa(value: string | null | undefined): string | undefined {
  const raw = (value ?? "").trim();
  if (!raw) return undefined;
  const aliases: Record<string, CategoriaTarefa> = {
    "Atualizar Indicadores": "Atualizar indicadores",
    "Material de Apoio": "Material de apoio",
    Outro: "Outra",
    Assessoria: "Administrativo",
    Capacitação: "Administrativo",
    Consultoria: "Comercial",
    GesConselho: "Administrativo",
    GesPlanos: "Administrativo",
    GestorAlerta: "Administrativo",
    InfoPolis: "Administrativo",
    "Painél Regional": "Marketing",
    "Reformulação Portal": "Marketing",
    "Reformulação Portais": "Marketing",
  };
  if ((TAREFA_CATEGORIAS as readonly string[]).includes(raw)) return raw;
  return aliases[raw] ?? raw;
}

export function composeDescricaoWithCategoria(
  descricao: string | null | undefined,
  categoria: string | null | undefined
): string | null {
  const cleanDescricao = (descricao ?? "").trim();
  const cleanCategoria = normalizeCategoriaTarefa(categoria) ?? (categoria ?? "").trim();
  if (!cleanCategoria) return cleanDescricao || null;
  return `${CATEGORY_PREFIX}${cleanCategoria}]${cleanDescricao ? ` ${cleanDescricao}` : ""}`;
}

export function splitDescricaoCategoria(descricao: string | null | undefined): {
  descricao: string | undefined;
  categoria: string | undefined;
} {
  const raw = (descricao ?? "").trim();
  if (!raw.startsWith(CATEGORY_PREFIX)) {
    return { descricao: raw || undefined, categoria: undefined };
  }
  const closing = raw.indexOf("]");
  if (closing < 0) return { descricao: raw || undefined, categoria: undefined };
  const categoriaRaw = raw.slice(CATEGORY_PREFIX.length, closing).trim();
  const texto = raw.slice(closing + 1).trim();
  return {
    descricao: texto || undefined,
    categoria: normalizeCategoriaTarefa(categoriaRaw) ?? (categoriaRaw || undefined),
  };
}
