import { prisma } from "@/lib/prisma";
import { mapClienteFromDb } from "@/app/api/comercial/_shared";
import { ok } from "@/lib/server/api-response";

export async function GET() {
  const clientes = await prisma.cliente.findMany({
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

  const mapped = clientes.map(mapClienteFromDb);
  return ok({ clientes: mapped, data: { clientes: mapped } });
}

