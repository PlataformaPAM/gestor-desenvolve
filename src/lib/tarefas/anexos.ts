import type { Tarefa, TarefaAnexoItem } from "@/lib/tarefas/types";

export function tarefaAnexoLeituraUrl(tarefaId: string, nomeArquivo: string): string {
  return `/api/tarefas/${encodeURIComponent(tarefaId)}/anexos/arquivo?nome=${encodeURIComponent(nomeArquivo)}`;
}

export function buildAnexoItens(
  nomes: string[],
  tarefaId?: string,
  ...sources: Array<TarefaAnexoItem[] | undefined>
): TarefaAnexoItem[] {
  const byName = new Map<string, TarefaAnexoItem>();
  for (const list of sources) {
    for (const item of list ?? []) {
      if (!item.name) continue;
      byName.set(item.name, item);
    }
  }
  return nomes.map((name) => {
    const item = byName.get(name) ?? { name };
    if (!tarefaId) return item;
    return {
      ...item,
      url: item.url ?? tarefaAnexoLeituraUrl(tarefaId, name),
    };
  });
}

export async function uploadTarefaAnexos(tarefaId: string, files: File[]): Promise<Tarefa> {
  if (!files.length) {
    throw new Error("Nenhum arquivo para enviar.");
  }
  const form = new FormData();
  for (const file of files) {
    form.append("arquivos", file, file.name);
  }
  const res = await fetch(`/api/tarefas/${tarefaId}/anexos`, {
    method: "POST",
    body: form,
  });
  const payload = (await res.json().catch(() => ({}))) as {
    tarefa?: Tarefa;
    data?: { tarefa?: Tarefa };
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(payload?.error?.message || "Falha ao enviar anexos.");
  }
  const saved = payload?.tarefa ?? payload?.data?.tarefa;
  if (!saved) throw new Error("Resposta inválida ao enviar anexos.");
  return saved;
}

export function mergeTarefaPreservandoAnexos(saved: Tarefa, previous?: Tarefa | null): Tarefa {
  const nomes = saved.anexos ?? [];
  const anexoItens = buildAnexoItens(nomes, saved.id, saved.anexoItens, previous?.anexoItens);
  const arquivos =
    previous?.arquivos?.filter((file) => nomes.includes(file.name)) ??
    saved.arquivos ??
    [];
  return {
    ...saved,
    anexoItens,
    arquivos,
  };
}
