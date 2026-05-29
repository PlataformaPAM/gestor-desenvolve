/** Utilitários de texto em português (BR) para nomes próprios e endereços. */

export function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Remove acentos (comparação / busca). */
export function stripPortugueseAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

export function accentKey(value: string): string {
  return stripPortugueseAccents(value).toLowerCase();
}

/** Preposições e artigos que permanecem em minúsculas (exceto início). */
const PREPOSITIONS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "na",
  "no",
  "nas",
  "nos",
  "a",
  "o",
  "as",
  "os",
  "para",
  "por",
  "com",
  "sem",
  "ate",
  "até",
  "após",
  "apos",
  "à",
  "às",
  "ao",
  "aos",
]);

/** Siglas jurídicas comuns em razão social. */
const UPPERCASE_LEGAL = new Set(["me", "epp", "eireli", "ss", "sa", "s/s", "s.a.", "s/a"]);

/** Palavras frequentes em cadastros públicos / endereços (sem acento digitado). */
const WORD_CANONICAL: Record<string, string> = {
  municipio: "Município",
  prefeitura: "Prefeitura",
  municipal: "Municipal",
  estadual: "Estadual",
  federal: "Federal",
  secretaria: "Secretaria",
  camara: "Câmara",
  fundacao: "Fundação",
  associacao: "Associação",
  organizacao: "Organização",
  administracao: "Administração",
  educacao: "Educação",
  saude: "Saúde",
  agricola: "Agrícola",
  industria: "Indústria",
  servicos: "Serviços",
  tecnologia: "Tecnologia",
  cooperativa: "Cooperativa",
  consorcio: "Consórcio",
  instituto: "Instituto",
  universidade: "Universidade",
  hospital: "Hospital",
  unidade: "Unidade",
  regiao: "Região",
  distrito: "Distrito",
  bairro: "Bairro",
  sao: "São",
  santo: "Santo",
  santa: "Santa",
  jose: "José",
  joao: "João",
  luis: "Luís",
  antonio: "Antônio",
  marilia: "Marília",
  brasilia: "Brasília",
  goias: "Goiás",
  parana: "Paraná",
  cuiaba: "Cuiabá",
  florianopolis: "Florianópolis",
  curitiba: "Curitiba",
  ribeirao: "Ribeirão",
  pocos: "Poços",
  maceio: "Maceió",
  brasileiro: "Brasileiro",
  brasileira: "Brasileira",
};

function formatLegalToken(lower: string): string {
  if (lower === "ltda" || lower === "ltda.") return "Ltda.";
  if (lower === "sa" || lower === "s.a.") return "S.A.";
  if (lower === "s/a" || lower === "s/s") return lower.toUpperCase();
  if (UPPERCASE_LEGAL.has(lower)) return lower.toUpperCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function formatWordToken(token: string, wordIndex: number): string {
  const lower = token.toLowerCase();
  const canonical = WORD_CANONICAL[lower];
  if (canonical) return canonical;
  if (lower === "ltda" || lower === "ltda.") return "Ltda.";
  if (UPPERCASE_LEGAL.has(lower)) return formatLegalToken(lower);
  if (wordIndex > 0 && PREPOSITIONS.has(lower)) return lower;
  if (/^\d+$/.test(token)) return token;
  if (token.length <= 1) return token.toUpperCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Converte texto livre para formato de nome próprio em português:
 * caixa mista, preposições em minúscula, siglas jurídicas e palavras comuns corrigidas.
 */
export function toPortugueseTitleCase(value: string): string {
  const collapsed = collapseWhitespace(value);
  if (!collapsed) return "";

  return collapsed
    .split(/\s+/)
    .map((word, wordIndex) =>
      word
        .split("-")
        .map((part) => formatWordToken(part, wordIndex))
        .join("-")
    )
    .join(" ");
}

export function normalizeProperName(value: string | undefined | null): string {
  if (!value?.trim()) return "";
  return toPortugueseTitleCase(value);
}

export function normalizeEmail(value: string | undefined | null): string {
  return collapseWhitespace(value ?? "").toLowerCase();
}

export function normalizeUf(value: string | undefined | null): string {
  return collapseWhitespace(value ?? "")
    .toUpperCase()
    .slice(0, 2);
}

export function normalizeCep(value: string | undefined | null): string {
  const digits = (value ?? "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export type InstitutionalPrefix = {
  pattern: RegExp;
  label: string;
};

/** Prefixos típicos de órgãos municipais (após title case). */
export const INSTITUTIONAL_PREFIXES: InstitutionalPrefix[] = [
  { pattern: /^Município de (.+)$/i, label: "Município de" },
  { pattern: /^Prefeitura Municipal de (.+)$/i, label: "Prefeitura Municipal de" },
  { pattern: /^Prefeitura de (.+)$/i, label: "Prefeitura de" },
  { pattern: /^Câmara Municipal de (.+)$/i, label: "Câmara Municipal de" },
];

export function extractInstitutionalCityPart(titleCasedName: string): {
  label: string;
  cityPart: string;
} | null {
  for (const { pattern, label } of INSTITUTIONAL_PREFIXES) {
    const match = titleCasedName.match(pattern);
    if (match?.[1]?.trim()) {
      return { label, cityPart: collapseWhitespace(match[1]) };
    }
  }
  return null;
}

export function applyInstitutionalCityName(
  titleCasedName: string,
  officialCityName: string
): string {
  const parsed = extractInstitutionalCityPart(titleCasedName);
  if (!parsed) return titleCasedName;
  return `${parsed.label} ${officialCityName}`;
}

/** Compara nomes de município ignorando acentos e caixa. */
export function municipalityNamesMatch(a: string, b: string): boolean {
  return accentKey(a) === accentKey(b);
}
