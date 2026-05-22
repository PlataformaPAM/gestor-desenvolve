import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/server/api-response";
import { contratosAccessGate } from "@/lib/server/contratos-access";
import { userCanAccessLeadId } from "@/lib/server/lead-access";

export async function GET(req: Request, ctx: { params: Promise<{ leadId: string }> }) {
  const gate = await contratosAccessGate(req, "ver");
  if (!gate.ok) return gate.response;

  try {
    const { leadId } = await ctx.params;
    if (!leadId) return fail("BAD_REQUEST", "leadId obrigatório.", 400);

    if (gate.scope === "vinculados") {
      const okLead = await userCanAccessLeadId(gate.userId, leadId, gate.scope);
      if (!okLead) return fail("FORBIDDEN", "Você não tem acesso a este lead.", 403);
    }
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
