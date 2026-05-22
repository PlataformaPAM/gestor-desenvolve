import { prisma } from "@/lib/prisma";
import { mapClienteFromDb } from "@/app/api/comercial/_shared";
import { fail, ok } from "@/lib/server/api-response";
import { clientesAccessGate, filterClientesForSession } from "@/lib/server/clientes-access";

export async function GET(req: Request) {
  const gate = await clientesAccessGate(req, "ver");
  if (!gate.ok) return gate.response;

  const clientesRaw = await prisma.cliente.findMany({
    include: {
      criadoPor: { select: { nomeExibicao: true } },
      endereco: true,
      contatos: { include: { papeis: true } },
      propostas: true,
      faturas: true,
      ticketsResumo: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const clientes = await filterClientesForSession(
    clientesRaw.map((c) => ({ id: c.id, criadoPorId: c.criadoPorId })),
    gate.userId,
    gate.scope
  );
  const allowedIds = new Set(clientes.map((c) => c.id));
  const mapped = clientesRaw.filter((c) => allowedIds.has(c.id)).map(mapClienteFromDb);
  return ok({ clientes: mapped, data: { clientes: mapped } });
}

