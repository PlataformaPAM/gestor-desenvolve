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

/** Migra presets antigos (bancos) para o genérico Banco. */
export function normalizeContaPresetId(id: string | undefined): string {
  const allowed = new Set(CONTA_PRESETS.map((p) => p.id));
  if (id && allowed.has(id)) return id;
  return "banco";
}
