import { prisma } from "@/lib/prisma";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { getSessionUserId } from "@/lib/server/request-session";
import {
  financeiroAccessGate,
  FINANCEIRO_VENDA_DIRETA_RESOURCE,
} from "@/lib/server/financeiro-access";
import { resolveUsuarioIdForPrismaFk } from "@/app/api/comercial/_shared";
import {
  createVendaDiretaFinanceiro,
  type VendaDiretaParticipacaoInput,
  type VendaDiretaSolucaoInput,
} from "@/lib/server/venda-direta-financeiro";

type Body = {
  clienteId?: string;
  tituloLead?: string | null;
  solucoes?: VendaDiretaSolucaoInput[];
  participacoes?: VendaDiretaParticipacaoInput[];
};

export async function POST(req: Request) {
  const gate = await financeiroAccessGate(req, FINANCEIRO_VENDA_DIRETA_RESOURCE, "criar");
  if (!gate.ok) return gate.response;

  const parsed = await parseJsonSafe<Body>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const body = parsed.value;

  const sessionUserId = await resolveUsuarioIdForPrismaFk(prisma, getSessionUserId(req));

  const result = await createVendaDiretaFinanceiro(prisma, {
    clienteId: body.clienteId ?? "",
    tituloLead: body.tituloLead,
    solucoes: Array.isArray(body.solucoes) ? body.solucoes : [],
    participacoes: Array.isArray(body.participacoes) ? body.participacoes : [],
    criadoPorId: sessionUserId ?? null,
  });

  if (!result.ok) {
    return fail("BAD_REQUEST", result.message, 400);
  }

  await writeAuditLog(prisma, {
    acao: "Venda direta (Financeiro) registrada para comissão",
    modulo: "financeiro",
    detalhes: `Lead ${result.data.leadId} — ${result.data.solucoes.length} solução(ões).`,
  });

  return ok({ vendaDireta: result.data }, 201);
}
