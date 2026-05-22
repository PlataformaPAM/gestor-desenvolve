import { prisma } from "@/lib/prisma";

import { Prisma } from "@prisma/client";

import { fail, ok } from "@/lib/server/api-response";

import { writeAuditLog } from "@/lib/server/audit-log";

import {

  alertasAccessGate,

  alertaUsuarioScope,

  allowedAlertModules,

} from "@/lib/server/alertas-access";



export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {

  const gate = await alertasAccessGate(req, "editar");

  if (!gate.ok) return gate.response;



  const { id } = await ctx.params;

  const allowed = allowedAlertModules(gate.session);



  let exists: { id: string; modulo: string } | null = null;

  try {

    exists = await prisma.alerta.findFirst({

      where: {

        id,

        modulo: { in: [...allowed] },

        ...alertaUsuarioScope(gate.session),

      },

      select: { id: true, modulo: true },

    });

  } catch (error) {

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {

      return ok({ updated: false, skipped: true });

    }

    throw error;

  }

  if (!exists) return fail("NOT_FOUND", "Alerta não encontrado.", 404);



  await prisma.alerta

    .update({

      where: { id },

      data: { lida: true },

    })

    .catch(() => undefined);

  await writeAuditLog(prisma, {

    acao: "Alerta marcado como lido",

    modulo: "alertas",

    detalhes: `Alerta ${id}`,

  });

  return ok({ updated: true });

}


