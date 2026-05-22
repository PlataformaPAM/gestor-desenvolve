import { prisma } from "@/lib/prisma";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import {
  financeiroAccessGate,
  FINANCEIRO_LANCAMENTOS_RESOURCE,
} from "@/lib/server/financeiro-access";
import { ensureFinanceiroCadastros } from "../seed-defaults";

export async function POST(req: Request) {
  const gate = await financeiroAccessGate(req, FINANCEIRO_LANCAMENTOS_RESOURCE, "criar");
  if (!gate.ok) return gate.response;

  const body = await parseJsonSafe<{ nome?: string }>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const nome = body.value.nome?.trim();
  if (!nome) return fail("BAD_REQUEST", "Nome obrigatório.", 400);
  try {
    await ensureFinanceiroCadastros().catch(() => undefined);
    const maxOrd = (await prisma.financeiroMeioPagamento.aggregate({ _max: { ordem: true } }))._max.ordem ?? 0;
    const m = await prisma.financeiroMeioPagamento.create({
      data: { nome, ativo: true, ordem: maxOrd + 1 },
    });
    await writeAuditLog(prisma, {
      acao: "Meio de pagamento criado",
      modulo: "financeiro",
      detalhes: nome,
    });
    return ok({ meio: m }, 201);
  } catch (error) {
    const msg =
      error instanceof Error && /does not exist|relation|enum/i.test(error.message)
        ? "Estrutura do banco não sincronizada para Financeiro. Execute: npx prisma db push"
        : "Não foi possível criar meio de pagamento.";
    return fail("INTERNAL_ERROR", msg, 500);
  }
}
