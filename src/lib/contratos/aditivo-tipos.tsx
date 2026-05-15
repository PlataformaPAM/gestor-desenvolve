import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import {
  Ban,
  CalendarClock,
  FileText,
  Layers2,
  MessageSquare,
  PauseCircle,
  Percent,
  RefreshCw,
  Wallet,
} from "lucide-react";
import type { SearchableOption } from "@/components/ui/searchable-select";

type AditivoTipoDef = {
  value: string;
  label: string;
  /** Texto curto para chips na lista */
  badgeLabel: string;
  subtitle: string;
  Icon: LucideIcon;
  /** Sobrescreve o cinza padrão do SearchableSelect */
  iconClass: string;
  chipClass: string;
};

const DEFS: AditivoTipoDef[] = [
  {
    value: "ajuste_valor",
    label: "Ajuste de valor",
    badgeLabel: "Valor",
    subtitle: "Acréscimo, desconto ou renegociação do montante",
    Icon: Wallet,
    iconClass: "!text-amber-600 dark:!text-amber-400",
    chipClass:
      "border border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200",
  },
  {
    value: "prorrogacao_prazo",
    label: "Prorrogação de prazo",
    badgeLabel: "Prazo",
    subtitle: "Extensão de vigência sem novo ciclo completo",
    Icon: CalendarClock,
    iconClass: "!text-sky-600 dark:!text-sky-400",
    chipClass:
      "border border-sky-200/80 bg-sky-50 text-sky-900 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-200",
  },
  {
    value: "renovacao",
    label: "Renovação contratual",
    badgeLabel: "Renovação",
    subtitle: "Novo período ou ciclo contratual",
    Icon: RefreshCw,
    iconClass: "!text-emerald-600 dark:!text-emerald-400",
    chipClass:
      "border border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200",
  },
  {
    value: "alteracao_escopo",
    label: "Alteração de escopo",
    badgeLabel: "Escopo",
    subtitle: "Inclusão, exclusão ou substituição de entregas",
    Icon: Layers2,
    iconClass: "!text-violet-600 dark:!text-violet-400",
    chipClass:
      "border border-violet-200/80 bg-violet-50 text-violet-900 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-200",
  },
  {
    value: "reajuste_indice",
    label: "Reajuste por índice",
    badgeLabel: "Índice",
    subtitle: "IPCA, INPC, IGP-M ou cláusula de correção monetária",
    Icon: Percent,
    iconClass: "!text-rose-600 dark:!text-rose-400",
    chipClass:
      "border border-rose-200/80 bg-rose-50 text-rose-900 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200",
  },
  {
    value: "suspensao",
    label: "Suspensão temporária",
    badgeLabel: "Suspensão",
    subtitle: "Pausa das obrigações por período definido",
    Icon: PauseCircle,
    iconClass: "!text-orange-600 dark:!text-orange-400",
    chipClass:
      "border border-orange-200/80 bg-orange-50 text-orange-900 dark:border-orange-800/60 dark:bg-orange-950/40 dark:text-orange-200",
  },
  {
    value: "rescisao",
    label: "Rescisão ou distrato",
    badgeLabel: "Rescisão",
    subtitle: "Encerramento antecipado ou rescisão amigável",
    Icon: Ban,
    iconClass: "!text-red-600 dark:!text-red-400",
    chipClass:
      "border border-red-200/80 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200",
  },
  {
    value: "outro",
    label: "Outro aditivo",
    badgeLabel: "Outro",
    subtitle: "Demais alterações não listadas acima",
    Icon: FileText,
    iconClass: "!text-slate-600 dark:!text-slate-400",
    chipClass:
      "border border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
  },
];

function wrapIcon(Icon: LucideIcon, iconClass: string) {
  return function AditivoTipoOptionIcon({ className }: { className?: string }) {
    return <Icon className={clsx("h-4 w-4 shrink-0", iconClass, className)} />;
  };
}

export const ADITIVO_TIPO_OPTIONS: SearchableOption[] = DEFS.map((d) => ({
  value: d.value,
  label: d.label,
  subtitle: d.subtitle,
  icon: wrapIcon(d.Icon, d.iconClass),
}));

export type AditivoTipoMeta = {
  slug: string;
  label: string;
  badgeLabel: string;
  Icon: LucideIcon;
  iconClass: string;
  chipClass: string;
};

/** Tipos gravados fora da lista (ex.: histórico automático) */
const EXTRA_META: Record<string, Omit<AditivoTipoMeta, "slug">> = {
  comentario: {
    label: "Interação",
    badgeLabel: "Interação",
    Icon: MessageSquare,
    iconClass: "!text-[#6D28D9] dark:!text-violet-400",
    chipClass:
      "border border-violet-200/80 bg-violet-50 text-violet-900 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-200",
  },
};

export function getAditivoTipoMeta(tipo: string): AditivoTipoMeta {
  const slug = tipo.trim();
  const def = DEFS.find((d) => d.value === slug);
  if (def) {
    return {
      slug: def.value,
      label: def.label,
      badgeLabel: def.badgeLabel,
      Icon: def.Icon,
      iconClass: def.iconClass,
      chipClass: def.chipClass,
    };
  }
  const extra = EXTRA_META[slug];
  if (extra) {
    return { slug, ...extra };
  }
  return {
    slug,
    label: slug || "Tipo não informado",
    badgeLabel: slug ? slug.slice(0, 24) : "?",
    Icon: FileText,
    iconClass: "!text-slate-500 dark:!text-slate-400",
    chipClass:
      "border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };
}
