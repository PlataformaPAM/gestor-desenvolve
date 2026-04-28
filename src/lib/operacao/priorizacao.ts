export type OperacaoViewId = "minha_fila" | "urgentes" | "atrasados" | "vence_logo" | "fechados";

export type SituacaoOperacional = "normal" | "vence_logo" | "atrasado";

type PrioridadeLike = "baixa" | "media" | "alta" | "urgente" | "critica";

type ScoreInput = {
  prioridade?: PrioridadeLike;
  vencimentoIso?: string;
  atualizadoIso?: string;
  now?: Date;
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getDiasParaVencer(vencimentoIso?: string, now = new Date()): number | null {
  if (!vencimentoIso) return null;
  const due = new Date(vencimentoIso);
  if (Number.isNaN(due.getTime())) return null;
  const diff = startOfDay(due).getTime() - startOfDay(now).getTime();
  return Math.round(diff / 86400000);
}

export function getSituacaoOperacional(vencimentoIso?: string, now = new Date()): SituacaoOperacional {
  const dias = getDiasParaVencer(vencimentoIso, now);
  if (dias === null) return "normal";
  if (dias < 0) return "atrasado";
  if (dias <= 3) return "vence_logo";
  return "normal";
}

function prioridadePeso(prioridade?: PrioridadeLike): number {
  if (prioridade === "urgente" || prioridade === "critica") return 1000;
  if (prioridade === "alta") return 700;
  if (prioridade === "media") return 400;
  if (prioridade === "baixa") return 200;
  return 0;
}

function situacaoPeso(situacao: SituacaoOperacional): number {
  if (situacao === "atrasado") return 300;
  if (situacao === "vence_logo") return 150;
  return 0;
}

export function getScorePriorizacao(input: ScoreInput): number {
  const now = input.now ?? new Date();
  const situacao = getSituacaoOperacional(input.vencimentoIso, now);
  const diasParaVencer = getDiasParaVencer(input.vencimentoIso, now);
  const dueBonus =
    diasParaVencer === null ? 0 : Math.max(0, 40 - Math.min(40, Math.max(0, diasParaVencer))) * 2;
  const atualizado = input.atualizadoIso ? new Date(input.atualizadoIso) : null;
  const stalenessDays =
    atualizado && !Number.isNaN(atualizado.getTime())
      ? Math.max(0, Math.round((now.getTime() - atualizado.getTime()) / 86400000))
      : 0;
  const staleBonus = Math.min(stalenessDays, 30);
  return prioridadePeso(input.prioridade) + situacaoPeso(situacao) + dueBonus + staleBonus;
}

export function sortByPriorizacao<T>(
  items: T[],
  selectors: {
    prioridade: (item: T) => PrioridadeLike | undefined;
    vencimentoIso: (item: T) => string | undefined;
    atualizadoIso: (item: T) => string | undefined;
    now?: Date;
  }
): T[] {
  const now = selectors.now ?? new Date();
  return [...items].sort((a, b) => {
    const scoreA = getScorePriorizacao({
      prioridade: selectors.prioridade(a),
      vencimentoIso: selectors.vencimentoIso(a),
      atualizadoIso: selectors.atualizadoIso(a),
      now,
    });
    const scoreB = getScorePriorizacao({
      prioridade: selectors.prioridade(b),
      vencimentoIso: selectors.vencimentoIso(b),
      atualizadoIso: selectors.atualizadoIso(b),
      now,
    });
    if (scoreA !== scoreB) return scoreB - scoreA;
    const dueA = new Date(selectors.vencimentoIso(a) ?? "").getTime();
    const dueB = new Date(selectors.vencimentoIso(b) ?? "").getTime();
    if (!Number.isNaN(dueA) && !Number.isNaN(dueB) && dueA !== dueB) return dueA - dueB;
    const updA = new Date(selectors.atualizadoIso(a) ?? "").getTime();
    const updB = new Date(selectors.atualizadoIso(b) ?? "").getTime();
    if (!Number.isNaN(updA) && !Number.isNaN(updB) && updA !== updB) return updA - updB;
    return 0;
  });
}
