import { prisma } from "@/lib/prisma";

import { Prisma } from "@prisma/client";

import { fail, ok } from "@/lib/server/api-response";

import { writeAuditLog } from "@/lib/server/audit-log";

import {

  alertasAccessGate,

  alertaUsuarioScope,

  allowedAlertModules,

} from "@/lib/server/alertas-access";



export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {

  const gate = await alertasAccessGate(req, "excluir");

  if (!gate.ok) return gate.response;



  const { id } = await ctx.params;

  const allowed = allowedAlertModules(gate.session);



  let exists: { id: string } | null = null;

  try {

    exists = await prisma.alerta.findFirst({

      where: {

        id,

        modulo: { in: [...allowed] },

        ...alertaUsuarioScope(gate.session),

      },

      select: { id: true },

    });

  } catch (error) {

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {

      return ok({ deleted: false, skipped: true });

    }

    throw error;

  }

  if (!exists) return fail("NOT_FOUND", "Alerta não encontrado.", 404);



  await prisma.alerta.delete({ where: { id } }).catch(() => undefined);

  await writeAuditLog(prisma, {

    acao: "Alerta excluído",

    modulo: "alertas",

    detalhes: `Alerta ${id}`,

  });

  return ok({ deleted: true });

}


