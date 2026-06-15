import { prisma } from "@/lib/prisma";
import type { TarefaRegua } from "@/lib/pos-venda/types";
import { decodePosVendaMeta, encodePosVendaMeta } from "../../_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { emitAlert } from "@/lib/server/alerts";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { posvendaAccessGate } from "@/lib/server/posvenda-access";

function mapStatus(status: TarefaRegua["status"]) {
  if (status === "concluida") return "concluido" as const;
  if (status === "adiada") return "aguardando" as const;
  return "a_fazer" as const;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const gate = await posvendaAccessGate(req, "editar", id);
  if (!gate.ok) return gate.response;
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const session = decodeSession(match?.[1]?.trim());
  const parsedBody = await parseJsonSafe<{ tarefa?: TarefaRegua; eventoTitulo?: string }>(req);
  if (!parsedBody.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const body = parsedBody.value;
  const tarefa = body.tarefa;
  if (!tarefa || tarefa.id !== id) {
    return fail("BAD_REQUEST", "Payload inválido.", 400);
  }

  const current = await prisma.tarefa.findUnique({ where: { id } });
  if (!current) return fail("NOT_FOUND", "Tarefa não encontrada.", 404);
  const parsed = decodePosVendaMeta(current.descricao);
  const nextMeta = {
    ...parsed.meta,
    tipo: tarefa.tipo,
    categoria: tarefa.categoria,
    objetivo: tarefa.objetivo,
    scriptSugerido: tarefa.scriptSugerido,
    intervaloRecorrenciaDias: tarefa.intervaloRecorrenciaDias,
    proximaEtapaTipo: tarefa.proximaEtapaTipo,
    prioridadeCritica: tarefa.prioridadeCritica,
    motivoCritico: tarefa.motivoCritico,
    clienteNome: tarefa.clienteNome,
    dataConclusao: tarefa.dataConclusao,
    playbook: tarefa.playbook,
  };
  const dataFim = new Date(`${tarefa.dataAgendada}T12:00:00.000Z`);

  await prisma.$transaction(async (tx) => {
    await tx.tarefa.update({
      where: { id },
      data: {
        titulo: tarefa.titulo,
        status: mapStatus(tarefa.status),
        dataFim,
        descricao: encodePosVendaMeta(nextMeta, parsed.descricao || tarefa.objetivo),
      },
    });
    if (body.eventoTitulo?.trim()) {
      await tx.tarefaHistorico.create({
        data: {
          tarefaId: id,
          data: new Date(),
          autorId: session?.userId ?? null,
          acao: body.eventoTitulo.trim(),
        },
      });
    }
  });

  await writeAuditLog(prisma, {
    acao: "Tarefa de pós-venda atualizada",
    modulo: "pos-venda",
    detalhes: `Tarefa ${id}`,
  });

  if (
    tarefa.status === "concluida" &&
    (current.descricao ?? "").includes("\"categoria\":\"onboarding\"") &&
    current.clienteId
  ) {
    const pendentesOnboarding = await prisma.tarefa.count({
      where: {
        clienteId: current.clienteId,
        status: { not: "concluido" },
        descricao: { contains: "\"categoria\":\"onboarding\"" },
      },
    });
    if (pendentesOnboarding === 0) {
      await emitAlert(prisma, {
        modulo: "posVenda",
        titulo: "Pós-venda: Etapa 1 concluída",
        descricao: `Onboarding concluído para ${tarefa.clienteNome}. Inicie a Etapa 2 (relacionamento contínuo).`,
        dedupeKey: `posvenda-etapa2-${current.clienteId}`,
      });
    }
  }

  return ok({ updated: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const gate = await posvendaAccessGate(req, "excluir", id);
    if (!gate.ok) return gate.response;
    const cookieHeader = req.headers.get("cookie") || "";
    const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    const session = decodeSession(match?.[1]?.trim());
    const parsedBody = await parseJsonSafe<{ motivo?: string }>(req);
    if (!parsedBody.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
    const motivo = parsedBody.value.motivo?.trim();
    if (!motivo) {
      return fail("BAD_REQUEST", "Informe o motivo para enviar o item à lixeira.", 400);
    }

    const current = await prisma.tarefa.findUnique({ where: { id } });
    if (!current) return fail("NOT_FOUND", "Tarefa não encontrada.", 404);
    const parsed = decodePosVendaMeta(current.descricao);
    if (parsed.meta.removidaEm) {
      return ok({ removed: true });
    }

    let autorHistoricoId: string | null = null;
    let nomeRemocao = session?.userName ?? "Usuário";
    if (session?.userId) {
      const usuarioRow = await prisma.usuario.findUnique({
        where: { id: session.userId },
        select: { id: true, nomeExibicao: true },
      });
      if (usuarioRow) {
        autorHistoricoId = usuarioRow.id;
        nomeRemocao = usuarioRow.nomeExibicao || nomeRemocao;
      }
    }
    const removidaEm = new Date().toISOString();

    await prisma.$transaction(async (tx) => {
      await tx.tarefa.update({
        where: { id },
        data: {
          status: "aguardando",
          descricao: encodePosVendaMeta(
            {
              ...parsed.meta,
              removidaEm,
              removidaMotivo: motivo,
              removidaPor: nomeRemocao,
            },
            parsed.descricao
          ),
        },
      });
      await tx.tarefaHistorico.create({
        data: {
          tarefaId: id,
          data: new Date(),
          autorId: autorHistoricoId,
          acao: `Movida para lixeira: ${motivo}`,
        },
      });
    });

    try {
      const admins = await prisma.usuario.findMany({
        where: {
          ativo: true,
          perfil: {
            nome: { contains: "admin", mode: "insensitive" },
          },
        },
        select: { id: true },
      });
      for (const a of admins) {
        try {
          await emitAlert(prisma, {
            modulo: "posVenda",
            usuarioId: a.id,
            titulo: "Item enviado para lixeira no Pós-venda",
            descricao: `A tarefa "${current.titulo}" foi enviada para a lixeira. Motivo: ${motivo}.`,
            dedupeKey: `posvenda-lixeira-${id}-${removidaEm}-${a.id}`,
          });
        } catch {
          /* alerta auxiliar: não bloqueia a lixeira */
        }
      }
    } catch {
      /* ignore */
    }

    try {
      await writeAuditLog(prisma, {
        usuarioId: autorHistoricoId,
        acao: "Tarefa de pós-venda enviada para lixeira",
        modulo: "pos-venda",
        detalhes: `Tarefa ${id} - Motivo: ${motivo}`,
      });
    } catch {
      /* auditoria auxiliar */
    }

    return ok({ removed: true });
  } catch (err) {
    console.error("[pos-venda/tarefas DELETE]", err);
    return fail(
      "INTERNAL_ERROR",
      err instanceof Error ? err.message : "Não foi possível enviar o item para a lixeira.",
      500
    );
  }
}

