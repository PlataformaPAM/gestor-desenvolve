import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/server/api-response";
import { tarefasAccessGate } from "@/lib/server/tarefas-access";
import {
  resolveTarefaAnexoForRead,
  tarefaAnexoPublicUrl,
} from "@/lib/server/tarefas-anexos";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: tarefaId } = await ctx.params;
  const gate = await tarefasAccessGate(req, "ver", tarefaId);
  if (!gate.ok) return gate.response;

  const nome = new URL(req.url).searchParams.get("nome")?.trim();
  if (!nome) return fail("BAD_REQUEST", "Informe o nome do anexo.", 400);

  const registro = await prisma.tarefaAnexo.findFirst({
    where: { tarefaId, nomeArquivo: nome },
    select: { id: true, url: true },
  });

  const resolved = await resolveTarefaAnexoForRead(tarefaId, nome, registro?.url);
  if (!resolved) return fail("NOT_FOUND", "Anexo não encontrado.", 404);

  if (registro && !registro.url) {
    const canonicalUrl = tarefaAnexoPublicUrl(tarefaId, resolved.storedName);
    await prisma.tarefaAnexo
      .update({
        where: { id: registro.id },
        data: { url: canonicalUrl },
      })
      .catch(() => undefined);
  }

  return new Response(new Uint8Array(resolved.data), {
    status: 200,
    headers: {
      "Content-Type": resolved.contentType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(nome)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
