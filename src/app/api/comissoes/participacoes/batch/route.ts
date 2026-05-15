import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mapParticipacao } from "@/app/api/comissoes/_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { consultoresUnicosResolvidos, resolveEquipeVendaParaComissao } from "@/lib/server/comissoes-ownership-resolve";

const SUM_EPS = 0.02;

type Item = { consultorId: string; percentualParticipacao: number };

type Body = {
  leadId?: string;
  /** Escopo principal; ignorado se `replicarTodasSolucoes`. */
  leadSolucaoId?: string | null;
  itens?: Item[];
  /** Grava a mesma divisão em cada linha de solução do lead (e não grava em `null` quando há soluções). */
  replicarTodasSolucoes?: boolean;
};

function assertItensValidos(itens: Item[]): string | null {
  if (!itens.length) return "Informe ao menos um consultor e percentual.";
  const seen = new Set<string>();
  for (const it of itens) {
    if (!it.consultorId?.trim()) return "Cada item precisa de consultorId.";
    if (seen.has(it.consultorId)) return "Consultor duplicado na lista.";
    seen.add(it.consultorId);
    if (typeof it.percentualParticipacao !== "number" || Number.isNaN(it.percentualParticipacao)) {
      return "Percentual inválido.";
    }
    if (it.percentualParticipacao <= 0 || it.percentualParticipacao > 100) {
      return "Cada percentual deve ficar entre 0 e 100.";
    }
  }
  const soma = itens.reduce((a, b) => a + b.percentualParticipacao, 0);
  if (Math.abs(soma - 100) > SUM_EPS) {
    return `A soma dos percentuais é ${soma.toFixed(4)}% e deve totalizar 100%.`;
  }
  return null;
}

async function persistEscopo(
  tx: Prisma.TransactionClient,
  leadId: string,
  leadSolucaoId: string | null,
  itens: Item[]
) {
  const consultorIds = itens.map((i) => i.consultorId);
  await tx.comissaoParticipacaoVenda.updateMany({
    where: {
      leadId,
      leadSolucaoId,
      consultorId: { notIn: consultorIds },
      ativo: true,
    },
    data: { ativo: false },
  });
  for (const it of itens) {
    const existing = await tx.comissaoParticipacaoVenda.findFirst({
      where: { leadId, leadSolucaoId, consultorId: it.consultorId },
      select: { id: true },
    });
    if (existing) {
      await tx.comissaoParticipacaoVenda.update({
        where: { id: existing.id },
        data: {
          percentualParticipacao: it.percentualParticipacao,
          ativo: true,
        },
      });
    } else {
      await tx.comissaoParticipacaoVenda.create({
        data: {
          leadId,
          leadSolucaoId,
          consultorId: it.consultorId,
          percentualParticipacao: it.percentualParticipacao,
          ativo: true,
        },
      });
    }
  }
}

export async function POST(req: Request) {
  const parsed = await parseJsonSafe<Body>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const body = parsed.value;
  if (!body.leadId?.trim()) return fail("BAD_REQUEST", "Informe leadId.", 400);
  const itens = body.itens ?? [];
  const errItens = assertItensValidos(itens);
  if (errItens) return fail("BAD_REQUEST", errItens, 400);

  const lead = await prisma.lead.findUnique({
    where: { id: body.leadId },
    select: { id: true, solucoes: { select: { id: true } } },
  });
  if (!lead) return fail("NOT_FOUND", "Lead não encontrado.", 404);

  const equipe = await resolveEquipeVendaParaComissao(prisma, lead.id);
  const permitidos = new Set(consultoresUnicosResolvidos(equipe).map((c) => c.id));
  for (const it of itens) {
    if (!permitidos.has(it.consultorId)) {
      return fail(
        "BAD_REQUEST",
        "Só é possível atribuir percentuais a consultores que fazem parte da equipe da venda (responsável e colaboradores) e estão elegíveis no RH.",
        400
      );
    }
  }

  const solucaoIds = (lead.solucoes ?? []).map((s) => s.id);
  const escopos: (string | null)[] =
    body.replicarTodasSolucoes && solucaoIds.length > 0
      ? solucaoIds
      : [body.leadSolucaoId ?? null];

  const resultado = await prisma.$transaction(async (tx) => {
    for (const leadSolucaoId of escopos) {
      await persistEscopo(tx, lead.id, leadSolucaoId, itens);
    }
    const escopoOr = escopos.map((sid) => ({ leadSolucaoId: sid }));
    const todas = await tx.comissaoParticipacaoVenda.findMany({
      where: { leadId: lead.id, OR: escopoOr },
      include: { consultor: { select: { nome: true } } },
      orderBy: [{ leadSolucaoId: "asc" }, { createdAt: "asc" }],
    });
    return todas.map(mapParticipacao);
  });

  await writeAuditLog(prisma, {
    acao: "Participações de comissão gravadas (lote)",
    modulo: "comissoes",
    detalhes: `Lead ${lead.id} escopos: ${escopos.map((s) => s ?? "geral").join(",")}`,
  });

  return ok({ participacoes: resultado }, 201);
}
