"use client";

import type { ComponentType } from "react";
import { AlertTriangle, CheckCircle2, Gauge, ArrowRight, CalendarClock } from "lucide-react";
import type { ClienteHealth, TarefaRegua } from "@/lib/pos-venda/types";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";

type CommandCenterHomeProps = {
  tarefas: TarefaRegua[];
  alertTasks: TarefaRegua[];
  clienteHealth: ClienteHealth[];
  onIrParaPrioridade?: () => void;
  onIrParaRegua?: () => void;
  onAbrirLixeira?: () => void;
  podeVerLixeira?: boolean;
  janela: "hoje" | "7d" | "30d" | "60d";
  onChangeJanela: (janela: "hoje" | "7d" | "30d" | "60d") => void;
};

export function CommandCenterHome({
  tarefas,
  alertTasks,
  clienteHealth,
  onIrParaPrioridade,
  onIrParaRegua,
  onAbrirLixeira,
  podeVerLixeira = false,
  janela,
  onChangeJanela,
}: CommandCenterHomeProps) {
  const todasPendentes = [...alertTasks, ...tarefas].filter((t) => t.status === "pendente");
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const ate30 = new Date(hoje);
  ate30.setDate(ate30.getDate() + 30);
  const acoesCriticas30Dias = [...alertTasks, ...tarefas].filter((t) => {
    if (t.status !== "pendente") return false;
    const data = new Date(`${t.dataAgendada}T00:00:00`);
    return data <= ate30;
  }).length;
  const clientesRisco = clienteHealth.filter((c) => c.healthScore === "risco").length;
  const mediaHealth = clienteHealth.length
    ? Math.round(clienteHealth.reduce((acc, c) => acc + c.score, 0) / clienteHealth.length)
    : 0;

  return (
    <div
      className={clsx(
        "flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900",
        "p-4 lg:p-6"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Painel executivo do pós-venda</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Visão objetiva para decisão rápida do time.</p>
        </div>
        <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {[
            { id: "hoje" as const, label: "Hoje" },
            { id: "7d" as const, label: "7 dias" },
            { id: "30d" as const, label: "30 dias" },
            { id: "60d" as const, label: "60 dias" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeJanela(item.id)}
              className={clsx(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                janela === item.id
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-300"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CardKpi icon={Gauge} label="Pontuação média da carteira" value={`${mediaHealth}/100`} tone="violet" />
        <CardKpi icon={AlertTriangle} label="Clientes em risco" value={`${clientesRisco}`} tone="red" />
        <CardKpi icon={CalendarClock} label="Ações críticas no período" value={`${acoesCriticas30Dias}`} tone="amber" />
        <CardKpi icon={CheckCircle2} label="Pendências no período" value={`${todasPendentes.length}`} tone="emerald" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onIrParaPrioridade}
          className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700"
        >
          Ir para Ações Prioritárias
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onIrParaRegua}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Ir para Régua
        </button>
        {podeVerLixeira && (
          <button
            type="button"
            onClick={onAbrirLixeira}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Lixeira
          </button>
        )}
      </div>
    </div>
  );
}

function CardKpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "violet" | "red" | "amber" | "emerald";
}) {
  const tones: Record<typeof tone, string> = {
    violet: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/40 dark:bg-violet-950/40 dark:text-violet-200",
    red: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-200",
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-200",
  };
  return (
    <div className={`rounded-lg border p-3 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">{label}</p>
        <Icon className="h-4 w-4" />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={value}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          className="mt-1 text-lg font-semibold"
        >
          {value}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
