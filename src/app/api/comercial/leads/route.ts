import { prisma } from "@/lib/prisma";
import { Prisma, type PipelineStageId } from "@prisma/client";
import type { Lead } from "@/lib/comercial/types";
import {
  ensureLeadPriorityEnumIncludesUrgente,
  filterUsuarioIdsExisting,
  mapLeadFromDb,
  resolveLeadInteractionUserId,
  resolveUsuarioIdForPrismaFk,
  toDateOrUndefined,
} from "../_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { syncContratoOnLeadFechado } from "@/lib/server/contratos-sync";
import { syncLeadSolucoesForPayload } from "@/lib/server/lead-solucoes-sync";
import { emitAlert } from "@/lib/server/alerts";
import { getSessionUserId } from "@/lib/server/request-session";

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

export async function POST(req: Request) {
  try {
    const parsed = await parseJsonSafe<{ lead?: Lead }>(req);
    if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
    const lead = parsed.value.lead;
    if (!lead?.id) {
      return fail("BAD_REQUEST", "Lead inválido.", 400);
    }
    const sessionUserId = await resolveUsuarioIdForPrismaFk(prisma, getSessionUserId(req));
    const interactionCandidates = (lead.interactions ?? []).map((i) =>
      resolveLeadInteractionUserId(i, sessionUserId)
    );
    const validInteractionUserIds = await filterUsuarioIdsExisting(
      prisma,
      interactionCandidates.filter((x): x is string => Boolean(x))
    );

    await ensureLeadPriorityEnumIncludesUrgente(prisma);

    await prisma.$transaction(async (tx) => {
    await tx.lead.create({
      data: {
        id: lead.id,
        name: lead.name,
        value: lead.value ?? 0,
        valorTotal: lead.valorTotal ?? lead.value ?? 0,
        stageId: lead.stageId,
        priority: lead.priority,
        enteredStageAt: toDateOrUndefined(lead.enteredStageAt) ?? new Date(),
        origem: lead.origem,
        propostaGeradaEm: toDateOrUndefined(lead.propostaGeradaEm),
        previsaoFechamento: toDateOrUndefined(lead.previsaoFechamento),
        cpf: lead.cpf,
        company: lead.company,
        contact: lead.contact,
        email: lead.email,
        phone: lead.phone,
        municipioUf: lead.municipioUf,
        entidade: lead.entidade,
        cargo: lead.cargo,
        notes: lead.notes,
        criadoPorId: sessionUserId ?? undefined,
        atualizadoPorId: sessionUserId ?? undefined,
        clienteId: lead.clienteId ?? null,
      },
    });

    await syncLeadSolucoesForPayload(tx, lead.id, lead.solucoes);

    if (lead.contatosOportunidade?.length) {
      for (const c of lead.contatosOportunidade) {
        await tx.leadContato.create({
          data: {
            leadId: lead.id,
            nome: c.nome,
            cargo: c.cargo ?? null,
            setor: c.setor ?? null,
            telefone: c.telefone,
            email: c.email,
            papeis: { create: (c.papeis ?? []).map((p) => ({ papel: p })) },
          },
        });
      }
    }

    const checklist = Object.entries(lead.checklistProgress ?? {});
    if (checklist.length) {
      await tx.leadChecklistItem.createMany({
        data: checklist.map(([taskKey, done]) => ({
          leadId: lead.id,
          stageId: lead.stageId,
          taskKey,
          taskLabel: taskKey,
          done: Boolean(done),
        })),
      });
    }

    if (lead.contratoChecklist) {
      await tx.leadContratoChecklist.create({ data: { leadId: lead.id, ...lead.contratoChecklist } });
    }

    const min = lead.contratoArquivos?.minuta ?? [];
    const ass = lead.contratoArquivos?.assinatura ?? [];
    const clienteAnexos = lead.contratoAnexosCliente ?? [];
    const contratoRows: Array<{
      leadId: string;
      tipo: string;
      nomeArquivo: string;
      createdAt?: Date;
    }> = [
      ...min.map((nomeArquivo) => ({ leadId: lead.id, tipo: "minuta", nomeArquivo })),
      ...ass.map((nomeArquivo) => ({ leadId: lead.id, tipo: "assinatura", nomeArquivo })),
      ...clienteAnexos.map((a) => ({
        leadId: lead.id,
        tipo: "cliente",
        nomeArquivo: a.nome,
        createdAt: toDateOrUndefined(a.anexadoEm) ?? new Date(),
      })),
    ];
    if (contratoRows.length) {
      await tx.leadContratoArquivo.createMany({ data: contratoRows });
    }

    if (lead.financeiroFluxo) {
      await tx.leadFinanceiroFluxo.create({
        data: {
          leadId: lead.id,
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
    }

    if (lead.interactions?.length) {
      for (const i of lead.interactions) {
        const uidRaw = resolveLeadInteractionUserId(i, sessionUserId);
        const userId =
          uidRaw && validInteractionUserIds.has(uidRaw) ? uidRaw : null;
        await tx.leadInteraction.create({
          data: {
            id: i.id,
            leadId: lead.id,
            date: toDateOrUndefined(i.date) ?? new Date(),
            type: i.type,
            description: i.description,
            action: i.action ?? null,
            field: i.field ?? null,
            fieldKey: i.fieldKey ?? null,
            oldValue: i.oldValue ?? Prisma.JsonNull,
            newValue: i.newValue ?? Prisma.JsonNull,
            userId,
            autorNome: i.user?.trim() || null,
            anexos: {
              create: (i.anexos ?? []).map((a) =>
                typeof a === "string" ? { nome: a, url: null } : { nome: a.name, url: a.url || null }
              ),
            },
          },
        });
      }
    }

    await syncContratoOnLeadFechado(tx, {
      leadId: lead.id,
      clienteId: lead.clienteId,
      leadName: lead.name,
      valorTotal: lead.valorTotal ?? lead.value ?? 0,
      solucoes: lead.solucoes ?? [],
      previousStageId: null,
      newStageId: lead.stageId as PipelineStageId,
    });
  });

  const saved = await loadLead(lead.id);
  await writeAuditLog(prisma, {
    acao: "Lead criado",
    modulo: "comercial",
    detalhes: `Lead ${saved.name} (${saved.id})`,
  });
  await emitAlert(prisma, {
    modulo: "comercial",
    titulo: "Novo lead recebido",
    descricao: `Novo potencial cliente cadastrado: ${saved.name}. Priorize o contato inicial da equipe Comercial.`,
    dedupeKey: `novo-lead-${saved.id}`,
  });
  return ok({ lead: mapLeadFromDb(saved) }, 201);
  } catch (e) {
    console.error("[POST /api/comercial/leads]", e);
    return fail(
      "INTERNAL_ERROR",
      "Não foi possível salvar o lead. Verifique sua sessão e tente novamente.",
      500
    );
  }
}

