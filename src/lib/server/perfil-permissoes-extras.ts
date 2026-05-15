import type { PrismaClient } from "@prisma/client";
import type { ModuloPermissao } from "@/lib/configuracoes/types";
import { EXTRA_PERMISSION_KEYS } from "@/lib/configuracoes/permission-utils";

const PREFIX = "perfil_permissoes_extras:";

function buildKey(perfilId: string): string {
  return `${PREFIX}${perfilId}`;
}

const EXTRA_KEYS: ModuloPermissao[] = [...EXTRA_PERMISSION_KEYS];

export async function loadPerfilPermissoesExtras(
  prisma: PrismaClient,
  perfilIds: string[]
): Promise<Record<string, Partial<Record<ModuloPermissao, boolean>>>> {
  if (perfilIds.length === 0) return {};
  const configs = await prisma.configuracaoSistema.findMany({
    where: { chave: { in: perfilIds.map(buildKey) } },
    select: { chave: true, valor: true },
  });
  const byPerfil: Record<string, Partial<Record<ModuloPermissao, boolean>>> = {};
  for (const row of configs) {
    const perfilId = row.chave.replace(PREFIX, "");
    const raw = typeof row.valor === "object" && row.valor ? (row.valor as Record<string, unknown>) : {};
    const parsed: Partial<Record<ModuloPermissao, boolean>> = {};
    for (const key of EXTRA_KEYS) {
      parsed[key] = raw[key] === true;
    }
    byPerfil[perfilId] = parsed;
  }
  return byPerfil;
}

export async function savePerfilPermissoesExtras(
  prisma: PrismaClient,
  perfilId: string,
  permissoes: Partial<Record<ModuloPermissao, boolean>>
): Promise<void> {
  const valor = Object.fromEntries(EXTRA_KEYS.map((key) => [key, permissoes[key] === true]));
  await prisma.configuracaoSistema.upsert({
    where: { chave: buildKey(perfilId) },
    create: { chave: buildKey(perfilId), valor },
    update: { valor },
  });
}
