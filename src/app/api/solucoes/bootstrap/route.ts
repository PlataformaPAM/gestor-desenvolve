import { prisma } from "@/lib/prisma";
import { mapSolucao } from "../_shared";
import { ok } from "@/lib/server/api-response";
import { solucoesAccessGate } from "@/lib/server/solucoes-access";

export async function GET(req: Request) {
  const gate = await solucoesAccessGate(req, "ver");
  if (!gate.ok) return gate.response;

  const solucoes = await prisma.solucaoCatalogo.findMany({
    orderBy: { createdAt: "desc" },
  });
  const mapped = solucoes.map(mapSolucao);
  return ok({ solucoes: mapped, data: { solucoes: mapped } });
}

