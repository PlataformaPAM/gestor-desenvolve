import { prisma } from "@/lib/prisma";
import type { TarefaRegua } from "@/lib/pos-venda/types";
import { encodePosVendaMeta, pickResponsavelId } from "../_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";

function mapStatus(status: TarefaRegua["status"]) {
  if (status === "concluida") return "concluido" as const;
  if (status === "adiada") return "impedimento" as const;
  return "a_fazer" as const;
}

function buildCodigoFrom(ano: number, sequencial: number): string {
  return `TAR-${ano}-${String(sequencial).padStart(4, "0")}`;
}

async function proximoCodigoTarefa(tx: any, ano: number): Promise<string> {
  const prefixo = `TAR-${ano}-`;
  const ultimo = (await tx.tarefa.findFirst({
    where: { codigo: { startsWith: prefixo } },
    orderBy: { codigo: "desc" },
    select: { codigo: true },
  })) as { codigo?: string } | null;
  const ultimoSequencial = Number.parseInt(ultimo?.codigo?.slice(-4) ?? "0", 10);
  return buildCodigoFrom(ano, Number.isFinite(ultimoSequencial) ? ultimoSequencial + 1 : 1);
}

export async function POST(req: Request) {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const session = decodeSession(match?.[1]?.trim());

  const parsed = await parseJsonSafe<{ tarefa?: TarefaRegua }>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const tarefa = parsed.value.tarefa;
  if (!tarefa?.id || !tarefa.clienteId) {
    return fail("BAD_REQUEST", "Tarefa inválida.", 400);
  }

  const users = await prisma.usuario.findMany({ where: { ativo: true }, take: 1, orderBy: { createdAt: "asc" } });
  const responsavelId = pickResponsavelId(users);
  if (!responsavelId) return fail("BAD_REQUEST", "Sem usuário ativo para responsável.", 400);

  const dataFim = new Date(`${tarefa.dataAgendada}T12:00:00.000Z`);
  const descricao = encodePosVendaMeta(
    {
      tipo: tarefa.tipo,
      categoria: tarefa.categoria,
      objetivo: tarefa.objetivo,
      scriptSugerido: tarefa.scriptSugerido,
      intervaloRecorrenciaDias: tarefa.intervaloRecorrenciaDias,
      proximaEtapaTipo: tarefa.proximaEtapaTipo,
      prioridadeCritica: tarefa.prioridadeCritica,
      motivoCritico: tarefa.motivoCritico,
      clienteNome: tarefa.clienteNome,
      dataConclusao: tarefa.dataConclusao,
      playbook: tarefa.playbook,
    },
    tarefa.objetivo
  );

  const created = await prisma.$transaction(async (tx) => {
    const codigo = await proximoCodigoTarefa(tx, new Date().getFullYear());
    return tx.tarefa.create({
      data: {
        id: tarefa.id,
        codigo,
        titulo: tarefa.titulo,
        descricao,
        status: mapStatus(tarefa.status),
        prioridade: "media",
        dataInicio: new Date(),
        dataFim,
        clienteId: tarefa.clienteId,
        responsavelId,
      },
    });
  });
  await prisma.tarefaHistorico.create({
    data: {
      tarefaId: created.id,
      data: new Date(),
      autorId: session?.userId ?? null,
      acao: "Tarefa criada",
    },
  });
  await writeAuditLog(prisma, {
    acao: "Tarefa de pós-venda criada",
    modulo: "pos-venda",
    detalhes: `Tarefa ${created.titulo} (${created.id})`,
  });
  return ok({ created: true }, 201);
}

