import { prisma } from "@/lib/prisma";
import { preencherTemplateDocumento, valoresPreviewExemplo } from "@/lib/documentos/template-vars";
import { getDocumentoTimbresConfig } from "@/lib/documentos/timbres-config";
import { getEmpresaDocumentoConfig } from "@/lib/documentos/empresa-config";
import type { DocumentoSnapshot } from "@/lib/documentos/documento-html";
import { getComercialReportById, type ComercialReportId, type ComercialSituacao } from "@/lib/relatorios/comercial-catalogo";

export type ComercialBuildParams = {
  reportId: ComercialReportId;
  modeloId: string;
  periodoInicio: string;
  periodoFim: string;
  situacao?: ComercialSituacao;
};

export type ComercialBuildResult = {
  snapshot: DocumentoSnapshot;
  modeloNome: string;
  assunto: string;
  resumo: {
    periodoInicio: string;
    periodoFim: string;
    totalLeads: number;
    totalValorAberto: number;
    totalGanhos: number;
    totalPerdidos: number;
    taxaConversao: number;
    reportId: ComercialReportId;
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

export async function buildComercialSnapshot(params: ComercialBuildParams): Promise<ComercialBuildResult> {
  const reportDef = getComercialReportById(params.reportId);
  if (!reportDef) throw new Error("Tipo de relatório comercial inválido.");

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

  const leadsBase = await prisma.lead.findMany({
    where: { createdAt: { gte: inicio, lte: fim } },
    orderBy: [{ createdAt: "asc" }],
  });
  const leads = leadsBase.filter((l) => {
    if (!params.situacao || params.situacao === "todos") return true;
    if (params.situacao === "abertos") return !["fechado", "perdido"].includes(l.stageId);
    if (params.situacao === "ganhos") return l.stageId === "fechado";
    if (params.situacao === "perdidos") return l.stageId === "perdido";
    return true;
  });

  const ganhos = leads.filter((l) => l.stageId === "fechado");
  const perdidos = leads.filter((l) => l.stageId === "perdido");
  const abertos = leads.filter((l) => !["fechado", "perdido"].includes(l.stageId));
  const totalValorAberto = abertos.reduce((acc, x) => acc + (x.valorTotal || x.value || 0), 0);
  const totalGanhos = ganhos.reduce((acc, x) => acc + (x.valorTotal || x.value || 0), 0);
  const totalPerdidos = perdidos.reduce((acc, x) => acc + (x.valorTotal || x.value || 0), 0);
  const taxaConversao = ganhos.length + perdidos.length > 0 ? (ganhos.length / (ganhos.length + perdidos.length)) * 100 : 0;

  const rows = leads
    .map((l) => {
      return `<tr><td>${esc(l.name)}</td><td>${esc(l.stageId)}</td><td>${esc(l.priority)}</td><td>${esc(
        l.origem
      )}</td><td>${formatMoney(l.valorTotal || l.value || 0)}</td><td>${formatDateBr(l.createdAt)}</td></tr>`;
    })
    .join("");

  const values = {
    ...valoresPreviewExemplo(new Date(), empresaConfig),
    "{{periodo_inicio}}": formatDateBr(inicio),
    "{{periodo_fim}}": formatDateBr(fim),
    "{{relatorio_tipo}}": reportDef.titulo,
    "{{resumo_total_leads}}": String(leads.length),
    "{{resumo_valor_aberto}}": formatMoney(totalValorAberto),
    "{{resumo_valor_ganhos}}": formatMoney(totalGanhos),
    "{{resumo_valor_perdidos}}": formatMoney(totalPerdidos),
    "{{resumo_taxa_conversao}}": `${taxaConversao.toFixed(1)}%`,
    "{{tabela_leads_html}}": `<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Lead</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Etapa</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Prioridade</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Origem</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Valor</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Criado em</th></tr></thead><tbody>${
      rows || `<tr><td colspan="6" style="padding:6px">Sem leads no período.</td></tr>`
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
    assunto: assunto || `${reportDef.titulo} - Comercial`,
    snapshot: {
      assunto,
      cabecalhoHtml: preencherTemplateDocumento(modelo.cabecalhoHtml ?? "", values),
      corpoHtml: preencherTemplateDocumento(modelo.corpo ?? "", values),
      rodapeHtml: preencherTemplateDocumento(modelo.rodapeHtml ?? "", values),
      timbreUrl: timbre?.url ?? empresaConfig.papelTimbradoUrl ?? "",
      renderConfig: timbre?.renderConfig ?? fallbackRenderConfig,
    },
    resumo: {
      periodoInicio: values["{{periodo_inicio}}"],
      periodoFim: values["{{periodo_fim}}"],
      totalLeads: leads.length,
      totalValorAberto,
      totalGanhos,
      totalPerdidos,
      taxaConversao,
      reportId: reportDef.id,
      reportTitulo: reportDef.titulo,
    },
  };
}
