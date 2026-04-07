import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/server/api-response";

export async function GET(_req: Request, ctx: { params: Promise<{ leadId: string }> }) {
  try {
    const { leadId } = await ctx.params;
    if (!leadId) return fail("BAD_REQUEST", "leadId obrigatório.", 400);
    const c = await prisma.contrato.findFirst({
      where: { leadId },
      select: { id: true },
      orderBy: { updatedAt: "desc" },
    });
    return ok({ contratoId: c?.id ?? null });
  } catch {
    return fail("INTERNAL_ERROR", "Falha ao buscar contrato.", 500);
  }
}
