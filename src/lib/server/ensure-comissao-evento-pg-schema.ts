import type { PrismaClient } from "@prisma/client";

/**
 * Garante no PostgreSQL a coluna e FK de `lancamentoSaidaId` em `ComissaoEvento`
 * (equivalente à migração `20260513120000_comissao_evento_lancamento_saida`).
 * Idempotente: seguro chamar várias vezes. Evita quebra quando o deploy de
 * migrações não rodou, mas o Prisma Client já foi gerado com o novo campo.
 */
export async function ensureComissaoEventoLancamentoSaidaSchema(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ComissaoEvento" ADD COLUMN IF NOT EXISTS "lancamentoSaidaId" TEXT`
  );
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ComissaoEvento_lancamentoSaidaId_key"
    ON "ComissaoEvento"("lancamentoSaidaId")
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "ComissaoEvento"
        ADD CONSTRAINT "ComissaoEvento_lancamentoSaidaId_fkey"
        FOREIGN KEY ("lancamentoSaidaId") REFERENCES "Lancamento"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `);
}

/**
 * Cria `Lancamento` de saída para eventos já `paga` sem vínculo (ex.: pagos antes da coluna existir).
 */
export async function backfillComissaoPagasSemLancamentoSaida(prisma: PrismaClient): Promise<void> {
  const cat = await prisma.financeiroCategoria.findFirst({
    where: { ativo: true, tipo: { in: ["saida", "ambos"] } },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    select: { id: true },
  });
  if (!cat) return;

  const BATCH = 80;
  for (let round = 0; round < 40; round++) {
    const orphans = await prisma.comissaoEvento.findMany({
      where: { status: "paga", lancamentoSaidaId: null },
      include: {
        consultor: { select: { nome: true } },
        lead: { select: { name: true } },
      },
      take: BATCH,
    });
    if (!orphans.length) return;

    for (const ev of orphans) {
      const paidAt = ev.pagoEm ?? new Date();
      const valor = Number(ev.valorComissao.toString());
      await prisma.$transaction(async (tx) => {
        const row = await tx.comissaoEvento.findUnique({
          where: { id: ev.id },
          select: { lancamentoSaidaId: true, status: true },
        });
        if (!row || row.lancamentoSaidaId || row.status !== "paga") return;

        const saida = await tx.lancamento.create({
          data: {
            tipo: "saida",
            descricao: `Pagamento comissão — ${ev.lead?.name ?? "Lead"} / ${ev.consultor.nome}`,
            fornecedor: ev.consultor.nome,
            vencimento: paidAt,
            valor,
            status: "pago",
            dataPagamento: paidAt,
            categoriaId: cat.id,
            contaId: null,
            meioPagamentoId: null,
            leadIdOrigem: ev.leadId,
            leadSolucaoId: ev.leadSolucaoId,
          },
        });
        await tx.comissaoEvento.update({
          where: { id: ev.id },
          data: { lancamentoSaidaId: saida.id },
        });
      });
    }
  }
}
