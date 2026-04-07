import { prisma } from "@/lib/prisma";
import { mapSolucao } from "../_shared";
import { ok } from "@/lib/server/api-response";

export async function GET() {
  const solucoes = await prisma.solucaoCatalogo.findMany({
    orderBy: { createdAt: "desc" },
  });
  const mapped = solucoes.map(mapSolucao);
  return ok({ solucoes: mapped, data: { solucoes: mapped } });
}

