import { prisma } from "@/lib/prisma";
import type { Tarefa } from "@/lib/tarefas/types";
import { mapTarefaFromDb } from "../_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { emitAlert } from "@/lib/server/alerts";
import { Prisma } from "@prisma/client";
import { composeDescricaoWithCategoria } from "@/lib/tarefas/categorias";
import { tarefasAccessGate } from "@/lib/server/tarefas-access";

function buildHistoricoId(tarefaId: string, index: number): string {
  return `${tarefaId}-h-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const gate = await tarefasAccessGate(req, "editar", id);
  if (!gate.ok) return gate.response;

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

  let usedStatusOnlyFallback = false;
  try {
    await prisma.$transaction(async (tx) => {
      const autorIds = Array.from(
        new Set(
          (tarefa.historico ?? [])
            .map((h) => h.autorId?.trim() ?? "")
            .filter((autorId) => Boolean(autorId))
        )
      );
      const autoresValidos = new Set(
        autorIds.length
          ? (
              await tx.usuario.findMany({
                where: { id: { in: autorIds } },
                select: { id: true },
              })
            ).map((u) => u.id)
          : []
      );

      // Campo principal: deve persistir sempre (inclusive drag/drop de status).
      await tx.tarefa.update({
        where: { id },
        data: {
          titulo: tarefa.titulo,
          descricao: composeDescricaoWithCategoria(tarefa.descricao, tarefa.categoria),
          status: tarefa.status,
          prioridade: tarefa.prioridade,
          dataInicio: new Date(tarefa.dataInicio),
          dataFim: new Date(tarefa.dataFim),
          clienteId: tarefa.clienteId ?? null,
          solucaoId: tarefa.solucaoId ?? null,
          responsavelId: tarefa.responsavel.id,
        },
      });

      try {
        await tx.tarefaColaborador.deleteMany({ where: { tarefaId: id } });
        if (tarefa.colaboradores?.length) {
          await tx.tarefaColaborador.createMany({
            data: tarefa.colaboradores.map((c) => ({ tarefaId: id, usuarioId: c.id })),
          });
        }
      } catch (error) {
        console.warn("[tarefas/update] colaboradores indisponível; mantendo atualização principal.", error);
      }

      try {
        await tx.tarefaCliente.deleteMany({ where: { tarefaId: id } });
        const clienteIds = Array.from(new Set((tarefa.clienteIds ?? [tarefa.clienteId]).filter(Boolean) as string[]));
        if (clienteIds.length) {
          await tx.tarefaCliente.createMany({
            data: clienteIds.map((clienteId) => ({ tarefaId: id, clienteId })),
          });
        }
      } catch (error) {
        console.warn("[tarefas/update] clientes vinculados indisponível; mantendo atualização principal.", error);
      }

      try {
        await tx.tarefaAnexo.deleteMany({ where: { tarefaId: id } });
        if (tarefa.anexos?.length) {
          await tx.tarefaAnexo.createMany({
            data: tarefa.anexos.map((nomeArquivo) => ({ tarefaId: id, nomeArquivo, url: null })),
          });
        }
      } catch (error) {
        console.warn("[tarefas/update] anexos indisponível; mantendo atualização principal.", error);
      }

      try {
        await tx.tarefaHistoricoAnexo.deleteMany({ where: { historico: { tarefaId: id } } });
        await tx.tarefaHistorico.deleteMany({ where: { tarefaId: id } });
        for (const [index, h] of (tarefa.historico ?? []).entries()) {
          const autorId = h.autorId?.trim() ?? "";
          await tx.tarefaHistorico.create({
            data: {
              id: buildHistoricoId(id, index),
              tarefaId: id,
              data: new Date(h.data),
              acao: h.acao,
              autorId: autorId && autoresValidos.has(autorId) ? autorId : null,
              anexos: {
                create: (h.anexos ?? []).map((nomeArquivo) => ({ nomeArquivo, url: null })),
              },
            },
          });
        }
      } catch (error) {
        console.warn("[tarefas/update] histórico indisponível; mantendo atualização principal.", error);
      }
    });
  } catch (error) {
    const isMissingColumnError =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022";
    if (isMissingColumnError) {
      try {
        // Hotfix para produção com schema legado: garante persistência do movimento no Kanban.
        await prisma.$executeRawUnsafe(
          `UPDATE "Tarefa"
           SET "status" = $1::"TarefaStatus",
               "updatedAt" = $2
           WHERE "id" = $3`,
          tarefa.status,
          new Date(),
          id
        );
        usedStatusOnlyFallback = true;
      } catch (fallbackStatusError) {
        const detail =
          fallbackStatusError instanceof Prisma.PrismaClientKnownRequestError
            ? `Erro ${fallbackStatusError.code}`
            : fallbackStatusError instanceof Error
              ? fallbackStatusError.message
              : "erro desconhecido";
        return fail("INTERNAL_ERROR", `Falha ao persistir tarefa: ${detail}`, 500);
      }
    } else {
    const detail =
      error instanceof Prisma.PrismaClientKnownRequestError
        ? `Erro ${error.code}`
        : error instanceof Error
          ? error.message
          : "erro desconhecido";
    return fail("INTERNAL_ERROR", `Falha ao persistir tarefa: ${detail}`, 500);
    }
  }

  let saved: any;
  try {
    saved = await prisma.tarefa.findUniqueOrThrow({
      where: { id },
      include: {
        cliente: { select: { id: true, nome: true, empresa: true } },
        clientesVinculados: { include: { cliente: { select: { id: true, nome: true, empresa: true } } } },
        responsavel: true,
        colaboradores: { include: { usuario: true } },
        anexos: true,
        historico: { include: { autor: true, anexos: true }, orderBy: { data: "asc" } },
      },
    });
  } catch {
    try {
      saved = await prisma.tarefa.findUniqueOrThrow({
        where: { id },
        include: {
          cliente: { select: { id: true, nome: true, empresa: true } },
          responsavel: true,
          colaboradores: { include: { usuario: true } },
          anexos: true,
          historico: { include: { autor: true, anexos: true }, orderBy: { data: "asc" } },
        },
      });
    } catch (readError) {
      if (!usedStatusOnlyFallback) {
        const detail =
          readError instanceof Prisma.PrismaClientKnownRequestError
            ? `Erro ${readError.code}`
            : readError instanceof Error
              ? readError.message
              : "erro desconhecido";
        return fail("INTERNAL_ERROR", `Falha ao carregar tarefa após atualização: ${detail}`, 500);
      }
      // Em fallback de status (schema legado), retornamos payload mínimo para evitar falso erro no front.
      return ok({
        tarefa: {
          ...tarefa,
          updatedAt: new Date().toISOString(),
          historico: tarefa.historico ?? [],
          anexos: tarefa.anexos ?? [],
          colaboradores: tarefa.colaboradores ?? [],
          clienteIds: tarefa.clienteIds ?? [tarefa.clienteId].filter(Boolean),
          codigo: tarefa.codigo ?? "",
        },
      });
    }
  }
  await writeAuditLog(prisma, {
    acao: "Tarefa atualizada",
    modulo: "tarefas",
    detalhes: `Tarefa ${saved.titulo} (${saved.id})`,
  });
  if (previous?.status !== "concluido" && saved.status === "concluido") {
    try {
      await emitAlert(prisma, {
        modulo: "tarefas",
        titulo: "Tarefa interna concluída",
        descricao: `A tarefa "${saved.titulo}" foi concluída.`,
        dedupeKey: `tarefa-concluida-${saved.id}`,
      });
    } catch (error) {
      console.error("[tarefas/update] falha ao emitir alerta de conclusão:", error);
    }
  }
  if (previous?.status !== "impedimento" && saved.status === "impedimento") {
    try {
      await emitAlert(prisma, {
        modulo: "tarefas",
        titulo: "Tarefa interna com impedimento",
        descricao: `A tarefa "${saved.titulo}" foi movida para impedimento e precisa de ação.`,
        dedupeKey: `tarefa-impedimento-${saved.id}`,
      });
    } catch (error) {
      console.error("[tarefas/update] falha ao emitir alerta de impedimento:", error);
    }
  }
  return ok({ tarefa: mapTarefaFromDb(saved) });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const gate = await tarefasAccessGate(req, "excluir", id);
  if (!gate.ok) return gate.response;

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

