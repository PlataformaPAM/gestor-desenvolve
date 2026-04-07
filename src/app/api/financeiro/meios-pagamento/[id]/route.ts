import { prisma } from "@/lib/prisma";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await parseJsonSafe<{ nome?: string; ativo?: boolean }>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const v = body.value;
  try {
    const updated = await prisma.financeiroMeioPagamento.update({
      where: { id },
      data: {
        ...(v.nome != null ? { nome: v.nome.trim() } : {}),
        ...(v.ativo != null ? { ativo: v.ativo } : {}),
      },
    });
    await writeAuditLog(prisma, {
      acao: "Meio de pagamento atualizado",
      modulo: "financeiro",
      detalhes: updated.nome,
    });
    return ok({ meio: updated });
  } catch {
    return fail("NOT_FOUND", "Meio não encontrado.", 404);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    await prisma.financeiroMeioPagamento.delete({ where: { id } });
    await writeAuditLog(prisma, {
      acao: "Meio de pagamento excluído",
      modulo: "financeiro",
      detalhes: id,
    });
    return ok({ id });
  } catch {
    return fail("NOT_FOUND", "Meio não encontrado ou em uso.", 404);
  }
}
