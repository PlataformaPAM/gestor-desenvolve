import { prisma } from "@/lib/prisma";
import { Prisma, type PipelineStageId } from "@prisma/client";
import type { Lead } from "@/lib/comercial/types";
import {
  ensureLeadOrigemEnumValues,
  ensureLeadPriorityEnumIncludesUrgente,
  filterUsuarioIdsExisting,
  mapLeadFromDb,
  resolveLeadInteractionUserId,
  resolveUsuarioIdForPrismaFk,
  toDateOrUndefined,
} from "../../_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { syncContratoOnLeadFechado } from "@/lib/server/contratos-sync";
import { emitAlert, emitManyAlerts } from "@/lib/server/alerts";
import { comercialAccessGate } from "@/lib/server/comercial-lead-access";
import { getSessionUserId } from "@/lib/server/request-session";
import { getLeadOwnership } from "@/lib/comercial/ownership";
import { syncLeadSolucoesForPayload } from "@/lib/server/lead-solucoes-sync";
import { isPrismaSchemaDriftError } from "@/lib/server/prisma-schema";

async function loadLead(id: string) {
  return prisma.lead.findUniqueOrThrow({
    where: { id },
    include: {
      criadoPor: { select: { nomeExibicao: true } },
      atualizadoPor: { select: { nomeExibicao: true } },
      solucoes: { include: { solucaoCatalogo: true } },
      contatos: { include: { papeis: true } },
      checklistItems: true,
      contratoChecklist: true,
      contratoArquivos: true,
      financeiroFluxo: true,
      interactions: { include: { user: true, anexos: true }, orderBy: { date: "asc" } },
    },
  });
}

