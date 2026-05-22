import {
  relatorioAccessForResource,
  relatoriosAccessGate,
  RELATORIOS_OPERACIONAL_RESOURCE,
  RELATORIOS_PRESTACAO_CONTAS_RESOURCE,
} from "@/lib/server/relatorios-access";
import { RelatorioForbiddenError } from "@/lib/server/relatorio-scope";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/server/api-response";
import { montarDocumentoHtmlCompleto } from "@/lib/documentos/documento-html";
import { renderHtmlToPdfBuffer } from "@/lib/server/html-to-pdf";
import { sendDocumentoEmail } from "@/lib/server/documento-email";
import { buildPrestacaoContasSnapshot } from "@/lib/relatorios/prestacao-contas";
import {
  RELATORIOS_AGENDAMENTOS_CHAVE,
  RELATORIOS_AGENDAMENTOS_ESTADO_CHAVE,
  normalizeAgendamentos,
  normalizeEstado,
  previousMonthPeriod,
  nowIso,
  type AgendamentoExecLog,
} from "@/lib/relatorios/agendamentos";

function isAuthorized(req: Request): boolean {
  const expected = process.env.RELATORIOS_CRON_TOKEN?.trim();
  if (!expected) return true;
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const plain = req.headers.get("x-relatorios-cron-token")?.trim() || "";
  return bearer === expected || plain === expected;
}

export async function POST(req: Request) {
  const gate = await relatoriosAccessGate(req, RELATORIOS_OPERACIONAL_RESOURCE, "ver");
  if (!gate.ok) return gate.response;


  if (!isAuthorized(req)) return fail("UNAUTHORIZED", "Token de execução inválido.", 401);

  const today = new Date();
  const day = today.getDate();
  const period = previousMonthPeriod(today);

  const [agRow, stateRow] = await Promise.all([
    prisma.configuracaoSistema.findUnique({
      where: { chave: RELATORIOS_AGENDAMENTOS_CHAVE },
      select: { valor: true },
    }),
    prisma.configuracaoSistema.findUnique({
      where: { chave: RELATORIOS_AGENDAMENTOS_ESTADO_CHAVE },
      select: { valor: true },
    }),
  ]);

  const agendamentos = normalizeAgendamentos(agRow?.valor).filter((a) => a.ativo);
  const estado = normalizeEstado(stateRow?.valor);
  const logs: AgendamentoExecLog[] = [];
  const resultados: Array<{ id: string; nome: string; status: string; mensagem: string }> = [];
  let enviados = 0;
  let erros = 0;
  let ignorados = 0;

  for (const ag of agendamentos) {
    if (day < ag.diaExecucao) {
      ignorados += 1;
      resultados.push({ id: ag.id, nome: ag.nome, status: "ignorado", mensagem: "Dia de execução ainda não atingido." });
      continue;
    }
    if (estado.lastRunByAgendamento[ag.id] === period.referenciaMes) {
      ignorados += 1;
      resultados.push({ id: ag.id, nome: ag.nome, status: "ignorado", mensagem: "Já executado neste mês de referência." });
      continue;
    }
    if (!ag.destinatarios.length) {
      erros += 1;
      const mensagem = "Sem destinatários configurados.";
      resultados.push({ id: ag.id, nome: ag.nome, status: "erro", mensagem });
      logs.push({
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        agendamentoId: ag.id,
        agendamentoNome: ag.nome,
        referenciaMes: period.referenciaMes,
        status: "erro",
        mensagem,
        destinatarios: [],
        executadoEm: nowIso(),
      });
      continue;
    }

    try {
      const report = await buildPrestacaoContasSnapshot({
        clienteId: ag.clienteId,
        modeloId: ag.modeloId,
        periodoInicio: period.inicio,
        periodoFim: period.fim,
        access: relatorioAccessForResource(gate, RELATORIOS_PRESTACAO_CONTAS_RESOURCE),
      });
      const htmlDocumento = montarDocumentoHtmlCompleto({
        title: `Relatório - ${report.resumo.cliente}`,
        modeloNome: report.modeloNome,
        snapshot: report.snapshot,
        geradoEmIso: new Date().toISOString(),
      });
      const pdf = await renderHtmlToPdfBuffer(htmlDocumento);
      const subject = report.assunto || `${ag.nome} - ${period.referenciaMes}`;

      for (const to of ag.destinatarios) {
        const send = await sendDocumentoEmail({
          to,
          subject,
          text: `Segue relatório mensal em anexo.\nCliente: ${report.resumo.cliente}\nPeríodo: ${report.resumo.periodoInicio} até ${report.resumo.periodoFim}`,
          html: `<p>Segue relatório mensal em anexo.</p><p><strong>Cliente:</strong> ${report.resumo.cliente}</p><p><strong>Período:</strong> ${report.resumo.periodoInicio} até ${report.resumo.periodoFim}</p>`,
          attachmentFilename: `relatorio-${period.referenciaMes}.pdf`,
          attachmentContent: pdf,
          attachmentContentType: "application/pdf",
        });
        if (!send.accepted.includes(to.toLowerCase()) || send.rejected.includes(to.toLowerCase())) {
          throw new Error(`Servidor de e-mail não confirmou destinatário: ${to}`);
        }
      }

      estado.lastRunByAgendamento[ag.id] = period.referenciaMes;
      enviados += 1;
      const mensagem = `Enviado para ${ag.destinatarios.length} destinatário(s).`;
      resultados.push({ id: ag.id, nome: ag.nome, status: "sucesso", mensagem });
      logs.push({
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        agendamentoId: ag.id,
        agendamentoNome: ag.nome,
        referenciaMes: period.referenciaMes,
        status: "sucesso",
        mensagem,
        destinatarios: ag.destinatarios,
        executadoEm: nowIso(),
      });
    } catch (error) {
      erros += 1;
      const mensagem = error instanceof Error ? error.message : "Falha na execução.";
      resultados.push({ id: ag.id, nome: ag.nome, status: "erro", mensagem });
      logs.push({
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        agendamentoId: ag.id,
        agendamentoNome: ag.nome,
        referenciaMes: period.referenciaMes,
        status: "erro",
        mensagem,
        destinatarios: ag.destinatarios,
        executadoEm: nowIso(),
      });
    }
  }

  estado.logs = [...logs, ...estado.logs].slice(0, 200);
  estado.updatedAt = nowIso();

  await prisma.configuracaoSistema.upsert({
    where: { chave: RELATORIOS_AGENDAMENTOS_ESTADO_CHAVE },
    create: { chave: RELATORIOS_AGENDAMENTOS_ESTADO_CHAVE, valor: estado },
    update: { valor: estado },
  });

  return ok({
    referenciaMes: period.referenciaMes,
    totalAtivos: agendamentos.length,
    enviados,
    erros,
    ignorados,
    resultados,
  });
}

export async function GET(req: Request) {
  const gate = await relatoriosAccessGate(req, RELATORIOS_OPERACIONAL_RESOURCE, "ver");
  if (!gate.ok) return gate.response;


  if (!isAuthorized(req)) return fail("UNAUTHORIZED", "Token de execução inválido.", 401);
  const row = await prisma.configuracaoSistema.findUnique({
    where: { chave: RELATORIOS_AGENDAMENTOS_ESTADO_CHAVE },
    select: { valor: true },
  });
  const estado = normalizeEstado(row?.valor);
  return ok({
    updatedAt: estado.updatedAt,
    lastRunByAgendamento: estado.lastRunByAgendamento,
    logs: estado.logs,
  });
}
