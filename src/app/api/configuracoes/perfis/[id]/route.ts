import type { PerfilAcesso as PerfilAcessoFront } from "@/lib/configuracoes/types";
import { prisma } from "@/lib/prisma";
import { mapPerfil } from "../../_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { DB_PERMISSION_MODULES } from "@/lib/configuracoes/permission-utils";
import { savePerfilPermissoesExtras } from "@/lib/server/perfil-permissoes-extras";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await parseJsonSafe<{ perfil?: PerfilAcessoFront }>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const p = body.value.perfil;
  if (!p || p.id !== id) return fail("BAD_REQUEST", "Payload inválido.", 400);

  await prisma.$transaction(async (tx) => {
    await tx.perfilAcesso.update({
      where: { id },
      data: {
        nome: p.nome,
        descricao: p.descricao ?? null,
      },
    });
    await tx.perfilPermissao.deleteMany({ where: { perfilId: id } });
    await tx.perfilPermissao.createMany({
      data: Object.entries(p.permissoes)
        .filter(([modulo]) => DB_PERMISSION_MODULES.includes(modulo as (typeof DB_PERMISSION_MODULES)[number]))
        .map(([modulo, permitido]) => ({
          perfilId: id,
          modulo: modulo as never,
          permitido: Boolean(permitido),
        })),
    });
  });
  await savePerfilPermissoesExtras(prisma, id, p.permissoes);

  const updated = await prisma.perfilAcesso.findUniqueOrThrow({
    where: { id },
    include: { permissoes: true },
  });
  await writeAuditLog(prisma, {
    acao: "Perfil atualizado",
    modulo: "configuracoes",
    detalhes: `Perfil ${updated.nome}`,
  });
  return ok({ perfil: mapPerfil(updated, p.permissoes) });
}

