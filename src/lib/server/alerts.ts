import type { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

export const ALERT_MODULES = [
  "sistema",
  "comercial",
  "financeiro",
  "clientes",
  "contratos",
  "helpdesk",
  "posVenda",
  "tarefas",
] as const;

export type AlertModule = (typeof ALERT_MODULES)[number];

function isValidModule(modulo: string): modulo is AlertModule {
  return (ALERT_MODULES as readonly string[]).includes(modulo);
}

function withDedupeTag(descricao: string, dedupeKey?: string): string {
  const key = dedupeKey?.trim();
  if (!key) return descricao;
  return `${descricao}\n[ALERTA_DEDUPE:${key}]`;
}

type EmitAlertInput = {
  modulo: AlertModule | string;
  titulo: string;
  descricao: string;
  usuarioId?: string | null;
  dedupeKey?: string;
  data?: Date;
};

async function shouldSkipByDedupe(
  db: Prisma.TransactionClient | PrismaClient,
  dedupeKey?: string
): Promise<boolean> {
  const key = dedupeKey?.trim();
  if (!key) return false;
  const found = await db.alerta.findFirst({
    where: { descricao: { contains: `[ALERTA_DEDUPE:${key}]` } },
    select: { id: true },
  });
  return !!found;
}

export async function emitAlert(
  db: Prisma.TransactionClient | PrismaClient,
  input: EmitAlertInput
): Promise<{ created: boolean }> {
  if (!isValidModule(input.modulo)) return { created: false };
  const titulo = input.titulo?.trim();
  const descricao = input.descricao?.trim();
  if (!titulo || !descricao) return { created: false };
  if (await shouldSkipByDedupe(db, input.dedupeKey)) return { created: false };

  await db.alerta.create({
    data: {
      modulo: input.modulo,
      titulo,
      descricao: withDedupeTag(descricao, input.dedupeKey),
      data: input.data ?? new Date(),
      usuarioId: input.usuarioId?.trim() || null,
    },
  });
  return { created: true };
}

export async function emitManyAlerts(
  db: Prisma.TransactionClient | PrismaClient,
  inputs: EmitAlertInput[]
): Promise<void> {
  for (const item of inputs) {
    await emitAlert(db, item);
  }
}

