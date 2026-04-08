import { prisma } from "@/lib/prisma";
import type { Tarefa } from "@/lib/tarefas/types";
import { mapTarefaFromDb } from "../_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { emitAlert } from "@/lib/server/alerts";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseJsonSafe<{ tarefa?: Tarefa }>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const tarefa = parsed.value.tarefa;
  if (!tarefa || tarefa.id !== id || !tarefa.responsavel?.id) {
    return fail("BAD_REQUEST", "Payload inválido.", 400);
  }

  const previous = await prisma.tarefa.findUnique({
    where: { id },
    select: { status: true, titulo: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.tarefa.update({
      where: { id },
      data: {
        titulo: tarefa.titulo,
        descricao: tarefa.descricao ?? null,
        status: tarefa.status,
        prioridade: tarefa.prioridade,
        dataInicio: new Date(tarefa.dataInicio),
        dataFim: new Date(tarefa.dataFim),
        clienteId: tarefa.clienteId ?? null,
        solucaoId: tarefa.solucaoId ?? null,
        responsavelId: tarefa.responsavel.id,
      },
    });

    await tx.tarefaColaborador.deleteMany({ where: { tarefaId: id } });
    if (tarefa.colaboradores?.length) {
      await tx.tarefaColaborador.createMany({
        data: tarefa.colaboradores.map((c) => ({ tarefaId: id, usuarioId: c.id })),
      });
    }

    await tx.tarefaAnexo.deleteMany({ where: { tarefaId: id } });
    if (tarefa.anexos?.length) {
      await tx.tarefaAnexo.createMany({
        data: tarefa.anexos.map((nomeArquivo) => ({ tarefaId: id, nomeArquivo, url: null })),
      });
    }

    await tx.tarefaHistoricoAnexo.deleteMany({ where: { historico: { tarefaId: id } } });
    await tx.tarefaHistorico.deleteMany({ where: { tarefaId: id } });
    for (const h of tarefa.historico ?? []) {
      await tx.tarefaHistorico.create({
        data: {
          id: h.id,
          tarefaId: id,
          data: new Date(h.data),
          acao: h.acao,
          autorId: h.autorId?.trim() ? h.autorId.trim() : null,
          anexos: {
            create: (h.anexos ?? []).map((nomeArquivo) => ({ nomeArquivo, url: null })),
          },
        },
      });
    }
  });

  const saved = await prisma.tarefa.findUniqueOrThrow({
    where: { id },
    include: {
      responsavel: true,
      colaboradores: { include: { usuario: true } },
      anexos: true,
      historico: { include: { autor: true, anexos: true }, orderBy: { data: "asc" } },
    },
  });
  await writeAuditLog(prisma, {
    acao: "Tarefa atualizada",
    modulo: "tarefas",
    detalhes: `Tarefa ${saved.titulo} (${saved.id})`,
  });
  if (previous?.status !== "concluido" && saved.status === "concluido") {
    await emitAlert(prisma, {
      modulo: "tarefas",
      titulo: "Tarefa interna concluída",
      descricao: `A tarefa "${saved.titulo}" foi concluída.`,
      dedupeKey: `tarefa-concluida-${saved.id}`,
    });
  }
  if (previous?.status !== "impedimento" && saved.status === "impedimento") {
    await emitAlert(prisma, {
      modulo: "tarefas",
      titulo: "Tarefa interna com impedimento",
      descricao: `A tarefa "${saved.titulo}" foi movida para impedimento e precisa de ação.`,
      dedupeKey: `tarefa-impedimento-${saved.id}`,
    });
  }
  return ok({ tarefa: mapTarefaFromDb(saved) });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const existing = await prisma.tarefa.findUnique({ where: { id }, select: { id: true, titulo: true } });
  if (!existing) return fail("NOT_FOUND", "Tarefa não encontrada.", 404);
  await prisma.tarefa.delete({ where: { id } });
  await writeAuditLog(prisma, {
    acao: "Tarefa excluída",
    modulo: "tarefas",
    detalhes: `Tarefa ${existing.titulo} (${existing.id})`,
  });
  return ok({ deleted: true });
}

