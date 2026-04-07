import { prisma } from "@/lib/prisma";
import type { FinanceiroCategoriaTipo } from "@/lib/financeiro/types";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await parseJsonSafe<{
    nome?: string;
    tipo?: FinanceiroCategoriaTipo;
    ativo?: boolean;
  }>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const v = body.value;
  if (v.tipo != null && v.tipo !== "entrada" && v.tipo !== "saida") {
    return fail("BAD_REQUEST", "Tipo deve ser Entrada ou Saída.", 400);
  }
  try {
    const updated = await prisma.financeiroCategoria.update({
      where: { id },
      data: {
        ...(v.nome != null ? { nome: v.nome.trim() } : {}),
        ...(v.tipo != null ? { tipo: v.tipo } : {}),
        ...(v.ativo != null ? { ativo: v.ativo } : {}),
      },
    });
    await writeAuditLog(prisma, {
      acao: "Categoria financeira atualizada",
      modulo: "financeiro",
      detalhes: updated.nome,
    });
    return ok({ categoria: updated });
  } catch {
    return fail("NOT_FOUND", "Categoria não encontrada.", 404);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    await prisma.financeiroCategoria.delete({ where: { id } });
    await writeAuditLog(prisma, {
      acao: "Categoria financeira excluída",
      modulo: "financeiro",
      detalhes: id,
    });
    return ok({ id });
  } catch {
    return fail("NOT_FOUND", "Categoria não encontrada ou em uso.", 404);
  }
}
