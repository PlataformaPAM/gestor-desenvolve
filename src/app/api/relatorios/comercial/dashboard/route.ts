import { relatoriosAccessGate, RELATORIOS_COMERCIAL_RESOURCE } from "@/lib/server/relatorios-access";
import { filterRelatorioLeads } from "@/lib/server/relatorio-scope";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/server/api-response";

function monthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { now, start, end };
}

export async function GET(req: Request) {
  const gate = await relatoriosAccessGate(req, RELATORIOS_COMERCIAL_RESOURCE, "ver");
  if (!gate.ok) return gate.response;


  try {
    const { now, start, end } = monthBounds();
    const leadsRaw = await prisma.lead.findMany({
      where: { createdAt: { gte: start, lte: end }, registroLead: "oportunidade" },
      orderBy: { createdAt: "asc" },
    });
    const leads = await filterRelatorioLeads(
      leadsRaw,
      gate.session,
      gate.userId,
      RELATORIOS_COMERCIAL_RESOURCE
    );

    const ganhos = leads.filter((x) => x.stageId === "fechado");
    const perdidos = leads.filter((x) => x.stageId === "perdido");
    const abertos = leads.filter((x) => !["fechado", "perdido"].includes(x.stageId));

    const sum = (arr: typeof leads) => arr.reduce((acc, x) => acc + (x.valorTotal || x.value || 0), 0);
    const taxaConversao = ganhos.length + perdidos.length > 0 ? (ganhos.length / (ganhos.length + perdidos.length)) * 100 : 0;

    const byStageMap = new Map<string, { name: string; quantidade: number; valor: number }>();
    leads.forEach((l) => {
      const key = l.stageId;
      const curr = byStageMap.get(key) ?? { name: key, quantidade: 0, valor: 0 };
      curr.quantidade += 1;
      curr.valor += l.valorTotal || l.value || 0;
      byStageMap.set(key, curr);
    });
    const porEtapa = [...byStageMap.values()];

    const byOrigemMap = new Map<string, number>();
    leads.forEach((l) => {
      const key = l.origem || "outro";
      byOrigemMap.set(key, (byOrigemMap.get(key) ?? 0) + 1);
    });
    const porOrigem = [...byOrigemMap.entries()].map(([name, quantidade]) => ({ name, quantidade }));

    const byWeek = new Map<number, { semana: string; ganhos: number; perdidos: number; novos: number }>();
    leads.forEach((l) => {
      const day = l.createdAt.getDate();
      const week = Math.min(4, Math.floor((day - 1) / 7) + 1);
      const curr = byWeek.get(week) ?? { semana: `Sem ${week}`, ganhos: 0, perdidos: 0, novos: 0 };
      curr.novos += 1;
      if (l.stageId === "fechado") curr.ganhos += 1;
      if (l.stageId === "perdido") curr.perdidos += 1;
      byWeek.set(week, curr);
    });
    const tendenciaSemanal = [1, 2, 3, 4].map((n) => byWeek.get(n) ?? { semana: `Sem ${n}`, ganhos: 0, perdidos: 0, novos: 0 });

    return ok({
      referencia: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      kpis: {
        totalLeads: leads.length,
        valorAberto: sum(abertos),
        valorGanhos: sum(ganhos),
        valorPerdidos: sum(perdidos),
        taxaConversao,
      },
      charts: {
        porEtapa,
        porOrigem,
        tendenciaSemanal,
      },
    });
  } catch {
    return fail("INTERNAL_ERROR", "Falha ao montar dashboard comercial.", 500);
  }
}
