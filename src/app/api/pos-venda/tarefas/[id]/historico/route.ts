import { prisma } from "@/lib/prisma";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tarefa = await prisma.tarefa.findUnique({ where: { id }, select: { id: true } });
  if (!tarefa) return fail("NOT_FOUND", "Tarefa não encontrada.", 404);

  const historico = await prisma.tarefaHistorico.findMany({
    where: { tarefaId: id },
    include: {
      autor: { select: { id: true, nomeExibicao: true } },
      anexos: { select: { id: true, nomeArquivo: true, url: true } },
    },
    orderBy: { data: "desc" },
    take: 100,
  });

  return ok({
    historico: historico.map((h) => ({
      id: h.id,
      data: h.data.toISOString(),
      acao: h.acao,
      autorId: h.autorId,
      autorNome: h.autor?.nomeExibicao || "Sistema",
      anexos: h.anexos.map((a) => ({ id: a.id, name: a.nomeArquivo, url: a.url || undefined })),
    })),
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseJsonSafe<{
    acao?: string;
    anexos?: Array<{ name?: string; url?: string }>;
  }>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const acao = parsed.value.acao?.trim();
  if (!acao) return fail("BAD_REQUEST", "Informe a descrição do comentário.", 400);

  const tarefa = await prisma.tarefa.findUnique({ where: { id }, select: { id: true } });
  if (!tarefa) return fail("NOT_FOUND", "Tarefa não encontrada.", 404);

  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const session = decodeSession(match?.[1]?.trim());

  const created = await prisma.tarefaHistorico.create({
    data: {
      tarefaId: id,
      data: new Date(),
      acao,
      autorId: session?.userId ?? null,
      anexos: {
        create: (parsed.value.anexos ?? [])
          .filter((a) => a?.name?.trim())
          .map((a) => ({
            nomeArquivo: a.name!.trim(),
            url: a.url?.trim() || null,
          })),
      },
    },
    include: {
      autor: { select: { id: true, nomeExibicao: true } },
      anexos: { select: { id: true, nomeArquivo: true, url: true } },
    },
  });

  return ok({
    created: {
      id: created.id,
      data: created.data.toISOString(),
      acao: created.acao,
      autorId: created.autorId,
      autorNome: created.autor?.nomeExibicao || "Sistema",
      anexos: created.anexos.map((a) => ({ id: a.id, name: a.nomeArquivo, url: a.url || undefined })),
    },
  });
}

