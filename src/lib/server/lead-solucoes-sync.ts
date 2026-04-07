import { randomUUID } from "node:crypto";
import type { Prisma, LeadSolucaoRecorrenciaPagamento } from "@prisma/client";
import type { Lead } from "@/lib/comercial/types";

function toRecEnum(v: string | null | undefined): LeadSolucaoRecorrenciaPagamento | null {
  if (v === "mensal" || v === "unica" || v === "parcelado") return v;
  return null;
}

/** Sincroniza linhas LeadSolucao com o payload do lead (preserva ids estáveis; faz match por catálogo quando necessário). */
export async function syncLeadSolucoesForPayload(
  tx: Prisma.TransactionClient,
  leadId: string,
  solucoes: Lead["solucoes"] | undefined
): Promise<void> {
  if (!solucoes?.length) {
    await tx.leadSolucao.deleteMany({ where: { leadId } });
    return;
  }

  const existingLines = await tx.leadSolucao.findMany({ where: { leadId } });
  const existingById = new Map(existingLines.map((e) => [e.id, e]));
  const catalogIdsInPayload = [...new Set(solucoes.map((s) => s.solucaoCatalogoId).filter(Boolean))] as string[];
  const catalogExists =
    catalogIdsInPayload.length > 0
      ? await tx.solucaoCatalogo.findMany({
          where: { id: { in: catalogIdsInPayload } },
          select: { id: true },
        })
      : [];
  const idsValidos = new Set(catalogExists.map((c) => c.id));
  const processedIds = new Set<string>();

  for (const s of solucoes) {
    const validCatalog =
      s.solucaoCatalogoId && idsValidos.has(s.solucaoCatalogoId) ? s.solucaoCatalogoId : null;
    let existing = existingById.get(s.id);
    if (!existing && validCatalog) {
      existing = existingLines.find((e) => e.solucaoCatalogoId === validCatalog) ?? undefined;
    }

    const rec = toRecEnum(s.recorrenciaPagamento ?? undefined);
    const parcelasNum = s.parcelas != null ? Math.floor(Number(s.parcelas)) : null;

    const baseData = {
      nome: (s.nome ?? "").trim() || "Solução",
      valor: s.valor ?? null,
      condicoesPagamento: s.condicoesPagamento ?? null,
      solucaoCatalogoId: validCatalog,
      recorrenciaPagamento: rec,
      parcelas:
        rec === "parcelado" ? Math.min(60, Math.max(2, parcelasNum ?? 12)) : null,
    };

    if (existing) {
      await tx.leadSolucao.update({
        where: { id: existing.id },
        data: baseData,
      });
      processedIds.add(existing.id);
    } else {
      const idTaken = existingById.has(s.id) || existingLines.some((e) => e.id === s.id);
      const newId = s.id && !idTaken ? s.id : randomUUID();
      await tx.leadSolucao.create({
        data: {
          id: newId,
          leadId,
          ...baseData,
        },
      });
      processedIds.add(newId);
    }
  }

  const toRemove = existingLines.filter((e) => !processedIds.has(e.id));
  if (toRemove.length) {
    await tx.leadSolucao.deleteMany({
      where: { id: { in: toRemove.map((x) => x.id) } },
    });
  }
}
