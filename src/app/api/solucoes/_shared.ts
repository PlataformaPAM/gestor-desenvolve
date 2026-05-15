import type { SolucaoCatalogo } from "@prisma/client";

const META_MARKER = "[SOLUCAO_META]";

type SolucaoMeta = {
  categoria?: string;
  tipo?: "produto" | "servico";
  /** Legado: `anual` foi substituído por `parcelado`. */
  recorrencia?: "mensal" | "unica" | "anual" | "parcelado";
  parcelasPadrao?: number;
  regrasContrato?: string;
  logoUrl?: string;
  playbook?: unknown[];
};

export type SolucaoFront = {
  id: string;
  nome: string;
  descricaoTecnica: string;
  categoria: string;
  tipo: "produto" | "servico";
  valorVenda: number;
  recorrencia: "mensal" | "unica" | "parcelado";
  /** Número de parcelas sugeridas quando `recorrencia === "parcelado"` (mín. 2). */
  parcelasPadrao: number;
  regrasContrato: string;
  logoUrl?: string;
  playbook: unknown[];
  ativo?: boolean;
};

function decodeMeta(descricao?: string | null): { descricaoTecnica: string; meta: SolucaoMeta } {
  const raw = (descricao || "").trim();
  if (!raw.startsWith(META_MARKER)) return { descricaoTecnica: raw, meta: {} };
  const end = raw.indexOf("\n");
  const metaRaw = end >= 0 ? raw.slice(META_MARKER.length, end) : raw.slice(META_MARKER.length);
  const desc = end >= 0 ? raw.slice(end + 1) : "";
  try {
    return { descricaoTecnica: desc, meta: JSON.parse(metaRaw) as SolucaoMeta };
  } catch {
    return { descricaoTecnica: desc, meta: {} };
  }
}

function normalizeRecorrenciaMeta(meta: SolucaoMeta): {
  recorrencia: SolucaoFront["recorrencia"];
  parcelasPadrao: number;
} {
  const r = meta.recorrencia;
  const pad = meta.parcelasPadrao;
  const parcelas = pad != null && pad >= 2 ? Math.min(60, Math.floor(pad)) : 12;
  if (r === "anual" || r === "parcelado") {
    return { recorrencia: "parcelado", parcelasPadrao: parcelas };
  }
  if (r === "mensal") return { recorrencia: "mensal", parcelasPadrao: 1 };
  return { recorrencia: "unica", parcelasPadrao: 1 };
}

export function encodeDescricao(descricaoTecnica: string, meta: SolucaoMeta): string {
  const { recorrencia, parcelasPadrao } = normalizeRecorrenciaMeta(meta);
  const out: SolucaoMeta = {
    categoria: meta.categoria,
    tipo: meta.tipo,
    recorrencia,
    parcelasPadrao: recorrencia === "parcelado" ? parcelasPadrao : undefined,
    regrasContrato: meta.regrasContrato,
    logoUrl: meta.logoUrl,
    playbook: meta.playbook,
  };
  return `${META_MARKER}${JSON.stringify(out)}\n${descricaoTecnica || ""}`.trim();
}

/**
 * Categoria usada em regras e filtros: coluna `SolucaoCatalogo.categoria` (preferencial) ou legado em `[SOLUCAO_META]` na descrição.
 */
export function categoriaEfetivaSolucaoCatalogo(
  s: Pick<SolucaoCatalogo, "descricao" | "categoria">
): string {
  const col = (s.categoria ?? "").trim();
  if (col) return col;
  const parsed = decodeMeta(s.descricao);
  return (parsed.meta.categoria ?? "").trim();
}

export function mapSolucao(s: SolucaoCatalogo): SolucaoFront {
  const parsed = decodeMeta(s.descricao);
  const { recorrencia, parcelasPadrao } = normalizeRecorrenciaMeta(parsed.meta);
  return {
    id: s.id,
    nome: s.nome,
    descricaoTecnica: parsed.descricaoTecnica,
    categoria: categoriaEfetivaSolucaoCatalogo(s),
    tipo: parsed.meta.tipo || "servico",
    valorVenda: s.valorBase || 0,
    recorrencia,
    parcelasPadrao,
    regrasContrato: parsed.meta.regrasContrato || "",
    logoUrl: parsed.meta.logoUrl || "",
    playbook: parsed.meta.playbook || [],
    ativo: s.ativa,
  };
}
