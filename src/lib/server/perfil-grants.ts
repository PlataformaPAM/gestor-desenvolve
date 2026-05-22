import type { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { ModuloPermissao, PerfilAcesso } from "@/lib/configuracoes/types";
import {
  grantsFromLegacyPermissoes,
  parseGrantsMap,
  type GrantsMap,
} from "@/lib/configuracoes/permission-grants";
import { isAdminProfileName } from "@/lib/configuracoes/permission-utils";
import { grantsForAdmin } from "@/lib/configuracoes/permission-grants";

type Db = Prisma.TransactionClient | PrismaClient;

type PerfilRow = {
  nome: string;
  permissoesGranulares: unknown;
  permissoes: { modulo: string; permitido: boolean }[];
};

export function loadGrantsForPerfil(
  perfil: PerfilRow,
  extras?: Partial<Record<ModuloPermissao, boolean>>
): GrantsMap {
  if (isAdminProfileName(perfil.nome)) {
    return grantsForAdmin();
  }
  if (perfil.permissoesGranulares) {
    return parseGrantsMap(perfil.permissoesGranulares);
  }
  const permissoesBase = Object.fromEntries(
    perfil.permissoes.map((p) => [p.modulo, p.permitido])
  ) as Partial<Record<ModuloPermissao, boolean>>;
  return grantsFromLegacyPermissoes({ ...permissoesBase, ...(extras ?? {}) });
}

export async function savePerfilGrants(
  db: Db,
  perfilId: string,
  grants: GrantsMap
): Promise<void> {
  try {
    await db.perfilAcesso.update({
      where: { id: perfilId },
      data: {
        permissoesGranulares: grants as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("permissoesGranulares") && !message.includes("does not exist")) {
      throw error;
    }
    // Coluna ainda não migrada no ambiente — permissões legadas continuam válidas.
  }
}

export function attachGrantsToPerfilFront<T extends PerfilAcesso>(
  perfil: T,
  grants: GrantsMap
): T & { permissoesGranulares: GrantsMap } {
  return { ...perfil, permissoesGranulares: grants };
}
