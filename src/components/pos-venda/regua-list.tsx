"use client";

import { Phone, FileCheck, RefreshCw, ClipboardList, ChevronRight, CalendarCheck2, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import type { TarefaRegua } from "@/lib/pos-venda/types";
import { TIPO_TAREFA_LABELS } from "@/lib/pos-venda/constants";
import clsx from "clsx";

const TIPO_ICON: Record<TarefaRegua["tipo"], React.ComponentType<{ className?: string }>> = {
  boas_vindas: Phone,
  agenda_reuniao: CalendarCheck2,
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

type ReguaListProps = {
  tarefas: TarefaRegua[];
  somentePendentes?: boolean;
  onSelecionarTarefa?: (tarefa: TarefaRegua) => void;
  pageSize?: number;
  compacto?: boolean;
};

function formatData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isAtrasada(t: TarefaRegua): boolean {
  if (t.status === "concluida") return false;
  return t.dataAgendada.slice(0, 10) < localYmd(new Date());
}

function isVenceHoje(t: TarefaRegua): boolean {
  if (t.status === "concluida") return false;
  return t.dataAgendada.slice(0, 10) === localYmd(new Date());
}

type ReguaListPaginatedBodyProps = {
  listaOrdenada: TarefaRegua[];
  somentePendentes: boolean;
  onSelecionarTarefa?: (tarefa: TarefaRegua) => void;
  compacto: boolean;
  pageSize: number;
};

/** Paginação isolada: `key` no pai reinicia a página quando o total ou o tamanho da página mudam (sem setState em effect). */
function ReguaListPaginatedBody({
  listaOrdenada,
  somentePendentes,
  onSelecionarTarefa,
  compacto,
  pageSize,
}: ReguaListPaginatedBodyProps) {
  const total = listaOrdenada.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const [pagina, setPagina] = useState(0);
  const paginaAtual = Math.min(pagina, pageCount - 1);
  const listaExibida = useMemo(() => {
    const start = paginaAtual * pageSize;
    const end = start + pageSize;
    return listaOrdenada.slice(start, end);
  }, [listaOrdenada, paginaAtual, pageSize]);

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
      <div className={`border-b border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/80 ${compacto ? "px-3 py-2" : "px-4 py-3 lg:px-6"}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200">
            Régua de Relacionamento
          </h2>
        </div>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {listaOrdenada.length} tarefa(s) {somentePendentes ? "pendente(s)" : "no total"}
          {!compacto && " · Clique para ver o playbook"}
        </p>
      </div>
      <ul className="divide-y divide-slate-100 dark:divide-slate-700">
        {listaExibida.map((t) => {
          const Icon = TIPO_ICON[t.tipo];
          const estilo = t.categoria ? CATEGORIA_STYLE[t.categoria] : "bg-[#6D28D9]/10 text-[#6D28D9] border-[#6D28D9]/30";
          const tipoLabel = TIPO_TAREFA_LABELS[t.tipo];
          const prioritaria = typeof t.prioridadeCritica === "number" && t.prioridadeCritica > 0;
          const atrasada = isAtrasada(t);
          const venceHoje = isVenceHoje(t);
          const veioDeAlerta = t.id.startsWith("alert-");
          return (
            <li
              key={t.id}
              className={clsx(
                "relative px-4 py-3 lg:px-6",
                t.status === "pendente" && "bg-white dark:bg-slate-800/40",
                t.status === "concluida" && "bg-slate-50/50 dark:bg-slate-900/50",
                t.status === "adiada" && "bg-slate-50/50 dark:bg-slate-900/50",
                onSelecionarTarefa && (t.status === "pendente" || t.status === "adiada") && "cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/80"
              )}
              onClick={
                onSelecionarTarefa && (t.status === "pendente" || t.status === "adiada")
                  ? () => onSelecionarTarefa(t)
                  : undefined
              }
              onKeyDown={
                onSelecionarTarefa && (t.status === "pendente" || t.status === "adiada")
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelecionarTarefa(t);
                      }
                    }
                  : undefined
              }
              role={onSelecionarTarefa && (t.status === "pendente" || t.status === "adiada") ? "button" : undefined}
              tabIndex={onSelecionarTarefa && (t.status === "pendente" || t.status === "adiada") ? 0 : undefined}
            >
              {veioDeAlerta && (
                <span className="absolute right-2 top-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  1
                </span>
              )}
              {/* Mobile: mantém layout em 2 linhas para não estourar texto */}
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
                  {prioritaria && (
                    <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-200">
                      Prioritária
                    </span>
                  )}
                  {atrasada && (
                    <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-300">
                      Atrasada
                    </span>
                  )}
                  {venceHoje && !atrasada && (
                    <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 dark:border-sky-500/40 dark:bg-sky-950/40 dark:text-sky-200">
                      Vence hoje
                    </span>
                  )}
                  {t.status === "pendente" && (
                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-300">
                      Pendente
                    </span>
                  )}
                  {t.status === "concluida" && (
                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-300">
                      Concluída
                    </span>
                  )}
                  {t.status === "adiada" && (
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                      Adiada
                    </span>
                  )}
                  {onSelecionarTarefa && (t.status === "pendente" || t.status === "adiada") && (
                    <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-slate-400 dark:text-slate-500">
                      <Pencil className="h-4 w-4" aria-hidden />
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </span>
                  )}
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
                <p className="whitespace-nowrap text-sm font-medium text-slate-700 dark:text-slate-200">{formatData(t.dataAgendada)}</p>
                {prioritaria && (
                  <span className="whitespace-nowrap inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-200">
                    Prioritária
                  </span>
                )}
                {atrasada && (
                  <span className="whitespace-nowrap inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-300">
                    Atrasada
                  </span>
                )}
                {venceHoje && !atrasada && (
                  <span className="whitespace-nowrap inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 dark:border-sky-500/40 dark:bg-sky-950/40 dark:text-sky-200">
                    Vence hoje
                  </span>
                )}
                {t.status === "pendente" && (
                  <span className="whitespace-nowrap inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-300">
                    Pendente
                  </span>
                )}
                {t.status === "concluida" && (
                  <span className="whitespace-nowrap inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-300">
                    Concluída
                  </span>
                )}
                {t.status === "adiada" && (
                  <span className="whitespace-nowrap inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                    Adiada
                  </span>
                )}
                {onSelecionarTarefa && (t.status === "pendente" || t.status === "adiada") && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-slate-400 dark:text-slate-500">
                    <Pencil className="h-4 w-4" aria-hidden />
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {listaOrdenada.length === 0 && (
        <div className="flex items-center justify-center px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          Nenhuma tarefa {somentePendentes ? "pendente" : "cadastrada"} na régua.
        </div>
      )}
      {listaOrdenada.length > 0 && total > pageSize && (
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-700">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={paginaAtual <= 0}
              onClick={() => setPagina((p) => Math.max(0, p - 1))}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Anterior
            </button>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Página {paginaAtual + 1} de {pageCount}
            </p>
            <button
              type="button"
              disabled={paginaAtual >= pageCount - 1}
              onClick={() => setPagina((p) => Math.min(pageCount - 1, p + 1))}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ReguaList({
  tarefas,
  somentePendentes = true,
  onSelecionarTarefa,
  compacto = false,
  pageSize = 3,
}: ReguaListProps) {
  const lista = somentePendentes
    ? tarefas.filter((t) => t.status === "pendente" || t.status === "adiada")
    : tarefas;

  const listaOrdenada = [...lista].sort(
    (a, b) =>
      new Date(`${a.dataAgendada}T00:00:00`).getTime() -
      new Date(`${b.dataAgendada}T00:00:00`).getTime()
  );

  const total = listaOrdenada.length;

  return (
    <ReguaListPaginatedBody
      key={`${total}-${pageSize}`}
      listaOrdenada={listaOrdenada}
      somentePendentes={somentePendentes}
      onSelecionarTarefa={onSelecionarTarefa}
      compacto={compacto}
      pageSize={pageSize}
    />
  );
}
