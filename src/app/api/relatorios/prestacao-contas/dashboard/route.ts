import { relatoriosAccessGate, RELATORIOS_PRESTACAO_CONTAS_RESOURCE } from "@/lib/server/relatorios-access";
import { userCanAccessClienteId } from "@/lib/server/cliente-access";
import {
  filterRelatorioTarefasRaw,
  filterRelatorioTicketsRaw,
} from "@/lib/server/relatorio-scope";
import { authorize } from "@/lib/server/authorize";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/server/api-response";

function parseDate(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export async function GET(req: Request) {
  const gate = await relatoriosAccessGate(req, RELATORIOS_PRESTACAO_CONTAS_RESOURCE, "ver");
  if (!gate.ok) return gate.response;


  try {
    const url = new URL(req.url);
    const now = new Date();
    const defaultInicio = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultFim = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const inicio = parseDate(url.searchParams.get("periodoInicio"), defaultInicio);
    const fim = parseDate(url.searchParams.get("periodoFim"), defaultFim);
    fim.setHours(23, 59, 59, 999);
    const clienteId = url.searchParams.get("clienteId")?.trim() || "";
    const view = authorize(gate.session, RELATORIOS_PRESTACAO_CONTAS_RESOURCE, "ver");

    if (clienteId && view.scope === "vinculados") {
      const okCliente = await userCanAccessClienteId(gate.userId, clienteId, view.scope);
      if (!okCliente) return fail("FORBIDDEN", "Sem acesso a este cliente.", 403);
    }

    const whereCliente = clienteId ? { clienteId } : {};
    const [tarefasRaw, ticketsRaw, cliente] = await Promise.all([
      prisma.tarefa.findMany({
        where: { ...whereCliente, createdAt: { gte: inicio, lte: fim } },
        include: {
          responsavel: { select: { nomeExibicao: true, email: true } },
          colaboradores: { select: { usuarioId: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.helpdeskTicket.findMany({
        where: { ...whereCliente, dataCriacao: { gte: inicio, lte: fim } },
        include: {
          responsaveis: {
            include: {
              usuario: { select: { nomeExibicao: true, email: true } },
            },
          },
        },
        orderBy: { dataCriacao: "asc" },
      }),
      clienteId
        ? prisma.cliente.findUnique({ where: { id: clienteId }, select: { nome: true, empresa: true } })
        : Promise.resolve(null),
    ]);

    const tarefas = filterRelatorioTarefasRaw(
      tarefasRaw.map((t) => ({
        ...t,
        responsavelId: t.responsavelId,
        colaboradores: t.colaboradores,
      })),
      gate.userId,
      view.scope
    );
    const tickets = filterRelatorioTicketsRaw(
      ticketsRaw.map((t) => ({
        ...t,
        responsaveis: t.responsaveis,
      })),
      gate.userId,
      view.scope
    );

    const nowTs = Date.now();
    const tarefasConcluidas = tarefas.filter((t) => t.status === "concluido").length;
    const tarefasAtrasadas = tarefas.filter((t) => t.status !== "concluido" && t.dataFim.getTime() < nowTs).length;
    const ticketsFechados = tickets.filter((t) => ["finalizado", "nao_solucionado"].includes(t.status)).length;
    const ticketsAtrasados = tickets.filter(
      (t) => !["finalizado", "nao_solucionado"].includes(t.status) && t.previsaoConclusao.getTime() < nowTs
    ).length;

    const totalEntregaveis = tarefas.length + tickets.length;
    const totalConcluidos = tarefasConcluidas + ticketsFechados;
    const slaCumprido = totalEntregaveis > 0 ? ((totalEntregaveis - (tarefasAtrasadas + ticketsAtrasados)) / totalEntregaveis) * 100 : 100;

    const barraStatus = [
      { name: "Tarefas concluídas", value: tarefasConcluidas },
      { name: "Tarefas atrasadas", value: tarefasAtrasadas },
      { name: "Tickets fechados", value: ticketsFechados },
      { name: "Tickets atrasados", value: ticketsAtrasados },
    ];

    const timeline = Array.from({ length: 4 }, (_, i) => {
      const from = new Date(inicio);
      from.setDate(from.getDate() + i * 7);
      const to = new Date(from);
      to.setDate(to.getDate() + 6);
      const tarefasWeek = tarefas.filter((t) => t.createdAt >= from && t.createdAt <= to).length;
      const ticketsWeek = tickets.filter((t) => t.dataCriacao >= from && t.dataCriacao <= to).length;
      return { semana: `Sem ${i + 1}`, tarefas: tarefasWeek, tickets: ticketsWeek };
    });

    const categoriaMap = new Map<string, number>();
    tarefas.forEach((t) => {
      const key = t.prioridade || "sem_prioridade";
      categoriaMap.set(key, (categoriaMap.get(key) ?? 0) + 1);
    });
    tickets.forEach((t) => {
      const key = t.categoria || "sem_categoria";
      categoriaMap.set(key, (categoriaMap.get(key) ?? 0) + 1);
    });
    const porCategoria = [...categoriaMap.entries()].map(([name, value]) => ({ name, value }));

    const responsavelMap = new Map<string, { responsavel: string; total: number; atrasados: number }>();
    tarefas.forEach((t) => {
      const nome = t.responsavel.nomeExibicao?.trim() || t.responsavel.email || "Sem responsável";
      const curr = responsavelMap.get(nome) ?? { responsavel: nome, total: 0, atrasados: 0 };
      curr.total += 1;
      if (t.status !== "concluido" && t.dataFim.getTime() < nowTs) curr.atrasados += 1;
      responsavelMap.set(nome, curr);
    });
    tickets.forEach((t) => {
      const resp = t.responsaveis[0]?.usuario;
      const nome = resp?.nomeExibicao?.trim() || resp?.email || "Sem responsável";
      const curr = responsavelMap.get(nome) ?? { responsavel: nome, total: 0, atrasados: 0 };
      curr.total += 1;
      if (!["finalizado", "nao_solucionado"].includes(t.status) && t.previsaoConclusao.getTime() < nowTs) curr.atrasados += 1;
      responsavelMap.set(nome, curr);
    });
    const slaPorResponsavel = [...responsavelMap.values()]
      .map((x) => ({
        ...x,
        sla: x.total > 0 ? ((x.total - x.atrasados) / x.total) * 100 : 100,
      }))
      .sort((a, b) => a.sla - b.sla || b.atrasados - a.atrasados || b.total - a.total);

    return ok({
      resumo: {
        cliente: cliente ? (cliente.empresa?.trim() || cliente.nome) : "Todos os clientes",
        periodoInicio: inicio.toISOString().slice(0, 10),
        periodoFim: fim.toISOString().slice(0, 10),
        totalEntregaveis,
        totalConcluidos,
        tarefasAtrasadas,
        ticketsAtrasados,
        slaCumprido,
      },
      charts: {
        barraStatus,
        timeline,
        porCategoria,
        slaPorResponsavel,
      },
    });
  } catch {
    return fail("INTERNAL_ERROR", "Falha ao montar dashboard de prestação de contas.", 500);
  }
}
