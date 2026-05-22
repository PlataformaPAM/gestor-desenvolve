import { prisma } from "@/lib/prisma";
import { mapTicketFromDb } from "../_shared";
import { ok } from "@/lib/server/api-response";
import { filterTicketsForSession, helpdeskAccessGate } from "@/lib/server/helpdesk-access";
import { loadUsuariosAtivosParaVinculo } from "@/lib/server/usuarios-ativos";

export async function GET(req: Request) {
  const gate = await helpdeskAccessGate(req, "ver");
  if (!gate.ok) return gate.response;

  const [tickets, usuarios] = await Promise.all([
    prisma.helpdeskTicket.findMany({
    include: {
      criadoPor: true,
      cliente: true,
      responsaveis: { include: { usuario: true } },
      historico: { include: { autor: true, anexos: true }, orderBy: { data: "asc" } },
      comentarios: { include: { anexos: true }, orderBy: { data: "asc" } },
      anexos: true,
    },
      orderBy: { dataCriacao: "desc" },
    }),
    loadUsuariosAtivosParaVinculo(),
  ]);

  const mapped = filterTicketsForSession(
    tickets.map(mapTicketFromDb),
    gate.session,
    gate.userId
  );
  return ok({
    tickets: mapped,
    usuarios,
    data: { tickets: mapped, usuarios },
  });
}

