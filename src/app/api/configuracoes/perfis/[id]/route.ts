import type { PerfilAcesso as PerfilAcessoFront } from "@/lib/configuracoes/types";
import { prisma } from "@/lib/prisma";
import { mapPerfil } from "../../_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { CONFIG_RESOURCES, configuracoesAccessGate } from "@/lib/server/configuracoes-access";
import { DB_PERMISSION_MODULES } from "@/lib/configuracoes/permission-utils";
import { savePerfilPermissoesExtras } from "@/lib/server/perfil-permissoes-extras";
import { savePerfilGrants } from "@/lib/server/perfil-grants";
import {
  deriveLegacyPermissoesFromGrants,
  grantsFromLegacyPermissoes,
  parseGrantsMap,
} from "@/lib/configuracoes/permission-grants";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await configuracoesAccessGate(req, CONFIG_RESOURCES.perfis, "editar");
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const body = await parseJsonSafe<{ perfil?: PerfilAcessoFront }>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const p = body.value.perfil;
  if (!p || p.id !== id) return fail("BAD_REQUEST", "Payload inválido.", 400);

  const grants = p.permissoesGranulares
    ? parseGrantsMap(p.permissoesGranulares)
    : grantsFromLegacyPermissoes(p.permissoes);
  const permissoesDerivadas = deriveLegacyPermissoesFromGrants(grants);

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
      data: Object.entries(permissoesDerivadas)
        .filter(([modulo]) => DB_PERMISSION_MODULES.includes(modulo as (typeof DB_PERMISSION_MODULES)[number]))
        .map(([modulo, permitido]) => ({
          perfilId: id,
          modulo: modulo as never,
          permitido: Boolean(permitido),
        })),
    });
  });
  await savePerfilGrants(prisma, id, grants);
  await savePerfilPermissoesExtras(prisma, id, permissoesDerivadas);

  const updated = await prisma.perfilAcesso.findUniqueOrThrow({
    where: { id },
    include: { permissoes: true },
  });
  await writeAuditLog(prisma, {
    acao: "Perfil atualizado",
    modulo: "configuracoes",
    detalhes: `Perfil ${updated.nome}`,
  });
  return ok({ perfil: mapPerfil(updated, permissoesDerivadas) });
}

