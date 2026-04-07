import { prisma } from "@/lib/prisma";
import { encodeDescricao, mapSolucao, type SolucaoFront } from "../_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await parseJsonSafe<{ solucao?: SolucaoFront }>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const s = body.value.solucao;
  if (!s || s.id !== id) return fail("BAD_REQUEST", "Payload inválido.", 400);

  const updated = await prisma.solucaoCatalogo.update({
    where: { id },
    data: {
      nome: s.nome.trim(),
      descricao: encodeDescricao(s.descricaoTecnica || "", {
        categoria: s.categoria,
        tipo: s.tipo,
        recorrencia: s.recorrencia,
        parcelasPadrao: s.recorrencia === "parcelado" ? s.parcelasPadrao : undefined,
        regrasContrato: s.regrasContrato,
        logoUrl: s.logoUrl || "",
        playbook: s.playbook || [],
      }),
      valorBase: s.valorVenda || 0,
      ativa: s.ativo ?? true,
    },
  });

  await writeAuditLog(prisma, {
    acao: "Solução atualizada",
    modulo: "solucoes",
    detalhes: `Solução ${updated.nome} (${updated.id})`,
  });
  return ok({ solucao: mapSolucao(updated) });
}

