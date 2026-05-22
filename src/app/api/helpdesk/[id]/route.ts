import type { Ticket } from "@/lib/suporte/types";
import { prisma } from "@/lib/prisma";
import { mapTicketFromDb } from "../_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { emitAlert } from "@/lib/server/alerts";
import { helpdeskAccessGate } from "@/lib/server/helpdesk-access";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const gate = await helpdeskAccessGate(req, "editar", id);
  if (!gate.ok) return gate.response;

  const parsed = await parseJsonSafe<{ ticket?: Ticket }>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const ticket = parsed.value.ticket;
  if (!ticket || ticket.id !== id) {
    return fail("BAD_REQUEST", "Payload inválido.", 400);
  }
  const current = await prisma.helpdeskTicket.findUnique({ where: { codigo: id }, select: { id: true } });
  if (!current) return fail("NOT_FOUND", "Ticket não encontrado.", 404);
  const ticketDbId = current.id;
  const before = await prisma.helpdeskTicket.findUnique({
    where: { codigo: id },
    select: { status: true, previsaoConclusao: true, assunto: true, codigo: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.helpdeskTicket.update({
      where: { codigo: id },
      data: {
        clienteId: ticket.clienteId,
        assunto: ticket.assunto,
        descricao: ticket.descricao,
        status: ticket.status,
        prioridade: ticket.prioridade,
        categoria: ticket.categoria,
        previsaoConclusao: new Date(ticket.previsaoConclusao),
        ultimaAtualizacao: new Date(ticket.ultimaAtualizacao),
      },
    });

    await tx.helpdeskTicketResponsavel.deleteMany({ where: { ticketId: ticketDbId } });
    const users = ticket.responsaveis?.length
      ? await tx.usuario.findMany({ where: { id: { in: ticket.responsaveis.map((r) => r.id) } } })
      : [];
    if (users.length) {
      await tx.helpdeskTicketResponsavel.createMany({
        data: users.map((u) => ({ ticketId: ticketDbId, usuarioId: u.id })),
      });
    }

    await tx.helpdeskHistoricoAnexo.deleteMany({ where: { historico: { ticketId: ticketDbId } } });
    await tx.helpdeskHistorico.deleteMany({ where: { ticketId: ticketDbId } });
    for (const h of ticket.historico ?? []) {
      await tx.helpdeskHistorico.create({
        data: {
          id: h.id,
          ticketId: ticketDbId,
          data: new Date(h.data),
          acao: h.acao,
          detalhe: h.detalhe ?? null,
          anexos: { create: (h.anexos ?? []).map((nomeArquivo) => ({ nomeArquivo, url: null })) },
        },
      });
    }

    await tx.helpdeskComentarioAnexo.deleteMany({ where: { comentario: { ticketId: ticketDbId } } });
    await tx.helpdeskComentario.deleteMany({ where: { ticketId: ticketDbId } });
    for (const c of ticket.comentarios ?? []) {
      await tx.helpdeskComentario.create({
        data: {
          id: c.id,
          ticketId: ticketDbId,
          autorNomeSnapshot: c.autor,
          autorTipo: c.autorTipo,
          texto: c.texto,
          data: new Date(c.data),
          anexos: { create: (c.anexos ?? []).map((nomeArquivo) => ({ nomeArquivo, url: null })) },
        },
      });
    }

    await tx.helpdeskAnexo.deleteMany({ where: { ticketId: ticketDbId } });
    if (ticket.arquivos?.length) {
      await tx.helpdeskAnexo.createMany({
        data: ticket.arquivos.map((f) => ({ ticketId: ticketDbId, nomeArquivo: f.name, url: null })),
      });
    }
  });

  const saved = await prisma.helpdeskTicket.findUniqueOrThrow({
    where: { codigo: id },
    include: {
      cliente: true,
      responsaveis: { include: { usuario: true } },
      historico: { include: { autor: true, anexos: true }, orderBy: { data: "asc" } },
      comentarios: { include: { anexos: true }, orderBy: { data: "asc" } },
      anexos: true,
    },
  });
  await writeAuditLog(prisma, {
    acao: "Ticket atualizado",
    modulo: "helpdesk",
    detalhes: `Ticket ${saved.codigo} - ${saved.assunto}`,
  });
  if (before?.status !== "finalizado" && saved.status === "finalizado") {
    await emitAlert(prisma, {
      modulo: "helpdesk",
      titulo: `Ticket finalizado: ${saved.codigo}`,
      descricao: `Ticket "${saved.assunto}" foi concluído.`,
      dedupeKey: `ticket-finalizado-${saved.id}`,
    });
  }
  const now = new Date();
  const previsao = new Date(saved.previsaoConclusao);
  const diffDays = Math.round((new Date(previsao.toDateString()).getTime() - new Date(now.toDateString()).getTime()) / 86400000);
  if (saved.status !== "finalizado" && (diffDays === 1 || diffDays === 0 || diffDays < 0)) {
    await emitAlert(prisma, {
      modulo: "helpdesk",
      titulo: diffDays < 0 ? `Ticket em atraso: ${saved.codigo}` : `Ticket próximo do prazo: ${saved.codigo}`,
      descricao:
        diffDays < 0
          ? `Ticket "${saved.assunto}" está em atraso e requer priorização.`
          : `Ticket "${saved.assunto}" ${diffDays === 0 ? "vence hoje" : "vence amanhã"}.`,
      dedupeKey: `ticket-prazo-imediato-${saved.id}-${diffDays}`,
    });
  }
  return ok({ ticket: mapTicketFromDb(saved) });
}

