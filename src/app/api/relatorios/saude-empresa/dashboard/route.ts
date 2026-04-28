import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/server/api-response";

function monthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function clampScore(v: number): number {
  return Math.max(0, Math.min(100, v));
}

export async function GET() {
  try {
    const { start, end } = monthBounds();
    const now = Date.now();

    const [clientes, tarefas, tickets, lancamentos, leads] = await Promise.all([
      prisma.cliente.findMany({
        select: { id: true, nome: true, empresa: true },
        orderBy: { nome: "asc" },
      }),
      prisma.tarefa.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { clienteId: true, status: true, dataFim: true },
      }),
      prisma.helpdeskTicket.findMany({
        where: { dataCriacao: { gte: start, lte: end } },
        select: { clienteId: true, status: true, previsaoConclusao: true },
      }),
      prisma.lancamento.findMany({
        where: { vencimento: { gte: start, lte: end } },
        select: { clienteId: true, tipo: true, status: true, valor: true, vencimento: true },
      }),
      prisma.lead.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { stageId: true, valorTotal: true, value: true },
      }),
    ]);

    const tarefasAtrasadas = tarefas.filter((t) => t.status !== "concluido" && t.dataFim.getTime() < now).length;
    const ticketsAtrasados = tickets.filter(
      (t) => !["finalizado", "nao_solucionado"].includes(t.status) && t.previsaoConclusao.getTime() < now
    ).length;
    const receitaPrevista = lancamentos
      .filter((l) => l.tipo === "entrada")
      .reduce((acc, l) => acc + l.valor, 0);
    const saidasPrevistas = lancamentos
      .filter((l) => l.tipo === "saida")
      .reduce((acc, l) => acc + l.valor, 0);
    const inadimplencia = lancamentos
      .filter((l) => l.tipo === "entrada" && l.status !== "pago" && l.vencimento.getTime() < now)
      .reduce((acc, l) => acc + l.valor, 0);
    const ganhos = leads.filter((l) => l.stageId === "fechado");
    const perdidos = leads.filter((l) => l.stageId === "perdido");
    const taxaConversao =
      ganhos.length + perdidos.length > 0
        ? (ganhos.length / (ganhos.length + perdidos.length)) * 100
        : 0;

    const scorePorCliente = clientes
      .map((c) => {
        const tarefasCliente = tarefas.filter((t) => t.clienteId === c.id);
        const ticketsCliente = tickets.filter((t) => t.clienteId === c.id);
        const lancamentosCliente = lancamentos.filter((l) => l.clienteId === c.id);

        const tarefasTot = tarefasCliente.length;
        const ticketsTot = ticketsCliente.length;
        const atrasosTarefa = tarefasCliente.filter((t) => t.status !== "concluido" && t.dataFim.getTime() < now).length;
        const atrasosTicket = ticketsCliente.filter(
          (t) => !["finalizado", "nao_solucionado"].includes(t.status) && t.previsaoConclusao.getTime() < now
        ).length;
        const entregasTotal = tarefasTot + ticketsTot;
        const atrasosTotal = atrasosTarefa + atrasosTicket;
        const sla = entregasTotal > 0 ? ((entregasTotal - atrasosTotal) / entregasTotal) * 100 : 100;

        const recebiveis = lancamentosCliente
          .filter((l) => l.tipo === "entrada")
          .reduce((acc, l) => acc + l.valor, 0);
        const inadimplente = lancamentosCliente
          .filter((l) => l.tipo === "entrada" && l.status !== "pago" && l.vencimento.getTime() < now)
          .reduce((acc, l) => acc + l.valor, 0);
        const adimplencia =
          recebiveis > 0 ? ((recebiveis - inadimplente) / recebiveis) * 100 : 100;

        const score = clampScore(sla * 0.6 + adimplencia * 0.4);
        return {
          clienteId: c.id,
          cliente: (c.empresa?.trim() || c.nome).trim(),
          score,
          sla: clampScore(sla),
          adimplencia: clampScore(adimplencia),
          atrasos: atrasosTotal,
          entregas: entregasTotal,
          inadimplente,
        };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 20);

    const distributivoScore = [
      { faixa: "0-39", total: scorePorCliente.filter((x) => x.score < 40).length },
      { faixa: "40-69", total: scorePorCliente.filter((x) => x.score >= 40 && x.score < 70).length },
      { faixa: "70-100", total: scorePorCliente.filter((x) => x.score >= 70).length },
    ];

    return ok({
      resumo: {
        receitaPrevista,
        saidasPrevistas,
        saldoPrevisto: receitaPrevista - saidasPrevistas,
        inadimplencia,
        tarefasAtrasadas,
        ticketsAtrasados,
        taxaConversao,
        clientesMonitorados: clientes.length,
      },
      charts: {
        distributivoScore,
      },
      scorePorCliente,
    });
  } catch {
    return fail("INTERNAL_ERROR", "Falha ao montar painel de saúde da empresa.", 500);
  }
}
