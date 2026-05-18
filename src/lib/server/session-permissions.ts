import type { PrismaClient } from "@prisma/client";
import type { ModuloPermissao } from "@/lib/configuracoes/types";
import {
  isAdminProfileName,
  withAdminOverride,
} from "@/lib/configuracoes/permission-utils";
import { loadPerfilPermissoesExtras } from "@/lib/server/perfil-permissoes-extras";

export type ResolvedSessionPermissions = {
  permissoes: Record<ModuloPermissao, boolean>;
  perfilNome: string;
  isSystemAdmin: boolean;
};

export function resolveIsSystemAdmin(perfilNome: string): boolean {
  return isAdminProfileName(perfilNome);
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
  const permissoes = withAdminOverride(
    {
      ...permissoesBase,
      ...(extrasByPerfil[perfilId] ?? {}),
    },
    perfilNome
  );
  const isSystemAdmin = resolveIsSystemAdmin(perfilNome);

  return { permissoes, perfilNome, isSystemAdmin };
}
