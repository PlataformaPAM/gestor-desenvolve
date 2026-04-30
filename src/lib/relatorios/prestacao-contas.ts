import { prisma } from "@/lib/prisma";
import { preencherTemplateDocumento, valoresPreviewExemplo } from "@/lib/documentos/template-vars";
import { getDocumentoTimbresConfig } from "@/lib/documentos/timbres-config";
import { getEmpresaDocumentoConfig } from "@/lib/documentos/empresa-config";
import type { DocumentoSnapshot } from "@/lib/documentos/documento-html";

export type PrestacaoContasBuildParams = {
  clienteId: string;
  modeloId: string;
  periodoInicio: string;
  periodoFim: string;
};

export type PrestacaoContasBuildResult = {
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

function codigoOuId(item: { id: string }): string {
  const codigo = (item as { codigo?: string | null }).codigo;
  return codigo?.trim() || item.id;
}

export async function buildPrestacaoContasSnapshot(
  params: PrestacaoContasBuildParams
): Promise<PrestacaoContasBuildResult> {
  const inicio = parseDateInput(params.periodoInicio);
  const fimBase = parseDateInput(params.periodoFim);
  if (!inicio || !fimBase) throw new Error("Período inválido.");
  const fim = new Date(fimBase);
  fim.setHours(23, 59, 59, 999);
  if (inicio > fim) throw new Error("Período inválido.");

  const [cliente, modelo, timbresConfig, empresaConfig] = await Promise.all([
    prisma.cliente.findUnique({ where: { id: params.clienteId }, select: { id: true, nome: true, empresa: true } }),
    prisma.documentoModelo.findFirst({ where: { id: params.modeloId, ativo: true } }),
    getDocumentoTimbresConfig(),
    getEmpresaDocumentoConfig(),
  ]);
  if (!cliente) throw new Error("Cliente não encontrado.");
  if (!modelo) throw new Error("Modelo de documento não encontrado.");

  const [tarefas, tickets] = await Promise.all([
    prisma.tarefa.findMany({
      where: { clienteId: params.clienteId, createdAt: { gte: inicio, lte: fim } },
      include: {
        responsavel: { select: { nomeExibicao: true, email: true } },
        historico: {
          include: { autor: { select: { nomeExibicao: true, email: true } } },
          orderBy: { data: "asc" },
        },
      },
      orderBy: [{ dataFim: "asc" }, { createdAt: "asc" }],
    }),
    prisma.helpdeskTicket.findMany({
      where: { clienteId: params.clienteId, dataCriacao: { gte: inicio, lte: fim } },
      include: {
        responsaveis: { include: { usuario: { select: { nomeExibicao: true, email: true } } } },
        historico: {
          include: { autor: { select: { nomeExibicao: true, email: true } } },
          orderBy: { data: "asc" },
        },
        comentarios: {
          include: { autor: { select: { nomeExibicao: true, email: true } } },
          orderBy: { data: "asc" },
        },
      },
      orderBy: [{ previsaoConclusao: "asc" }, { dataCriacao: "asc" }],
    }),
  ]);

  const tarefaRows = tarefas
    .map((t) => {
      const responsavel = t.responsavel?.nomeExibicao?.trim() || t.responsavel?.email || "Não definido";
      return `<tr><td>${esc(codigoOuId(t))}</td><td>${esc(t.titulo)}</td><td>${esc(t.status)}</td><td>${esc(
        t.prioridade
      )}</td><td>${esc(responsavel)}</td><td>${formatDateBr(t.dataInicio)}</td><td>${formatDateBr(t.dataFim)}</td></tr>`;
    })
    .join("");
  const ticketRows = tickets
    .map((t) => {
      const resp = t.responsaveis[0]?.usuario;
      const responsavel = resp?.nomeExibicao?.trim() || resp?.email || "Não definido";
      return `<tr><td>${esc(codigoOuId(t))}</td><td>${esc(t.assunto)}</td><td>${esc(t.status)}</td><td>${esc(
        t.prioridade
      )}</td><td>${esc(t.categoria)}</td><td>${esc(responsavel)}</td><td>${formatDateBr(
        t.dataCriacao
      )}</td><td>${formatDateBr(t.previsaoConclusao)}</td></tr>`;
    })
    .join("");

  const tarefaDetalhadaRows = tarefas
    .map((t) => {
      const responsavel = t.responsavel?.nomeExibicao?.trim() || t.responsavel?.email || "Não definido";
      const ultimaAcao = t.historico.at(-1);
      const ultimaAcaoTexto = ultimaAcao ? `${ultimaAcao.acao} (${formatDateBr(ultimaAcao.data)})` : "Sem registro";
      const quemFez = ultimaAcao?.autor?.nomeExibicao?.trim() || ultimaAcao?.autor?.email || responsavel;
      const quandoConcluiu = t.status === "concluido" ? formatDateBr(t.updatedAt) : "—";
      return `<tr><td>${esc(codigoOuId(t))}</td><td>${esc(t.titulo)}</td><td>${esc(t.status)}</td><td>${esc(
        responsavel
      )}</td><td>${formatDateBr(t.createdAt)}</td><td>${quandoConcluiu}</td><td>${esc(quemFez)}</td><td>${esc(
        ultimaAcaoTexto
      )}</td></tr>`;
    })
    .join("");

  const ticketDetalhadoRows = tickets
    .map((t) => {
      const resp = t.responsaveis[0]?.usuario;
      const responsavel = resp?.nomeExibicao?.trim() || resp?.email || "Não definido";
      const ultimaInteracao = t.comentarios.at(-1) ?? t.historico.at(-1);
      const quemInteragiu =
        "autor" in (ultimaInteracao || {})
          ? (ultimaInteracao as { autor?: { nomeExibicao?: string | null; email?: string | null } }).autor?.nomeExibicao?.trim() ||
            (ultimaInteracao as { autor?: { nomeExibicao?: string | null; email?: string | null } }).autor?.email ||
            responsavel
          : responsavel;
      const quandoFechou = ["finalizado", "nao_solucionado"].includes(t.status) ? formatDateBr(t.updatedAt) : "—";
      const ultimaData =
        ultimaInteracao && "data" in ultimaInteracao && ultimaInteracao.data instanceof Date
          ? formatDateBr(ultimaInteracao.data)
          : "Sem registro";
      return `<tr><td>${esc(codigoOuId(t))}</td><td>${esc(t.assunto)}</td><td>${esc(t.status)}</td><td>${esc(
        responsavel
      )}</td><td>${formatDateBr(t.dataCriacao)}</td><td>${quandoFechou}</td><td>${esc(quemInteragiu)}</td><td>${esc(
        ultimaData
      )}</td></tr>`;
    })
    .join("");

  const tarefasAtrasadas = tarefas.filter((t) => t.status !== "concluido" && t.dataFim.getTime() < Date.now()).length;
  const ticketsAtrasados = tickets.filter(
    (t) => !["finalizado", "nao_solucionado"].includes(t.status) && t.previsaoConclusao.getTime() < Date.now()
  ).length;

  const clienteNome = (cliente.empresa?.trim() || cliente.nome).trim();
  const empresaEndereco = (empresaConfig.endereco ?? "").trim();

  const values = {
    ...valoresPreviewExemplo(new Date(), empresaConfig),
    "{{cliente_nome}}": clienteNome,
    "{{periodo_inicio}}": formatDateBr(inicio),
    "{{periodo_fim}}": formatDateBr(fim),
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
    "{{tabela_tarefas_detalhada_html}}": `<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Código</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Título</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Status</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Responsável</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Criado em</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Concluído em</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Quem fez</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Última ação</th></tr></thead><tbody>${
      tarefaDetalhadaRows || `<tr><td colspan="8" style="padding:6px">Sem tarefas no período.</td></tr>`
    }</tbody></table>`,
    "{{tabela_tickets_detalhada_html}}": `<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Código</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Título</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Status</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Responsável</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Criado em</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Fechado em</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Última interação de</th><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:4px">Última interação em</th></tr></thead><tbody>${
      ticketDetalhadoRows || `<tr><td colspan="8" style="padding:6px">Sem tickets no período.</td></tr>`
    }</tbody></table>`,
    "{{empresa.razaoSocial}}": empresaConfig.razaoSocial || "",
    "{{empresa.nomeFantasia}}": empresaConfig.nomeFantasia || "",
    "{{empresa.cnpj}}": empresaConfig.cnpj || "",
    "{{empresa.telefone}}": empresaConfig.telefone || "",
    "{{empresa.email}}": empresaConfig.email || "",
    "{{empresa.site}}": empresaConfig.site || "",
    "{{empresa.endereco}}": empresaEndereco,
    "{{cliente.nome}}": clienteNome,
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
    assunto: assunto || `Prestação de contas - ${clienteNome}`,
    snapshot: {
      assunto,
      cabecalhoHtml: preencherTemplateDocumento(modelo.cabecalhoHtml ?? "", values),
      corpoHtml: preencherTemplateDocumento(modelo.corpo ?? "", values),
      rodapeHtml: preencherTemplateDocumento(modelo.rodapeHtml ?? "", values),
      timbreUrl: timbre?.url ?? empresaConfig.papelTimbradoUrl ?? "",
      renderConfig: timbre?.renderConfig ?? fallbackRenderConfig,
    },
    resumo: {
      cliente: values["{{cliente_nome}}"],
      periodoInicio: values["{{periodo_inicio}}"],
      periodoFim: values["{{periodo_fim}}"],
      totalTarefas: tarefas.length,
      totalTickets: tickets.length,
      tarefasAtrasadas,
      ticketsAtrasados,
    },
  };
}
