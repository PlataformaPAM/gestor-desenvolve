export const TAREFA_CATEGORIAS = [
  "Administrativo",
  "Assessoria",
  "Atualizar Indicadores",
  "Capacitação",
  "Comercial",
  "Consultoria",
  "Dúvida",
  "Financeiro",
  "GesConselho",
  "GesPlanos",
  "GestorAlerta",
  "InfoPolis",
  "Marketing",
  "Material de Apoio",
  "Outro",
  "Painél Regional",
  "Reformulação Portal",
  "Suporte",
] as const;

export type CategoriaTarefa = (typeof TAREFA_CATEGORIAS)[number];

const CATEGORY_PREFIX = "[CATEGORIA:";

export function composeDescricaoWithCategoria(
  descricao: string | null | undefined,
  categoria: string | null | undefined
): string | null {
  const cleanDescricao = (descricao ?? "").trim();
  const cleanCategoria = (categoria ?? "").trim();
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
  const categoria = raw.slice(CATEGORY_PREFIX.length, closing).trim();
  const texto = raw.slice(closing + 1).trim();
  return {
    descricao: texto || undefined,
    categoria: categoria || undefined,
  };
}
