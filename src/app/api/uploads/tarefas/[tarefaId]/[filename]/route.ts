import { tarefasAccessGate } from "@/lib/server/tarefas-access";
import {
  contentTypeFromFileName,
  readTarefaAnexo,
  safeStoredFileName,
} from "@/lib/server/tarefas-anexos";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ tarefaId: string; filename: string }> }
) {
  const { tarefaId, filename: rawFilename } = await ctx.params;
  const gate = await tarefasAccessGate(req, "ver", tarefaId);
  if (!gate.ok) return gate.response;

  const filename = safeStoredFileName(rawFilename);
  if (!filename) return new Response("Arquivo inválido.", { status: 400 });

  const data = await readTarefaAnexo(tarefaId, filename);
  if (!data) return new Response("Arquivo não encontrado.", { status: 404 });

  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": contentTypeFromFileName(filename),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
