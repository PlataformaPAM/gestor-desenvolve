import type { LeadSolucao, Prisma, SolucaoCatalogo } from "@prisma/client";
import { mapSolucao } from "@/app/api/solucoes/_shared";
import { encodePosVendaMeta, pickResponsavelId } from "@/app/api/pos-venda/_shared";
import type { TarefaRegua } from "@/lib/pos-venda/types";

export function posVendaFechamentoLeadTag(leadId: string): string {
  return `[POSVENDA_FECHAMENTO_LEAD:${leadId}]`;
}

type SolucaoComCatalogo = LeadSolucao & { solucaoCatalogo: SolucaoCatalogo | null };

type PlaybookSub = {
  tituloTarefa?: string;
  descricaoComoFazer?: string;
  slaDias?: number;
  resultadoEsperado?: string;
};

type PlaybookEtapa = { titulo?: string; filhos?: PlaybookSub[] };

function normalizePlaybook(raw: unknown): PlaybookEtapa[] {
  if (!Array.isArray(raw)) return [];
  return raw as PlaybookEtapa[];
}

function addCalendarDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildCodigoFrom(ano: number, sequencial: number): string {
  return `TAR-${ano}-${String(sequencial).padStart(4, "0")}`;
}

async function proximoCodigoTarefa(tx: Prisma.TransactionClient, ano: number): Promise<string> {
  const prefixo = `TAR-${ano}-`;
  const ultimo = await tx.tarefa.findFirst({
    where: { codigo: { startsWith: prefixo } },
    orderBy: { codigo: "desc" },
    select: { codigo: true },
  });
  const ultimoSequencial = Number.parseInt(ultimo?.codigo.slice(-4) ?? "0", 10);
  return buildCodigoFrom(ano, Number.isFinite(ultimoSequencial) ? ultimoSequencial + 1 : 1);
}

async function insertPosVendaTarefa(
  tx: Prisma.TransactionClient,
  input: {
    titulo: string;
    clienteId: string;
    clienteNome: string;
    dataAgendada: string;
    tipo: TarefaRegua["tipo"];
    categoria: NonNullable<TarefaRegua["categoria"]>;
    objetivo: string;
    scriptSugerido?: string;
    responsavelId: string;
    leadId: string;
    playbookEtapaTitulo?: string;
  }
): Promise<void> {
  const tag = posVendaFechamentoLeadTag(input.leadId);
  const descricao = encodePosVendaMeta(
    {
      tipo: input.tipo,
      categoria: input.categoria,
      objetivo: input.objetivo,
      scriptSugerido: input.scriptSugerido,
      clienteNome: input.clienteNome,
      origemLeadId: input.leadId,
      playbookEtapaTitulo: input.playbookEtapaTitulo,
    },
    tag
  );
  const dataFim = new Date(`${input.dataAgendada}T12:00:00.000Z`);
  const codigo = await proximoCodigoTarefa(tx, dataFim.getUTCFullYear());
  await tx.tarefa.create({
    data: {
      id: crypto.randomUUID(),
      codigo,
      titulo: input.titulo,
      descricao,
      status: "a_fazer",
      prioridade: "media",
      dataInicio: new Date(),
      dataFim,
      clienteId: input.clienteId,
      responsavelId: input.responsavelId,
    },
  });
}

export type SeedPosVendaResult = { created: number; skipped: boolean };

/**
 * Cria tarefas de Pós-venda após aprovação financeira (contrato ativo).
 * Idempotente por lead: se já existir tarefa com a marca do fechamento, não duplica.
 */
export async function seedPosVendaAfterFinanceiroApproval(
  tx: Prisma.TransactionClient,
  params: {
    leadId: string;
    clienteId: string;
    clienteNome: string;
    leadNome: string;
    solucoes: SolucaoComCatalogo[];
    at: Date;
  }
): Promise<SeedPosVendaResult> {
  const tag = posVendaFechamentoLeadTag(params.leadId);
  const jaExiste = await tx.tarefa.count({
    where: {
      clienteId: params.clienteId,
      descricao: { contains: tag },
    },
  });
  if (jaExiste > 0) {
    return { created: 0, skipped: true };
  }

  const users = await tx.usuario.findMany({
    where: { ativo: true },
    take: 1,
    orderBy: { createdAt: "asc" },
  });
  const responsavelId = pickResponsavelId(users);
  if (!responsavelId) {
    return { created: 0, skipped: true };
  }

  const hoje = params.at.toISOString().slice(0, 10);
  let created = 0;

  await insertPosVendaTarefa(tx, {
    titulo: `Kick-off / Implantação — ${params.leadNome}`,
    clienteId: params.clienteId,
    clienteNome: params.clienteNome,
    dataAgendada: hoje,
    tipo: "boas_vindas",
    categoria: "onboarding",
    objetivo: `Contrato ativo após aprovação financeira. Alinhar próximos passos com o cliente e registrar responsáveis internos.`,
    scriptSugerido: `Apresente-se, confirme o escopo de ${params.leadNome} e valide canal de contato com [Nome].`,
    responsavelId,
    leadId: params.leadId,
  });
  created += 1;

  let dayCursor = 0;
  for (const ls of params.solucoes) {
    const nomeSolucao = ls.nome?.trim() || "Solução";
    const front = ls.solucaoCatalogo ? mapSolucao(ls.solucaoCatalogo) : null;
    const etapas = normalizePlaybook(front?.playbook);

    for (const etapa of etapas) {
      const fase = etapa.titulo?.trim() || "Entrega";
      for (const filho of etapa.filhos ?? []) {
        const sla = Number.isFinite(Number(filho.slaDias)) ? Math.max(0, Number(filho.slaDias)) : 0;
        dayCursor += sla;
        const dataAgendada = addCalendarDays(hoje, dayCursor);
        const tituloTarefa = filho.tituloTarefa?.trim() || "Etapa do playbook";
        const titulo = `${nomeSolucao} › ${fase} › ${tituloTarefa}`;
        const objetivo =
          filho.resultadoEsperado?.trim() ||
          filho.descricaoComoFazer?.trim() ||
          `Executar etapa do playbook da solução ${nomeSolucao}.`;
        const script = filho.descricaoComoFazer?.trim();

        await insertPosVendaTarefa(tx, {
          titulo,
          clienteId: params.clienteId,
          clienteNome: params.clienteNome,
          dataAgendada,
          tipo: "outro",
          categoria: "onboarding",
          objetivo,
          scriptSugerido: script,
          responsavelId,
          leadId: params.leadId,
          playbookEtapaTitulo: fase,
        });
        created += 1;
      }
    }
  }

  await tx.leadInteraction.create({
    data: {
      leadId: params.leadId,
      date: params.at,
      type: "sistema",
      action: "UPDATE",
      autorNome: "Sistema (integração)",
      description: `Pós-venda: ${created} tarefa(s) geradas automaticamente (kick-off e playbook das soluções).`,
    },
  });

  return { created, skipped: false };
}
