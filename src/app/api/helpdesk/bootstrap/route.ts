import { prisma } from "@/lib/prisma";
import { mapTicketFromDb } from "../_shared";
import { ok } from "@/lib/server/api-response";

export async function GET() {
  const tickets = await prisma.helpdeskTicket.findMany({
    include: {
      criadoPor: true,
      cliente: true,
      responsaveis: { include: { usuario: true } },
      historico: { include: { autor: true, anexos: true }, orderBy: { data: "asc" } },
      comentarios: { include: { anexos: true }, orderBy: { data: "asc" } },
      anexos: true,
    },
    orderBy: { dataCriacao: "desc" },
  });

  const mapped = tickets.map(mapTicketFromDb);
  return ok({ tickets: mapped, data: { tickets: mapped } });
}

