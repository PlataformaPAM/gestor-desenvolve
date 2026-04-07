import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";

export async function PATCH() {
  const result = await prisma.alerta.updateMany({
    where: { lida: false },
    data: { lida: true },
  });
  await writeAuditLog(prisma, {
    acao: "Alertas marcados como lidos",
    modulo: "alertas",
    detalhes: `${result.count} alerta(s) atualizados`,
  });
  return ok({ updated: result.count });
}

