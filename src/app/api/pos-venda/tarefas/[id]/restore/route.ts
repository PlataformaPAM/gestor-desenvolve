import { prisma } from "@/lib/prisma";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { decodePosVendaMeta, encodePosVendaMeta } from "../../../_shared";
import { emitAlert } from "@/lib/server/alerts";
import { writeAuditLog } from "@/lib/server/audit-log";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsedBody = await parseJsonSafe<{ motivo?: string }>(req);
  if (!parsedBody.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const motivo = parsedBody.value.motivo?.trim();
  if (!motivo) return fail("BAD_REQUEST", "Informe o motivo da restauração.", 400);

  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const session = decodeSession(match?.[1]?.trim());
  if (!session?.perfilId) return fail("UNAUTHORIZED", "Sessão inválida.", 401);
  const perfil = await prisma.perfilAcesso.findUnique({
    where: { id: session.perfilId },
    select: { nome: true },
  });
  const isAdmin = (perfil?.nome || "").toLowerCase().includes("admin");
  if (!isAdmin) return fail("FORBIDDEN", "Apenas administrador pode restaurar itens.", 403);

  const current = await prisma.tarefa.findUnique({ where: { id } });
  if (!current) return fail("NOT_FOUND", "Tarefa não encontrada.", 404);
  const parsed = decodePosVendaMeta(current.descricao);
  if (!parsed.meta.removidaEm) return ok({ restored: true });

  await prisma.$transaction(async (tx) => {
    await tx.tarefa.update({
      where: { id },
      data: {
        status: "a_fazer",
        descricao: encodePosVendaMeta(
          {
            ...parsed.meta,
            removidaEm: undefined,
            removidaMotivo: undefined,
            removidaPor: undefined,
          },
          parsed.descricao
        ),
      },
    });
    await tx.tarefaHistorico.create({
      data: {
        tarefaId: id,
        data: new Date(),
        autorId: session?.userId ?? null,
        acao: `Restaurada da lixeira: ${motivo}`,
      },
    });
  });

  const admins = await prisma.usuario.findMany({
    where: {
      ativo: true,
      perfil: { nome: { contains: "admin", mode: "insensitive" } },
    },
    select: { id: true },
  });
  await Promise.all(
    admins.map((a) =>
      emitAlert(prisma, {
        modulo: "posVenda",
        usuarioId: a.id,
        titulo: "Item restaurado da lixeira no Pós-venda",
        descricao: `A tarefa "${current.titulo}" foi restaurada. Motivo: ${motivo}.`,
        dedupeKey: `posvenda-restaurada-${id}-${Date.now()}`,
      })
    )
  );

  await writeAuditLog(prisma, {
    acao: "Tarefa de pós-venda restaurada da lixeira",
    modulo: "pos-venda",
    detalhes: `Tarefa ${id} - Motivo: ${motivo}`,
  });
  return ok({ restored: true });
}
