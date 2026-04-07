import { prisma } from "@/lib/prisma";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { ensureFinanceiroCadastros } from "../seed-defaults";

export async function GET() {
  try {
    const rows = await prisma.financeiroConta.findMany({
      orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    });
    return ok({ contas: rows });
  } catch {
    return fail("INTERNAL_ERROR", "Não foi possível listar contas.", 500);
  }
}

export async function POST(req: Request) {
  const body = await parseJsonSafe<{
    nome?: string;
    saldoInicial?: number;
    padrao?: boolean;
  }>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const nome = body.value.nome?.trim();
  if (!nome) return fail("BAD_REQUEST", "Nome obrigatório.", 400);
  const saldoInicial = Number(body.value.saldoInicial ?? 0);
  const padrao = Boolean(body.value.padrao);
  try {
    await ensureFinanceiroCadastros().catch(() => undefined);
    if (padrao) {
      await prisma.financeiroConta.updateMany({ data: { padrao: false } });
    }
    const maxOrd =
      (
        await prisma.financeiroConta.aggregate({
          _max: { ordem: true },
        })
      )._max.ordem ?? 0;
    const c = await prisma.financeiroConta.create({
      data: {
        nome,
        saldoInicial: Number.isFinite(saldoInicial) ? saldoInicial : 0,
        padrao,
        ativo: true,
        ordem: maxOrd + 1,
      },
    });
    await writeAuditLog(prisma, {
      acao: "Conta financeira criada",
      modulo: "financeiro",
      detalhes: nome,
    });
    return ok({ conta: c }, 201);
  } catch (error) {
    const msg =
      error instanceof Error && /does not exist|relation|enum/i.test(error.message)
        ? "Estrutura do banco não sincronizada para Financeiro. Execute: npx prisma db push"
        : "Não foi possível criar conta.";
    return fail("INTERNAL_ERROR", msg, 500);
  }
}
