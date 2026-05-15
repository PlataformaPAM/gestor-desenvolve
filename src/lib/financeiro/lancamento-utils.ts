import type { Lancamento } from "./types";
import { getGroupMembers, getRecurrenceRootId } from "./recurrence-save";

/** Distribui o total em N parcelas em centavos (soma exata ao total). */
export function splitValorTotalEmParcelas(total: number, n: number): number[] {
  const count = Math.max(1, Math.floor(n));
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const c = base + (i < remainder ? 1 : 0);
    out.push(c / 100);
  }
  return out;
}

/** Texto da descrição na grade (prefixos legados e sufixo " (1/N)" de parcelas antigas). */
export function descricaoParaExibicao(descricao: string): string {
  let t = descricao.trim();
  if (/^Recebimento Comercial:\s*/i.test(t)) t = t.replace(/^Recebimento Comercial:\s*/i, "").trim();
  else if (/^Recebimento:\s*/i.test(t)) t = t.replace(/^Recebimento:\s*/i, "").trim();
  t = t.replace(/\s+\(\d+\/\d+\)\s*$/u, "").trim();
  return t;
}

/** Dias até o vencimento (0 = hoje, negativo = atraso), comparando só a data local. */
export function diasAteVencimentoCalendar(isoDate: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const v = new Date(isoDate);
  v.setHours(0, 0, 0, 0);
  return Math.round((v.getTime() - hoje.getTime()) / 86400000);
}

/** Selo junto à data: atraso ou vence em até 7 dias (alinhado ao resumo do Financeiro). */
export function badgeUrgenciaVencimento(
  l: Lancamento
): { texto: string; variant: "atraso" | "urgente" } | null {
  if (l.status === "pago") return null;
  const dias = diasAteVencimentoCalendar(l.vencimento);
  if (dias < 0) {
    return { texto: "VENCIDO", variant: "atraso" };
  }
  if (dias === 0) {
    return { texto: "VENCE HOJE", variant: "urgente" };
  }
  if (dias === 1) {
    return { texto: "VENCE AMANHÃ", variant: "urgente" };
  }
  if (dias <= 7) {
    return { texto: "VENCE LOGO", variant: "urgente" };
  }
  return null;
}

/** Status para UI: vencimento passado e não pago → atrasado (alinha à coluna com selo VENCIDO). */
export function statusFinanceiroEfetivo(l: Lancamento): Lancamento["status"] {
  if (l.status === "pago") return "pago";
  if (diasAteVencimentoCalendar(l.vencimento) < 0) return "atrasado";
  return l.status;
}

/** Conta para badge na sidebar: VENCIDO ou VENCE LOGO (exclui hoje, amanhã e >7 dias). */
export function lancamentoVencidoOuVenceLogo(l: Lancamento): boolean {
  if (l.status === "pago") return false;
  const dias = diasAteVencimentoCalendar(l.vencimento);
  if (dias < 0) return true;
  if (dias >= 2 && dias <= 7) return true;
  return false;
}

/**
 * Recorrência fixa mensal: entre 30 dias antes e o dia do vencimento da última linha em aberto,
 * alerta nas linhas não pagas do grupo (badge na lista + diálogo ao editar).
 */
export function lancamentoAlertaFimFixoMensal(l: Lancamento, all: Lancamento[]): boolean {
  if (l.status === "pago") return false;
  const rootId = getRecurrenceRootId(l);
  const gfm = getGroupMembers(rootId, all).filter((x) => x.tipoRecorrencia === "fixo_mensal");
  if (gfm.length === 0 || !gfm.some((x) => x.id === l.id)) return false;
  const last = gfm[gfm.length - 1];
  if (last.status === "pago") return false;
  const dias = diasAteVencimentoCalendar(last.vencimento);
  return dias >= 0 && dias <= 30;
}

/** Linha deve exibir bolinha de alerta (central e/ou vencimento urgente ou vencido ou fim de fixo mensal na janela 30d–vencimento). */
export function linhaLancamentoComAlertaVisual(
  l: Lancamento,
  pendingByLancamentoId: Record<string, number>,
  todosLancamentos?: Lancamento[]
): boolean {
  if ((pendingByLancamentoId[l.id] ?? 0) > 0 || badgeUrgenciaVencimento(l) != null) {
    return true;
  }
  if (todosLancamentos?.length && lancamentoAlertaFimFixoMensal(l, todosLancamentos)) {
    return true;
  }
  return false;
}

export function normalizeTextoAlertaMatch(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Extrai valor monetário de textos de alerta (ex.: R$ 1.500,00 ou R$ 1500.00). */
export function parseValorReaisDeTexto(text: string): number | null {
  const m = text.match(/R\$\s*([\d][\d.,]*)/);
  if (!m) return null;
  const raw = m[1];
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(/,/g, "");
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Rótulo curto para exibir junto ao valor (parcelado). */
export function parcelaRotuloCurto(l: Lancamento): string | null {
  if (l.tipoRecorrencia !== "parcelado") return null;
  if (l.parcelaNumero == null || l.parcelas == null || l.parcelas < 2) return null;
  return `Parcela ${l.parcelaNumero}/${l.parcelas}`;
}

/** Mantém a última ocorrência de cada id (evita chaves React duplicadas na grade). */
export function dedupeLancamentosPorId(list: Lancamento[]): Lancamento[] {
  const byId = new Map<string, Lancamento>();
  for (const l of list) {
    byId.set(l.id, l);
  }
  return [...byId.values()];
}
