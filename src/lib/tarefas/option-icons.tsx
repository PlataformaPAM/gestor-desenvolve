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
  CircleX,
  ClipboardCheck,
  Clock3,
  Handshake,
  Megaphone,
  PauseCircle,
  Settings2,
  ShieldAlert,
  Wallet,
  Wrench,
} from "lucide-react";
import type { PrioridadeTarefa, StatusTarefa } from "@/lib/tarefas/types";
import type { CategoriaTarefa } from "@/lib/tarefas/categorias";

type IconComp = ComponentType<{ className?: string }>;

const PRIORIDADE_ICON_BY_VALUE: Record<PrioridadeTarefa, IconComp> = {
  baixa: ({ className }) => <Circle className={`!text-slate-500 ${className ?? ""}`} />,
  media: ({ className }) => <Clock3 className={`!text-amber-500 ${className ?? ""}`} />,
  alta: ({ className }) => <AlertTriangle className={`!text-orange-500 ${className ?? ""}`} />,
  urgente: ({ className }) => <ShieldAlert className={`!text-red-500 ${className ?? ""}`} />,
};

const STATUS_ICON_BY_VALUE: Record<StatusTarefa, IconComp> = {
  a_fazer: ({ className }) => <Circle className={`!text-slate-500 ${className ?? ""}`} />,
  em_andamento: ({ className }) => <Clock3 className={`!text-blue-500 ${className ?? ""}`} />,
  aguardando: ({ className }) => <PauseCircle className={`!text-orange-500 ${className ?? ""}`} />,
  validar: ({ className }) => <ClipboardCheck className={`!text-violet-500 ${className ?? ""}`} />,
  concluido: ({ className }) => <CircleDot className={`!text-emerald-500 ${className ?? ""}`} />,
  cancelado: ({ className }) => <CircleX className={`!text-rose-500 ${className ?? ""}`} />,
};

const CATEGORIA_ICON_BY_VALUE: Record<CategoriaTarefa, IconComp> = {
  Administrativo: ({ className }) => <BriefcaseBusiness className={`!text-slate-500 ${className ?? ""}`} />,
  "Atualizar indicadores": ({ className }) => <BarChart3 className={`!text-sky-500 ${className ?? ""}`} />,
  Comercial: ({ className }) => <Handshake className={`!text-violet-500 ${className ?? ""}`} />,
  Dúvida: ({ className }) => <CircleHelp className={`!text-amber-500 ${className ?? ""}`} />,
  Financeiro: ({ className }) => <Wallet className={`!text-emerald-500 ${className ?? ""}`} />,
  Marketing: ({ className }) => <Megaphone className={`!text-rose-500 ${className ?? ""}`} />,
  "Material de apoio": ({ className }) => <BookOpen className={`!text-blue-500 ${className ?? ""}`} />,
  Outra: ({ className }) => <Building2 className={`!text-slate-500 ${className ?? ""}`} />,
  "Problemas técnicos": ({ className }) => <Wrench className={`!text-orange-600 ${className ?? ""}`} />,
  Suporte: ({ className }) => <Settings2 className={`!text-indigo-500 ${className ?? ""}`} />,
};

export function iconForPrioridade(prioridade: PrioridadeTarefa): IconComp {
  return PRIORIDADE_ICON_BY_VALUE[prioridade];
}

export function iconForStatus(status: StatusTarefa): IconComp {
  return STATUS_ICON_BY_VALUE[status];
}

export function iconForCategoria(categoria: string): IconComp {
  const normalized = categoria.trim();
  return (CATEGORIA_ICON_BY_VALUE as Record<string, IconComp | undefined>)[normalized] ?? Building2;
}

export const PRIORIDADE_LEADING_ICON = Wrench;
export const STATUS_LEADING_ICON = Clock3;
