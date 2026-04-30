import { prisma } from "@/lib/prisma";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { hasClienteAccess, resolvePortalContext } from "@/lib/server/portal-access";
import { mapTicketFromDb } from "@/app/api/helpdesk/_shared";
import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/server/audit-log";
import { emitAlert, emitManyAlerts } from "@/lib/server/alerts";

type NovoChamadoBody = {
  clienteId: string;
  assunto: string;
  descricao: string;
  prioridade: "baixa" | "media" | "alta" | "critica";
  categoria: "comercial" | "financeiro" | "suporte_tecnico" | "duvida" | "sugestao";
  previsaoConclusao?: string;
};

type TxTicketCompat = {
  helpdeskTicket: {
    findFirst: (args: unknown) => Promise<unknown>;
  };
};

function buildCodigoFrom(ano: number, sequencial: number): string {
  return `SUP-${ano}-${String(sequencial).padStart(4, "0")}`;
}

async function proximoCodigoTicket(tx: TxTicketCompat, ano: number): Promise<string> {
  const prefixo = `SUP-${ano}-`;
  const ultimo = (await tx.helpdeskTicket.findFirst({
    where: { codigo: { startsWith: prefixo } },
    orderBy: { codigo: "desc" },
    select: { codigo: true },
  })) as { codigo?: string } | null;
  const ultimoSequencial = Number.parseInt(ultimo?.codigo?.slice(-4) ?? "0", 10);
  return buildCodigoFrom(ano, Number.isFinite(ultimoSequencial) ? ultimoSequencial + 1 : 1);
}

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

export async function GET(req: Request) {
  const ctx = await resolvePortalContext(req);
  if (!ctx) return fail("FORBIDDEN", "Acesso ao portal do cliente não autorizado.", 403);

  const tickets = await prisma.helpdeskTicket.findMany({
    where: { clienteId: { in: ctx.clienteIds } },
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

export async function POST(req: Request) {
  const ctx = await resolvePortalContext(req);
  if (!ctx) return fail("FORBIDDEN", "Acesso ao portal do cliente não autorizado.", 403);
  const parsed = await parseJsonSafe<NovoChamadoBody>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);

  const body = parsed.value;
  if (!hasClienteAccess(ctx, body.clienteId)) {
    return fail("FORBIDDEN", "Cliente informado não pertence ao seu acesso.", 403);
  }
  if (!body.assunto?.trim() || !body.descricao?.trim()) {
    return fail("BAD_REQUEST", "Assunto e descrição são obrigatórios.", 400);
  }

  const previsaoConclusao = body.previsaoConclusao ? new Date(body.previsaoConclusao) : new Date(Date.now() + 3 * 86400000);
  if (Number.isNaN(previsaoConclusao.getTime())) {
    return fail("BAD_REQUEST", "Previsão de conclusão inválida.", 400);
  }

  const usuariosSuporteIds = await listarUsuariosSuporteInterno();

  let createdCodigo = "";
  let createdDbId = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await prisma.$transaction(async (tx) => {
        const now = new Date();
        const codigo = await proximoCodigoTicket(tx as unknown as TxTicketCompat, now.getFullYear());
        const created = await tx.helpdeskTicket.create({
          data: {
            codigo,
            clienteId: body.clienteId,
            assunto: body.assunto.trim(),
            descricao: body.descricao.trim(),
            status: "novo",
            prioridade: body.prioridade,
            categoria: body.categoria,
            dataCriacao: now,
            previsaoConclusao,
            ultimaAtualizacao: now,
            criadoPorId: ctx.userId,
            atualizadoPorId: ctx.userId,
          },
        });
        await tx.helpdeskComentario.create({
          data: {
            ticketId: created.id,
            autorId: ctx.userId,
            autorNomeSnapshot: ctx.userName,
            autorTipo: "cliente",
            texto: body.descricao.trim(),
            data: now,
          },
        });
        await tx.helpdeskHistorico.create({
          data: {
            ticketId: created.id,
            data: now,
            acao: "Chamado aberto pelo cliente",
            detalhe: "Abertura inicial via Portal do Cliente.",
            autorId: ctx.userId,
          },
        });
        if (usuariosSuporteIds.length) {
          await tx.helpdeskTicketResponsavel.createMany({
            data: usuariosSuporteIds.map((usuarioId) => ({ ticketId: created.id, usuarioId })),
            skipDuplicates: true,
          });
        }
        createdCodigo = created.codigo;
        createdDbId = created.id;
      });
      break;
    } catch (error) {
      const target =
        error instanceof Prisma.PrismaClientKnownRequestError ? error.meta?.target : undefined;
      const targetIncludesCodigo = Array.isArray(target)
        ? target.includes("codigo")
        : typeof target === "string"
          ? target.includes("codigo")
          : false;
      const isUniqueCodigoConflict =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        targetIncludesCodigo;
      if (!isUniqueCodigoConflict || attempt === 4) throw error;
    }
  }

  const saved = await prisma.helpdeskTicket.findUniqueOrThrow({
    where: { codigo: createdCodigo },
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
    acao: "Chamado aberto no portal",
    modulo: "helpdesk",
    detalhes: `Ticket ${saved.codigo} - ${saved.assunto}`,
  });
  await emitAlert(prisma, {
    modulo: "helpdesk",
    titulo: `Novo ticket: ${saved.codigo}`,
    descricao: `Chamado aberto pelo cliente: "${saved.assunto}".`,
    dedupeKey: `portal-ticket-criado-${createdDbId}`,
  });
  if (usuariosSuporteIds.length) {
    await emitManyAlerts(
      prisma,
      usuariosSuporteIds.map((usuarioId) => ({
        modulo: "helpdesk",
        titulo: `Novo ticket: ${saved.codigo}`,
        descricao: `Chamado aberto pelo cliente: "${saved.assunto}".`,
        usuarioId,
        dedupeKey: `portal-ticket-criado-${createdDbId}-${usuarioId}`,
      }))
    );
  }

  return ok({ ticket: mapTicketFromDb(saved) }, 201);
}

