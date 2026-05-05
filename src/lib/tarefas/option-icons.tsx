"use client";

import type { ComponentType } from "react";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Circle,
  CircleDot,
  CircleHelp,
  Clock3,
  GraduationCap,
  Handshake,
  LayoutTemplate,
  Megaphone,
  PanelsTopLeft,
  Settings2,
  ShieldAlert,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import type { PrioridadeTarefa, StatusTarefa } from "@/lib/tarefas/types";
import type { CategoriaTarefa } from "@/lib/tarefas/categorias";

type IconComp = ComponentType<{ className?: string }>;

const softwareIcon: IconComp = ({ className }) => <Settings2 className={`!text-indigo-500 ${className ?? ""}`} />;

const PRIORIDADE_ICON_BY_VALUE: Record<PrioridadeTarefa, IconComp> = {
  baixa: ({ className }) => <Circle className={`!text-slate-500 ${className ?? ""}`} />,
  media: ({ className }) => <Clock3 className={`!text-amber-500 ${className ?? ""}`} />,
  alta: ({ className }) => <AlertTriangle className={`!text-orange-500 ${className ?? ""}`} />,
  urgente: ({ className }) => <ShieldAlert className={`!text-red-500 ${className ?? ""}`} />,
};

const STATUS_ICON_BY_VALUE: Record<StatusTarefa, IconComp> = {
  a_fazer: ({ className }) => <Circle className={`!text-slate-500 ${className ?? ""}`} />,
  em_andamento: ({ className }) => <Clock3 className={`!text-blue-500 ${className ?? ""}`} />,
  impedimento: ({ className }) => <AlertTriangle className={`!text-orange-500 ${className ?? ""}`} />,
  concluido: ({ className }) => <CircleDot className={`!text-emerald-500 ${className ?? ""}`} />,
};

const CATEGORIA_ICON_BY_VALUE: Record<CategoriaTarefa, IconComp> = {
  Administrativo: ({ className }) => <BriefcaseBusiness className={`!text-slate-500 ${className ?? ""}`} />,
  Assessoria: ({ className }) => <Handshake className={`!text-cyan-500 ${className ?? ""}`} />,
  "Atualizar Indicadores": ({ className }) => <BarChart3 className={`!text-sky-500 ${className ?? ""}`} />,
  Capacitação: ({ className }) => <GraduationCap className={`!text-teal-500 ${className ?? ""}`} />,
  Comercial: ({ className }) => <Handshake className={`!text-violet-500 ${className ?? ""}`} />,
  Consultoria: ({ className }) => <Users className={`!text-violet-500 ${className ?? ""}`} />,
  Dúvida: ({ className }) => <CircleHelp className={`!text-amber-500 ${className ?? ""}`} />,
  Financeiro: ({ className }) => <Wallet className={`!text-emerald-500 ${className ?? ""}`} />,
  GesConselho: softwareIcon,
  GesPlanos: softwareIcon,
  GestorAlerta: softwareIcon,
  InfoPolis: softwareIcon,
  Marketing: ({ className }) => <Megaphone className={`!text-rose-500 ${className ?? ""}`} />,
  "Material de Apoio": ({ className }) => <BookOpen className={`!text-blue-500 ${className ?? ""}`} />,
  Outro: ({ className }) => <Building2 className={`!text-slate-500 ${className ?? ""}`} />,
  "Painél Regional": ({ className }) => <PanelsTopLeft className={`!text-indigo-500 ${className ?? ""}`} />,
  "Reformulação Portal": ({ className }) => <LayoutTemplate className={`!text-fuchsia-500 ${className ?? ""}`} />,
  Suporte: ({ className }) => <ShieldAlert className={`!text-orange-500 ${className ?? ""}`} />,
};

export function iconForPrioridade(prioridade: PrioridadeTarefa): IconComp {
  return PRIORIDADE_ICON_BY_VALUE[prioridade];
}

export function iconForStatus(status: StatusTarefa): IconComp {
  return STATUS_ICON_BY_VALUE[status];
}

export function iconForCategoria(categoria: string): IconComp {
  if (categoria === "Reformulação Portais") return CATEGORIA_ICON_BY_VALUE["Reformulação Portal"];
  return (CATEGORIA_ICON_BY_VALUE as Record<string, IconComp | undefined>)[categoria] ?? Building2;
}

export const PRIORIDADE_LEADING_ICON = Wrench;
export const STATUS_LEADING_ICON = Clock3;
