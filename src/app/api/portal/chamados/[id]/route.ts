import { prisma } from "@/lib/prisma";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { hasClienteAccess, resolvePortalContext } from "@/lib/server/portal-access";
import { mapTicketFromDb } from "@/app/api/helpdesk/_shared";
import type { Ticket } from "@/lib/suporte/types";

export async function GET(req: Request, ctxRoute: { params: Promise<{ id: string }> }) {
  const ctx = await resolvePortalContext(req);
  if (!ctx) return fail("FORBIDDEN", "Acesso ao portal do cliente não autorizado.", 403);
  const { id } = await ctxRoute.params;

  const ticket = await prisma.helpdeskTicket.findUnique({
    where: { codigo: id },
    include: {
      criadoPor: true,
      cliente: true,
      responsaveis: { include: { usuario: true } },
      historico: { include: { autor: true, anexos: true }, orderBy: { data: "asc" } },
      comentarios: { include: { anexos: true }, orderBy: { data: "asc" } },
      anexos: true,
    },
  });
  if (!ticket) return fail("NOT_FOUND", "Chamado não encontrado.", 404);
  if (!hasClienteAccess(ctx, ticket.clienteId)) {
    return fail("FORBIDDEN", "Você não possui acesso a este chamado.", 403);
  }
  return ok({ ticket: mapTicketFromDb(ticket) });
}

export async function PATCH(req: Request, ctxRoute: { params: Promise<{ id: string }> }) {
  const ctx = await resolvePortalContext(req);
  if (!ctx) return fail("FORBIDDEN", "Acesso ao portal do cliente não autorizado.", 403);
  const { id } = await ctxRoute.params;
  const parsed = await parseJsonSafe<{ ticket?: Ticket }>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const ticket = parsed.value.ticket;
  if (!ticket || ticket.id !== id) {
    return fail("BAD_REQUEST", "Payload inválido.", 400);
  }

  const current = await prisma.helpdeskTicket.findUnique({
    where: { codigo: id },
    select: { id: true, clienteId: true },
  });
  if (!current) return fail("NOT_FOUND", "Chamado não encontrado.", 404);
  if (!hasClienteAccess(ctx, current.clienteId)) {
    return fail("FORBIDDEN", "Você não possui acesso a este chamado.", 403);
  }

  await prisma.helpdeskTicket.update({
    where: { codigo: id },
    data: {
      assunto: ticket.assunto,
      descricao: ticket.descricao,
      status: ticket.status,
      prioridade: ticket.prioridade,
      categoria: ticket.categoria,
      previsaoConclusao: new Date(ticket.previsaoConclusao),
      ultimaAtualizacao: new Date(),
    },
  });

  const saved = await prisma.helpdeskTicket.findUniqueOrThrow({
    where: { codigo: id },
    include: {
      criadoPor: true,
      cliente: true,
      responsaveis: { include: { usuario: true } },
      historico: { include: { autor: true, anexos: true }, orderBy: { data: "asc" } },
      comentarios: { include: { anexos: true }, orderBy: { data: "asc" } },
      anexos: true,
    },
  });
  return ok({ ticket: mapTicketFromDb(saved) });
}

