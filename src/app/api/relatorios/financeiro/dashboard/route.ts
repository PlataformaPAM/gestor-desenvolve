import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/server/api-response";

function monthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  return { now, start, end, todayEnd };
}

export async function GET() {
  try {
    const { now, start, end, todayEnd } = monthBounds();
    const rows = await prisma.lancamento.findMany({
      where: { vencimento: { gte: start, lte: end } },
      orderBy: { vencimento: "asc" },
      include: {
        categoria: { select: { nome: true } },
      },
    });

    const acumuladoAteHoje = rows.filter((x) => x.vencimento <= todayEnd);
    const futuroAteFimMes = rows.filter((x) => x.vencimento > todayEnd);
    const entradasMes = rows.filter((x) => x.tipo === "entrada");
    const saidasMes = rows.filter((x) => x.tipo === "saida");

    const soma = (list: typeof rows) => list.reduce((acc, x) => acc + x.valor, 0);
    const entradasTotal = soma(entradasMes);
    const saidasTotal = soma(saidasMes);
    const saldoProjetadoMes = entradasTotal - saidasTotal;
    const entradasAteHoje = soma(acumuladoAteHoje.filter((x) => x.tipo === "entrada"));
    const saidasAteHoje = soma(acumuladoAteHoje.filter((x) => x.tipo === "saida"));
    const saldoAteHoje = entradasAteHoje - saidasAteHoje;
    const entradasFuturas = soma(futuroAteFimMes.filter((x) => x.tipo === "entrada"));
    const saidasFuturas = soma(futuroAteFimMes.filter((x) => x.tipo === "saida"));

    const porStatus = ["pago", "pendente", "atrasado"].map((status) => ({
      name: status,
      total: soma(rows.filter((x) => x.status === status)),
    }));

    const byDay = new Map<string, { dia: string; entradas: number; saidas: number; saldo: number }>();
    for (const l of rows) {
      const key = l.vencimento.toISOString().slice(0, 10);
      const curr = byDay.get(key) ?? { dia: key.slice(8, 10), entradas: 0, saidas: 0, saldo: 0 };
      if (l.tipo === "entrada") curr.entradas += l.valor;
      else curr.saidas += l.valor;
      curr.saldo = curr.entradas - curr.saidas;
      byDay.set(key, curr);
    }
    const tendenciaDiaria = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);

    const categoriaAgg = new Map<string, number>();
    for (const l of rows.filter((x) => x.tipo === "saida")) {
      const key = l.categoria?.nome?.trim() || "Sem categoria";
      categoriaAgg.set(key, (categoriaAgg.get(key) ?? 0) + l.valor);
    }
    const topCategoriasSaida = [...categoriaAgg.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    return ok({
      referencia: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      kpis: {
        entradasTotal,
        saidasTotal,
        saldoProjetadoMes,
        saldoAteHoje,
        entradasAteHoje,
        saidasAteHoje,
        entradasFuturas,
        saidasFuturas,
      },
      charts: {
        porStatus,
        tendenciaDiaria,
        topCategoriasSaida,
      },
    });
  } catch {
    return fail("INTERNAL_ERROR", "Falha ao montar dashboard financeiro.", 500);
  }
}
