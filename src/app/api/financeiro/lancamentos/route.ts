import { prisma } from "@/lib/prisma";
import type { Lancamento } from "@/lib/financeiro/types";
import { mapLancamentoFromDb } from "../_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";

function toDate(v: string): Date {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export async function POST(req: Request) {
  const body = await parseJsonSafe<{ lancamentos?: Lancamento[] }>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const lancamentos = body.value.lancamentos ?? [];
  if (!lancamentos.length) {
    return fail("BAD_REQUEST", "Nenhum lançamento informado.", 400);
  }

  await prisma.$transaction(
    lancamentos.map((l) =>
      prisma.lancamento.create({
        data: {
          id: l.id,
          tipo: l.tipo,
          descricao: l.descricao,
          clienteId: l.clienteId ?? null,
          fornecedor: l.fornecedor ?? null,
          vencimento: toDate(l.vencimento),
          valor: l.valor,
          status: l.status,
          dataPagamento: l.dataPagamento ? toDate(l.dataPagamento) : null,
          tipoRecorrencia: l.tipoRecorrencia ?? null,
          parcelas: l.parcelas ?? null,
          idPai: l.idPai ?? null,
          parcelaNumero: l.parcelaNumero ?? null,
          leadIdOrigem: l.leadIdOrigem ?? null,
          leadSolucaoId: l.leadSolucaoId ?? null,
          formaPagamento: l.formaPagamento ?? null,
          condicoesPagamento: l.condicoesPagamento ?? null,
          prazoDias: l.prazoDias ?? null,
          contaId: l.contaId ?? null,
          categoriaId: l.categoriaId ?? null,
          meioPagamentoId: l.meioPagamentoId ?? null,
        },
      })
    )
  );

  const saved = await prisma.lancamento.findMany({
    where: { id: { in: lancamentos.map((l) => l.id) } },
    orderBy: { vencimento: "asc" },
  });
  await writeAuditLog(prisma, {
    acao: "Lançamento(s) financeiro(s) criado(s)",
    modulo: "financeiro",
    detalhes: `${saved.length} lançamento(s)`,
  });
  return ok({ lancamentos: saved.map(mapLancamentoFromDb) }, 201);
}

