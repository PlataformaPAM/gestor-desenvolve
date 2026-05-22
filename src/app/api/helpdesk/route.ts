import type { Ticket } from "@/lib/suporte/types";
import { prisma } from "@/lib/prisma";
import { mapTicketFromDb } from "./_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { emitAlert } from "@/lib/server/alerts";
import { helpdeskAccessGate } from "@/lib/server/helpdesk-access";

export async function POST(req: Request) {
  const gate = await helpdeskAccessGate(req, "criar");
  if (!gate.ok) return gate.response;

  const parsed = await parseJsonSafe<{ ticket?: Ticket }>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const ticket = parsed.value.ticket;
  if (!ticket?.id || !ticket.clienteId) {
    return fail("BAD_REQUEST", "Ticket inválido.", 400);
  }

  await prisma.$transaction(async (tx) => {
    const created = await tx.helpdeskTicket.create({
      data: {
        codigo: ticket.id,
        clienteId: ticket.clienteId,
        assunto: ticket.assunto,
        descricao: ticket.descricao,
        status: ticket.status,
        prioridade: ticket.prioridade,
        categoria: ticket.categoria,
        dataCriacao: new Date(ticket.dataCriacao),
        previsaoConclusao: new Date(ticket.previsaoConclusao),
        ultimaAtualizacao: new Date(ticket.ultimaAtualizacao),
      },
    });

    const users = ticket.responsaveis?.length
      ? await tx.usuario.findMany({ where: { id: { in: ticket.responsaveis.map((r) => r.id) } } })
      : [];
    if (users.length) {
      await tx.helpdeskTicketResponsavel.createMany({
        data: users.map((u) => ({ ticketId: created.id, usuarioId: u.id })),
      });
    }

    for (const h of ticket.historico ?? []) {
      await tx.helpdeskHistorico.create({
        data: {
          id: h.id,
          ticketId: created.id,
          data: new Date(h.data),
          acao: h.acao,
          detalhe: h.detalhe ?? null,
          anexos: { create: (h.anexos ?? []).map((nomeArquivo) => ({ nomeArquivo, url: null })) },
        },
      });
    }

    for (const c of ticket.comentarios ?? []) {
      await tx.helpdeskComentario.create({
        data: {
          id: c.id,
          ticketId: created.id,
          autorNomeSnapshot: c.autor,
          autorTipo: c.autorTipo,
          texto: c.texto,
          data: new Date(c.data),
          anexos: { create: (c.anexos ?? []).map((nomeArquivo) => ({ nomeArquivo, url: null })) },
        },
      });
    }

    if (ticket.arquivos?.length) {
      await tx.helpdeskAnexo.createMany({
        data: ticket.arquivos.map((f) => ({ ticketId: created.id, nomeArquivo: f.name, url: null })),
      });
    }
  });

  const saved = await prisma.helpdeskTicket.findUniqueOrThrow({
    where: { codigo: ticket.id },
    include: {
      cliente: true,
      responsaveis: { include: { usuario: true } },
      historico: { include: { autor: true, anexos: true }, orderBy: { data: "asc" } },
      comentarios: { include: { anexos: true }, orderBy: { data: "asc" } },
      anexos: true,
    },
  });
  await writeAuditLog(prisma, {
    acao: "Ticket criado",
    modulo: "helpdesk",
    detalhes: `Ticket ${saved.codigo} - ${saved.assunto}`,
  });
  await emitAlert(prisma, {
    modulo: "helpdesk",
    titulo: `Novo ticket: ${saved.codigo}`,
    descricao: `Ticket "${saved.assunto}" criado e disponível para atendimento dos envolvidos.`,
    dedupeKey: `ticket-criado-${saved.id}`,
  });
  return ok({ ticket: mapTicketFromDb(saved) }, 201);
}

