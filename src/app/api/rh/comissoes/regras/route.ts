import { prisma } from "@/lib/prisma";
import { mapRegra } from "@/app/api/comissoes/_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";

type PayloadRegra = {
  consultorId?: string;
  solucaoCatalogoId?: string;
  categoriaSolucao?: string;
  baseCalculo?: "bruto" | "liquido";
  percentualComissao?: number;
  despesaFixa?: number | null;
  vigenciaInicio?: string;
  vigenciaFim?: string | null;
  prioridade?: number;
  observacoes?: string;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const consultorId = searchParams.get("consultorId") ?? undefined;
  const regras = await prisma.comissaoRegra.findMany({
    where: consultorId ? { consultorId } : undefined,
    include: {
      consultor: { select: { nome: true } },
      solucaoCatalogo: { select: { nome: true } },
    },
    orderBy: [{ ativo: "desc" }, { prioridade: "desc" }, { vigenciaInicio: "desc" }, { createdAt: "desc" }],
  });
  return ok({ regras: regras.map(mapRegra) });
}

export async function POST(req: Request) {
  const body = await parseJsonSafe<{ regra?: PayloadRegra }>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const regra = body.value.regra;
  if (!regra?.consultorId || !regra.vigenciaInicio || typeof regra.percentualComissao !== "number") {
    return fail("BAD_REQUEST", "Informe consultor, vigência inicial e percentual.", 400);
  }
  if (regra.percentualComissao < 0 || regra.percentualComissao > 100) {
    return fail("BAD_REQUEST", "Percentual da comissão deve ficar entre 0 e 100.", 400);
  }
  const baseCalculo = regra.baseCalculo ?? "bruto";
  let despesaFixa: number | null = null;
  if (baseCalculo === "liquido") {
    if (regra.despesaFixa != null && regra.despesaFixa !== undefined) {
      if (typeof regra.despesaFixa !== "number" || regra.despesaFixa < 0 || regra.despesaFixa > 100) {
        return fail("BAD_REQUEST", "Despesa fixa (%) deve ficar entre 0 e 100.", 400);
      }
      despesaFixa = regra.despesaFixa;
    }
  } else if (regra.despesaFixa != null && regra.despesaFixa !== undefined) {
    return fail("BAD_REQUEST", "Despesa fixa (%) só se aplica quando a base de cálculo é líquida.", 400);
  }
  const created = await prisma.comissaoRegra.create({
    data: {
      consultorId: regra.consultorId,
      solucaoCatalogoId: regra.solucaoCatalogoId ?? null,
      categoriaSolucao: regra.categoriaSolucao?.trim() || null,
      baseCalculo,
      percentualComissao: regra.percentualComissao,
      despesaFixa,
      vigenciaInicio: new Date(regra.vigenciaInicio),
      vigenciaFim: regra.vigenciaFim ? new Date(regra.vigenciaFim) : null,
      prioridade: regra.prioridade ?? 0,
      observacoes: regra.observacoes?.trim() || null,
    },
    include: {
      consultor: { select: { nome: true } },
      solucaoCatalogo: { select: { nome: true } },
    },
  });
  await writeAuditLog(prisma, {
    acao: "Regra de comissão criada",
    modulo: "comissoes",
    detalhes: `${created.consultorId} ${created.percentualComissao.toString()}%`,
  });
  return ok({ regra: mapRegra(created) }, 201);
}

