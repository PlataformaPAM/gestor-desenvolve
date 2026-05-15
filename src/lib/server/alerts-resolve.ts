import type { Prisma, PrismaClient } from "@prisma/client";
import { badgeUrgenciaContrato } from "@/lib/contratos/vencimento-utils";
import { diasAteVencimentoCalendar } from "@/lib/financeiro/lancamento-utils";

type Db = Prisma.TransactionClient | PrismaClient;

const DEDUPE_RE = /\[ALERTA_DEDUPE:([^\]]+)\]/i;

export function extractDedupeKey(descricao: string): string | null {
  const m = descricao.match(DEDUPE_RE);
  return m?.[1]?.trim() || null;
}

function dedupeTag(dedupeKey: string): string {
  return `[ALERTA_DEDUPE:${dedupeKey.trim()}]`;
}

export async function markAlertsReadByDedupe(db: Db, dedupeKey: string): Promise<void> {
  const key = dedupeKey.trim();
  if (!key) return;
  await db.alerta.updateMany({
    where: { descricao: { contains: dedupeTag(key) }, lida: false },
    data: { lida: true },
  });
}

export async function markAlertsReadByDedupePrefix(db: Db, prefix: string): Promise<void> {
  const p = prefix.trim();
  if (!p) return;
  await db.alerta.updateMany({
    where: { descricao: { contains: dedupeTag(p) }, lida: false },
    data: { lida: true },
  });
}

function lancamentoAindaUrgente(lanc: { status: string; vencimento: Date }): boolean {
  if (lanc.status === "pago") return false;
  const dias = diasAteVencimentoCalendar(lanc.vencimento.toISOString().slice(0, 10));
  if (dias < 0) return true;
  if (dias >= 2 && dias <= 7) return true;
  return false;
}

function parseReabertoDedupeKey(key: string): { lancamentoId: string } | null {
  if (!key.startsWith("reaberto-pendente-")) return null;
  const rest = key.slice("reaberto-pendente-".length);
  const lastDash = rest.lastIndexOf("-");
  if (lastDash <= 0) return null;
  const lancamentoId = rest.slice(0, lastDash);
  return lancamentoId ? { lancamentoId } : null;
}

export async function markAlertsReadForLancamentoPaid(
  db: Db,
  lanc: { id: string; descricao: string }
): Promise<void> {
  await markAlertsReadByDedupePrefix(db, `reaberto-pendente-${lanc.id}-`);
}

export async function markAlertsReadForLeadFinanceiroApproved(db: Db, leadId: string): Promise<void> {
  const id = leadId.trim();
  if (!id) return;
  await markAlertsReadByDedupe(db, `fechado-financeiro-${id}`);
  await markAlertsReadByDedupe(db, `fechado-posvenda-pendente-${id}`);
}

export async function markContratoAlertsResolvedIfApplicable(
  db: Db,
  contrato: {
    id: string;
    leadId: string | null;
    status: string;
    dataFim: Date | null;
  }
): Promise<void> {
  const dataFimIso = contrato.dataFim?.toISOString() ?? null;
  if (badgeUrgenciaContrato(dataFimIso, contrato.status)) return;

  await markAlertsReadByDedupe(db, `contrato-auto-suspenso-${contrato.id}`);
  await markAlertsReadByDedupe(db, `contrato-manual-fin-${contrato.id}`);
  await markAlertsReadByDedupe(db, `contrato-manual-pv-${contrato.id}`);

  if (contrato.leadId) {
    await markAlertsReadByDedupe(db, `contrato-novo-${contrato.leadId}`);
    await markAlertsReadByDedupe(db, `contrato-ativado-${contrato.leadId}`);
  }
}

export async function reconcileStaleFinanceiroAlerts(db: Db): Promise<void> {
  const rows = await db.alerta.findMany({
    where: { modulo: "financeiro", lida: false },
    select: { id: true, titulo: true, descricao: true },
  });
  if (rows.length === 0) return;

  const toMark = new Set<string>();

  const pendentesAprovacao = await db.leadFinanceiroFluxo.count({
    where: { status: "pendente_aprovacao" },
  });
  if (pendentesAprovacao === 0) {
    for (const a of rows) {
      if (/Nova aprovação pendente/i.test(a.titulo)) toMark.add(a.id);
    }
  }

  for (const a of rows) {
    const key = extractDedupeKey(a.descricao);
    if (!key) continue;

    if (key.startsWith("fechado-financeiro-")) {
      const leadId = key.slice("fechado-financeiro-".length);
      const fluxo = await db.leadFinanceiroFluxo.findUnique({
        where: { leadId },
        select: { status: true },
      });
      if (fluxo?.status === "lancado") toMark.add(a.id);
      continue;
    }

    const reaberto = parseReabertoDedupeKey(key);
    if (reaberto) {
      const lanc = await db.lancamento.findUnique({
        where: { id: reaberto.lancamentoId },
        select: { status: true, vencimento: true },
      });
      if (!lanc) {
        toMark.add(a.id);
        continue;
      }
      if (lanc.status === "pago" || !lancamentoAindaUrgente(lanc)) toMark.add(a.id);
    }
  }

  if (toMark.size === 0) return;
  await db.alerta.updateMany({
    where: { id: { in: [...toMark] } },
    data: { lida: true },
  });
}

export async function reconcileStaleContratosAlerts(db: Db): Promise<void> {
  const rows = await db.alerta.findMany({
    where: { modulo: "contratos", lida: false },
    select: { id: true, descricao: true },
  });
  if (rows.length === 0) return;

  const toMark = new Set<string>();

  for (const a of rows) {
    const key = extractDedupeKey(a.descricao);
    if (!key) continue;

    let contratoId: string | null = null;
    let leadId: string | null = null;

    if (key.startsWith("contrato-auto-suspenso-")) {
      contratoId = key.slice("contrato-auto-suspenso-".length);
    } else if (key.startsWith("contrato-manual-fin-")) {
      contratoId = key.slice("contrato-manual-fin-".length);
    } else if (key.startsWith("contrato-novo-")) {
      leadId = key.slice("contrato-novo-".length);
    } else if (key.startsWith("contrato-ativado-")) {
      leadId = key.slice("contrato-ativado-".length);
    }

    let contrato: { id: string; leadId: string | null; status: string; dataFim: Date | null } | null =
      null;

    if (contratoId) {
      contrato = await db.contrato.findUnique({
        where: { id: contratoId },
        select: { id: true, leadId: true, status: true, dataFim: true },
      });
      if (!contrato) {
        toMark.add(a.id);
        continue;
      }
    } else if (leadId) {
      contrato = await db.contrato.findFirst({
        where: { leadId },
        orderBy: { updatedAt: "desc" },
        select: { id: true, leadId: true, status: true, dataFim: true },
      });
    }

    if (!contrato) continue;

    const dataFimIso = contrato.dataFim?.toISOString() ?? null;
    if (!badgeUrgenciaContrato(dataFimIso, contrato.status)) {
      toMark.add(a.id);
    }
  }

  if (toMark.size === 0) return;
  await db.alerta.updateMany({
    where: { id: { in: [...toMark] } },
    data: { lida: true },
  });
}

export async function reconcileStaleModuleAlerts(db: Db): Promise<void> {
  await reconcileStaleFinanceiroAlerts(db);
  await reconcileStaleContratosAlerts(db);
}
