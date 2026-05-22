import { prisma } from "@/lib/prisma";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { emitAlert } from "@/lib/server/alerts";
import {
  financeiroAccessGate,
  FINANCEIRO_APROVACOES_RESOURCE,
} from "@/lib/server/financeiro-access";

type Payload = { motivo: string; userName?: string };

export async function POST(req: Request, ctx: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await ctx.params;
  const gate = await financeiroAccessGate(req, FINANCEIRO_APROVACOES_RESOURCE, "editar", {
    leadId,
  });
  if (!gate.ok) return gate.response;

  const parsed = await parseJsonSafe<Payload>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const body = parsed.value;
  const motivo = body.motivo?.trim();
  if (!motivo) return fail("BAD_REQUEST", "Motivo é obrigatório.", 400);
  const userName = body.userName?.trim() || "Financeiro";
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: leadId },
      data: {
        stageId: "contratacao",
        enteredStageAt: now,
      },
    });
    await tx.leadFinanceiroFluxo.upsert({
      where: { leadId },
      create: {
        leadId,
        status: "devolvido",
        bloqueadoEdicao: false,
        devolvidoEm: now,
        motivoDevolucao: motivo,
      },
      update: {
        status: "devolvido",
        bloqueadoEdicao: false,
        devolvidoEm: now,
        motivoDevolucao: motivo,
        liberacaoSolicitadaEm: null,
        motivoSolicitacaoLiberacao: null,
      },
    });
    await tx.leadInteraction.create({
      data: {
        leadId,
        date: now,
        type: "sistema",
        action: "UPDATE",
        autorNome: userName,
        description: `Financeiro recusou. Motivo: ${motivo}. Responsável: ${userName}.`,
      },
    });
    await emitAlert(tx, {
      modulo: "comercial",
      titulo: "Lead devolvido pelo Financeiro",
      descricao: `O lead foi retornado para Contratação. Motivo: ${motivo}`,
      dedupeKey: `financeiro-recusou-${leadId}-${now.toISOString().slice(0, 10)}`,
    });

    await tx.contrato.updateMany({
      where: { leadId, status: "pendente_financeiro" },
      data: { status: "nao_efetivado" },
    });
  });

  await writeAuditLog(prisma, {
    acao: "Aprovação financeira recusada",
    modulo: "financeiro",
    detalhes: `Lead ${leadId} recusado por ${userName}`,
  });
  return ok({ rejected: true });
}

