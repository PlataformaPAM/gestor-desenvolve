import type { Tarefa } from "@/lib/tarefas/types";
import { deleteTarefaAnexoFile } from "@/lib/server/tarefas-anexos";

type AnexoTx = {
  tarefaAnexo: {
    findMany: (args: {
      where: { tarefaId: string };
      select: { nomeArquivo: true; url: true };
    }) => Promise<Array<{ nomeArquivo: string; url: string | null }>>;
    deleteMany: (args: { where: { tarefaId: string } }) => Promise<unknown>;
    createMany: (args: {
      data: Array<{ tarefaId: string; nomeArquivo: string; url: string | null }>;
    }) => Promise<unknown>;
  };
};

export async function syncTarefaAnexos(
  tx: AnexoTx,
  tarefaId: string,
  tarefa: Pick<Tarefa, "anexos" | "anexoItens">
): Promise<void> {
  const nomes = Array.from(new Set((tarefa.anexos ?? []).filter(Boolean)));
  const existing = await tx.tarefaAnexo.findMany({
    where: { tarefaId },
    select: { nomeArquivo: true, url: true },
  });
  const urlByName = new Map(existing.map((item) => [item.nomeArquivo, item.url]));
  for (const item of tarefa.anexoItens ?? []) {
    if (item.url) urlByName.set(item.name, item.url);
  }

  const removed = existing.filter((item) => !nomes.includes(item.nomeArquivo));
  for (const item of removed) {
    await deleteTarefaAnexoFile(tarefaId, item.url);
  }

  await tx.tarefaAnexo.deleteMany({ where: { tarefaId } });
  if (!nomes.length) return;

  await tx.tarefaAnexo.createMany({
    data: nomes.map((nomeArquivo) => ({
      tarefaId,
      nomeArquivo,
      url: urlByName.get(nomeArquivo) ?? null,
    })),
  });
}
