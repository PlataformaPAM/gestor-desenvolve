import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";

export async function PATCH(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const exists = await prisma.alerta.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return fail("NOT_FOUND", "Alerta não encontrado.", 404);
  await prisma.alerta.update({
    where: { id },
    data: { lida: true },
  });
  await writeAuditLog(prisma, {
    acao: "Alerta marcado como lido",
    modulo: "alertas",
    detalhes: `Alerta ${id}`,
  });
  return ok({ updated: true });
}

