import { prisma } from "@/lib/prisma";
import { Prisma, type PipelineStageId } from "@prisma/client";
import type { Lead } from "@/lib/comercial/types";
import { randomUUID } from "node:crypto";
import {
  ensureLeadOrigemEnumValues,
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
import { comercialAccessGate } from "@/lib/server/comercial-lead-access";
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

async function createLeadWithSchemaFallback(
  db: typeof prisma,
  lead: Lead,
  sessionUserId: string | undefined
) {
  try {
    await db.lead.create({
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
    return;
  } catch (err) {
    console.error("[POST /api/comercial/leads] full create failed, trying fallback", err);
  }

  // Fallback para ambientes com schema legado: tenta insert SQL mínimo, ignorando colunas novas.
  const enteredAt = toDateOrUndefined(lead.enteredStageAt) ?? new Date();
  try {
    await db.$executeRaw`
      INSERT INTO "Lead" (
        "id",
        "name",
        "value",
        "valorTotal",
        "stageId",
        "priority",
        "enteredStageAt",
        "origem",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${lead.id},
        ${lead.name},
        ${lead.value ?? 0},
        ${lead.valorTotal ?? lead.value ?? 0},
        ${lead.stageId},
        ${lead.priority},
        ${enteredAt},
        ${lead.origem},
        NOW(),
        NOW()
      )
    `;
    return;
  } catch (err) {
    console.error("[POST /api/comercial/leads] SQL fallback with valorTotal failed", err);
  }

  await db.$executeRaw`
    INSERT INTO "Lead" (
      "id",
      "name",
      "value",
      "stageId",
      "priority",
      "enteredStageAt",
      "origem",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${lead.id},
      ${lead.name},
      ${lead.value ?? 0},
      ${lead.stageId},
      ${lead.priority},
      ${enteredAt},
      ${lead.origem},
      NOW(),
      NOW()
    )
  `;
}

export async function POST(req: Request) {
  const gate = await comercialAccessGate(req, "criar");
  if (!gate.ok) return gate.response;

  try {
    const parsed = await parseJsonSafe<{ lead?: Lead }>(req);
    if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
    const lead = parsed.value.lead;
    if (!lead?.id) {
      return fail("BAD_REQUEST", "Lead inválido.", 400);
    }
    const sessionUserIdRaw = getSessionUserId(req);
    const sessionUserName = gate.session.userName?.trim() || "Usuário";
    const sessionUserId = await resolveUsuarioIdForPrismaFk(prisma, sessionUserIdRaw);
    const interactionCandidates = (lead.interactions ?? []).map((i) =>
      resolveLeadInteractionUserId(i, sessionUserId)
    );
    const validInteractionUserIds = await filterUsuarioIdsExisting(
      prisma,
      interactionCandidates.filter((x): x is string => Boolean(x))
    );

    await ensureLeadPriorityEnumIncludesUrgente(prisma);
    await ensureLeadOrigemEnumValues(prisma);

    await createLeadWithSchemaFallback(prisma, lead, sessionUserId);

    try {
      await prisma.$transaction(async (tx) => {
        await syncLeadSolucoesForPayload(tx, lead.id, lead.solucoes);
      });
    } catch (err) {
      console.error("[POST /api/comercial/leads] syncLeadSolucoesForPayload failed", err);
    }

    if (lead.contatosOportunidade?.length) {
      for (const c of lead.contatosOportunidade) {
        try {
          await prisma.leadContato.create({
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
        } catch (err) {
          console.error("[POST /api/comercial/leads] contato create failed", err);
        }
      }
    }

    const checklist = Object.entries(lead.checklistProgress ?? {});
    if (checklist.length) {
      try {
        await prisma.leadChecklistItem.createMany({
          data: checklist.map(([taskKey, done]) => ({
            leadId: lead.id,
            stageId: lead.stageId,
            taskKey,
            taskLabel: taskKey,
            done: Boolean(done),
          })),
        });
      } catch (err) {
        console.error("[POST /api/comercial/leads] checklist create failed", err);
      }
    }

    if (lead.contratoChecklist) {
      try {
        await prisma.leadContratoChecklist.create({ data: { leadId: lead.id, ...lead.contratoChecklist } });
      } catch (err) {
        console.error("[POST /api/comercial/leads] contratoChecklist create failed", err);
      }
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
      try {
        await prisma.leadContratoArquivo.createMany({ data: contratoRows });
      } catch (err) {
        console.error("[POST /api/comercial/leads] contratoArquivos create failed", err);
      }
    }

    if (lead.financeiroFluxo) {
      try {
        await prisma.leadFinanceiroFluxo.create({
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
      } catch (err) {
        console.error("[POST /api/comercial/leads] financeiroFluxo create failed", err);
      }
    }

    if (lead.interactions?.length) {
      for (const i of lead.interactions) {
        try {
          const uidRaw = resolveLeadInteractionUserId(i, sessionUserId);
          const userId = uidRaw && validInteractionUserIds.has(uidRaw) ? uidRaw : null;
          await prisma.leadInteraction.create({
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
        } catch (err) {
          console.error("[POST /api/comercial/leads] interaction create failed", err);
        }
      }
    }

    // Garante ownership persistido para escopo "vinculados" mesmo quando FK de usuário não resolve no ambiente.
    if (sessionUserIdRaw) {
      try {
        await prisma.leadInteraction.create({
          data: {
            id: randomUUID(),
            leadId: lead.id,
            date: new Date(),
            type: "sistema",
            description: `Responsável inicial: ${sessionUserName}`,
            action: "CREATE",
            field: "ownership",
            fieldKey: "ownership",
            oldValue: Prisma.JsonNull,
            newValue: {
              responsavelId: sessionUserIdRaw,
              responsavelNome: sessionUserName,
              colaboradores: [],
            },
            userId: sessionUserId ?? null,
            autorNome: sessionUserName,
          },
        });
      } catch (err) {
        console.error("[POST /api/comercial/leads] ownership interaction fallback failed", err);
      }
    }

    try {
      await prisma.$transaction(async (tx) => {
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
    } catch (err) {
      console.error("[POST /api/comercial/leads] syncContratoOnLeadFechado failed", err);
    }

    const saved = await loadLead(lead.id).catch(() => null);
    const savedLead = saved ? mapLeadFromDb(saved) : lead;
    await writeAuditLog(prisma, {
      acao: "Lead criado",
      modulo: "comercial",
      detalhes: `Lead ${savedLead.name} (${savedLead.id})`,
    });
    try {
      await emitAlert(prisma, {
        modulo: "comercial",
        titulo: "Novo lead recebido",
        descricao: `Novo potencial cliente cadastrado: ${savedLead.name}. Priorize o contato inicial da equipe Comercial.`,
        dedupeKey: `novo-lead-${savedLead.id}`,
      });
    } catch (err) {
      console.error("[POST /api/comercial/leads] emitAlert failed", err);
    }
    return ok({ lead: savedLead }, 201);
  } catch (e) {
    console.error("[POST /api/comercial/leads]", e);
    const detail =
      e instanceof Error
        ? e.message
        : typeof e === "object" && e && "code" in e
          ? String((e as { code?: unknown }).code ?? "")
          : "";
    return fail(
      "INTERNAL_ERROR",
      detail
        ? `Não foi possível salvar o lead. Detalhe técnico: ${detail}`
        : "Não foi possível salvar o lead. Verifique sua sessão e tente novamente.",
      500
    );
  }
}

