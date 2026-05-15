import type { PipelineStageId } from "./types";

export type StageColorConfig = {
  /** Fundo da coluna + borda top (ex.: bg-slate-100 border-t-4 border-slate-400) */
  bg: string;
  borderTop: string;
  /** Borda lateral do card */
  borderLeft: string;
  /** Badge e ícones (texto vibrante) */
  badge: string;
  /** Texto do título da coluna */
  text: string;
};

export const STAGE_COLORS: Record<PipelineStageId, StageColorConfig> = {
  prospecao: {
    bg: "bg-slate-100 dark:bg-slate-800/90",
    borderTop: "border-t-4 border-slate-400 dark:border-slate-500",
    borderLeft: "border-l-slate-400 dark:border-l-slate-500",
    badge: "bg-slate-200/80 text-slate-700 dark:bg-slate-700/80 dark:text-slate-200",
    text: "text-slate-700 dark:text-slate-200",
  },
  qualificacao: {
    bg: "bg-cyan-50 dark:bg-cyan-950/45",
    borderTop: "border-t-4 border-cyan-500 dark:border-cyan-400",
    borderLeft: "border-l-cyan-500 dark:border-l-cyan-400",
    badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300",
    text: "text-cyan-700 dark:text-cyan-300",
  },
  proposta: {
    bg: "bg-purple-50 dark:bg-violet-950/40",
    borderTop: "border-t-4 border-[#6D28D9] dark:border-violet-400",
    borderLeft: "border-l-[#6D28D9] dark:border-l-violet-400",
    badge: "bg-purple-100 text-[#6D28D9] dark:bg-violet-900/50 dark:text-violet-300",
    text: "text-[#6D28D9] dark:text-violet-300",
  },
  contratacao: {
    bg: "bg-blue-50 dark:bg-blue-950/45",
    borderTop: "border-t-4 border-blue-500 dark:border-blue-400",
    borderLeft: "border-l-blue-500 dark:border-l-blue-400",
    badge: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300",
    text: "text-blue-600 dark:text-blue-300",
  },
  fechado: {
    bg: "bg-green-50 dark:bg-emerald-950/40",
    borderTop: "border-t-4 border-emerald-500 dark:border-emerald-400",
    borderLeft: "border-l-emerald-500 dark:border-l-emerald-400",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  perdido: {
    bg: "bg-red-50 dark:bg-red-950/40",
    borderTop: "border-t-4 border-red-500 dark:border-red-400",
    borderLeft: "border-l-red-500 dark:border-l-red-400",
    badge: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300",
    text: "text-red-600 dark:text-red-300",
  },
};

/** Cor da borda ao destacar card (pulso ~3s) — alinhada à etapa do funil. */
export const STAGE_HIGHLIGHT_HEX: Record<PipelineStageId, string> = {
  prospecao: "#94a3b8",
  qualificacao: "#06b6d4",
  proposta: "#6d28d9",
  contratacao: "#3b82f6",
  fechado: "#10b981",
  perdido: "#ef4444",
};
