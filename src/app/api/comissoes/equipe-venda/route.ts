import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/server/api-response";
import {
  consultoresUnicosResolvidos,
  resolveEquipeVendaParaComissao,
  somaPercentuaisParticipacao,
} from "@/lib/server/comissoes-ownership-resolve";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("leadId")?.trim();
  if (!leadId) return fail("BAD_REQUEST", "Informe leadId.", 400);

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      name: true,
      solucoes: { select: { id: true, nome: true } },
    },
  });
  if (!lead) return fail("NOT_FOUND", "Lead não encontrado.", 404);

  const equipe = await resolveEquipeVendaParaComissao(prisma, lead.id);
  const consultoresDistintos = consultoresUnicosResolvidos(equipe);

  const escopos: Array<{
    leadSolucaoId: string | null;
    nome: string;
    somaPercentuais: number;
    participacoes: Array<{ consultorId: string; consultorNome: string; percentual: number }>;
  }> = [];

  const solucoes = lead.solucoes ?? [];
  const linhas: { id: string | null; nome: string }[] =
    solucoes.length > 0
      ? solucoes.map((s) => ({ id: s.id, nome: s.nome }))
      : [{ id: null, nome: "Proposta (única)" }];

  for (const lin of linhas) {
    const lid = lin.id;
    const rows = await prisma.comissaoParticipacaoVenda.findMany({
      where: { leadId: lead.id, leadSolucaoId: lid, ativo: true },
      include: { consultor: { select: { nome: true } } },
      orderBy: { createdAt: "asc" },
    });
    const soma = await somaPercentuaisParticipacao(prisma, lead.id, lid);
    escopos.push({
      leadSolucaoId: lid,
      nome: lin.nome,
      somaPercentuais: soma,
      participacoes: rows.map((r) => ({
        consultorId: r.consultorId,
        consultorNome: r.consultor.nome,
        percentual: Number(r.percentualParticipacao.toString()),
      })),
    });
  }

  return ok({
    leadId: lead.id,
    leadNome: lead.name,
    equipe: equipe.map((e) => ({
      usuarioOuMembroId: e.membro.id,
      nomeComercial: e.membro.nome,
      consultorId: e.consultor?.id ?? null,
      consultorNomeRh: e.consultor?.nome ?? null,
      resolvido: Boolean(e.consultor),
    })),
    consultoresDistintos: consultoresDistintos.length,
    escopos,
  });
}
