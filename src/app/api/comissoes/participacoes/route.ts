import { prisma } from "@/lib/prisma";
import { mapParticipacao } from "@/app/api/comissoes/_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import {
  financeiroAccessGate,
  FINANCEIRO_COMISSOES_RESOURCE,
} from "@/lib/server/financeiro-access";

type PayloadParticipacao = {
  leadId?: string;
  leadSolucaoId?: string | null;
  consultorId?: string;
  percentualParticipacao?: number;
  ativo?: boolean;
  observacoes?: string;
};

export async function GET(req: Request) {
  const gate = await financeiroAccessGate(req, FINANCEIRO_COMISSOES_RESOURCE, "ver");
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("leadId") ?? undefined;
  const leadSolucaoId = searchParams.get("leadSolucaoId");
  const participacoes = await prisma.comissaoParticipacaoVenda.findMany({
    where: {
      ...(leadId ? { leadId } : {}),
      ...(leadSolucaoId ? { leadSolucaoId } : {}),
    },
    include: { consultor: { select: { nome: true } } },
    orderBy: [{ ativo: "desc" }, { createdAt: "asc" }],
  });
  return ok({ participacoes: participacoes.map(mapParticipacao) });
}

export async function POST(req: Request) {
  const gate = await financeiroAccessGate(req, FINANCEIRO_COMISSOES_RESOURCE, "criar");
  if (!gate.ok) return gate.response;

  const body = await parseJsonSafe<{ participacao?: PayloadParticipacao }>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const p = body.value.participacao;
  if (!p?.leadId || !p.consultorId || typeof p.percentualParticipacao !== "number") {
    return fail("BAD_REQUEST", "Informe lead, consultor e percentual de participação.", 400);
  }
  if (p.percentualParticipacao <= 0 || p.percentualParticipacao > 100) {
    return fail("BAD_REQUEST", "Percentual de participação deve ficar entre 0 e 100.", 400);
  }
  const somaExistente = await prisma.comissaoParticipacaoVenda.aggregate({
    where: {
      leadId: p.leadId,
      leadSolucaoId: p.leadSolucaoId ?? null,
      ativo: true,
    },
    _sum: { percentualParticipacao: true },
  });
  const somaAtual = Number(somaExistente._sum.percentualParticipacao?.toString() ?? "0");
  if (somaAtual + p.percentualParticipacao > 100.0001) {
    return fail(
      "BAD_REQUEST",
      `Participação excede 100% para este escopo (atual ${somaAtual.toFixed(4)}%).`,
      400
    );
  }
  const created = await prisma.comissaoParticipacaoVenda.create({
    data: {
      leadId: p.leadId,
      leadSolucaoId: p.leadSolucaoId ?? null,
      consultorId: p.consultorId,
      percentualParticipacao: p.percentualParticipacao,
      ativo: p.ativo ?? true,
      observacoes: p.observacoes?.trim() || null,
    },
    include: { consultor: { select: { nome: true } } },
  });
  await writeAuditLog(prisma, {
    acao: "Participação de comissão criada",
    modulo: "comissoes",
    detalhes: `${created.leadId}/${created.leadSolucaoId ?? "geral"} -> ${created.consultorId} ${created.percentualParticipacao.toString()}%`,
  });
  return ok({ participacao: mapParticipacao(created) }, 201);
}

