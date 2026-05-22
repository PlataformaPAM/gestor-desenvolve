import { prisma } from "@/lib/prisma";
import { mapLancamentoFromDb } from "../_shared";
import { ok, fail } from "@/lib/server/api-response";
import { lancamentoVencidoOuVenceLogo } from "@/lib/financeiro/lancamento-utils";
import { reconcileStaleModuleAlerts } from "@/lib/server/alerts-resolve";
import {
  filterLancamentosForSession,
  financeiroAccessGate,
  FINANCEIRO_LANCAMENTOS_RESOURCE,
} from "@/lib/server/financeiro-access";

export async function GET(req: Request) {
  const gate = await financeiroAccessGate(req, FINANCEIRO_LANCAMENTOS_RESOURCE, "ver");
  if (!gate.ok) return ok({ count: 0 });

  try {
    await reconcileStaleModuleAlerts(prisma).catch(() => undefined);

    const rowsRaw = await prisma.lancamento.findMany({
      where: { status: { not: "pago" } },
      include: { criadoPor: { select: { nomeExibicao: true } } },
    });
    const rows = await filterLancamentosForSession(rowsRaw, gate.userId, gate.scope);
    const mapped = rows.map(mapLancamentoFromDb);
    const count = mapped.filter(lancamentoVencidoOuVenceLogo).length;
    return ok({ count });
  } catch {
    return ok({ count: 0 });
  }
}
