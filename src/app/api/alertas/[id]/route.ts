import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { fail, ok } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let exists: { id: string } | null = null;
  try {
    exists = await prisma.alerta.findUnique({ where: { id }, select: { id: true } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return ok({ deleted: false, skipped: true });
    }
    throw error;
  }
  if (!exists) return fail("NOT_FOUND", "Alerta não encontrado.", 404);
  await prisma.alerta.delete({ where: { id } }).catch(() => undefined);
  await writeAuditLog(prisma, {
    acao: "Alerta excluído",
    modulo: "alertas",
    detalhes: `Alerta ${id}`,
  });
  return ok({ deleted: true });
}

