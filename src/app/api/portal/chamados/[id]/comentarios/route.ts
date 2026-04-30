import { prisma } from "@/lib/prisma";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { hasClienteAccess, resolvePortalContext } from "@/lib/server/portal-access";
import { mapTicketFromDb } from "@/app/api/helpdesk/_shared";
import { writeAuditLog } from "@/lib/server/audit-log";
import { emitAlert, emitManyAlerts } from "@/lib/server/alerts";

type ComentarBody = {
  texto: string;
};

async function listarUsuariosSuporteInterno() {
  const usuarios = await prisma.usuario.findMany({
    where: {
      ativo: true,
      OR: [
        { perfil: { nome: { contains: "admin", mode: "insensitive" } } },
        { perfil: { nome: { contains: "administrador", mode: "insensitive" } } },
        {
          perfil: {
            permissoes: {
              some: {
                modulo: "helpdesk",
                permitido: true,
              },
            },
          },
        },
      ],
    },
    select: { id: true },
  });
  return Array.from(new Set(usuarios.map((u) => u.id)));
}

export async function POST(req: Request, ctxRoute: { params: Promise<{ id: string }> }) {
  const ctx = await resolvePortalContext(req);
  if (!ctx) return fail("FORBIDDEN", "Acesso ao portal do cliente não autorizado.", 403);
  const { id } = await ctxRoute.params;
  const parsed = await parseJsonSafe<ComentarBody>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const texto = parsed.value.texto?.trim() ?? "";
  if (!texto) return fail("BAD_REQUEST", "Comentário não pode estar vazio.", 400);

  const ticket = await prisma.helpdeskTicket.findUnique({
    where: { codigo: id },
    select: { id: true, codigo: true, assunto: true, clienteId: true },
  });
  if (!ticket) return fail("NOT_FOUND", "Chamado não encontrado.", 404);
  if (!hasClienteAccess(ctx, ticket.clienteId)) {
    return fail("FORBIDDEN", "Você não possui acesso a este chamado.", 403);
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.helpdeskComentario.create({
      data: {
        ticketId: ticket.id,
        autorId: ctx.userId,
        autorNomeSnapshot: ctx.userName,
        autorTipo: "cliente",
        texto,
        data: now,
      },
    });
    await tx.helpdeskHistorico.create({
      data: {
        ticketId: ticket.id,
        data: now,
        acao: "Cliente respondeu no chamado",
        detalhe: texto.length > 120 ? `${texto.slice(0, 117)}...` : texto,
        autorId: ctx.userId,
      },
    });
    await tx.helpdeskTicket.update({
      where: { id: ticket.id },
      data: {
        status: "respondido",
        ultimaAtualizacao: now,
        atualizadoPorId: ctx.userId,
      },
    });
  });

  const saved = await prisma.helpdeskTicket.findUniqueOrThrow({
    where: { id: ticket.id },
    include: {
      criadoPor: true,
      cliente: true,
      responsaveis: { include: { usuario: true } },
      historico: { include: { autor: true, anexos: true }, orderBy: { data: "asc" } },
      comentarios: { include: { anexos: true }, orderBy: { data: "asc" } },
      anexos: true,
    },
  });

  await writeAuditLog(prisma, {
    usuarioId: ctx.userId,
    acao: "Comentário no portal",
    modulo: "helpdesk",
    detalhes: `Comentário no ticket ${ticket.codigo}`,
  });
  await emitAlert(prisma, {
    modulo: "helpdesk",
    titulo: `Atualização do cliente: ${ticket.codigo}`,
    descricao: `O cliente enviou uma nova resposta em "${ticket.assunto}".`,
    dedupeKey: `portal-ticket-comentario-${ticket.id}-${now.getTime()}`,
  });
  const usuariosSuporteIds = await listarUsuariosSuporteInterno();
  if (usuariosSuporteIds.length) {
    await emitManyAlerts(
      prisma,
      usuariosSuporteIds.map((usuarioId) => ({
        modulo: "helpdesk",
        titulo: `Atualização do cliente: ${ticket.codigo}`,
        descricao: `O cliente enviou uma nova resposta em "${ticket.assunto}".`,
        usuarioId,
        dedupeKey: `portal-ticket-comentario-${ticket.id}-${now.getTime()}-${usuarioId}`,
      }))
    );
  }

  return ok({ ticket: mapTicketFromDb(saved) }, 201);
}

