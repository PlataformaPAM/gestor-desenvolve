import { prisma } from "@/lib/prisma";
import { encodeDescricao, mapSolucao, type SolucaoFront } from "./_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";

export async function POST(req: Request) {
  const body = await parseJsonSafe<{ solucao?: SolucaoFront }>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const s = body.value.solucao;
  if (!s?.nome?.trim()) return fail("BAD_REQUEST", "Solução inválida.", 400);

  const created = await prisma.solucaoCatalogo.create({
    data: {
      id: s.id || undefined,
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
    acao: "Solução criada",
    modulo: "solucoes",
    detalhes: `Solução ${created.nome} (${created.id})`,
  });
  return ok({ solucao: mapSolucao(created) }, 201);
}

