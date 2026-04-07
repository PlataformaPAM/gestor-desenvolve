import type { Lancamento } from "./types";
import type { FinanceiroConta } from "./types";

/** Fim do dia de hoje (local) para comparar com dataPagamento. */
function fimDoDiaHoje(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Saldo em caixa: saldos iniciais das contas ativas
 * + entradas já pagas (data de pagamento/recebimento até hoje)
 * - saídas já pagas no mesmo critério.
 * Movimenta no momento da baixa (status pago + dataPagamento).
 */
export function calcularCaixaAtual(lancamentos: Lancamento[], contas: FinanceiroConta[]): number {
  const base = contas.filter((c) => c.ativo).reduce((s, c) => s + (Number.isFinite(c.saldoInicial) ? c.saldoInicial : 0), 0);
  const limite = fimDoDiaHoje().getTime();
  let ent = 0;
  let sai = 0;
  for (const l of lancamentos) {
    if (l.status !== "pago" || !l.dataPagamento) continue;
    const t = new Date(l.dataPagamento).getTime();
    if (Number.isNaN(t) || t > limite) continue;
    if (l.tipo === "entrada") ent += l.valor;
    else sai += l.valor;
  }
  return base + ent - sai;
}

/**
 * Previsão ao “fechar” o período filtrado: caixa atual + o que ainda está aberto (pendente/atrasado) no período.
 */
export function calcularPrevisaoPeriodo(
  caixaAtual: number,
  lancamentosNoPeriodo: Lancamento[]
): number {
  let rec = 0;
  let pag = 0;
  for (const l of lancamentosNoPeriodo) {
    if (l.status !== "pendente" && l.status !== "atrasado") continue;
    if (l.tipo === "entrada") rec += l.valor;
    else pag += l.valor;
  }
  return caixaAtual + rec - pag;
}
