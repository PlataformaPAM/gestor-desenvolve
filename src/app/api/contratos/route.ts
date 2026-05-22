import { prisma } from "@/lib/prisma";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { emitManyAlerts } from "@/lib/server/alerts";
import { writeAuditLog } from "@/lib/server/audit-log";
import { getSessionUserId } from "@/lib/server/request-session";
import { contratosAccessGate } from "@/lib/server/contratos-access";
import type { ContratoStatus } from "@prisma/client";

type ItemIn = { nome: string; valor?: number; condicoesPagamento?: string };

type PostBody = {
  clienteId?: string;
  titulo?: string;
  valorTotal?: number;
  dataInicio?: string;
  dataFim?: string;
  geraPosVenda?: boolean;
  observacoes?: string;
  condicoesGerais?: string;
  status?: ContratoStatus;
  itens?: ItemIn[];
};

export async function POST(req: Request) {
  const gate = await contratosAccessGate(req, "criar");
  if (!gate.ok) return gate.response;

  const sessionUserId = gate.userId ?? getSessionUserId(req);
  const parsed = await parseJsonSafe<PostBody>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const b = parsed.value;
  const clienteId = b.clienteId?.trim();
  if (!clienteId) return fail("BAD_REQUEST", "Informe o cliente.", 400);

  const existe = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true, nome: true, empresa: true } });
  if (!existe) return fail("NOT_FOUND", "Cliente não encontrado.", 404);

  const valorTotal = typeof b.valorTotal === "number" && !Number.isNaN(b.valorTotal) ? b.valorTotal : 0;
  const geraPosVenda = b.geraPosVenda !== false;
  const status: ContratoStatus = b.status ?? "ativo";
  const titulo = (b.titulo?.trim() || `${existe.empresa || existe.nome} — Contrato manual`).slice(0, 240);

  const dataInicio = b.dataInicio ? new Date(`${b.dataInicio}T12:00:00`) : null;
  const dataFim = b.dataFim ? new Date(`${b.dataFim}T12:00:00`) : null;
  if (dataInicio && Number.isNaN(dataInicio.getTime())) return fail("BAD_REQUEST", "Data de início inválida.", 400);
  if (dataFim && Number.isNaN(dataFim.getTime())) return fail("BAD_REQUEST", "Data de fim inválida.", 400);

  const itens = (b.itens ?? []).filter((i) => i.nome?.trim());

  const created = await prisma.$transaction(async (tx) => {
    const c = await tx.contrato.create({
      data: {
        clienteId,
        leadId: null,
        titulo,
        valorTotal,
        status,
        origem: "cadastro_manual",
        geraPosVenda,
        observacoes: b.observacoes?.trim() || null,
        condicoesGerais: b.condicoesGerais?.trim() || null,
        dataInicio: dataInicio && !Number.isNaN(dataInicio.getTime()) ? dataInicio : null,
        dataFim: dataFim && !Number.isNaN(dataFim.getTime()) ? dataFim : null,
        criadoPorId: sessionUserId ?? undefined,
        atualizadoPorId: sessionUserId ?? undefined,
        itens:
          itens.length > 0
            ? {
                create: itens.map((i) => ({
                  nome: i.nome.trim(),
                  valor: i.valor ?? null,
                  condicoesPagamento: i.condicoesPagamento?.trim() || null,
                })),
              }
            : undefined,
      },
    });

    await emitManyAlerts(tx, [
      {
        modulo: "financeiro",
        titulo: `Contrato manual: ${titulo}`,
        descricao: `Novo contrato cadastrado em Contratos para ${existe.empresa || existe.nome}. Verifique lançamentos, faturamento e obrigações.`,
        dedupeKey: `contrato-manual-fin-${c.id}`,
      },
      ...(geraPosVenda
        ? [
            {
              modulo: "posVenda" as const,
              titulo: `Contrato com Pós-venda: ${titulo}`,
              descricao: `Contrato manual marcado com Pós-venda. Cliente: ${existe.empresa || existe.nome}. Planeje régua e tarefas.`,
              dedupeKey: `contrato-manual-pv-${c.id}`,
            },
          ]
        : []),
    ]);

    return c;
  });

  await writeAuditLog(prisma, {
    usuarioId: sessionUserId,
    acao: "Contrato cadastrado manualmente",
    modulo: "contratos",
    detalhes: `${created.id} — ${titulo}`,
  });

  return ok({ id: created.id, data: { id: created.id } });
}
