import { prisma } from "@/lib/prisma";

import { Prisma } from "@prisma/client";

import { fail, ok } from "@/lib/server/api-response";

import { writeAuditLog } from "@/lib/server/audit-log";

import {

  alertasAccessGate,

  alertaUsuarioScope,

  allowedAlertModules,

} from "@/lib/server/alertas-access";



export async function PATCH(req: Request) {

  const gate = await alertasAccessGate(req, "editar");

  if (!gate.ok) return gate.response;



  const allowed = [...allowedAlertModules(gate.session)];

  if (allowed.length === 0) {

    return ok({ updated: 0 });

  }



  let result = { count: 0 };

  try {

    result = await prisma.alerta.updateMany({

      where: {

        lida: false,

        modulo: { in: allowed },

        ...alertaUsuarioScope(gate.session),

      },

      data: { lida: true },

    });

  } catch (error) {

    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021")) {

      throw error;

    }

  }

  await writeAuditLog(prisma, {

    acao: "Alertas marcados como lidos",

    modulo: "alertas",

    detalhes: `${result.count} alerta(s) atualizados`,

  });

  return ok({ updated: result.count });

}


