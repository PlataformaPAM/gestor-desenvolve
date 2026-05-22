import { fail, ok } from "@/lib/server/api-response";
import { PIPELINE_STAGES } from "@/lib/comercial/constants";
import { isSessionAdmin } from "@/lib/server/authorize";
import { getRequestSession, getSessionUserId } from "@/lib/server/request-session";
import {
  getDashboardVisibility,
  loadDashboardClientes,
  loadDashboardLancamentos,
  loadDashboardLeads,
  loadDashboardTarefas,
  loadDashboardTickets,
} from "@/lib/server/dashboard-access";

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

export async function GET(req: Request) {
  try {
    const session = await getRequestSession(req);
    if (!session?.perfilId) {
      return fail("UNAUTHORIZED", "Sessão inválida.", 401);
    }

    const userId = getSessionUserId(req);
    const vis = getDashboardVisibility(session, userId);

    if (!vis.central && !isSessionAdmin(session)) {
      return ok({
        kpis: [],
        fluxoData: [],
        statusClientes: [],
        atividades: [],
        pipelineBars: [],
        upcoming: [],
        radarModulos: [],
        moduleTiles: [],
      });
    }

    const [leads, lancamentos, tickets, clientes, tarefas] = await Promise.all([
      loadDashboardLeads(session, userId, vis),
      loadDashboardLancamentos(session, userId, vis),
      loadDashboardTickets(session, userId, vis),
      loadDashboardClientes(session, userId, vis),
      loadDashboardTarefas(session, userId, vis),
    ]);

    const now = new Date();
    const weekEnd = new Date(now.getTime() + 7 * 86400000);

    const receitaPrevista = vis.financeiro
      ? lancamentos
          .filter((l) => l.tipo === "entrada" && l.status !== "pago")
          .reduce((sum, l) => sum + l.valor, 0)
      : 0;
    const aPagarAberto = vis.financeiro
      ? lancamentos
          .filter((l) => l.tipo === "saida" && l.status !== "pago")
          .reduce((sum, l) => sum + l.valor, 0)
      : 0;
    const vendasMes = vis.comercial
      ? leads.filter((l) => l.stageId === "fechado").length
      : 0;
    const ticketsAbertos = tickets.filter((t) => t.status !== "finalizado").length;
    const ticketsCriticos = tickets.filter(
      (t) => t.status !== "finalizado" && t.prioridade === "critica"
    ).length;
    const leadsQuentes = vis.comercial
      ? leads.filter(
          (l) => l.stageId !== "fechado" && l.stageId !== "perdido" && l.priority === "alta"
        ).length
      : 0;
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
      !vis.financeiro || lancamentos.length === 0
        ? []
        : lancamentos.slice(-12).map((l) => ({
            semana: weekLabel(l.vencimento),
            receita: l.tipo === "entrada" ? l.valor : 0,
            fluxo: l.tipo === "saida" ? -Math.abs(l.valor) : Math.round(l.valor * 0.25),
          }));

    const statusClientes =
      !vis.clientes || clientes.length === 0
        ? [
            { name: "Ativos", value: 0, color: "#7c3aed" },
            { name: "Inativos", value: 0, color: "#64748b" },
            { name: "Inadimplentes", value: 0, color: "#f43f5e" },
          ]
        : [
            {
              name: "Ativos",
              value: clientes.filter((c) => c.status === "ativo").length,
              color: "#7c3aed",
            },
            {
              name: "Inativos",
              value: clientes.filter((c) => c.status === "inativo").length,
              color: "#64748b",
            },
            {
              name: "Inadimplentes",
              value: clientes.filter((c) => c.status === "inadimplente").length,
              color: "#f43f5e",
            },
          ];

    const atividades: Array<{ id: string; texto: string; tempo: string; cor: string }> = [];

    const kpis: Array<{
      id: string;
      label: string;
      value: number;
      trend: number;
      trendLabel: string;
    }> = [];

    if (vis.financeiro) {
      kpis.push(
        {
          id: "receita",
          label: "A receber (aberto)",
          value: receitaPrevista,
          trend: 0,
          trendLabel: "base real",
        },
        {
          id: "pagar",
          label: "A pagar (aberto)",
          value: aPagarAberto,
          trend: 0,
          trendLabel: "base real",
        }
      );
    }
    if (vis.comercial) {
      kpis.push({
        id: "pipeline",
        label: "Oportunidades ativas",
        value: leads.filter((l) => l.stageId !== "fechado" && l.stageId !== "perdido").length,
        trend: 0,
        trendLabel: "funil",
      });
    }
    if (vis.comercial || vis.helpdesk || vis.tarefas) {
      kpis.push({
        id: "risco",
        label: "Itens de atenção",
        value:
          (vis.helpdesk ? ticketsCriticos : 0) +
          (vis.tarefas ? tarefasAtrasadas : 0) +
          (vis.comercial ? leadsQuentes : 0),
        trend: 0,
        trendLabel: "soma críticos",
      });
    }

    if (isSessionAdmin(session) && kpis.length === 0) {
      kpis.push(
        { id: "receita", label: "A receber (aberto)", value: 0, trend: 0, trendLabel: "base real" },
        { id: "pagar", label: "A pagar (aberto)", value: 0, trend: 0, trendLabel: "base real" },
        { id: "pipeline", label: "Oportunidades ativas", value: 0, trend: 0, trendLabel: "funil" },
        { id: "risco", label: "Itens de atenção", value: 0, trend: 0, trendLabel: "soma críticos" }
      );
    }

    const pipelineBars =
      !vis.comercial
        ? []
        : leads.length === 0
          ? isSessionAdmin(session)
            ? PIPELINE_STAGES.filter((s) => s.id !== "perdido").map((s) => ({
                id: s.id,
                label: s.label,
                count: 0,
              }))
            : []
          : PIPELINE_STAGES.filter((s) => s.id !== "perdido").map((s) => ({
              id: s.id,
              label: s.label,
              count: leads.filter((l) => l.stageId === s.id).length,
            }));

    const upcoming: UpcomingItem[] = [];

    if (vis.financeiro) {
      lancamentos
        .filter((l) => l.status !== "pago" && l.vencimento >= now && l.vencimento <= weekEnd)
        .sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime())
        .slice(0, 4)
        .forEach((l) => {
          const desc = (l.descricao ?? "").trim() || "Lançamento";
          upcoming.push({
            id: `lan-${l.id}`,
            tipo: l.tipo === "entrada" ? "Receita" : "Despesa",
            titulo: desc.slice(0, 48) + (desc.length > 48 ? "…" : ""),
            when: l.vencimento.toISOString(),
            href: vis.financeiroHref,
            accent: l.tipo === "entrada" ? "#10b981" : "#f43f5e",
          });
        });
    }

    if (vis.tarefas) {
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
    }

    if (vis.helpdesk) {
      tickets
        .filter(
          (t) =>
            t.status !== "finalizado" && t.previsaoConclusao >= now && t.previsaoConclusao <= weekEnd
        )
        .sort((a, b) => a.previsaoConclusao.getTime() - b.previsaoConclusao.getTime())
        .slice(0, 3)
        .forEach((t) => {
          const assunto = (t.assunto ?? "").trim() || "Chamado";
          upcoming.push({
            id: `tk-${t.id}`,
            tipo: "Ticket",
            titulo: `${t.codigo} · ${assunto.slice(0, 36)}`,
            when: t.previsaoConclusao.toISOString(),
            href: "/suporte",
            accent: "#0ea5e9",
          });
        });
    }

    if (vis.comercial) {
      leads
        .filter(
          (l) =>
            l.stageId !== "fechado" &&
            l.stageId !== "perdido" &&
            l.previsaoFechamento &&
            new Date(l.previsaoFechamento) >= now &&
            new Date(l.previsaoFechamento) <= weekEnd
        )
        .sort(
          (a, b) =>
            new Date(a.previsaoFechamento!).getTime() - new Date(b.previsaoFechamento!).getTime()
        )
        .slice(0, 3)
        .forEach((l) => {
          upcoming.push({
            id: `lead-${l.id}`,
            tipo: "Fechamento",
            titulo: (l.company || l.name || "Oportunidade").trim(),
            when: new Date(l.previsaoFechamento!).toISOString(),
            href: "/comercial",
            accent: "#d946ef",
          });
        });
    }

    upcoming.sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime());
    const upcomingTop = upcoming.slice(0, 10);

    const maxLeads = 40;
    const atrasosFin = vis.financeiro
      ? lancamentos.filter((l) => l.status !== "pago" && l.vencimento < now).length
      : 0;
    const baseVazia =
      leads.length === 0 &&
      lancamentos.length === 0 &&
      tickets.length === 0 &&
      tarefas.length === 0 &&
      clientes.length === 0;

    const adminRadarDefault = [
      { modulo: "Comercial", valor: 0 },
      { modulo: "Financeiro", valor: 0 },
      { modulo: "Clientes", valor: 0 },
      { modulo: "Suporte", valor: 0 },
      { modulo: "Tarefas", valor: 0 },
      { modulo: "Operação", valor: 0 },
    ];

    const radarModulos = baseVazia
      ? isSessionAdmin(session)
        ? adminRadarDefault
        : []
      : [
          vis.comercial && {
            modulo: "Comercial",
            valor:
              leads.length === 0
                ? 0
                : Math.min(
                    100,
                    Math.round((leads.filter((l) => l.stageId !== "perdido").length / maxLeads) * 100)
                  ),
          },
          vis.financeiro && {
            modulo: "Financeiro",
            valor:
              lancamentos.length === 0
                ? 0
                : Math.min(100, Math.max(0, 100 - Math.min(100, atrasosFin * 14))),
          },
          vis.clientes && {
            modulo: "Clientes",
            valor:
              clientes.length === 0
                ? 0
                : Math.min(
                    100,
                    Math.round((clientes.filter((c) => c.status === "ativo").length / 30) * 100)
                  ),
          },
          vis.helpdesk && {
            modulo: "Suporte",
            valor:
              tickets.length === 0 ? 0 : Math.min(100, Math.max(0, 100 - ticketsAbertos * 10)),
          },
          vis.tarefas && {
            modulo: "Tarefas",
            valor:
              tarefas.length === 0
                ? 0
                : Math.min(100, Math.max(0, 100 - tarefasAtrasadas * 18)),
          },
          (vis.comercial || vis.clientes) && {
            modulo: "Operação",
            valor: Math.min(
              100,
              vendasMes * 20 + Math.min(50, clientes.filter((c) => c.status === "ativo").length * 5)
            ),
          },
        ].filter(Boolean) as Array<{ modulo: string; valor: number }>;

    const moduleTiles = [
      vis.comercial && {
        id: "comercial",
        title: "Comercial",
        href: "/comercial",
        stat: `${leadsQuentes} quentes`,
        sub: `${pipelineBars.reduce((s, b) => s + b.count, 0)} no funil`,
        gradient: "from-fuchsia-500/20 via-violet-500/15 to-transparent",
        border: "border-fuchsia-400/30",
      },
      vis.financeiroNav && {
        id: "financeiro",
        title: "Financeiro",
        href: vis.financeiroHref,
        stat: vis.financeiro
          ? `R$ ${(receitaPrevista / 1000).toFixed(0)}k a receber`
          : "Acessar módulo",
        sub: vis.financeiro
          ? `R$ ${(aPagarAberto / 1000).toFixed(0)}k a pagar`
          : "Comissões e demais áreas",
        gradient: "from-emerald-500/20 via-teal-500/10 to-transparent",
        border: "border-emerald-400/35",
      },
      vis.clientes && {
        id: "clientes",
        title: "Clientes",
        href: "/clientes",
        stat: `${clientes.filter((c) => c.status === "ativo").length} ativos`,
        sub: `${clientes.length} cadastros`,
        gradient: "from-violet-500/20 to-transparent",
        border: "border-violet-400/30",
      },
      vis.helpdesk && {
        id: "helpdesk",
        title: "Suporte",
        href: "/suporte",
        stat: `${ticketsAbertos} abertos`,
        sub: ticketsCriticos ? `${ticketsCriticos} críticos` : "SLA em dia",
        gradient: "from-sky-500/20 to-transparent",
        border: "border-sky-400/35",
      },
      vis.tarefas && {
        id: "tarefas",
        title: "Tarefas",
        href: "/tarefas",
        stat: `${tarefasSemana} nesta semana`,
        sub: tarefasAtrasadas ? `${tarefasAtrasadas} atrasadas` : "Sem atrasos",
        gradient: "from-amber-500/20 to-transparent",
        border: "border-amber-400/35",
      },
      vis.posVenda && {
        id: "pos-venda",
        title: "Pós-venda",
        href: "/pos-venda",
        stat: "Regua ativa",
        sub: "Ações e health",
        gradient: "from-rose-500/15 to-transparent",
        border: "border-rose-400/30",
      },
    ].filter(Boolean);

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

    return ok(payload);
  } catch (error) {
    console.error("[dashboard/bootstrap]", error);
    const msg = error instanceof Error ? error.message : String(error);
    const migrationHint =
      msg.includes("registroLead") ||
      msg.includes("permissoesGranulares") ||
      msg.includes("does not exist");
    if (migrationHint) {
      return fail(
        "MIGRATION_REQUIRED",
        "Banco desatualizado em relação ao app. Rode `npx prisma migrate deploy` no ambiente de produção.",
        503
      );
    }
    return fail("INTERNAL_ERROR", "Falha ao carregar dashboard.", 500);
  }
}
