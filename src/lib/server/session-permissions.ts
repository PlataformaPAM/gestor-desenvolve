import type { PrismaClient } from "@prisma/client";
import type { ModuloPermissao } from "@/lib/configuracoes/types";
import {
  buildDefaultPermissoes,
  DB_PERMISSION_MODULES,
  isAdminProfileName,
  withAdminOverride,
} from "@/lib/configuracoes/permission-utils";
import { grantsForAdmin } from "@/lib/configuracoes/permission-grants";
import type { GrantsMap } from "@/lib/configuracoes/permission-grants";
import { loadPerfilPermissoesExtras, savePerfilPermissoesExtras } from "@/lib/server/perfil-permissoes-extras";
import { loadGrantsForPerfil, savePerfilGrants } from "@/lib/server/perfil-grants";

export type ResolvedSessionPermissions = {
  permissoes: Record<ModuloPermissao, boolean>;
  perfilNome: string;
  isSystemAdmin: boolean;
  grants: GrantsMap;
};

export function resolveIsSystemAdmin(perfilNome: string): boolean {
  return isAdminProfileName(perfilNome);
}

/** Repara perfil Administrador no banco (ex.: após migração RBAC com toggles zerados). */
export async function ensureSystemAdminProfilePersisted(
  db: PrismaClient,
  perfilId: string,
  perfilNome: string
): Promise<void> {
  if (!isAdminProfileName(perfilNome)) return;

  const allTrue = buildDefaultPermissoes();
  for (const key of Object.keys(allTrue) as ModuloPermissao[]) {
    allTrue[key] = true;
  }

  await db.$transaction(async (tx) => {
    await tx.perfilPermissao.deleteMany({ where: { perfilId } });
    await tx.perfilPermissao.createMany({
      data: DB_PERMISSION_MODULES.map((modulo) => ({
        perfilId,
        modulo: modulo as never,
        permitido: true,
      })),
    });
  });
  await savePerfilPermissoesExtras(db, perfilId, allTrue);
  await savePerfilGrants(db, perfilId, grantsForAdmin());
}

/** Carrega permissões do perfil (DB + extras) e aplica override de administrador. */
export async function loadSessionPermissions(
  db: PrismaClient,
  perfilId: string
): Promise<ResolvedSessionPermissions> {
  const perfil = await db.perfilAcesso.findUnique({
    where: { id: perfilId },
    include: { permissoes: true },
  });

  const permissoesBase = Object.fromEntries(
    (perfil?.permissoes ?? []).map((p) => [p.modulo, p.permitido])
  ) as Partial<Record<ModuloPermissao, boolean>>;

  const extrasByPerfil = await loadPerfilPermissoesExtras(db, [perfilId]);
  const perfilNome = perfil?.nome?.trim() ?? "";

  if (isAdminProfileName(perfilNome)) {
    const extras = extrasByPerfil[perfilId] ?? {};
    const mergedBeforeOverride = { ...permissoesBase, ...extras };
    const needsRepair =
      (perfil?.permissoes ?? []).some((p) => !p.permitido) ||
      Object.keys(buildDefaultPermissoes()).some(
        (key) => mergedBeforeOverride[key as ModuloPermissao] !== true
      );
    if (needsRepair) {
      try {
        await ensureSystemAdminProfilePersisted(db, perfilId, perfilNome);
      } catch (repairError) {
        console.error("[session-permissions] falha ao reparar perfil administrador:", repairError);
      }
    }
  }

  const mergedExtras = {
    ...permissoesBase,
    ...(extrasByPerfil[perfilId] ?? {}),
  };
  const permissoes = withAdminOverride(mergedExtras, perfilNome);
  const isSystemAdmin = resolveIsSystemAdmin(perfilNome);
  const grants = loadGrantsForPerfil(
    {
      nome: perfilNome,
      permissoesGranulares: perfil?.permissoesGranulares,
      permissoes: perfil?.permissoes ?? [],
    },
    extrasByPerfil[perfilId]
  );

  return { permissoes, perfilNome, isSystemAdmin, grants };
}
