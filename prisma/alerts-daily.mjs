import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDatabaseUrlFromEnvFiles() {
  if (process.env.DATABASE_URL) return;
  for (const name of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    const lines = readFileSync(p, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const m = t.match(/^DATABASE_URL\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[1].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env.DATABASE_URL = v;
      return;
    }
  }
}

loadDatabaseUrlFromEnvFiles();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Defina DATABASE_URL para executar alerts:daily.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function toDateOnly(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function diffDays(from, to) {
  const a = toDateOnly(from).getTime();
  const b = toDateOnly(to).getTime();
  return Math.round((b - a) / 86400000);
}

async function emitAlert({ modulo, titulo, descricao, dedupeKey, data = new Date() }) {
  const tag = dedupeKey ? `[ALERTA_DEDUPE:${dedupeKey}]` : "";
  if (tag) {
    const existing = await prisma.alerta.findFirst({
      where: { descricao: { contains: tag } },
      select: { id: true },
    });
    if (existing) return false;
  }
  await prisma.alerta.create({
    data: { modulo, titulo, descricao: `${descricao}${tag ? `\n${tag}` : ""}`, data },
  });
  return true;
}

async function run() {
  const today = toDateOnly(new Date());
  const milestonesDueSoon = [7, 1];
  const milestonesOverdue = [0, -3, -7, -15, -30, -60];

  const lancamentos = await prisma.lancamento.findMany({
    where: { status: { not: "pago" } },
    include: { cliente: true },
  });

  for (const l of lancamentos) {
    const due = toDateOnly(l.vencimento);
    const delta = diffDays(today, due);
    if (milestonesDueSoon.includes(delta)) {
      await emitAlert({
        modulo: "financeiro",
        titulo: `Lançamento vence em ${delta} dia(s)`,
        descricao: `${l.descricao} vence em ${delta} dia(s). Valor: R$ ${l.valor.toFixed(2)}.`,
        dedupeKey: `lancamento-vencer-${l.id}-${delta}`,
      });
    }
    if (milestonesOverdue.includes(delta)) {
      const abs = Math.abs(delta);
      const suffix = delta === 0 ? "hoje" : `${abs} dia(s)`;
      await emitAlert({
        modulo: "financeiro",
        titulo: delta === 0 ? "Lançamento vence hoje" : "Lançamento em atraso",
        descricao: `${l.descricao} ${delta === 0 ? "vence hoje" : `está em atraso há ${suffix}`}. Valor: R$ ${l.valor.toFixed(2)}.`,
        dedupeKey: `lancamento-atraso-${l.id}-${delta}`,
      });
    }
  }

  const leadsAtivos = await prisma.lead.findMany({
    where: { stageId: "prospecao" },
    include: {
      interactions: {
        orderBy: { date: "desc" },
        take: 1,
        select: { date: true },
      },
    },
  });
  for (const lead of leadsAtivos) {
    const ultimaInteracao = lead.interactions?.[0]?.date ?? lead.enteredStageAt ?? lead.updatedAt ?? lead.createdAt;
    const diasSemInteracao = Math.abs(diffDays(ultimaInteracao, today));
    if (diasSemInteracao < 7) continue;
    const anchor = toDateOnly(ultimaInteracao).toISOString().slice(0, 10);
    await emitAlert({
      modulo: "comercial",
      titulo: "Lead em Prospecção sem avanço",
      descricao: `Lead ${lead.name} está há ${diasSemInteracao} dias em Prospecção sem interação registrada. Comercial deve retomar contato.`,
      dedupeKey: `lead-prospeccao-parado-7d-${lead.id}-${anchor}`,
    });
  }

  const clientes = await prisma.cliente.findMany();
  for (const c of clientes) {
    const vencidos = lancamentos.filter(
      (l) => l.tipo === "entrada" && l.clienteId === c.id && toDateOnly(l.vencimento) < today
    );
    const hasOverdue = vencidos.length > 0;
    if (hasOverdue && c.status !== "inadimplente") {
      await prisma.cliente.update({ where: { id: c.id }, data: { status: "inadimplente" } });
      await emitAlert({
        modulo: "financeiro",
        titulo: "Cliente ficou inadimplente",
        descricao: `Cliente ${c.empresa || c.nome} está inadimplente por recebíveis vencidos.`,
        dedupeKey: `cliente-inadimplente-${c.id}-${today.toISOString().slice(0, 10)}`,
      });
    }
    if (!hasOverdue && c.status === "inadimplente") {
      await prisma.cliente.update({ where: { id: c.id }, data: { status: "ativo" } });
      await emitAlert({
        modulo: "financeiro",
        titulo: "Cliente regularizado",
        descricao: `Cliente ${c.empresa || c.nome} saiu da inadimplência e voltou para ativo.`,
        dedupeKey: `cliente-regularizado-${c.id}-${today.toISOString().slice(0, 10)}`,
      });
    }
  }

  const contratos = await prisma.contrato.findMany({
    where: { status: { in: ["ativo", "pendente_financeiro"] }, dataFim: { not: null } },
    include: { cliente: true },
  });
  const contratoMilestones = [60, 30, 15, 7, 0];
  for (const ct of contratos) {
    const delta = diffDays(today, ct.dataFim);
    if (!contratoMilestones.includes(delta)) continue;
    await emitAlert({
      modulo: "contratos",
      titulo: delta === 0 ? "Contrato vence hoje" : `Contrato vence em ${delta} dias`,
      descricao: `Contrato ${ct.titulo || ct.id} do cliente ${ct.cliente.empresa || ct.cliente.nome} ${delta === 0 ? "vence hoje" : `vence em ${delta} dias`}.`,
      dedupeKey: `contrato-vencimento-${ct.id}-${delta}`,
    });
  }

  const recentlyUpdatedContracts = await prisma.contrato.findMany({
    where: {
      status: "ativo",
      updatedAt: { gte: addDays(today, -1) },
    },
    include: { cliente: true },
  });
  for (const ct of recentlyUpdatedContracts) {
    if (ct.updatedAt.getTime() - ct.createdAt.getTime() > 60 * 1000) {
      await emitAlert({
        modulo: "contratos",
        titulo: "Contrato atualizado/renovado",
        descricao: `Contrato ${ct.titulo || ct.id} do cliente ${ct.cliente.empresa || ct.cliente.nome} foi atualizado recentemente.`,
        dedupeKey: `contrato-renovado-${ct.id}-${today.toISOString().slice(0, 10)}`,
      });
    }
  }

  const tickets = await prisma.helpdeskTicket.findMany({
    where: { status: { not: "finalizado" } },
  });
  for (const t of tickets) {
    const delta = diffDays(today, t.previsaoConclusao);
    if (delta === 1 || delta === 0) {
      await emitAlert({
        modulo: "helpdesk",
        titulo: delta === 0 ? "Ticket vence hoje" : "Ticket vence amanhã",
        descricao: `Ticket ${t.codigo} - ${t.assunto} está próximo do prazo de conclusão.`,
        dedupeKey: `ticket-vencer-${t.id}-${delta}`,
      });
    }
    if (delta < 0 && [3, 7, 15, 30].includes(Math.abs(delta))) {
      await emitAlert({
        modulo: "helpdesk",
        titulo: "Ticket em atraso",
        descricao: `Ticket ${t.codigo} - ${t.assunto} está em atraso há ${Math.abs(delta)} dias.`,
        dedupeKey: `ticket-atraso-${t.id}-${delta}`,
      });
    }
  }

  const tarefas = await prisma.tarefa.findMany({
    where: { status: { not: "concluido" } },
  });
  for (const t of tarefas) {
    const delta = diffDays(today, t.dataFim);
    const isPosVenda = (t.descricao || "").includes("[POSVENDA_META]");
    const targetModulo = isPosVenda ? "posVenda" : "tarefas";
    const prefix = isPosVenda ? "pós-venda" : "interna";
    if (delta === 7 || delta === 1 || delta === 0) {
      await emitAlert({
        modulo: targetModulo,
        titulo:
          delta === 0
            ? `Tarefa ${prefix} vence hoje`
            : delta === 1
              ? `Tarefa ${prefix} vence amanhã`
              : `Tarefa ${prefix} vence em 7 dias`,
        descricao: `${t.titulo} está próxima do prazo final.`,
        dedupeKey: `tarefa-vencer-${targetModulo}-${t.id}-${delta}`,
      });
    }
    if (delta < 0 && [3, 7, 15, 30, 60].includes(Math.abs(delta))) {
      await emitAlert({
        modulo: targetModulo,
        titulo: `Tarefa ${prefix} em atraso`,
        descricao: `${t.titulo} está em atraso há ${Math.abs(delta)} dia(s).`,
        dedupeKey: `tarefa-atraso-${targetModulo}-${t.id}-${delta}`,
      });
    }
  }

  const tarefasPorCliente = new Map();
  for (const t of tarefas) {
    if (!(t.descricao || "").includes("[POSVENDA_META]")) continue;
    if (!t.clienteId) continue;
    const due = toDateOnly(t.dataFim);
    const overdue = due < today ? 1 : 0;
    const prev = tarefasPorCliente.get(t.clienteId) || { overdue: 0 };
    prev.overdue += overdue;
    tarefasPorCliente.set(t.clienteId, prev);
  }
  for (const [clienteId, stats] of tarefasPorCliente.entries()) {
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { empresa: true, nome: true } });
    if (!cliente) continue;
    if (stats.overdue >= 3) {
      await emitAlert({
        modulo: "posVenda",
        titulo: "Cliente em Risco no Pós-venda",
        descricao: `${cliente.empresa || cliente.nome} evoluiu para risco (acúmulo de tarefas em atraso).`,
        dedupeKey: `posvenda-health-risco-${clienteId}-${today.toISOString().slice(0, 10)}`,
      });
    } else if (stats.overdue >= 1) {
      await emitAlert({
        modulo: "posVenda",
        titulo: "Cliente em Neutro no Pós-venda",
        descricao: `${cliente.empresa || cliente.nome} saiu de engajado para neutro (tarefas em atraso).`,
        dedupeKey: `posvenda-health-neutro-${clienteId}-${today.toISOString().slice(0, 10)}`,
      });
    }
  }

  const onboardingDoneByCliente = await prisma.tarefa.groupBy({
    by: ["clienteId"],
    where: { status: "concluido", descricao: { contains: "\"categoria\":\"onboarding\"" }, clienteId: { not: null } },
    _count: { _all: true },
  });
  for (const group of onboardingDoneByCliente) {
    const pendingOnboarding = await prisma.tarefa.count({
      where: { clienteId: group.clienteId, status: { not: "concluido" }, descricao: { contains: "\"categoria\":\"onboarding\"" } },
    });
    if (pendingOnboarding === 0) {
      await emitAlert({
        modulo: "posVenda",
        titulo: "Pós-venda: iniciar Etapa 2",
        descricao: `Cliente com onboarding concluído. Inicie relacionamento contínuo (Etapa 2).`,
        dedupeKey: `posvenda-etapa2-${group.clienteId}`,
      });
    }
  }

  const contratosAtivos = await prisma.contrato.findMany({ where: { status: "ativo" }, select: { id: true, leadId: true, titulo: true } });
  for (const ct of contratosAtivos) {
    const hasLanc = await prisma.lancamento.count({ where: { leadIdOrigem: ct.leadId } });
    if (hasLanc === 0) {
      await emitAlert({
        modulo: "sistema",
        titulo: "Divergência Contrato x Financeiro",
        descricao: `Contrato ativo ${ct.titulo || ct.id} está sem lançamento financeiro vinculado.`,
        dedupeKey: `divergencia-contrato-lancamento-${ct.id}`,
      });
    }
  }

  const overdueCount = lancamentos.filter((l) => toDateOnly(l.vencimento) < today).length;
  if (overdueCount >= 10) {
    const weekKey = `${today.getFullYear()}-W${Math.ceil((today.getDate() + 6) / 7)}`;
    await emitAlert({
      modulo: "sistema",
      titulo: "Tendência de risco financeiro",
      descricao: `Quantidade de lançamentos em atraso está alta (${overdueCount}).`,
      dedupeKey: `tendencia-atrasos-${weekKey}`,
    });
  }

  const pendingFluxoComLancamento = await prisma.leadFinanceiroFluxo.findMany({
    where: { status: "pendente_aprovacao" },
    include: { lead: true },
  });
  for (const fluxo of pendingFluxoComLancamento) {
    const hasLanc = await prisma.lancamento.count({ where: { leadIdOrigem: fluxo.leadId } });
    if (hasLanc > 0) {
      await emitAlert({
        modulo: "sistema",
        titulo: "Aprovação financeira pendente após lançamento",
        descricao: `Lead ${fluxo.lead?.name || fluxo.leadId} possui lançamento financeiro, mas ainda consta como pendente de aprovação.`,
        dedupeKey: `pendente-com-lancamento-${fluxo.leadId}`,
      });
    }
  }
}

run()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });

