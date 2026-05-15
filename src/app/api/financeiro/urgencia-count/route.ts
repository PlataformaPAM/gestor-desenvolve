import { prisma } from "@/lib/prisma";
import { mapLancamentoFromDb } from "../_shared";
import { ok, fail } from "@/lib/server/api-response";
import { lancamentoVencidoOuVenceLogo } from "@/lib/financeiro/lancamento-utils";
import { reconcileStaleModuleAlerts } from "@/lib/server/alerts-resolve";

export async function GET() {
  try {
    await reconcileStaleModuleAlerts(prisma).catch(() => undefined);

    const rows = await prisma.lancamento.findMany({
      where: { status: { not: "pago" } },
      include: { criadoPor: { select: { nomeExibicao: true } } },
    });
    const mapped = rows.map(mapLancamentoFromDb);
    const count = mapped.filter(lancamentoVencidoOuVenceLogo).length;
    return ok({ count });
  } catch {
    return ok({ count: 0 });
  }
}
