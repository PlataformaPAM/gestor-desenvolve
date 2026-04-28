import { prisma } from "@/lib/prisma";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import {
  RELATORIOS_AGENDAMENTOS_CHAVE as CHAVE,
  type AgendamentoRelatorio as Agendamento,
  normalizeAgendamentos as normalizeList,
  nowIso,
} from "@/lib/relatorios/agendamentos";


type Body = {
  agendamento?: {
    nome?: string;
    clienteId?: string;
    modeloId?: string;
    diaExecucao?: number;
    destinatarios?: string[];
  };
};

export async function GET() {
  const row = await prisma.configuracaoSistema.findUnique({
    where: { chave: CHAVE },
    select: { valor: true },
  });
  const list = normalizeList(row?.valor);
  return ok({ agendamentos: list });
}

export async function POST(req: Request) {
  const parsed = await parseJsonSafe<Body>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const a = parsed.value.agendamento;
  if (!a?.nome?.trim() || !a.clienteId?.trim() || !a.modeloId?.trim()) {
    return fail("BAD_REQUEST", "Informe nome, cliente e modelo.", 400);
  }
  const dia = Math.max(1, Math.min(28, Number(a.diaExecucao ?? 1)));
  const destinatarios = Array.isArray(a.destinatarios)
    ? a.destinatarios.map((x) => String(x).trim()).filter(Boolean)
    : [];
  const row = await prisma.configuracaoSistema.findUnique({
    where: { chave: CHAVE },
    select: { valor: true },
  });
  const list = normalizeList(row?.valor);
  const now = nowIso();
  const novo: Agendamento = {
    id: `ag-${Date.now()}`,
    nome: a.nome.trim(),
    clienteId: a.clienteId.trim(),
    modeloId: a.modeloId.trim(),
    periodoTipo: "mensal",
    diaExecucao: dia,
    destinatarios,
    ativo: true,
    createdAt: now,
    updatedAt: now,
  };
  const next = [novo, ...list];
  await prisma.configuracaoSistema.upsert({
    where: { chave: CHAVE },
    create: { chave: CHAVE, valor: next },
    update: { valor: next },
  });
  return ok({ agendamento: novo }, 201);
}
