import { prisma } from "@/lib/prisma";
import {
  emptyEmpresaDocumentoConfig,
  type DocumentoLayoutModo,
  type EmpresaDocumentoConfig,
} from "@/lib/documentos/empresa-config-schema";

export const DOCUMENTO_TIMBRES_CHAVE = "documento_timbres";
const MAX_MARGIN_MM = 120;

function normalizeLegacyUploadUrl(raw: string): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (value.startsWith("/uploads/documentos-timbres/")) {
    const filename = value.slice("/uploads/documentos-timbres/".length);
    return `/api/uploads/documentos-timbres/${filename}`;
  }
  return value;
}

export type DocumentoTimbreItem = {
  id: string;
  nome: string;
  url: string;
  createdAt: string;
  ativo: boolean;
  renderConfig: DocumentoTimbreRenderConfig;
};

export type DocumentoTimbreRenderConfig = Pick<
  EmpresaDocumentoConfig,
  | "layoutModo"
  | "papelTimbradoUrl"
  | "papelTimbradoOpacity"
  | "margemTopMm"
  | "margemRightMm"
  | "margemBottomMm"
  | "margemLeftMm"
  | "headerHeightMm"
  | "footerHeightMm"
  | "cabecalhoPadraoHtml"
  | "rodapePadraoHtml"
>;

export type DocumentoTimbresConfig = {
  items: DocumentoTimbreItem[];
  modeloTimbreById: Record<string, string>;
};

type ConfiguracaoSistemaDelegate = {
  findUnique?: (args: { where: { chave: string }; select: { valor: true } }) => Promise<{ valor: unknown } | null>;
  upsert?: (args: {
    where: { chave: string };
    create: { chave: string; valor: DocumentoTimbresConfig };
    update: { valor: DocumentoTimbresConfig };
  }) => Promise<unknown>;
};

type PrismaMaybeWithConfig = {
  configuracaoSistema?: ConfiguracaoSistemaDelegate;
};

function emptyConfig(): DocumentoTimbresConfig {
  return {
    items: [],
    modeloTimbreById: {},
  };
}

function normalizeItem(raw: unknown): DocumentoTimbreItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? "").trim();
  const url = normalizeLegacyUploadUrl(String(r.url ?? "").trim());
  if (!id || !url) return null;
  return {
    id,
    nome: String(r.nome ?? "").trim() || id,
    url,
    createdAt: String(r.createdAt ?? new Date().toISOString()),
    ativo: r.ativo === undefined ? true : Boolean(r.ativo),
    renderConfig: normalizeRenderConfig(r.renderConfig, url),
  };
}

function coerceNumber(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeLayoutModo(raw: unknown): DocumentoLayoutModo {
  const layoutModoRaw = String(raw ?? "").trim();
  return layoutModoRaw === "background" || layoutModoRaw === "header_footer" || layoutModoRaw === "hybrid"
    ? layoutModoRaw
    : "background";
}

function normalizeRenderConfig(raw: unknown, timbreUrlDefault: string): DocumentoTimbreRenderConfig {
  const base = emptyEmpresaDocumentoConfig();
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const layoutModo = normalizeLayoutModo(source.layoutModo);
  const papelTimbradoUrl = normalizeLegacyUploadUrl(String(source.papelTimbradoUrl ?? "").trim()) || timbreUrlDefault;
  return {
    layoutModo,
    papelTimbradoUrl,
    papelTimbradoOpacity: clamp(coerceNumber(source.papelTimbradoOpacity, base.papelTimbradoOpacity), 0, 1),
    margemTopMm: clamp(coerceNumber(source.margemTopMm, base.margemTopMm), 0, MAX_MARGIN_MM),
    margemRightMm: clamp(coerceNumber(source.margemRightMm, base.margemRightMm), 0, MAX_MARGIN_MM),
    margemBottomMm: clamp(coerceNumber(source.margemBottomMm, base.margemBottomMm), 0, MAX_MARGIN_MM),
    margemLeftMm: clamp(coerceNumber(source.margemLeftMm, base.margemLeftMm), 0, MAX_MARGIN_MM),
    headerHeightMm: clamp(coerceNumber(source.headerHeightMm, base.headerHeightMm), 0, 60),
    footerHeightMm: clamp(coerceNumber(source.footerHeightMm, base.footerHeightMm), 0, 60),
    cabecalhoPadraoHtml: String(source.cabecalhoPadraoHtml ?? ""),
    rodapePadraoHtml: String(source.rodapePadraoHtml ?? ""),
  };
}

function normalizeConfig(raw: unknown): DocumentoTimbresConfig {
  if (!raw) return emptyConfig();
  let source: unknown = raw;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return emptyConfig();
    }
  }
  if (!source || typeof source !== "object") return emptyConfig();
  const obj = source as Record<string, unknown>;
  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  const items = rawItems.map(normalizeItem).filter((x): x is DocumentoTimbreItem => Boolean(x));
  const mapping = obj.modeloTimbreById && typeof obj.modeloTimbreById === "object" ? obj.modeloTimbreById : {};
  const modeloTimbreById: Record<string, string> = {};
  for (const [k, v] of Object.entries(mapping as Record<string, unknown>)) {
    const key = String(k).trim();
    const value = String(v ?? "").trim();
    if (key && value) modeloTimbreById[key] = value;
  }
  return { items, modeloTimbreById };
}

export async function getDocumentoTimbresConfig(): Promise<DocumentoTimbresConfig> {
  const db = prisma as unknown as PrismaMaybeWithConfig;
  if (db.configuracaoSistema?.findUnique) {
    const row = await db.configuracaoSistema.findUnique({
      where: { chave: DOCUMENTO_TIMBRES_CHAVE },
      select: { valor: true },
    });
    return normalizeConfig(row?.valor ?? null);
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ valor: unknown }>>`
      SELECT "valor"
      FROM "ConfiguracaoSistema"
      WHERE "chave" = ${DOCUMENTO_TIMBRES_CHAVE}
      LIMIT 1
    `;
    return normalizeConfig(rows[0]?.valor ?? null);
  } catch {
    return emptyConfig();
  }
}

export async function saveDocumentoTimbresConfig(config: DocumentoTimbresConfig): Promise<void> {
  const db = prisma as unknown as PrismaMaybeWithConfig;
  if (db.configuracaoSistema?.upsert) {
    await db.configuracaoSistema.upsert({
      where: { chave: DOCUMENTO_TIMBRES_CHAVE },
      create: { chave: DOCUMENTO_TIMBRES_CHAVE, valor: config },
      update: { valor: config },
    });
    return;
  }
  const json = JSON.stringify(config);
  await prisma.$executeRaw`
    INSERT INTO "ConfiguracaoSistema" ("id", "chave", "valor", "createdAt", "updatedAt")
    VALUES ('cfg_documento_timbres', ${DOCUMENTO_TIMBRES_CHAVE}, ${json}::jsonb, NOW(), NOW())
    ON CONFLICT ("chave")
    DO UPDATE SET "valor" = EXCLUDED."valor", "updatedAt" = NOW()
  `;
}

