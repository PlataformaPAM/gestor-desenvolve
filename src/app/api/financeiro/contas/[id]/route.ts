import { prisma } from "@/lib/prisma";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await parseJsonSafe<{
    nome?: string;
    saldoInicial?: number;
    padrao?: boolean;
    ativo?: boolean;
  }>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const v = body.value;
  try {
    if (v.padrao) {
      await prisma.financeiroConta.updateMany({ data: { padrao: false } });
    }
    const updated = await prisma.financeiroConta.update({
      where: { id },
      data: {
        ...(v.nome != null ? { nome: v.nome.trim() } : {}),
        ...(v.saldoInicial != null ? { saldoInicial: v.saldoInicial } : {}),
        ...(v.padrao != null ? { padrao: v.padrao } : {}),
        ...(v.ativo != null ? { ativo: v.ativo } : {}),
      },
    });
    await writeAuditLog(prisma, {
      acao: "Conta financeira atualizada",
      modulo: "financeiro",
      detalhes: updated.nome,
    });
    return ok({ conta: updated });
  } catch {
    return fail("NOT_FOUND", "Conta não encontrada.", 404);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    await prisma.financeiroConta.delete({ where: { id } });
    await writeAuditLog(prisma, {
      acao: "Conta financeira excluída",
      modulo: "financeiro",
      detalhes: id,
    });
    return ok({ id });
  } catch {
    return fail("NOT_FOUND", "Conta não encontrada ou em uso.", 404);
  }
}
