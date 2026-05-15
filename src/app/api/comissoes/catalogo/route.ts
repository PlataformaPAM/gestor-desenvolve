import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/server/api-response";
import { categoriaEfetivaSolucaoCatalogo } from "@/app/api/solucoes/_shared";

export async function GET() {
  const [consultores, rows] = await Promise.all([
    prisma.colaboradorRH.findMany({
      where: {
        tipoPessoa: { in: ["vendedor_externo", "equipe_interna"] },
        status: "ativo",
        cadastroEfetivado: true,
      },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.solucaoCatalogo.findMany({
      where: { ativa: true },
      select: { id: true, nome: true, categoria: true, descricao: true },
      orderBy: { nome: "asc" },
    }),
  ]);
  const solucoes = rows.map((s) => ({
    id: s.id,
    nome: s.nome,
    categoria: categoriaEfetivaSolucaoCatalogo(s) || null,
  }));
  return ok({ consultores, solucoes });
}