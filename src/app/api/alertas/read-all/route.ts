import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { ok } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";

export async function PATCH() {
  let result = { count: 0 };
  try {
    result = await prisma.alerta.updateMany({
      where: { lida: false },
      data: { lida: true },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021")) {
      throw error;
    }
  }
  await writeAuditLog(prisma, {
    acao: "Alertas marcados como lidos",
    modulo: "alertas",
    detalhes: `${result.count} alerta(s) atualizados`,
  });
  return ok({ updated: result.count });
}

