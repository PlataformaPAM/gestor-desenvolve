import { prisma } from "@/lib/prisma";
import { mapParticipacao } from "@/app/api/comissoes/_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";

type PayloadParticipacao = {
  percentualParticipacao?: number;
  ativo?: boolean;
  observacoes?: string | null;
};

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await parseJsonSafe<{ participacao?: PayloadParticipacao }>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const p = body.value.participacao;
  if (!p) return fail("BAD_REQUEST", "Payload inválido.", 400);

  const updated = await prisma.comissaoParticipacaoVenda.update({
    where: { id },
    data: {
      percentualParticipacao: p.percentualParticipacao,
      ativo: p.ativo,
      observacoes: p.observacoes === undefined ? undefined : p.observacoes?.trim() || null,
    },
    include: { consultor: { select: { nome: true } } },
  });
  await writeAuditLog(prisma, {
    acao: "Participação de comissão atualizada",
    modulo: "comissoes",
    detalhes: `${updated.leadId}/${updated.leadSolucaoId ?? "geral"} -> ${updated.consultorId} ${updated.percentualParticipacao.toString()}%`,
  });
  return ok({ participacao: mapParticipacao(updated) });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const before = await prisma.comissaoParticipacaoVenda.findUnique({ where: { id } });
  await prisma.comissaoParticipacaoVenda.delete({ where: { id } });
  await writeAuditLog(prisma, {
    acao: "Participação de comissão excluída",
    modulo: "comissoes",
    detalhes: before ? `${before.leadId}/${before.leadSolucaoId ?? "geral"} -> ${before.consultorId}` : id,
  });
  return ok({ id });
}

