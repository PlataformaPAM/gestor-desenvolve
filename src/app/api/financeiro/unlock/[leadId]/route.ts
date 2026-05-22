import { prisma } from "@/lib/prisma";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { emitManyAlerts } from "@/lib/server/alerts";
import {
  financeiroAccessGate,
  FINANCEIRO_APROVACOES_RESOURCE,
} from "@/lib/server/financeiro-access";

type Payload = { aprovado: boolean; motivo?: string; userName?: string };

export async function POST(req: Request, ctx: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await ctx.params;
  const gate = await financeiroAccessGate(req, FINANCEIRO_APROVACOES_RESOURCE, "editar", {
    leadId,
  });
  if (!gate.ok) return gate.response;

  const parsed = await parseJsonSafe<Payload>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const body = parsed.value;
  const userName = body.userName?.trim() || "Financeiro";
  const now = new Date();
  const motivo = body.motivo?.trim();

  await prisma.$transaction(async (tx) => {
    await tx.leadFinanceiroFluxo.upsert({
      where: { leadId },
      create: {
        leadId,
        status: "lancado",
        bloqueadoEdicao: !body.aprovado,
      },
      update: {
        bloqueadoEdicao: !body.aprovado,
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
        description: body.aprovado
          ? `Financeiro liberou edição para o Comercial. Responsável: ${userName}.`
          : `Financeiro negou liberação. Motivo: ${motivo || "não informado"}. Responsável: ${userName}.`,
      },
    });

    if (!body.aprovado) {
      const deniedCount = await tx.leadInteraction.count({
        where: {
          leadId,
          description: { contains: "negou liberação" },
          date: { gte: new Date(Date.now() - 30 * 86400000) },
        },
      });
      if (deniedCount >= 3) {
        await emitManyAlerts(tx, [
          {
            modulo: "comercial",
            titulo: "Atenção: lead com bloqueios recorrentes",
            descricao: `O lead ${leadId} teve ${deniedCount} negativas de liberação pelo Financeiro nos últimos 30 dias.`,
            dedupeKey: `bloqueio-recorrente-${leadId}-${new Date().toISOString().slice(0, 10)}`,
          },
          {
            modulo: "sistema",
            titulo: "Bloqueio recorrente detectado",
            descricao: `Lead ${leadId} com múltiplas negativas de liberação (>=3 em 30 dias).`,
            dedupeKey: `sistema-bloqueio-recorrente-${leadId}-${new Date().toISOString().slice(0, 10)}`,
          },
        ]);
      }
    }
  });

  await writeAuditLog(prisma, {
    acao: body.aprovado ? "Liberação de edição aprovada" : "Liberação de edição negada",
    modulo: "financeiro",
    detalhes: `Lead ${leadId} - responsável ${userName}`,
  });
  return ok({ processed: true });
}

