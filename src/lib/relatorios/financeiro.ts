import { prisma } from "@/lib/prisma";
import { preencherTemplateDocumento, valoresPreviewExemplo } from "@/lib/documentos/template-vars";
import { getDocumentoTimbresConfig } from "@/lib/documentos/timbres-config";
import { getEmpresaDocumentoConfig } from "@/lib/documentos/empresa-config";
import type { DocumentoSnapshot } from "@/lib/documentos/documento-html";
import {
  getFinanceiroReportById,
  type FinanceiroReportId,
  type FinanceiroSituacao,
  type FinanceiroTipo,
} from "@/lib/relatorios/financeiro-catalogo";
import {
  assertRelatorioClienteId,
  filterRelatorioLancamentos,
  type RelatorioAccessContext,
} from "@/lib/server/relatorio-scope";

export type FinanceiroBuildParams = {
  reportId: FinanceiroReportId;
  clienteId?: string;
  modeloId: string;
  periodoInicio: string;
  periodoFim: string;
  situacao?: FinanceiroSituacao;
  tipo?: FinanceiroTipo;
  access?: RelatorioAccessContext;
};

export type FinanceiroBuildResult = {
  snapshot: DocumentoSnapshot;
  modeloNome: string;
  assunto: string;
  resumo: {
    cliente: string;
    periodoInicio: string;
    periodoFim: string;
    totalLancamentos: number;
    totalEntradas: number;
    totalSaidas: number;
    saldoPeriodo: number;
    totalAtrasado: number;
    reportId: FinanceiroReportId;
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

function formatMoney(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function buildFinanceiroSnapshot(params: FinanceiroBuildParams): Promise<FinanceiroBuildResult> {
  const reportDef = getFinanceiroReportById(params.reportId);
  if (!reportDef) throw new Error("Tipo de relatório financeiro inválido.");

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

  if (params.access) {
    await assertRelatorioClienteId(params.access, params.clienteId);
  }

  const lancamentosBase = await prisma.lancamento.findMany({
    where: {
      ...(params.clienteId ? { clienteId: params.clienteId } : {}),
      vencimento: { gte: inicio, lte: fim },
    },
    include: {
      cliente: { select: { nome: true, empresa: true } },
      categoria: { select: { nome: true } },
      conta: { select: { nome: true } },
    },
    orderBy: [{ vencimento: "asc" }, { createdAt: "asc" }],
  });

  const lancamentosScoped = params.access
    ? await filterRelatorioLancamentos(
        lancamentosBase,
        params.access.session,
        params.access.userId,
        params.access.resourceId
      )
    : lancamentosBase;

  const lancamentos = lancamentosScoped.filter((l) => {
    const matchTipo = params.tipo && params.tipo !== "todos" ? l.tipo === params.tipo : true;
    const matchSituacao = params.situacao && params.situacao !== "todos" ? l.status === params.situacao : true;
    return matchTipo && matchSituacao;
  });

  const now = Date.now();
  const onlyOverdue = params.reportId === "inadimplencia_clientes";
  const filtered = onlyOverdue
    ? lancamentos.filter((l) => l.tipo === "entrada" && l.status !== "pago" && l.vencimento.getTime() < now)
    : lancamentos;

  const totalEntradas = filtered.filter((l) => l.tipo === "entrada").reduce((acc, x) => acc + x.valor, 0);
  const totalSaidas = filtered.filter((l) => l.tipo === "saida").reduce((acc, x) => acc + x.valor, 0);
  const totalAtrasado = filtered
    .filter((l) => l.status === "atrasado" || (l.status !== "pago" && l.vencimento.getTime() < now))
    .reduce((acc, x) => acc + x.valor, 0);
  const saldoPeriodo = totalEntradas - totalSaidas;

  const clienteRow = params.clienteId
    ? await prisma.cliente.findUnique({ where: { id: params.clienteId }, select: { nome: true, empresa: true } })
    : null;
  const clienteNome = params.clienteId ? clienteRow?.empresa?.trim() || clienteRow?.nome || "Cliente" : "Todos os clientes";

  const rows = filtered
    .map((l) => {
      const cliente = l.cliente?.empresa?.trim() || l.cliente?.nome || "—";
      return `<tr><td>${esc(l.tipo)}</td><td>${esc(l.descricao)}</td><td>${esc(cliente)}</td><td>${esc(
        l.status
      )}</td><td>${formatDateBr(l.vencimento)}</td><td>${esc(l.categoria?.nome ?? "—")}</td><td>${esc(
        l.conta?.nome ?? "—"
      )}</td><td>${formatMoney(l.valor)}</td></tr>`;
    })
    .join("");

  const values = {
    ...valoresPreviewExemplo(new Date(), empresaConfig),
    "{{cliente_nome}}": clienteNome,
    "{{periodo_inicio}}": formatDateBr(inicio),
    "{{periodo_fim}}": formatDateBr(fim),
    "{{relatorio_tipo}}": reportDef.titulo,
    "{{resumo_total_lancamentos}}": String(filtered.length),
    "{{resumo_total_entradas}}": formatMoney(totalEntradas),
    "{{resumo_total_saidas}}": formatMoney(totalSaidas),
    "{{resumo_saldo_periodo}}": formatMoney(saldoPeriodo),
    "{{resumo_total_atrasado}}": formatMoney(totalAtrasado),
    "{{tabela_lancamentos_html}}": `<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Tipo</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Descrição</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Cliente</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Status</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Vencimento</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Categoria</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Conta</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Valor</th></tr></thead><tbody>${
      rows || `<tr><td colspan="8" style="padding:6px">Sem lançamentos no período.</td></tr>`
    }</tbody></table>`,
  };

  const timbreId = timbresConfig.modeloTimbreById[modelo.id] ?? "";
  const timbreVinculado = timbresConfig.items.find((x) => x.id === timbreId);
  const timbrePadrao = timbresConfig.items.find((x) => x.ativo);
  const timbre = timbreVinculado ?? timbrePadrao ?? timbresConfig.items[0];
  const fallbackRenderConfig = {
    layoutModo: empresaConfig.layoutModo,
    papelTimbradoUrl: empresaConfig.papelTimbradoUrl,
    papelTimbradoOpacity: empresaConfig.papelTimbradoOpacity,
    margemTopMm: empresaConfig.margemTopMm,
    margemRightMm: empresaConfig.margemRightMm,
    margemBottomMm: empresaConfig.margemBottomMm,
    margemLeftMm: empresaConfig.margemLeftMm,
    headerHeightMm: empresaConfig.headerHeightMm,
    footerHeightMm: empresaConfig.footerHeightMm,
  };
  const assunto = preencherTemplateDocumento(modelo.assunto ?? "", values);
  return {
    modeloNome: modelo.nome,
    assunto: assunto || `${reportDef.titulo} - ${clienteNome}`,
    snapshot: {
      assunto,
      cabecalhoHtml: preencherTemplateDocumento(modelo.cabecalhoHtml ?? "", values),
      corpoHtml: preencherTemplateDocumento(modelo.corpo ?? "", values),
      rodapeHtml: preencherTemplateDocumento(modelo.rodapeHtml ?? "", values),
      timbreUrl: timbre?.url ?? empresaConfig.papelTimbradoUrl ?? "",
      renderConfig: timbre?.renderConfig ?? fallbackRenderConfig,
    },
    resumo: {
      cliente: clienteNome,
      periodoInicio: values["{{periodo_inicio}}"],
      periodoFim: values["{{periodo_fim}}"],
      totalLancamentos: filtered.length,
      totalEntradas,
      totalSaidas,
      saldoPeriodo,
      totalAtrasado,
      reportId: reportDef.id,
      reportTitulo: reportDef.titulo,
    },
  };
}
