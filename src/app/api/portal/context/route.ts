import { fail, ok } from "@/lib/server/api-response";
import { resolvePortalContext } from "@/lib/server/portal-access";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const ctx = await resolvePortalContext(req);
  if (!ctx) return fail("FORBIDDEN", "Acesso ao portal do cliente não autorizado.", 403);

  const clientes = await prisma.cliente.findMany({
    where: { id: { in: ctx.clienteIds } },
    select: { id: true, nome: true, empresa: true },
    orderBy: { empresa: "asc" },
  });

  return ok({
    user: {
      id: ctx.userId,
      nome: ctx.userName,
      isAdminCliente: ctx.isAdminCliente,
    },
    clientes,
  });
}

