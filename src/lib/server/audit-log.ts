import type { PrismaClient } from "@prisma/client";

type AuditParams = {
  usuarioId?: string | null;
  acao: string;
  modulo?: string;
  detalhes?: string;
};

export async function writeAuditLog(prisma: PrismaClient, params: AuditParams): Promise<void> {
  await prisma.logSistema.create({
    data: {
      data: new Date(),
      usuarioId: params.usuarioId ?? null,
      acao: params.acao,
      modulo: params.modulo ?? null,
      detalhes: params.detalhes ?? null,
    },
  });
}

