import { prisma } from "@/lib/prisma";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { seedPosVendaAfterFinanceiroApproval } from "@/lib/server/pos-venda-from-fechamento";
import { emitManyAlerts } from "@/lib/server/alerts";
import { markAlertsReadForLeadFinanceiroApproved } from "@/lib/server/alerts-resolve";
import {
  consultoresUnicosResolvidos,
  resolveEquipeVendaParaComissao,
  validarParticipacoesNoEscopo,
} from "@/lib/server/comissoes-ownership-resolve";

type Payload = {
  userName?: string;
};

export async function POST(req: Request, ctx: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await ctx.params;
  const parsed = await parseJsonSafe<Payload>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const body = parsed.value;
  const userName = body.userName?.trim() || "Financeiro";
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      cliente: true,
      solucoes: { include: { solucaoCatalogo: true } },
      financeiroFluxo: true,
    },
  });
  if (!lead || !lead.clienteId || !lead.cliente) {
    return fail("NOT_FOUND", "Lead inválido para aprovação.", 404);
  }
  const clienteId = lead.clienteId;
  const cliente = lead.cliente;

  const now = new Date();
  if (lead.financeiroFluxo?.status !== "pendente_aprovacao") {
    return fail("BAD_REQUEST", "Este lead não está pendente de aprovação financeira.", 400);
  }

  const linhasSolucao = lead.solucoes ?? [];
  const lancamentosLead = await prisma.lancamento.findMany({
    where: { leadIdOrigem: leadId },
    select: { id: true, leadSolucaoId: true },
  });
  const vinculos = new Set(
    lancamentosLead.map((x) => x.leadSolucaoId).filter((x): x is string => Boolean(x))
  );

  if (linhasSolucao.length > 0) {
    for (const lin of linhasSolucao) {
      if (!vinculos.has(lin.id)) {
        return fail(
          "BAD_REQUEST",
          `Crie um lançamento vinculado a cada solução da proposta. Faltando: ${lin.nome}.`,
          400
        );
      }
    }
  } else if (lancamentosLead.length === 0) {
    return fail("BAD_REQUEST", "Crie o lançamento no caixa antes de concluir a aprovação.", 400);
  }

  const equipeResolvida = await resolveEquipeVendaParaComissao(prisma, leadId);
  const consultorIdsExigidos = consultoresUnicosResolvidos(equipeResolvida).map((c) => c.id);
  const escoposComissao: (string | null)[] =
    linhasSolucao.length > 0 ? linhasSolucao.map((s) => s.id) : [null];
  for (const leadSolucaoId of escoposComissao) {
    const v = await validarParticipacoesNoEscopo(prisma, {
      leadId,
      leadSolucaoId,
      consultorIdsExigidos,
    });
    if (!v.ok) return fail("BAD_REQUEST", v.message, 400);
  }

  const lancamentoRecente = await prisma.lancamento.findFirst({
    where: { leadIdOrigem: leadId },
    orderBy: { createdAt: "desc" },
    select: { descricao: true },
  });

  let posVendaCriadas = 0;
  let posVendaSkipped = false;

  await prisma.$transaction(async (tx) => {
    await tx.leadFinanceiroFluxo.upsert({
      where: { leadId },
      create: {
        leadId,
        status: "lancado",
        bloqueadoEdicao: true,
        aprovadoEm: now,
      },
      update: {
        status: "lancado",
        bloqueadoEdicao: true,
        aprovadoEm: now,
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
        description: `Financeiro aprovou após lançamento no caixa (${lancamentoRecente?.descricao ?? "—"}). Responsável: ${userName}.`,
      },
    });

    await tx.contrato.updateMany({
      where: { leadId, status: "pendente_financeiro" },
      data: { status: "ativo" },
    });

    try {
      const seeded = await seedPosVendaAfterFinanceiroApproval(tx, {
        leadId,
        clienteId,
        clienteNome: cliente.empresa || cliente.nome || "Cliente",
        leadNome: lead.name,
        solucoes: lead.solucoes,
        at: now,
      });
      posVendaCriadas = seeded.created;
      posVendaSkipped = seeded.skipped;
    } catch {
      posVendaCriadas = 0;
      posVendaSkipped = true;
      await emitManyAlerts(tx, [
        {
          modulo: "sistema",
          titulo: "Falha na integração de Pós-venda",
          descricao: `Falha ao gerar tarefas automáticas de Pós-venda para o lead ${lead.name} após aprovação financeira.`,
          dedupeKey: `erro-seed-posvenda-${leadId}-${now.toISOString().slice(0, 10)}`,
        },
      ]);
    }

    await emitManyAlerts(tx, [
      {
        modulo: "posVenda",
        titulo: `Pós-venda iniciado: ${lead.name}`,
        descricao:
          posVendaCriadas > 0
            ? `${posVendaCriadas} tarefa(s) criada(s) automaticamente (kick-off + checklist/playbook por solução).`
            : "A aprovação foi concluída, mas não houve criação de tarefas automáticas (já existentes ou sem responsável).",
        dedupeKey: `posvenda-iniciado-${leadId}`,
      },
      {
        modulo: "contratos",
        titulo: `Contrato ativado: ${lead.name}`,
        descricao: `O Financeiro aprovou e vinculou lançamento para o lead ${lead.name}. Contrato movido para ativo.`,
        dedupeKey: `contrato-ativado-${leadId}`,
      },
    ]);
  });

  await markAlertsReadForLeadFinanceiroApproved(prisma, leadId);

  await writeAuditLog(prisma, {
    acao: "Aprovação financeira concluída",
    modulo: "financeiro",
    detalhes: `Lead ${leadId} lançado por ${userName}. Pós-venda: ${posVendaCriadas} tarefa(s) criada(s)${posVendaSkipped ? " (ou já existente / sem responsável)" : ""}.`,
  });
  return ok({
    approved: true,
    posVendaTarefasCriadas: posVendaCriadas,
    posVendaSeedSkipped: posVendaSkipped,
  });
}

