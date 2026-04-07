import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/server/api-response";
import { PIPELINE_STAGES } from "@/lib/comercial/constants";

function weekLabel(date: Date): string {
  const d = new Date(date);
  const day = d.getDate();
  return `Dia ${String(day).padStart(2, "0")}`;
}

type UpcomingItem = {
  id: string;
  tipo: string;
  titulo: string;
  when: string;
  href: string;
  accent: string;
};

export async function GET() {
  try {
    const [leads, lancamentos, tickets, clientes, tarefas] = await Promise.all([
      prisma.lead.findMany(),
      prisma.lancamento.findMany(),
      prisma.helpdeskTicket.findMany(),
      prisma.cliente.findMany(),
      prisma.tarefa.findMany(),
    ]);

    const now = new Date();
    const weekEnd = new Date(now.getTime() + 7 * 86400000);

    const receitaPrevista = lancamentos
      .filter((l) => l.tipo === "entrada" && l.status !== "pago")
      .reduce((sum, l) => sum + l.valor, 0);
    const aPagarAberto = lancamentos
      .filter((l) => l.tipo === "saida" && l.status !== "pago")
      .reduce((sum, l) => sum + l.valor, 0);
    const vendasMes = leads.filter((l) => l.stageId === "fechado").length;
    const ticketsAbertos = tickets.filter((t) => t.status !== "finalizado").length;
    const ticketsCriticos = tickets.filter(
      (t) => t.status !== "finalizado" && t.prioridade === "critica"
    ).length;
    const leadsQuentes = leads.filter(
      (l) => l.stageId !== "fechado" && l.stageId !== "perdido" && l.priority === "alta"
    ).length;
    const tarefasAtrasadas = tarefas.filter(
      (t) => t.status !== "concluido" && new Date(t.dataFim) < now
    ).length;
    const tarefasSemana = tarefas.filter(
      (t) =>
        t.status !== "concluido" &&
        new Date(t.dataFim) >= now &&
        new Date(t.dataFim) <= weekEnd
    ).length;

    const fluxoData =
      lancamentos.length === 0
        ? []
        : lancamentos.slice(-12).map((l) => ({
            semana: weekLabel(l.vencimento),
            receita: l.tipo === "entrada" ? l.valor : 0,
            fluxo: l.tipo === "saida" ? -Math.abs(l.valor) : Math.round(l.valor * 0.25),
          }));

    const statusClientes =
      clientes.length === 0
        ? [
            { name: "Ativos", value: 0, color: "#7c3aed" },
            { name: "Inativos", value: 0, color: "#64748b" },
            { name: "Inadimplentes", value: 0, color: "#f43f5e" },
          ]
        : [
            { name: "Ativos", value: clientes.filter((c) => c.status === "ativo").length, color: "#7c3aed" },
            { name: "Inativos", value: clientes.filter((c) => c.status === "inativo").length, color: "#64748b" },
            {
              name: "Inadimplentes",
              value: clientes.filter((c) => c.status === "inadimplente").length,
              color: "#f43f5e",
            },
          ];

    /** Auditoria no painel: lista vazia até definirmos o que exibir (evita histórico antigo poluir a visão). */
    const atividades: Array<{ id: string; texto: string; tempo: string; cor: string }> = [];

    const kpis = [
      { id: "receita", label: "A receber (aberto)", value: receitaPrevista, trend: 0, trendLabel: "base real" },
      { id: "pagar", label: "A pagar (aberto)", value: aPagarAberto, trend: 0, trendLabel: "base real" },
      { id: "pipeline", label: "Oportunidades ativas", value: leads.filter((l) => l.stageId !== "fechado" && l.stageId !== "perdido").length, trend: 0, trendLabel: "funil" },
      { id: "risco", label: "Itens de atenção", value: ticketsCriticos + tarefasAtrasadas + leadsQuentes, trend: 0, trendLabel: "soma críticos" },
    ];

    const pipelineBars =
      leads.length === 0
        ? []
        : PIPELINE_STAGES.filter((s) => s.id !== "perdido").map((s) => ({
            id: s.id,
            label: s.label,
            count: leads.filter((l) => l.stageId === s.id).length,
          }));

    const upcoming: UpcomingItem[] = [];

    lancamentos
      .filter((l) => l.status !== "pago" && l.vencimento >= now && l.vencimento <= weekEnd)
      .sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime())
      .slice(0, 4)
      .forEach((l) => {
        upcoming.push({
          id: `lan-${l.id}`,
          tipo: l.tipo === "entrada" ? "Receita" : "Despesa",
          titulo: l.descricao.slice(0, 48) + (l.descricao.length > 48 ? "…" : ""),
          when: l.vencimento.toISOString(),
          href: "/financeiro",
          accent: l.tipo === "entrada" ? "#10b981" : "#f43f5e",
        });
      });

    tarefas
      .filter((t) => t.status !== "concluido" && t.dataFim >= now && t.dataFim <= weekEnd)
      .sort((a, b) => a.dataFim.getTime() - b.dataFim.getTime())
      .slice(0, 4)
      .forEach((t) => {
        upcoming.push({
          id: `tar-${t.id}`,
          tipo: "Tarefa",
          titulo: t.titulo.slice(0, 48) + (t.titulo.length > 48 ? "…" : ""),
          when: t.dataFim.toISOString(),
          href: "/tarefas",
          accent: "#8b5cf6",
        });
      });

    tickets
      .filter((t) => t.status !== "finalizado" && t.previsaoConclusao >= now && t.previsaoConclusao <= weekEnd)
      .sort((a, b) => a.previsaoConclusao.getTime() - b.previsaoConclusao.getTime())
      .slice(0, 3)
      .forEach((t) => {
        upcoming.push({
          id: `tk-${t.id}`,
          tipo: "Ticket",
          titulo: `${t.codigo} · ${t.assunto.slice(0, 36)}`,
          when: t.previsaoConclusao.toISOString(),
          href: "/helpdesk",
          accent: "#0ea5e9",
        });
      });

    leads
      .filter(
        (l) =>
          l.stageId !== "fechado" &&
          l.stageId !== "perdido" &&
          l.previsaoFechamento &&
          l.previsaoFechamento >= now &&
          l.previsaoFechamento <= weekEnd
      )
      .sort((a, b) => (a.previsaoFechamento!.getTime() - b.previsaoFechamento!.getTime()))
      .slice(0, 3)
      .forEach((l) => {
        upcoming.push({
          id: `lead-${l.id}`,
          tipo: "Fechamento",
          titulo: l.company || l.name,
          when: l.previsaoFechamento!.toISOString(),
          href: "/comercial",
          accent: "#d946ef",
        });
      });

    upcoming.sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime());
    const upcomingTop = upcoming.slice(0, 10);

    const maxLeads = 40;
    const atrasosFin = lancamentos.filter((l) => l.status !== "pago" && l.vencimento < now).length;
    const baseVazia =
      leads.length === 0 &&
      lancamentos.length === 0 &&
      tickets.length === 0 &&
      tarefas.length === 0 &&
      clientes.length === 0;
    const radarModulos = baseVazia
      ? [
          { modulo: "Comercial", valor: 0 },
          { modulo: "Financeiro", valor: 0 },
          { modulo: "Clientes", valor: 0 },
          { modulo: "Suporte", valor: 0 },
          { modulo: "Tarefas", valor: 0 },
          { modulo: "Operação", valor: 0 },
        ]
      : [
          {
            modulo: "Comercial",
            valor:
              leads.length === 0
                ? 0
                : Math.min(100, Math.round((leads.filter((l) => l.stageId !== "perdido").length / maxLeads) * 100)),
          },
          {
            modulo: "Financeiro",
            valor: lancamentos.length === 0 ? 0 : Math.min(100, Math.max(0, 100 - Math.min(100, atrasosFin * 14))),
          },
          {
            modulo: "Clientes",
            valor:
              clientes.length === 0
                ? 0
                : Math.min(100, Math.round((clientes.filter((c) => c.status === "ativo").length / 30) * 100)),
          },
          {
            modulo: "Suporte",
            valor: tickets.length === 0 ? 0 : Math.min(100, Math.max(0, 100 - ticketsAbertos * 10)),
          },
          {
            modulo: "Tarefas",
            valor: tarefas.length === 0 ? 0 : Math.min(100, Math.max(0, 100 - tarefasAtrasadas * 18)),
          },
          {
            modulo: "Operação",
            valor: Math.min(
              100,
              vendasMes * 20 + Math.min(50, clientes.filter((c) => c.status === "ativo").length * 5)
            ),
          },
        ];

    const moduleTiles = [
      {
        id: "comercial",
        title: "Comercial",
        href: "/comercial",
        stat: `${leadsQuentes} quentes`,
        sub: `${pipelineBars.reduce((s, b) => s + b.count, 0)} no funil`,
        gradient: "from-fuchsia-500/20 via-violet-500/15 to-transparent",
        border: "border-fuchsia-400/30",
      },
      {
        id: "financeiro",
        title: "Financeiro",
        href: "/financeiro",
        stat: `R$ ${(receitaPrevista / 1000).toFixed(0)}k a receber`,
        sub: `R$ ${(aPagarAberto / 1000).toFixed(0)}k a pagar`,
        gradient: "from-emerald-500/20 via-teal-500/10 to-transparent",
        border: "border-emerald-400/35",
      },
      {
        id: "clientes",
        title: "Clientes",
        href: "/clientes",
        stat: `${clientes.filter((c) => c.status === "ativo").length} ativos`,
        sub: `${clientes.length} cadastros`,
        gradient: "from-violet-500/20 to-transparent",
        border: "border-violet-400/30",
      },
      {
        id: "helpdesk",
        title: "Helpdesk",
        href: "/helpdesk",
        stat: `${ticketsAbertos} abertos`,
        sub: ticketsCriticos ? `${ticketsCriticos} críticos` : "SLA em dia",
        gradient: "from-sky-500/20 to-transparent",
        border: "border-sky-400/35",
      },
      {
        id: "tarefas",
        title: "Tarefas",
        href: "/tarefas",
        stat: `${tarefasSemana} nesta semana`,
        sub: tarefasAtrasadas ? `${tarefasAtrasadas} atrasadas` : "Sem atrasos",
        gradient: "from-amber-500/20 to-transparent",
        border: "border-amber-400/35",
      },
      {
        id: "pos-venda",
        title: "Pós-venda",
        href: "/pos-venda",
        stat: "Regua ativa",
        sub: "Ações e health",
        gradient: "from-rose-500/15 to-transparent",
        border: "border-rose-400/30",
      },
    ];

    const payload = {
      kpis,
      fluxoData,
      statusClientes,
      atividades,
      pipelineBars,
      upcoming: upcomingTop,
      radarModulos,
      moduleTiles,
    };

    return ok({ ...payload, data: payload });
  } catch {
    return fail("INTERNAL_ERROR", "Falha ao carregar dashboard.", 500);
  }
}
