import { prisma } from "@/lib/prisma";

/** Garante conta padrão, meios e categorias iniciais (idempotente). */
export async function ensureFinanceiroCadastros(): Promise<void> {
  try {
    if ((await prisma.financeiroConta.count()) === 0) {
      await prisma.financeiroConta.create({
        data: {
          nome: "Caixa principal",
          saldoInicial: 0,
          padrao: true,
          ativo: true,
          ordem: 0,
        },
      });
    }
    if ((await prisma.financeiroMeioPagamento.count()) === 0) {
      const nomes = ["Boleto", "Dinheiro", "Empenho", "Pix", "Transferência bancária"];
      for (let i = 0; i < nomes.length; i++) {
        await prisma.financeiroMeioPagamento.create({
          data: { nome: nomes[i], ordem: i, ativo: true },
        });
      }
    }
    if ((await prisma.financeiroCategoria.count()) === 0) {
      await prisma.financeiroCategoria.create({
        data: { nome: "Receitas gerais", tipo: "entrada", ordem: 0, ativo: true },
      });
      await prisma.financeiroCategoria.create({
        data: { nome: "Despesas gerais", tipo: "saida", ordem: 1, ativo: true },
      });
    }
  } catch {
    // Tabelas ainda não existem (migration pendente).
  }
}
