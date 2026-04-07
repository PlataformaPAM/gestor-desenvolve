"use client";

import { AlertCircle, ChevronRight, Phone, FileCheck, RefreshCw, ClipboardList } from "lucide-react";
import type { ComponentType } from "react";
import type { TarefaRegua } from "@/lib/pos-venda/types";
import { TIPO_TAREFA_LABELS } from "@/lib/pos-venda/constants";
import clsx from "clsx";

const TIPO_ICON: Record<TarefaRegua["tipo"], ComponentType<{ className?: string }>> = {
  boas_vindas: Phone,
  checkup_30: FileCheck,
  checkup_90: FileCheck,
  renovacao_contrato: RefreshCw,
  pesquisa_satisfacao: ClipboardList,
  feedback: ClipboardList,
  outro: ClipboardList,
};

/** Azul = Onboarding, Roxo = Relacionamento, Laranja = Alerta Risco */
const CATEGORIA_STYLE: Record<NonNullable<TarefaRegua["categoria"]>, string> = {
  onboarding:
    "bg-blue-500/10 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-500/30",
  relacionamento:
    "bg-[#6D28D9]/10 text-[#6D28D9] border-[#6D28D9]/30 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-500/30",
  alerta_risco:
    "bg-orange-500/10 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-500/30",
};

type AcoesPrioritariasCardProps = {
  tarefas: TarefaRegua[];
  onSelecionarTarefa: (tarefa: TarefaRegua) => void;
};

function localYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isVenceHoje(t: TarefaRegua): boolean {
  if (t.status === "concluida") return false;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return t.dataAgendada.slice(0, 10) === `${y}-${m}-${d}`;
}

/** Retorna as 3 tarefas prioritárias (por data asc, desempate por prioridadeCritica desc). */
export function getAcoesPrioritarias(tarefas: TarefaRegua[]): TarefaRegua[] {
  const hoje = localYmd();
  return tarefas
    .filter((t) => (t.status === "pendente" || t.status === "adiada") && typeof t.prioridadeCritica === "number" && t.prioridadeCritica > 0)
    .filter((t) => t.dataAgendada.slice(0, 10) >= hoje)
    .sort((a, b) => {
      const da = new Date(`${a.dataAgendada}T00:00:00`).getTime();
      const db = new Date(`${b.dataAgendada}T00:00:00`).getTime();
      if (da !== db) return da - db; // mais próxima primeiro
      return (b.prioridadeCritica ?? 0) - (a.prioridadeCritica ?? 0); // desempate: mais alta
    })
    .slice(0, 3);
}

function formatData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function AcoesPrioritariasCard({ tarefas, onSelecionarTarefa }: AcoesPrioritariasCardProps) {
  const prioridades = getAcoesPrioritarias(tarefas);

  return (
    <div className="rounded-xl border-2 border-amber-200 bg-amber-50/80 p-4 shadow-sm lg:p-6 dark:border-amber-500/30 dark:bg-amber-950/40">
      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
        <AlertCircle className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Ações Prioritárias</h2>
      </div>
      <p className="mt-1 text-sm text-amber-700 dark:text-amber-200">
        Próximas tarefas prioritárias.
      </p>
      <ul className="mt-4 divide-y divide-amber-200/60 dark:divide-slate-800/60">
        {prioridades.map((t) => {
          const Icon = TIPO_ICON[t.tipo];
          const estilo = t.categoria
            ? CATEGORIA_STYLE[t.categoria]
            : "bg-[#6D28D9]/10 text-[#6D28D9] border-[#6D28D9]/30";
          const tipoLabel = TIPO_TAREFA_LABELS[t.tipo];

          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onSelecionarTarefa(t)}
                className={clsx(
                  "relative w-full px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50",
                  "lg:px-6",
                  "bg-white dark:bg-slate-800/40",
                  "text-left cursor-pointer"
                )}
              >
                {t.id.startsWith("alert-") && (
                  <span className="absolute right-2 top-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    1
                  </span>
                )}
                {/* Mobile: mantém layout em 2 linhas (igual à régua) */}
                <div className="flex flex-col gap-2 lg:hidden">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <div className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", estilo)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-medium text-slate-900 dark:text-slate-100">{tipoLabel}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t.clienteNome}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{formatData(t.dataAgendada)}</p>
                    {isVenceHoje(t) && (
                      <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 dark:border-sky-500/40 dark:bg-sky-950/40 dark:text-sky-200">
                        Vence hoje
                      </span>
                    )}
                    {t.status === "pendente" && (
                      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-300">
                        Pendente
                      </span>
                    )}
                    {t.status === "adiada" && (
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                        Adiada
                      </span>
                    )}
                    <ChevronRight className="ml-auto h-4 w-4 text-slate-400 dark:text-slate-500" />
                  </div>
                </div>

                {/* Desktop: tudo em uma única linha */}
                <div className="hidden lg:flex w-full items-center gap-3">
                  <div className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", estilo)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {tipoLabel} · {t.clienteNome}
                  </p>
                  <p className="whitespace-nowrap text-sm font-medium text-slate-700 dark:text-slate-200">
                    {formatData(t.dataAgendada)}
                  </p>
                  {isVenceHoje(t) && (
                    <span className="whitespace-nowrap inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 dark:border-sky-500/40 dark:bg-sky-950/40 dark:text-sky-200">
                      Vence hoje
                    </span>
                  )}
                  {t.status === "pendente" && (
                    <span className="whitespace-nowrap inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-300">
                      Pendente
                    </span>
                  )}
                  {t.status === "adiada" && (
                    <span className="whitespace-nowrap inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                      Adiada
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {prioridades.length === 0 && (
        <p className="mt-4 text-sm text-amber-700 dark:text-amber-200">
          Nenhuma ação crítica para hoje. Ótimo trabalho!
        </p>
      )}
    </div>
  );
}
