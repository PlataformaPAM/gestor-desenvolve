import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/server/api-response";
import { emitAlert } from "@/lib/server/alerts";

function formatContratoCode(year: number, seq: number): string {
  return `CTT-${year}-${String(seq).padStart(4, "0")}`;
}

function withContratoCode<T extends { createdAt: Date | string }>(rows: T[]): Array<T & { codigo: string }> {
  const ordered = [...rows].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const seqByYear = new Map<number, number>();
  const codeByRef = new Map<T, string>();
  for (const row of ordered) {
    const year = new Date(row.createdAt).getFullYear();
    const next = (seqByYear.get(year) ?? 0) + 1;
    seqByYear.set(year, next);
    codeByRef.set(row, formatContratoCode(year, next));
  }
  return rows.map((row) => ({ ...row, codigo: codeByRef.get(row) ?? formatContratoCode(new Date(row.createdAt).getFullYear(), 1) }));
}

/** Contratos ativos com data de fim já passada → Suspenso + alerta (idempotente após 1ª execução). */
async function suspenderContratosVencidos(): Promise<void> {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const candidatos = await prisma.contrato.findMany({
    where: { status: "ativo", dataFim: { not: null } },
    include: { cliente: { select: { empresa: true, nome: true } } },
  });

  for (const c of candidatos) {
    const f = new Date(c.dataFim!);
    f.setHours(0, 0, 0, 0);
    if (f >= hoje) continue;

    await prisma.contrato.update({
      where: { id: c.id },
      data: { status: "suspenso" },
    });

    const nomeCliente = c.cliente.empresa || c.cliente.nome;
    const titulo = c.titulo?.trim() || "Contrato";
    const fimStr = c.dataFim ? new Date(c.dataFim).toLocaleDateString("pt-BR") : "—";
    await emitAlert(prisma, {
      modulo: "contratos",
      titulo: `Contrato vencido — ${nomeCliente}`,
      descricao: `O contrato "${titulo}" atingiu a data de fim (${fimStr}) e foi marcado como Suspenso automaticamente.`,
      dedupeKey: `contrato-auto-suspenso-${c.id}`,
    });
  }
}

export async function GET() {
  try {
    await suspenderContratosVencidos().catch(() => undefined);

    const rows = await prisma.contrato.findMany({
      orderBy: { updatedAt: "desc" },
      take: 300,
      include: {
        cliente: { select: { id: true, nome: true, empresa: true } },
        lead: { select: { id: true, name: true } },
        itens: { select: { id: true } },
        criadoPor: { select: { nomeExibicao: true } },
      },
    });
    const rowsComCodigo = withContratoCode(rows);

    const contratos = rowsComCodigo.map((c) => ({
      id: c.id,
      codigo: c.codigo,
      leadId: c.leadId,
      clienteId: c.clienteId,
      origem: c.origem,
      geraPosVenda: c.geraPosVenda,
      clienteNome: c.cliente.empresa || c.cliente.nome,
      leadNome: c.lead?.name ?? null,
      titulo: c.titulo,
      status: c.status,
      valorTotal: c.valorTotal,
      dataInicio: c.dataInicio?.toISOString() ?? null,
      dataFim: c.dataFim?.toISOString() ?? null,
      itensCount: c.itens.length,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      registroCriadoPorNome: c.criadoPor?.nomeExibicao ?? null,
    }));

    return ok({ contratos, data: { contratos } });
  } catch {
    return fail("INTERNAL_ERROR", "Falha ao carregar contratos.", 500);
  }
}
