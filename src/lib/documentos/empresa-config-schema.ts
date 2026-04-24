/** Tipos e normalização compartilhados (seguros para import em Client Components). */

export const EMPRESA_DOCUMENTO_CHAVE = "empresa_documento";

export type DocumentoLayoutModo = "none" | "background" | "header_footer" | "hybrid";

export type EmpresaDocumentoConfig = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  telefone: string;
  email: string;
  site: string;
  endereco: string;
  logoUrl: string;
  cabecalhoPadraoHtml: string;
  rodapePadraoHtml: string;
  layoutModo: DocumentoLayoutModo;
  papelTimbradoUrl: string;
  papelTimbradoOpacity: number;
  margemTopMm: number;
  margemRightMm: number;
  margemBottomMm: number;
  margemLeftMm: number;
  headerHeightMm: number;
  footerHeightMm: number;
};
const MAX_MARGIN_MM = 120;

function coerceNumber(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function emptyEmpresaDocumentoConfig(): EmpresaDocumentoConfig {
  return {
    razaoSocial: "",
    nomeFantasia: "",
    cnpj: "",
    telefone: "",
    email: "",
    site: "",
    endereco: "",
    logoUrl: "",
    cabecalhoPadraoHtml: "",
    rodapePadraoHtml: "",
    layoutModo: "none",
    papelTimbradoUrl: "",
    papelTimbradoOpacity: 0.12,
    margemTopMm: 12,
    margemRightMm: 12,
    margemBottomMm: 12,
    margemLeftMm: 12,
    headerHeightMm: 28,
    footerHeightMm: 22,
  };
}

export function normalizeEmpresaDocumentoConfig(raw: unknown): EmpresaDocumentoConfig {
  const base = emptyEmpresaDocumentoConfig();
  if (!raw) return base;

  let source: unknown = raw;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return base;
    }
  }

  if (typeof source !== "object") return base;
  const o = source as Record<string, unknown>;
  const layoutModoRaw = String(o.layoutModo ?? "").trim();
  const layoutModo: DocumentoLayoutModo =
    layoutModoRaw === "background" ||
    layoutModoRaw === "header_footer" ||
    layoutModoRaw === "hybrid"
      ? layoutModoRaw
      : "none";

  return {
    razaoSocial: String(o.razaoSocial ?? "").trim(),
    nomeFantasia: String(o.nomeFantasia ?? "").trim(),
    cnpj: String(o.cnpj ?? "").trim(),
    telefone: String(o.telefone ?? "").trim(),
    email: String(o.email ?? "").trim(),
    site: String(o.site ?? "").trim(),
    endereco: String(o.endereco ?? "").trim(),
    logoUrl: String(o.logoUrl ?? "").trim(),
    cabecalhoPadraoHtml: String(o.cabecalhoPadraoHtml ?? ""),
    rodapePadraoHtml: String(o.rodapePadraoHtml ?? ""),
    layoutModo,
    papelTimbradoUrl: String(o.papelTimbradoUrl ?? "").trim(),
    papelTimbradoOpacity: clamp(coerceNumber(o.papelTimbradoOpacity, base.papelTimbradoOpacity), 0, 1),
    margemTopMm: clamp(coerceNumber(o.margemTopMm, base.margemTopMm), 0, MAX_MARGIN_MM),
    margemRightMm: clamp(coerceNumber(o.margemRightMm, base.margemRightMm), 0, MAX_MARGIN_MM),
    margemBottomMm: clamp(coerceNumber(o.margemBottomMm, base.margemBottomMm), 0, MAX_MARGIN_MM),
    margemLeftMm: clamp(coerceNumber(o.margemLeftMm, base.margemLeftMm), 0, MAX_MARGIN_MM),
    headerHeightMm: clamp(coerceNumber(o.headerHeightMm, base.headerHeightMm), 0, 60),
    footerHeightMm: clamp(coerceNumber(o.footerHeightMm, base.footerHeightMm), 0, 60),
  };
}
