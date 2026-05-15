import { randomUUID } from "crypto";
import { Prisma, type LeadSolucaoRecorrenciaPagamento, type PrismaClient } from "@prisma/client";
import {
  colaboradorRhWhereParaComissao,
  validarParticipacoesNoEscopo,
} from "@/lib/server/comissoes-ownership-resolve";

const SUM_EPS = 0.02;

export type VendaDiretaSolucaoInput = {
  nome: string;
  valor?: number | null;
  solucaoCatalogoId?: string | null;
  recorrenciaPagamento?: "mensal" | "unica" | "parcelado" | null;
  parcelas?: number | null;
  condicoesPagamento?: string | null;
};

export type VendaDiretaParticipacaoInput = {
  consultorId: string;
  percentual: number;
};

export type CreateVendaDiretaFinanceiroResult = {
  leadId: string;
  solucoes: Array<{ id: string; nome: string }>;
};

function mapRecorrencia(
  v: VendaDiretaSolucaoInput["recorrenciaPagamento"]
): LeadSolucaoRecorrenciaPagamento | null {
  if (v === "mensal" || v === "unica" || v === "parcelado") return v;
  return null;
}

/**
 * Cria Lead técnico (registroLead = venda_direta_financeiro), soluções e participações de comissão,
 * para o Financeiro lançar recebimentos com as mesmas regras do fluxo com Lead.
 */
export async function createVendaDiretaFinanceiro(
  prisma: PrismaClient,
  params: {
    clienteId: string;
    tituloLead?: string | null;
    solucoes: VendaDiretaSolucaoInput[];
    participacoes: VendaDiretaParticipacaoInput[];
    criadoPorId?: string | null;
  }
): Promise<{ ok: true; data: CreateVendaDiretaFinanceiroResult } | { ok: false; message: string }> {
  const { clienteId, tituloLead, solucoes, participacoes, criadoPorId } = params;

  if (!clienteId?.trim()) return { ok: false, message: "Cliente é obrigatório." };
  if (!solucoes.length) return { ok: false, message: "Informe ao menos uma solução." };
  if (!participacoes.length) return { ok: false, message: "Informe as participações de comissão." };

  const somaPct = participacoes.reduce((a, p) => a + (Number(p.percentual) || 0), 0);
  if (Math.abs(somaPct - 100) > SUM_EPS) {
    return { ok: false, message: `Os percentuais devem somar 100%. Atual: ${somaPct.toFixed(2)}%.` };
  }

  let valorTotal = 0;
  for (const s of solucoes) {
    const v = Number(s.valor);
    if (Number.isFinite(v) && v > 0) valorTotal += v;
  }
  if (valorTotal <= 0) {
    return { ok: false, message: "Informe valor maior que zero em ao menos uma solução." };
  }

  try {
    const data = await prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.findUnique({
        where: { id: clienteId.trim() },
        select: { id: true, empresa: true, nome: true },
      });
      if (!cliente) throw new Error("Cliente não encontrado.");

      for (const p of participacoes) {
        const okC = await tx.colaboradorRH.findFirst({
          where: { id: p.consultorId.trim(), ...colaboradorRhWhereParaComissao() },
          select: { id: true },
        });
        if (!okC) throw new Error("Um ou mais consultores não estão elegíveis para comissão.");
      }

      const catalogIds = [
        ...new Set(solucoes.map((s) => s.solucaoCatalogoId?.trim()).filter((x): x is string => Boolean(x))),
      ];
      if (catalogIds.length) {
        const cnt = await tx.solucaoCatalogo.count({ where: { id: { in: catalogIds } } });
        if (cnt !== catalogIds.length) throw new Error("Solução do catálogo inválida.");
      }

      const leadId = randomUUID();
      const titulo =
        (tituloLead?.trim() || `${(cliente.empresa || cliente.nome || "Cliente").trim()} — Venda direta`).slice(
          0,
          500
        );

      await tx.lead.create({
        data: {
          id: leadId,
          name: titulo,
          value: valorTotal,
          valorTotal,
          stageId: "fechado",
          priority: "media",
          enteredStageAt: new Date(),
          origem: "outro",
          registroLead: "venda_direta_financeiro",
          clienteId: cliente.id,
          criadoPorId: criadoPorId ?? undefined,
          atualizadoPorId: criadoPorId ?? undefined,
        },
      });

      const solOut: Array<{ id: string; nome: string }> = [];
      const consultorIdsExigidos = [...new Set(participacoes.map((x) => x.consultorId.trim()))];

      for (const s of solucoes) {
        const sid = randomUUID();
        const nome = (s.nome ?? "").trim() || "Solução";
        const rec = mapRecorrencia(s.recorrenciaPagamento ?? null);
        let parcelas: number | null = null;
        if (rec === "parcelado") {
          const n = Math.floor(Number(s.parcelas));
          parcelas = Number.isFinite(n) ? Math.min(60, Math.max(2, n)) : 12;
        }

        await tx.leadSolucao.create({
          data: {
            id: sid,
            leadId,
            nome,
            valor: Number.isFinite(Number(s.valor)) ? Number(s.valor) : null,
            condicoesPagamento: s.condicoesPagamento?.trim() || null,
            solucaoCatalogoId: s.solucaoCatalogoId?.trim() || null,
            recorrenciaPagamento: rec,
            parcelas,
          },
        });
        solOut.push({ id: sid, nome });

        for (const p of participacoes) {
          await tx.comissaoParticipacaoVenda.create({
            data: {
              leadId,
              leadSolucaoId: sid,
              consultorId: p.consultorId.trim(),
              percentualParticipacao: new Prisma.Decimal(Number(p.percentual).toFixed(4)),
            },
          });
        }

        const vld = await validarParticipacoesNoEscopo(tx, {
          leadId,
          leadSolucaoId: sid,
          consultorIdsExigidos,
        });
        if (!vld.ok) throw new Error(vld.message);
      }

      return { leadId, solucoes: solOut };
    });

    return { ok: true, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao registrar venda direta.";
    return { ok: false, message: msg };
  }
}
