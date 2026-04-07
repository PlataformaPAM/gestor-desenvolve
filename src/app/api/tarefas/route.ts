import { prisma } from "@/lib/prisma";
import type { Tarefa } from "@/lib/tarefas/types";
import { mapTarefaFromDb } from "./_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { emitAlert } from "@/lib/server/alerts";

export async function POST(req: Request) {
  const parsed = await parseJsonSafe<{ tarefa?: Tarefa }>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const tarefa = parsed.value.tarefa;
  if (!tarefa?.id || !tarefa.responsavel?.id) {
    return fail("BAD_REQUEST", "Payload de tarefa inválido.", 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.tarefa.create({
      data: {
        id: tarefa.id,
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

    if (tarefa.colaboradores?.length) {
      await tx.tarefaColaborador.createMany({
        data: tarefa.colaboradores.map((c) => ({ tarefaId: tarefa.id, usuarioId: c.id })),
      });
    }

    if (tarefa.anexos?.length) {
      await tx.tarefaAnexo.createMany({
        data: tarefa.anexos.map((nomeArquivo) => ({ tarefaId: tarefa.id, nomeArquivo, url: null })),
      });
    }

    for (const h of tarefa.historico ?? []) {
      await tx.tarefaHistorico.create({
        data: {
          id: h.id,
          tarefaId: tarefa.id,
          data: new Date(h.data),
          acao: h.acao,
          anexos: {
            create: (h.anexos ?? []).map((nomeArquivo) => ({ nomeArquivo, url: null })),
          },
        },
      });
    }
  });

  const saved = await prisma.tarefa.findUniqueOrThrow({
    where: { id: tarefa.id },
    include: {
      responsavel: true,
      colaboradores: { include: { usuario: true } },
      anexos: true,
      historico: { include: { autor: true, anexos: true }, orderBy: { data: "asc" } },
    },
  });
  await writeAuditLog(prisma, {
    acao: "Tarefa criada",
    modulo: "tarefas",
    detalhes: `Tarefa ${saved.titulo} (${saved.id})`,
  });
  await emitAlert(prisma, {
    modulo: "tarefas",
    titulo: "Nova tarefa interna criada",
    descricao: `Tarefa "${saved.titulo}" criada para acompanhamento da equipe.`,
    dedupeKey: `tarefa-criada-${saved.id}`,
  });
  return ok({ tarefa: mapTarefaFromDb(saved) }, 201);
}