function buildLeadResponseFromPayload(lead: Lead): Lead {
  const nowIso = new Date().toISOString();
  return {
    ...lead,
    registroLead: lead.registroLead ?? "oportunidade",
    solucoes: lead.solucoes ?? [],
    contatosOportunidade: lead.contatosOportunidade ?? [],
    checklistProgress: lead.checklistProgress ?? {},
    interactions: lead.interactions ?? [],
    contratoArquivos: lead.contratoArquivos ?? { minuta: [], assinatura: [] },
    contratoAnexosCliente: lead.contratoAnexosCliente ?? [],
    registroAtualizadoEm: nowIso,
    registroAtualizadoPorNome: lead.registroAtualizadoPorNome ?? null,
    registroCriadoPorNome: lead.registroCriadoPorNome ?? null,
    registroCriadoEm: lead.registroCriadoEm ?? nowIso,
  };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const gate = await comercialAccessGate(req, "editar", id);
  if (!gate.ok) return gate.response;
  const sessionUserId = getSessionUserId(req);
  const sessionUserIdResolved = await resolveUsuarioIdForPrismaFk(prisma, sessionUserId);
  const parsed = await parseJsonSafe<{ lead?: Lead }>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const lead = parsed.value.lead;
  if (!lead || lead.id !== id) {
    return fail("BAD_REQUEST", "Payload inválido.", 400);
  }

  const meta = await prisma.lead
    .findUnique({
      where: { id },
      select: { registroLead: true },
    })
    .catch(() => null);
  if (meta?.registroLead === "venda_direta_financeiro") {
    return fail(
      "FORBIDDEN",
      "Este registro foi criado como venda direta no Financeiro e não pode ser editado pelo Comercial.",
      403
    );
  }

  const existingBefore = await loadLead(id)
    .then((row) => mapLeadFromDb(row))
    .catch(() => null);
  const ownershipBefore = existingBefore ? getLeadOwnership(existingBefore) : { responsavelId: null };
  const interactionCandidates = (lead.interactions ?? []).map((i) =>
    resolveLeadInteractionUserId(i, sessionUserIdResolved)
  );
  const validInteractionUserIds = await filterUsuarioIdsExisting(
    prisma,
    interactionCandidates.filter((x): x is string => Boolean(x))
  );

  await ensureLeadPriorityEnumIncludesUrgente(prisma);
  await ensureLeadOrigemEnumValues(prisma);

  try {
    await prisma.$transaction(async (tx) => {
    const lastInteractionBefore = await tx.leadInteraction.findFirst({
      where: { leadId: id },
      orderBy: { date: "desc" },
      select: { date: true },
    });
    const anterior = await tx.lead.findUnique({
      where: { id },
      select: { stageId: true },
    });

    await tx.lead.update({
      where: { id },
      data: {
        name: lead.name,
        value: lead.value ?? 0,
        valorTotal: lead.valorTotal ?? lead.value ?? 0,
        stageId: lead.stageId,
        priority: lead.priority,
        enteredStageAt: toDateOrUndefined(lead.enteredStageAt) ?? new Date(),
        origem: lead.origem,
        propostaGeradaEm: toDateOrUndefined(lead.propostaGeradaEm),
        previsaoFechamento: toDateOrUndefined(lead.previsaoFechamento),
        cpf: lead.cpf ?? null,
        company: lead.company ?? null,
        contact: lead.contact ?? null,
        email: lead.email ?? null,
        phone: lead.phone ?? null,
        municipioUf: lead.municipioUf ?? null,
        entidade: lead.entidade ?? null,
        cargo: lead.cargo ?? null,
        notes: lead.notes ?? null,
        ...(sessionUserId
          ? sessionUserIdResolved
            ? { atualizadoPor: { connect: { id: sessionUserIdResolved } } }
            : {}
          : {}),
        cliente: lead.clienteId ? { connect: { id: lead.clienteId } } : { disconnect: true },
      },
    });

    await syncLeadSolucoesForPayload(tx, id, lead.solucoes);

    await tx.leadContatoPapel.deleteMany({ where: { leadContato: { leadId: id } } });
    await tx.leadContato.deleteMany({ where: { leadId: id } });
    for (const c of lead.contatosOportunidade ?? []) {
      await tx.leadContato.create({
        data: {
          leadId: id,
          nome: c.nome,
          cargo: c.cargo ?? null,
          setor: c.setor ?? null,
          telefone: c.telefone,
          email: c.email,
          papeis: { create: (c.papeis ?? []).map((p) => ({ papel: p })) },
        },
      });
    }

    await tx.leadChecklistItem.deleteMany({ where: { leadId: id } });
    const checklist = Object.entries(lead.checklistProgress ?? {});
    if (checklist.length) {
      await tx.leadChecklistItem.createMany({
        data: checklist.map(([taskKey, done]) => ({
          leadId: id,
          stageId: lead.stageId,
          taskKey,
          taskLabel: taskKey,
          done: Boolean(done),
        })),
      });
    }

    if (lead.contratoChecklist) {
      await tx.leadContratoChecklist.upsert({
        where: { leadId: id },
        create: { leadId: id, ...lead.contratoChecklist },
        update: { ...lead.contratoChecklist },
      });
    } else {
      await tx.leadContratoChecklist.deleteMany({ where: { leadId: id } });
    }

    await tx.leadContratoArquivo.deleteMany({ where: { leadId: id } });
    const min = lead.contratoArquivos?.minuta ?? [];
    const ass = lead.contratoArquivos?.assinatura ?? [];
    const clienteAnexos = lead.contratoAnexosCliente ?? [];
    const contratoRows: Array<{
      leadId: string;
      tipo: string;
      nomeArquivo: string;
      createdAt?: Date;
    }> = [
      ...min.map((nomeArquivo) => ({ leadId: id, tipo: "minuta", nomeArquivo })),
      ...ass.map((nomeArquivo) => ({ leadId: id, tipo: "assinatura", nomeArquivo })),
      ...clienteAnexos.map((a) => ({
        leadId: id,
        tipo: "cliente",
        nomeArquivo: a.nome,
        createdAt: toDateOrUndefined(a.anexadoEm) ?? new Date(),
      })),
    ];
    if (contratoRows.length) {
      await tx.leadContratoArquivo.createMany({ data: contratoRows });
    }

    if (lead.financeiroFluxo) {
      await tx.leadFinanceiroFluxo.upsert({
        where: { leadId: id },
        create: {
          leadId: id,
          status: lead.financeiroFluxo.status,
          bloqueadoEdicao: lead.financeiroFluxo.bloqueadoEdicao,
          solicitadoEm: toDateOrUndefined(lead.financeiroFluxo.solicitadoEm),
          aprovadoEm: toDateOrUndefined(lead.financeiroFluxo.aprovadoEm),
          devolvidoEm: toDateOrUndefined(lead.financeiroFluxo.devolvidoEm),
          motivoDevolucao: lead.financeiroFluxo.motivoDevolucao ?? null,
          liberacaoSolicitadaEm: toDateOrUndefined(lead.financeiroFluxo.liberacaoSolicitadaEm),
          motivoSolicitacaoLiberacao: lead.financeiroFluxo.motivoSolicitacaoLiberacao ?? null,
        },
        update: {
          status: lead.financeiroFluxo.status,
          bloqueadoEdicao: lead.financeiroFluxo.bloqueadoEdicao,
          solicitadoEm: toDateOrUndefined(lead.financeiroFluxo.solicitadoEm),
          aprovadoEm: toDateOrUndefined(lead.financeiroFluxo.aprovadoEm),
          devolvidoEm: toDateOrUndefined(lead.financeiroFluxo.devolvidoEm),
          motivoDevolucao: lead.financeiroFluxo.motivoDevolucao ?? null,
          liberacaoSolicitadaEm: toDateOrUndefined(lead.financeiroFluxo.liberacaoSolicitadaEm),
          motivoSolicitacaoLiberacao: lead.financeiroFluxo.motivoSolicitacaoLiberacao ?? null,
        },
      });
    } else {
      await tx.leadFinanceiroFluxo.deleteMany({ where: { leadId: id } });
    }

    await tx.leadInteractionAnexo.deleteMany({ where: { interaction: { leadId: id } } });
    await tx.leadInteraction.deleteMany({ where: { leadId: id } });
    for (const i of lead.interactions ?? []) {
      await tx.leadInteraction.create({
        data: {
          id: i.id,
          leadId: id,
          date: toDateOrUndefined(i.date) ?? new Date(),
          type: i.type,
          description: i.description,
          action: i.action ?? null,
          field: i.field ?? null,
          fieldKey: i.fieldKey ?? null,
          oldValue: i.oldValue ?? Prisma.JsonNull,
          newValue: i.newValue ?? Prisma.JsonNull,
          userId: (() => {
            const uid = resolveLeadInteractionUserId(i, sessionUserIdResolved);
            return uid && validInteractionUserIds.has(uid) ? uid : null;
          })(),
          autorNome: i.user?.trim() || null,
          anexos: {
            create: (i.anexos ?? []).map((a) =>
              typeof a === "string" ? { nome: a, url: null } : { nome: a.name, url: a.url || null }
            ),
          },
        },
      });
    }

    const incomingLatestInteraction = (lead.interactions ?? [])
      .map((i) => toDateOrUndefined(i.date) ?? new Date(0))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const hasNewInteraction =
      !!incomingLatestInteraction &&
      (!lastInteractionBefore?.date || incomingLatestInteraction.getTime() > lastInteractionBefore.date.getTime());
    if (hasNewInteraction) {
      await tx.alerta.updateMany({
        where: {
          modulo: "comercial",
          lida: false,
          OR: [
            { titulo: { contains: "Lead parado" } },
            { titulo: { contains: "Prospecção sem avanço" } },
            { titulo: { contains: "sem interação" } },
            { titulo: { contains: "Novo lead recebido" } },
            { descricao: { contains: "sem interação" } },
            { descricao: { contains: "retomar contato" } },
          ],
          descricao: { contains: lead.name },
        },
        data: { lida: true },
      });
    }

    if (anterior?.stageId === "prospecao" && lead.stageId === "qualificacao") {
      await tx.alerta.updateMany({
        where: {
          modulo: "comercial",
          lida: false,
          OR: [
            { titulo: { contains: "Novo lead recebido" } },
            { titulo: { contains: "Prospecção sem avanço" } },
            { titulo: { contains: "Lead parado" } },
          ],
          descricao: { contains: lead.name },
        },
        data: { lida: true },
      });
    }

    await syncContratoOnLeadFechado(tx, {
      leadId: id,
      clienteId: lead.clienteId,
      leadName: lead.name,
      valorTotal: lead.valorTotal ?? lead.value ?? 0,
      solucoes: lead.solucoes ?? [],
      previousStageId: anterior?.stageId ?? null,
      newStageId: lead.stageId as PipelineStageId,
      criadoPorId: sessionUserIdResolved,
    });

    if (anterior?.stageId !== "fechado" && lead.stageId === "fechado") {
      const solucoesResumo = (lead.solucoes ?? []).map((s) => s.nome).filter(Boolean);
      const clienteResumo = lead.company?.trim() || lead.name;
      const valorResumo = lead.valorTotal ?? lead.value ?? 0;
      const descricaoBase = [
        `Lead: ${lead.name}`,
        `Cliente: ${clienteResumo}`,
        `Soluções: ${solucoesResumo.length ? solucoesResumo.join(", ") : "Sem soluções cadastradas"}`,
        `Valor: R$ ${valorResumo.toFixed(2)}`,
      ].join(" | ");

      await emitManyAlerts(tx, [
        {
          modulo: "financeiro",
          titulo: "Nova aprovação pendente do Comercial",
          descricao: `${descricaoBase}. Acesse Financeiro para criar o lançamento e concluir a aprovação.`,
          dedupeKey: `fechado-financeiro-${id}`,
        },
        {
          modulo: "posVenda",
          titulo: "Cliente em Fechado aguardando Financeiro",
          descricao: `${descricaoBase}. Quando o Financeiro aceitar e lançar, a Etapa 1 do Pós-venda é iniciada automaticamente.`,
          dedupeKey: `fechado-posvenda-pendente-${id}`,
        },
      ]);
    }
    });

    const saved = await loadLead(id);
    const mapped = mapLeadFromDb(saved);
    const ownershipAfter = getLeadOwnership(mapped);
    const novoResp = ownershipAfter.responsavelId?.trim();
    if (novoResp && novoResp !== (ownershipBefore.responsavelId ?? "").trim()) {
      const lastOwnLog = [...(mapped.interactions ?? [])]
        .reverse()
        .find((i) => (i.fieldKey ?? "").toLowerCase() === "ownership");
      await emitAlert(prisma, {
        modulo: "comercial",
        titulo: "Você foi definido como responsável do lead",
        descricao: `${mapped.name} no Comercial foi atribuído a você como responsável principal.`,
        usuarioId: novoResp,
        dedupeKey: lastOwnLog ? `lead-resp-${id}-${lastOwnLog.id}` : `lead-resp-${id}-${Date.now()}`,
      });
    }
    await writeAuditLog(prisma, {
      acao: "Lead atualizado",
      modulo: "comercial",
      detalhes: `Lead ${saved.name} (${saved.id})`,
    });
    return ok({ lead: mapped });
  } catch (error) {
    if (!isPrismaSchemaDriftError(error)) throw error;
    console.warn("[PATCH /api/comercial/leads/:id] schema drift fallback", error);

    const entered = toDateOrUndefined(lead.enteredStageAt) ?? new Date();
    const proposta = toDateOrUndefined(lead.propostaGeradaEm) ?? null;
    const previsao = toDateOrUndefined(lead.previsaoFechamento) ?? null;

    await prisma.$executeRaw`
      UPDATE "Lead"
      SET
        "name" = ${lead.name},
        "value" = ${lead.value ?? 0},
        "valorTotal" = ${lead.valorTotal ?? lead.value ?? 0},
        "stageId" = ${lead.stageId},
        "priority" = ${lead.priority},
        "enteredStageAt" = ${entered},
        "origem" = ${lead.origem},
        "propostaGeradaEm" = ${proposta},
        "previsaoFechamento" = ${previsao},
        "cpf" = ${lead.cpf ?? null},
        "company" = ${lead.company ?? null},
        "contact" = ${lead.contact ?? null},
        "email" = ${lead.email ?? null},
        "phone" = ${lead.phone ?? null},
        "municipioUf" = ${lead.municipioUf ?? null},
        "entidade" = ${lead.entidade ?? null},
        "cargo" = ${lead.cargo ?? null},
        "notes" = ${lead.notes ?? null},
        "updatedAt" = NOW()
      WHERE "id" = ${id}
    `;

    const fallbackLead = buildLeadResponseFromPayload(lead);
    await writeAuditLog(prisma, {
      acao: "Lead atualizado (fallback)",
      modulo: "comercial",
      detalhes: `Lead ${fallbackLead.name} (${fallbackLead.id})`,
    }).catch(() => {});
    return ok({ lead: fallbackLead });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const gate = await comercialAccessGate(req, "excluir", id);
  if (!gate.ok) return gate.response;

  const existing = await prisma.lead.findUnique({
    where: { id },
    select: { id: true, name: true, registroLead: true, stageId: true },
  });
  if (!existing) return fail("NOT_FOUND", "Lead não encontrado.", 404);

  if (existing.registroLead === "venda_direta_financeiro") {
    return fail(
      "FORBIDDEN",
      "Registros de venda direta do Financeiro não podem ser excluídos pelo Comercial.",
      403
    );
  }

  if (existing.stageId === "fechado") {
    const lancamento = await prisma.lancamento.findFirst({
      where: { leadIdOrigem: id },
      select: { id: true },
    });
    if (lancamento) {
      return fail(
        "FORBIDDEN",
        "Lead fechado com lançamento financeiro vinculado não pode ser excluído.",
        403
      );
    }
  }

  try {
    await prisma.lead.delete({ where: { id } });
  } catch (error) {
    console.error("[DELETE /api/comercial/leads/:id]", error);
    return fail("INTERNAL_ERROR", "Não foi possível excluir o lead.", 500);
  }

  await writeAuditLog(prisma, {
    acao: "Lead excluído",
    modulo: "comercial",
    detalhes: `Lead ${existing.name} (${existing.id})`,
  });
  return ok({ deleted: true, id });
}

