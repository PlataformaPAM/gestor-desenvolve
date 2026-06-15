import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/server/api-response";
import { mapTarefaFromDb } from "../../_shared";
import { tarefasAccessGate } from "@/lib/server/tarefas-access";
import { writeTarefaAnexo } from "@/lib/server/tarefas-anexos";
import { TAREFA_BOOTSTRAP_INCLUDE } from "@/lib/server/tarefas-bootstrap";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: tarefaId } = await ctx.params;
  const gate = await tarefasAccessGate(req, "editar", tarefaId);
  if (!gate.ok) return gate.response;

  const exists = await prisma.tarefa.findUnique({ where: { id: tarefaId }, select: { id: true } });
  if (!exists) return fail("NOT_FOUND", "Tarefa não encontrada.", 404);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("BAD_REQUEST", "Formulário inválido.", 400);
  }

  const files = form
    .getAll("arquivos")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!files.length) {
    return fail("BAD_REQUEST", "Envie ao menos um arquivo.", 400);
  }

  try {
    for (const file of files) {
      const saved = await writeTarefaAnexo(tarefaId, file);
      const existing = await prisma.tarefaAnexo.findFirst({
        where: { tarefaId, nomeArquivo: saved.nomeArquivo },
        select: { id: true, url: true },
      });
      if (existing) {
        await prisma.tarefaAnexo.update({
          where: { id: existing.id },
          data: { url: saved.url },
        });
      } else {
        await prisma.tarefaAnexo.create({
          data: {
            tarefaId,
            nomeArquivo: saved.nomeArquivo,
            url: saved.url,
          },
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao salvar anexos.";
    return fail("BAD_REQUEST", message, 400);
  }

  const tarefa = await prisma.tarefa.findUniqueOrThrow({
    where: { id: tarefaId },
    include: TAREFA_BOOTSTRAP_INCLUDE,
  });

  return ok({ tarefa: mapTarefaFromDb(tarefa) });
}
