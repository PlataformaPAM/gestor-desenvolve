import type { PerfilAcesso as PerfilAcessoFront } from "@/lib/configuracoes/types";
import { prisma } from "@/lib/prisma";
import { mapPerfil } from "../_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { CONFIG_RESOURCES, configuracoesAccessGate } from "@/lib/server/configuracoes-access";
import { DB_PERMISSION_MODULES } from "@/lib/configuracoes/permission-utils";
import { savePerfilPermissoesExtras } from "@/lib/server/perfil-permissoes-extras";
import { savePerfilGrants } from "@/lib/server/perfil-grants";
import {
  buildEmptyGrantsMap,
  deriveLegacyPermissoesFromGrants,
  grantsFromLegacyPermissoes,
  parseGrantsMap,
} from "@/lib/configuracoes/permission-grants";

export async function POST(req: Request) {
  const gate = await configuracoesAccessGate(req, CONFIG_RESOURCES.perfis, "criar");
  if (!gate.ok) return gate.response;

  const body = await parseJsonSafe<{ perfil?: PerfilAcessoFront }>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const p = body.value.perfil;
  if (!p?.nome) return fail("BAD_REQUEST", "Perfil inválido.", 400);

  const grants = p.permissoesGranulares
    ? parseGrantsMap(p.permissoesGranulares)
    : p.permissoes
      ? grantsFromLegacyPermissoes(p.permissoes)
      : buildEmptyGrantsMap();
  const permissoesDerivadas = deriveLegacyPermissoesFromGrants(grants);

  let created;
  try {
    created = await prisma.perfilAcesso.create({
      data: {
        nome: p.nome,
        descricao: p.descricao ?? null,
        permissoesGranulares: grants as object,
        permissoes: {
          create: Object.entries(permissoesDerivadas)
            .filter(([modulo]) =>
              DB_PERMISSION_MODULES.includes(modulo as (typeof DB_PERMISSION_MODULES)[number])
            )
            .map(([modulo, permitido]) => ({
              modulo: modulo as never,
              permitido: Boolean(permitido),
            })),
        },
      },
      include: { permissoes: true },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("permissoesGranulares")) throw error;
    created = await prisma.perfilAcesso.create({
      data: {
        nome: p.nome,
        descricao: p.descricao ?? null,
        permissoes: {
          create: Object.entries(permissoesDerivadas)
            .filter(([modulo]) =>
              DB_PERMISSION_MODULES.includes(modulo as (typeof DB_PERMISSION_MODULES)[number])
            )
            .map(([modulo, permitido]) => ({
              modulo: modulo as never,
              permitido: Boolean(permitido),
            })),
        },
      },
      include: { permissoes: true },
    });
  }
  await savePerfilGrants(prisma, created.id, grants);
  await savePerfilPermissoesExtras(prisma, created.id, permissoesDerivadas);
  await writeAuditLog(prisma, {
    acao: "Perfil criado",
    modulo: "configuracoes",
    detalhes: `Perfil ${created.nome}`,
  });
  return ok({ perfil: mapPerfil(created, permissoesDerivadas) }, 201);
}

