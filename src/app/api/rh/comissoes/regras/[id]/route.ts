import { prisma } from "@/lib/prisma";
import { mapRegra } from "@/app/api/comissoes/_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";

type PayloadRegra = {
  ativo?: boolean;
  solucaoCatalogoId?: string | null;
  categoriaSolucao?: string | null;
  baseCalculo?: "bruto" | "liquido";
  percentualComissao?: number;
  despesaFixa?: number | null;
  vigenciaInicio?: string;
  vigenciaFim?: string | null;
  prioridade?: number;
  observacoes?: string | null;
};

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await parseJsonSafe<{ regra?: PayloadRegra }>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const regra = body.value.regra;
  if (!regra) return fail("BAD_REQUEST", "Payload inválido.", 400);

  const existing = await prisma.comissaoRegra.findUnique({ where: { id } });
  if (!existing) return fail("NOT_FOUND", "Regra não encontrada.", 404);

  const mergedBase = regra.baseCalculo ?? existing.baseCalculo;

  if (regra.percentualComissao !== undefined) {
    if (regra.percentualComissao < 0 || regra.percentualComissao > 100) {
      return fail("BAD_REQUEST", "Percentual da comissão deve ficar entre 0 e 100.", 400);
    }
  }

  if (regra.despesaFixa !== undefined && mergedBase === "bruto" && regra.despesaFixa !== null) {
    return fail("BAD_REQUEST", "Despesa fixa (%) só se aplica quando a base de cálculo é líquida.", 400);
  }
  if (regra.despesaFixa !== undefined && mergedBase === "liquido" && regra.despesaFixa !== null) {
    if (typeof regra.despesaFixa !== "number" || regra.despesaFixa < 0 || regra.despesaFixa > 100) {
      return fail("BAD_REQUEST", "Despesa fixa (%) deve ficar entre 0 e 100.", 400);
    }
  }

  /** Só altera despesa quando veio `baseCalculo` ou `despesaFixa` no payload; `bruto` zera despesa. */
  const despesaForPrisma: number | null | undefined =
    regra.baseCalculo === "bruto"
      ? null
      : regra.despesaFixa === undefined
        ? undefined
        : regra.despesaFixa;

  const updated = await prisma.comissaoRegra.update({
    where: { id },
    data: {
      ativo: typeof regra.ativo === "boolean" ? regra.ativo : undefined,
      solucaoCatalogoId: regra.solucaoCatalogoId === undefined ? undefined : regra.solucaoCatalogoId,
      categoriaSolucao:
        regra.categoriaSolucao === undefined ? undefined : regra.categoriaSolucao?.trim() || null,
      baseCalculo: regra.baseCalculo,
      percentualComissao: regra.percentualComissao,
      despesaFixa: despesaForPrisma,
      vigenciaInicio: regra.vigenciaInicio ? new Date(regra.vigenciaInicio) : undefined,
      vigenciaFim: regra.vigenciaFim === undefined ? undefined : regra.vigenciaFim ? new Date(regra.vigenciaFim) : null,
      prioridade: regra.prioridade,
      observacoes: regra.observacoes === undefined ? undefined : regra.observacoes?.trim() || null,
    },
    include: {
      consultor: { select: { nome: true } },
      solucaoCatalogo: { select: { nome: true } },
    },
  });
  await writeAuditLog(prisma, {
    acao: "Regra de comissão atualizada",
    modulo: "comissoes",
    detalhes: `${updated.id} (${updated.consultorId})`,
  });
  return ok({ regra: mapRegra(updated) });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const before = await prisma.comissaoRegra.findUnique({ where: { id } });
  if (!before) return fail("NOT_FOUND", "Regra não encontrada.", 404);
  await prisma.comissaoRegra.delete({ where: { id } });
  await writeAuditLog(prisma, {
    acao: "Regra de comissão excluída",
    modulo: "comissoes",
    detalhes: before ? `${before.id} (${before.consultorId})` : id,
  });
  return ok({ id });
}

