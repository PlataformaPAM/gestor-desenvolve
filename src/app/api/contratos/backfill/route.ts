import { backfillContratosFaltantes } from "@/lib/server/contratos-sync";
import { fail, ok } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { prisma } from "@/lib/prisma";

/** Quantos leads em Fechado ainda não têm contrato (antes de rodar o POST). */
export async function GET() {
  try {
    const pendentes = await prisma.lead.count({
      where: {
        stageId: "fechado",
        clienteId: { not: null },
        contrato: { is: null },
      },
    });
    return ok({ pendentes, data: { pendentes } });
  } catch {
    return fail("INTERNAL_ERROR", "Falha ao contar leads sem contrato.", 500);
  }
}

export async function POST() {
  try {
    const result = await backfillContratosFaltantes();
    await writeAuditLog(prisma, {
      acao: "Backfill de contratos",
      modulo: "contratos",
      detalhes: `${result.criados} contrato(s) criado(s) para leads em Fechado.`,
    });
    return ok({ ...result, data: result });
  } catch {
    return fail("INTERNAL_ERROR", "Falha ao executar backfill de contratos.", 500);
  }
}
