import { prisma } from "@/lib/prisma";
import { preencherTemplateDocumento, valoresPreviewExemplo } from "@/lib/documentos/template-vars";
import { getDocumentoTimbresConfig } from "@/lib/documentos/timbres-config";
import { getEmpresaDocumentoConfig } from "@/lib/documentos/empresa-config";
import type { DocumentoSnapshot } from "@/lib/documentos/documento-html";
import { getOperacionalReportById, type OperacionalReportId, type OperacionalSituacao } from "@/lib/relatorios/operacional-catalogo";

export type OperacionalBuildParams = {
  reportId: OperacionalReportId;
  clienteId?: string;
  modeloId: string;
  periodoInicio: string;
  periodoFim: string;
  situacao?: OperacionalSituacao;
};

export type OperacionalBuildResult = {
  snapshot: DocumentoSnapshot;
  modeloNome: string;
  assunto: string;
  resumo: {
    cliente: string;
    periodoInicio: string;
    periodoFim: string;
    totalTarefas: number;
    totalTickets: number;
    tarefasAtrasadas: number;
    ticketsAtrasados: number;
    reportId: OperacionalReportId;
    reportTitulo: string;
  };
};

function parseDateInput(value?: string): Date | null {
  if (!value?.trim()) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateBr(value: Date): string {
  return value.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function buildOperacionalSnapshot(params: OperacionalBuildParams): Promise<OperacionalBuildResult> {
  const reportDef = getOperacionalReportById(params.reportId);
  if (!reportDef) throw new Error("Tipo de relatório operacional inválido.");

  const inicio = parseDateInput(params.periodoInicio);
  const fimBase = parseDateInput(params.periodoFim);
  if (!inicio || !fimBase) throw new Error("Período inválido.");
  const fim = new Date(fimBase);
  fim.setHours(23, 59, 59, 999);
  if (inicio > fim) throw new Error("Período inválido.");

  const [modelo, timbresConfig, empresaConfig] = await Promise.all([
    prisma.documentoModelo.findFirst({ where: { id: params.modeloId, ativo: true } }),
    getDocumentoTimbresConfig(),
    getEmpresaDocumentoConfig(),
  ]);
  if (!modelo) throw new Error("Modelo de documento não encontrado.");

  const now = Date.now();
  const onlyOverdue = params.reportId === "itens_atrasados" || params.situacao === "atrasados";
  const onlyOpen = params.situacao === "abertos";

  const tarefasRaw = await prisma.tarefa.findMany({
    where: {
      ...(params.clienteId ? { clienteId: params.clienteId } : {}),
      createdAt: { gte: inicio, lte: fim },
    },
    include: { responsavel: { select: { nomeExibicao: true, email: true } } },
    orderBy: [{ dataFim: "asc" }, { createdAt: "asc" }],
  });
  const ticketsRaw = await prisma.helpdeskTicket.findMany({
    where: {
      ...(params.clienteId ? { clienteId: params.clienteId } : {}),
      dataCriacao: { gte: inicio, lte: fim },
    },
    include: { responsaveis: { include: { usuario: { select: { nomeExibicao: true, email: true } } } } },
    orderBy: [{ previsaoConclusao: "asc" }, { dataCriacao: "asc" }],
  });

  const tarefas = tarefasRaw.filter((t) => {
    const isOpen = t.status !== "concluido";
    const isOverdue = isOpen && t.dataFim.getTime() < now;
    if (onlyOverdue) return isOverdue;
    if (onlyOpen) return isOpen;
    return true;
  });
  const tickets = ticketsRaw.filter((t) => {
    const isOpen = !["finalizado", "nao_solucionado"].includes(t.status);
    const isOverdue = isOpen && t.previsaoConclusao.getTime() < now;
    if (onlyOverdue) return isOverdue;
    if (onlyOpen) return isOpen;
    return true;
  });

  const tarefasAtrasadas = tarefas.filter((t) => t.status !== "concluido" && t.dataFim.getTime() < now).length;
  const ticketsAtrasados = tickets.filter(
    (t) => !["finalizado", "nao_solucionado"].includes(t.status) && t.previsaoConclusao.getTime() < now
  ).length;

  const clienteRow = params.clienteId
    ? await prisma.cliente.findUnique({
        where: { id: params.clienteId },
        select: { nome: true, empresa: true },
      })
    : null;
  const clienteNome = params.clienteId ? clienteRow?.empresa?.trim() || clienteRow?.nome || "Cliente" : "Todos os clientes";

  const tarefaRows = tarefas
    .map((t) => {
      const responsavel = t.responsavel?.nomeExibicao?.trim() || t.responsavel?.email || "Não definido";
      return `<tr><td>${esc(t.codigo)}</td><td>${esc(t.titulo)}</td><td>${esc(t.status)}</td><td>${esc(
        t.prioridade
      )}</td><td>${esc(responsavel)}</td><td>${formatDateBr(t.dataInicio)}</td><td>${formatDateBr(t.dataFim)}</td></tr>`;
    })
    .join("");
  const ticketRows = tickets
    .map((t) => {
      const resp = t.responsaveis[0]?.usuario;
      const responsavel = resp?.nomeExibicao?.trim() || resp?.email || "Não definido";
      return `<tr><td>${esc(t.codigo)}</td><td>${esc(t.assunto)}</td><td>${esc(t.status)}</td><td>${esc(
        t.prioridade
      )}</td><td>${esc(t.categoria)}</td><td>${esc(responsavel)}</td><td>${formatDateBr(
        t.dataCriacao
      )}</td><td>${formatDateBr(t.previsaoConclusao)}</td></tr>`;
    })
    .join("");

  const values = {
    ...valoresPreviewExemplo(new Date(), empresaConfig),
    "{{cliente_nome}}": clienteNome,
    "{{periodo_inicio}}": formatDateBr(inicio),
    "{{periodo_fim}}": formatDateBr(fim),
    "{{relatorio_tipo}}": reportDef.titulo,
    "{{resumo_total_tarefas}}": String(tarefas.length),
    "{{resumo_total_tickets}}": String(tickets.length),
    "{{resumo_tarefas_atrasadas}}": String(tarefasAtrasadas),
    "{{resumo_tickets_atrasados}}": String(ticketsAtrasados),
    "{{tabela_tarefas_html}}": `<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Código</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Título</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Status</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Prioridade</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Responsável</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Início</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Final</th></tr></thead><tbody>${
      tarefaRows || `<tr><td colspan="7" style="padding:6px">Sem tarefas no período.</td></tr>`
    }</tbody></table>`,
    "{{tabela_tickets_html}}": `<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Código</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Título</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Status</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Prioridade</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Categoria</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Responsável</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Início</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Final</th></tr></thead><tbody>${
      ticketRows || `<tr><td colspan="8" style="padding:6px">Sem tickets no período.</td></tr>`
    }</tbody></table>`,
  };

  const timbreId = timbresConfig.modeloTimbreById[modelo.id] ?? "";
  const timbre = timbresConfig.items.find((x) => x.id === timbreId);
  const assunto = preencherTemplateDocumento(modelo.assunto ?? "", values);
  return {
    modeloNome: modelo.nome,
    assunto: assunto || `${reportDef.titulo} - ${clienteNome}`,
    snapshot: {
      assunto,
      cabecalhoHtml: preencherTemplateDocumento(modelo.cabecalhoHtml ?? "", values),
      corpoHtml: preencherTemplateDocumento(modelo.corpo ?? "", values),
      rodapeHtml: preencherTemplateDocumento(modelo.rodapeHtml ?? "", values),
      timbreUrl: timbre?.url ?? "",
      renderConfig: timbre?.renderConfig ?? null,
    },
    resumo: {
      cliente: clienteNome,
      periodoInicio: values["{{periodo_inicio}}"],
      periodoFim: values["{{periodo_fim}}"],
      totalTarefas: tarefas.length,
      totalTickets: tickets.length,
      tarefasAtrasadas,
      ticketsAtrasados,
      reportId: reportDef.id,
      reportTitulo: reportDef.titulo,
    },
  };
}
