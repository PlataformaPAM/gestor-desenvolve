import type { ComponentType, CSSProperties } from "react";
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Barcode,
  Circle,
  CreditCard,
  FileText,
  GitCompareArrows,
  Landmark,
  PiggyBank,
  ScanLine,
  Wallet,
} from "lucide-react";

export type VisualKind = "conta" | "categoria" | "meio";

/** Metadados visuais locais (localStorage) para contas — apenas ícones genéricos + cor escolhida. */
export type VisualMeta = {
  icon: string;
  color: string;
  presetId?: string;
};

export type ContaPreset = {
  id: string;
  label: string;
  icon: string;
  /** Cor sugerida ao selecionar o preset (o usuário pode alterar na paleta). */
  defaultColor: string;
};

/** Apenas ícones genéricos (sem logos de bancos / SVG externos). */
export const CONTA_PRESETS: ContaPreset[] = [
  { id: "carteira", label: "Carteira", icon: "wallet", defaultColor: "#64748B" },
  { id: "cofrinho", label: "Cofrinho", icon: "piggy-bank", defaultColor: "#0891B2" },
  { id: "banco", label: "Banco", icon: "landmark", defaultColor: "#475569" },
  { id: "outros", label: "Outros", icon: "circle", defaultColor: "#6B7280" },
];

export const COLOR_OPTIONS = [
  "#6D28D9",
  "#2563EB",
  "#0891B2",
  "#059669",
  "#65A30D",
  "#D97706",
  "#DC2626",
  "#475569",
];

export function defaultCategoriaVisual(tipo: "entrada" | "saida" | "ambos"): VisualMeta {
  if (tipo === "entrada") return { icon: "arrow-down-left", color: "#059669" };
  if (tipo === "saida") return { icon: "arrow-up-right", color: "#DC2626" };
  return { icon: "git-compare-arrows", color: "#6D28D9" };
}

export function defaultMeioVisual(nome: string): VisualMeta {
  const n = nome.toLowerCase();
  if (n.includes("pix")) return { icon: "scan-line", color: "#0EA5A4" };
  if (n.includes("boleto")) return { icon: "barcode", color: "#475569" };
  if (n.includes("dinheiro")) return { icon: "wallet", color: "#16A34A" };
  if (n.includes("cart") || n.includes("credito") || n.includes("débito") || n.includes("debito")) {
    return { icon: "credit-card", color: "#2563EB" };
  }
  if (n.includes("transfer")) return { icon: "arrow-right-left", color: "#7C3AED" };
  if (n.includes("empenho")) return { icon: "file-text", color: "#D97706" };
  return { icon: "circle", color: "#6B7280" };
}

export function visualStorageKey(kind: VisualKind): string {
  return `pam.financeiro.visual.${kind}.v1`;
}

/** Disparado após persistir visuais de conta no `localStorage` (mesma aba). */
export const FINANCEIRO_CONTA_VISUALS_UPDATE_EVENT = "pam-financeiro-conta-visuals-update";

/** Migra presets antigos (bancos) para o genérico Banco. */
export function normalizeContaPresetId(id: string | undefined): string {
  const allowed = new Set(CONTA_PRESETS.map((p) => p.id));
  if (id && allowed.has(id)) return id;
  return "banco";
}

/** Ícone Lucide a partir da chave salva em `VisualMeta.icon` (contas / categorias / meios). */
export function financeiroLucideFromIconKey(icon: string): ComponentType<{ className?: string; style?: CSSProperties }> {
  const key = icon.toLowerCase();
  if (key === "wallet") return Wallet;
  if (key === "piggy-bank") return PiggyBank;
  if (key === "credit-card") return CreditCard;
  if (key === "arrow-down-left") return ArrowDownLeft;
  if (key === "arrow-up-right") return ArrowUpRight;
  if (key === "git-compare-arrows") return GitCompareArrows;
  if (key === "scan-line") return ScanLine;
  if (key === "barcode") return Barcode;
  if (key === "arrow-right-left") return ArrowRightLeft;
  if (key === "file-text") return FileText;
  if (key === "circle") return Circle;
  return Landmark;
}

export function sanitizeContaVisualStored(raw: VisualMeta & { logoPath?: string }): VisualMeta {
  const presetId = normalizeContaPresetId(raw.presetId);
  const preset = CONTA_PRESETS.find((p) => p.id === presetId) ?? CONTA_PRESETS[2];
  return {
    icon: preset.icon,
    color: raw.color || preset.defaultColor,
    presetId,
  };
}

/** Visual da conta como no drawer de Configurações (localStorage por id da conta). */
export function resolveContaVisual(contaId: string, storedById: Record<string, VisualMeta>): VisualMeta {
  const stored = storedById[contaId];
  if (stored) return sanitizeContaVisualStored(stored as VisualMeta & { logoPath?: string });
  const fallback = CONTA_PRESETS[2] ?? CONTA_PRESETS[0];
  return {
    icon: fallback.icon,
    color: fallback.defaultColor,
    presetId: fallback.id,
  };
}

/** Lê o mapa de visuais de contas do mesmo localStorage que `FinanceiroConfigDrawer`. */
export function readContaVisualMapFromLocalStorage(): Record<string, VisualMeta> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(visualStorageKey("conta"));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, VisualMeta & { logoPath?: string }>;
    if (!parsed || typeof parsed !== "object") return {};
    const next: Record<string, VisualMeta> = {};
    for (const [id, v] of Object.entries(parsed)) {
      next[id] = sanitizeContaVisualStored(v);
    }
    return next;
  } catch {
    return {};
  }
}
