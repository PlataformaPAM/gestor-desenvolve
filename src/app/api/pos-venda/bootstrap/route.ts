import { prisma } from "@/lib/prisma";
import {
  decodePosVendaMeta,
  getPosVendaMarker,
  mapClienteSlim,
  mapEventosFromTask,
  mapPosVendaTask,
} from "../_shared";
import { ok } from "@/lib/server/api-response";
import type { ClienteHealth } from "@/lib/pos-venda/types";
import { emitAlert } from "@/lib/server/alerts";
import { filterPosVendaTarefasRaw, posvendaAccessGate } from "@/lib/server/posvenda-access";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function computeHealth(
  cliente: { id: string; nome: string; empresa: string | null; cpfCnpj: string; status: string },
  tarefas: Array<{ status: string; dataFim: Date }>
): ClienteHealth {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const d30 = new Date(hoje);
  d30.setDate(d30.getDate() - 30);

  const totalTarefas = tarefas.length;
  const pendentes = tarefas.filter((t) => t.status !== "concluido").length;
  const atrasadas = tarefas.filter((t) => t.status !== "concluido" && t.dataFim < hoje).length;
  const adiadas = tarefas.filter((t) => t.status === "aguardando").length;
  const concluidas30d = tarefas.filter((t) => t.status === "concluido" && t.dataFim >= d30).length;
  const concluidasTotal = tarefas.filter((t) => t.status === "concluido").length;

  let score = 100;
  const motivos: string[] = [];
  motivos.push(`Total de tarefas: ${totalTarefas}.`);
  if (cliente.status === "inadimplente") {
    score -= 35;
    motivos.push("Cliente inadimplente.");
  } else if (cliente.status === "inativo") {
    score -= 20;
    motivos.push("Cliente sem atividade recente.");
  }
  if (atrasadas > 0) {
    score -= Math.min(32, atrasadas * 8);
  }
  if (adiadas > 0) {
    score -= Math.min(15, adiadas * 5);
    motivos.push(`${adiadas} tarefa(s) adiada(s).`);
  }
  if (pendentes >= 5) {
    score -= 10;
    motivos.push("Volume alto de pendências.");
  }
  if (concluidas30d === 0) {
    score -= 10;
    motivos.push("Sem entregas concluídas nos últimos 30 dias.");
  } else {
    score += 5;
  }

  score = clamp(score, 0, 100);
  const healthScore: ClienteHealth["healthScore"] = score >= 75 ? "engajado" : score >= 45 ? "neutro" : "risco";
  const proximaAcao =
    healthScore === "risco"
      ? "Abrir ação crítica hoje e contato ativo em até 24h."
      : healthScore === "neutro"
        ? "Executar check-in da régua e reduzir pendências da semana."
        : "Manter relacionamento contínuo e registrar evolução.";

  return {
    clienteId: cliente.id,
    clienteNome: cliente.empresa || cliente.nome,
    clienteDocumento: cliente.cpfCnpj,
    healthScore,
    score,
    pendentes,
    atrasadas,
    concluidasTotal,
    motivoPrincipal: motivos[0] ?? "Cliente com fluxo saudável.",
    proximaAcao,
  };
}

export async function GET(req: Request) {
  const gate = await posvendaAccessGate(req, "ver");
  if (!gate.ok) return gate.response;

  const marker = getPosVendaMarker();
  const [clientes, tarefasRawAll] = await Promise.all([
    prisma.cliente.findMany({ orderBy: { nome: "asc" } }),
    prisma.tarefa.findMany({
      where: { descricao: { contains: marker } },
      include: {
        cliente: true,
        historico: { orderBy: { data: "asc" } },
        colaboradores: { select: { usuarioId: true } },
      },
      orderBy: { dataFim: "asc" },
    }),
  ]);
  const tarefasRaw = filterPosVendaTarefasRaw(tarefasRawAll, gate.session, gate.userId);

  // Tempo real (via polling da página): gera alerta quando tarefa vence hoje.
  const hojeIso = new Date().toISOString().slice(0, 10);
  await Promise.all(
    tarefasRaw.map(async (t) => {
      const parsed = decodePosVendaMeta(t.descricao);
      if (parsed.meta.removidaEm) return;
      if (t.status === "concluido") return;
      const dataIso = t.dataFim.toISOString().slice(0, 10);
      if (dataIso !== hojeIso) return;
      const clienteNome = t.cliente?.empresa || t.cliente?.nome || parsed.meta.clienteNome || "Cliente";
      await emitAlert(prisma, {
        modulo: "posVenda",
        titulo: "Pós-venda: tarefa vence hoje",
        descricao: `${t.titulo} - ${clienteNome} vence hoje e precisa de ação.`,
        dedupeKey: `posvenda-vence-hoje-${t.id}-${hojeIso}`,
      });
    })
  );

  const tarefasMapped = tarefasRaw.map(mapPosVendaTask);
  const tarefas = tarefasMapped.filter((t) => !t.removidaEm);
  const lixeira = tarefasMapped.filter((t) => !!t.removidaEm);
  const eventos = tarefasRaw.flatMap((t, idx) => mapEventosFromTask(tarefasMapped[idx], t.historico));
  const clienteHealth = clientes.map((c) =>
    computeHealth(
      { id: c.id, nome: c.nome, empresa: c.empresa, cpfCnpj: c.cpfCnpj, status: c.status },
      tarefasRaw.filter((t) => {
        if (t.clienteId !== c.id) return false;
        const parsed = decodePosVendaMeta(t.descricao);
        return !parsed.meta.removidaEm;
      })
    )
  );

  const clientesSlim = clientes.map(mapClienteSlim);
  return ok({
    tarefas,
    lixeira,
    eventos,
    clienteHealth,
    clientes: clientesSlim,
    data: {
      tarefas,
      lixeira,
      eventos,
      clienteHealth,
      clientes: clientesSlim,
    },
  });
}

