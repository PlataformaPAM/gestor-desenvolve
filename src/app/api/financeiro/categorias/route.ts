import { prisma } from "@/lib/prisma";
import type { FinanceiroCategoriaTipo } from "@/lib/financeiro/types";
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

  const body = await parseJsonSafe<{
    nome?: string;
    tipo?: FinanceiroCategoriaTipo;
  }>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const nome = body.value.nome?.trim();
  const tipo = body.value.tipo;
  if (!nome || !tipo) return fail("BAD_REQUEST", "Nome e tipo obrigatórios.", 400);
  if (tipo !== "entrada" && tipo !== "saida") {
    return fail("BAD_REQUEST", "Tipo deve ser Entrada ou Saída.", 400);
  }
  try {
    await ensureFinanceiroCadastros().catch(() => undefined);
    const maxOrd = (await prisma.financeiroCategoria.aggregate({ _max: { ordem: true } }))._max.ordem ?? 0;
    const c = await prisma.financeiroCategoria.create({
      data: { nome, tipo, ativo: true, ordem: maxOrd + 1 },
    });
    await writeAuditLog(prisma, {
      acao: "Categoria financeira criada",
      modulo: "financeiro",
      detalhes: nome,
    });
    return ok({ categoria: c }, 201);
  } catch (error) {
    const msg =
      error instanceof Error && /does not exist|relation|enum/i.test(error.message)
        ? "Estrutura do banco não sincronizada para Financeiro. Execute: npx prisma db push"
        : "Não foi possível criar categoria.";
    return fail("INTERNAL_ERROR", msg, 500);
  }
}
