import type { PerfilAcesso as PerfilAcessoFront } from "@/lib/configuracoes/types";
import { prisma } from "@/lib/prisma";
import { mapPerfil } from "../_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";

export async function POST(req: Request) {
  const body = await parseJsonSafe<{ perfil?: PerfilAcessoFront }>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const p = body.value.perfil;
  if (!p?.nome) return fail("BAD_REQUEST", "Perfil inválido.", 400);

  const created = await prisma.perfilAcesso.create({
    data: {
      nome: p.nome,
      descricao: p.descricao ?? null,
      permissoes: {
        create: Object.entries(p.permissoes).map(([modulo, permitido]) => ({
          modulo: modulo as never,
          permitido: Boolean(permitido),
        })),
      },
    },
    include: { permissoes: true },
  });
  await writeAuditLog(prisma, {
    acao: "Perfil criado",
    modulo: "configuracoes",
    detalhes: `Perfil ${created.nome}`,
  });
  return ok({ perfil: mapPerfil(created) }, 201);
}

