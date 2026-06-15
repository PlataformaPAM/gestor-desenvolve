import type { Tarefa } from "./types";

function startOfMonth(date: Date): { year: number; month: number } {
  return { year: date.getFullYear(), month: date.getMonth() };
}

function isBeforeMonth(a: { year: number; month: number }, b: { year: number; month: number }): boolean {
  return a.year < b.year || (a.year === b.year && a.month < b.month);
}

/** Data em que a tarefa foi concluída (histórico → updatedAt → prazo). */
export function getDataReferenciaConclusao(tarefa: Pick<Tarefa, "historico" | "updatedAt" | "dataFim" | "createdAt">): Date | null {
  const historicoConclusao = [...(tarefa.historico ?? [])]
    .filter((h) => /conclu[ií]d/i.test(h.acao) || /para\s+Conclu[ií]do/i.test(h.acao))
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  const candidatos = [
    historicoConclusao[0]?.data,
    tarefa.updatedAt,
    tarefa.dataFim,
    tarefa.createdAt,
  ].filter(Boolean) as string[];

  for (const iso of candidatos) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/** Concluídas de meses anteriores ao mês corrente (ex.: em maio, abril e antes). */
export function isTarefaConcluidaArquivada(tarefa: Pick<Tarefa, "status" | "historico" | "updatedAt" | "dataFim" | "createdAt">, now = new Date()): boolean {
  if (tarefa.status !== "concluido") return false;
  const ref = getDataReferenciaConclusao(tarefa);
  if (!ref) return false;
  return isBeforeMonth(startOfMonth(ref), startOfMonth(now));
}

/** Visão Fechadas: concluídas do mês atual + canceladas (qualquer mês). */
export function isTarefaNaVisaoFechadas(
  tarefa: Pick<Tarefa, "status" | "historico" | "updatedAt" | "dataFim" | "createdAt">,
  now = new Date()
): boolean {
  if (tarefa.status === "cancelado") return true;
  if (tarefa.status === "concluido") return !isTarefaConcluidaArquivada(tarefa, now);
  return false;
}

/** Visão Arquivados: somente concluídas de meses anteriores. */
export function isTarefaNaVisaoArquivados(
  tarefa: Pick<Tarefa, "status" | "historico" | "updatedAt" | "dataFim" | "createdAt">,
  now = new Date()
): boolean {
  return isTarefaConcluidaArquivada(tarefa, now);
}

/** Visão Abertos: tudo que não está em Fechadas nem Arquivados. */
export function isTarefaNaVisaoAbertos(
  tarefa: Pick<Tarefa, "status" | "historico" | "updatedAt" | "dataFim" | "createdAt">,
  now = new Date()
): boolean {
  return !isTarefaNaVisaoFechadas(tarefa, now) && !isTarefaNaVisaoArquivados(tarefa, now);
}

export function sortTarefasPorDataDesc(
  a: Pick<Tarefa, "updatedAt" | "dataFim">,
  b: Pick<Tarefa, "updatedAt" | "dataFim">
): number {
  const aTime = new Date(a.updatedAt ?? a.dataFim).getTime();
  const bTime = new Date(b.updatedAt ?? b.dataFim).getTime();
  return bTime - aTime;
}
