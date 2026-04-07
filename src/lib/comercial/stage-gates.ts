import type { Lead, PipelineStageId } from "./types";
import { CHECKLIST_DADOS_GERAIS, ORIGEM_COM_DETALHE } from "./constants";

export type GateResult = { allowed: boolean; reasons: string[] };

const order: PipelineStageId[] = ["prospecao", "qualificacao", "proposta", "contratacao", "fechado", "perdido"];

/** Campos visíveis em Prospecção — obrigatórios; após Qualificação com contatos oficiais, não exigimos o trio prospecção */
function gateProspecaoCompleta(lead: Lead, reasons: string[], skipContatoProspecao = false): void {
  if (!lead.name?.trim()) reasons.push("• Preencha o nome do lead (assunto + entidade).");
  if (!lead.origem) reasons.push("• Selecione a origem do lead.");
  if (ORIGEM_COM_DETALHE.includes(lead.origem) && !(lead.notes?.trim())) {
    reasons.push("• Preencha o detalhe da origem.");
  }
  if (!skipContatoProspecao) {
    if (!(lead.contact?.trim())) reasons.push("• Preencha o contato.");
    if (!(lead.phone?.trim())) reasons.push("• Preencha o telefone.");
    if (!(lead.email?.trim())) reasons.push("• Preencha o e-mail.");
  }
}

/** Qualificação → Proposta (checklist geral + cliente + contatos) */
function gateQualificacaoParaProposta(lead: Lead, reasons: string[]): void {
  const temContatosOficiais = (lead.contatosOportunidade?.length ?? 0) > 0;
  gateProspecaoCompleta(lead, reasons, temContatosOficiais);
  if (!lead.clienteId) reasons.push("• Vincule um cliente à oportunidade.");
  if ((lead.contatosOportunidade?.length ?? 0) === 0) {
    reasons.push("• Adicione pelo menos um contato.");
  }
  const checklistOk = CHECKLIST_DADOS_GERAIS.every((_, idx) => !!lead.checklistProgress?.[`geral-${idx}`]);
  if (!checklistOk) {
    reasons.push("• Marque os 4 itens do checklist de Qualificação (aba Dados Gerais).");
  }
}

/** Proposta → Contratação */
function gatePropostaParaContratacao(lead: Lead, reasons: string[]): void {
  gateQualificacaoParaProposta(lead, reasons);
  if (!lead.solucoes || lead.solucoes.length === 0) {
    reasons.push("• Adicione ao menos uma solução na aba Proposta.");
  } else {
    lead.solucoes.forEach((s, i) => {
      if (!s.nome?.trim()) reasons.push(`• Solução ${i + 1}: informe o nome.`);
      if (s.valor == null || Number.isNaN(s.valor) || s.valor <= 0) {
        reasons.push(`• Solução "${s.nome || `#${i + 1}`}": informe um valor maior que zero (R$).`);
      }
      if (!(s.condicoesPagamento?.trim())) {
        reasons.push(`• Solução "${s.nome || `#${i + 1}`}": preencha as condições de pagamento.`);
      }
    });
  }
  if (!lead.previsaoFechamento?.trim()) {
    reasons.push("• Preencha a previsão de fechamento (aba Proposta).");
  }
}

/** Contratação → Fechado */
function gateContratacaoParaFechado(lead: Lead, reasons: string[]): void {
  gatePropostaParaContratacao(lead, reasons);
  const ch = lead.contratoChecklist ?? {
    aprovacaoCliente: false,
    recebimentoDocumentacao: false,
    envioDocumentacao: false,
    ordemCompra: false,
  };
  const itens: (keyof typeof ch)[] = ["aprovacaoCliente", "recebimentoDocumentacao", "envioDocumentacao", "ordemCompra"];
  if (itens.some((k) => !ch[k])) {
    reasons.push("• Conclua todos os itens do checklist de contratação (aba Contrato).");
  }
  const nAnexos = lead.contratoAnexosCliente?.length ?? 0;
  const legado =
    (lead.contratoArquivos?.minuta?.length ?? 0) + (lead.contratoArquivos?.assinatura?.length ?? 0);
  if (nAnexos === 0 && legado === 0) {
    reasons.push("• Anexe ao menos um arquivo do cliente (aba Contrato).");
  }
}

/**
 * Valida avanço para a etapa de DESTINO (exige tudo que o usuário deve ter preenchido até lá).
 * Retornos e movimentos para "perdido" são liberados sem validação de campos.
 */
export function canAdvanceToStage(lead: Lead, destId: PipelineStageId): GateResult {
  const reasons: string[] = [];

  if (destId === "perdido") return { allowed: true, reasons: [] };

  switch (destId) {
    case "qualificacao":
      gateProspecaoCompleta(lead, reasons);
      break;
    case "proposta":
      gateQualificacaoParaProposta(lead, reasons);
      break;
    case "contratacao":
      gatePropostaParaContratacao(lead, reasons);
      break;
    case "fechado":
      gateContratacaoParaFechado(lead, reasons);
      break;
    case "prospecao":
      break;
    default:
      break;
  }

  return { allowed: reasons.length === 0, reasons };
}

/** Compatível com DnD: valida avanço considerando origem e destino (bloqueia só avanços inválidos). */
export function canTransitionStage(
  lead: Lead,
  sourceId: PipelineStageId,
  destId: PipelineStageId
): GateResult {
  if (destId === sourceId) return { allowed: true, reasons: [] };
  const sourceIdx = order.indexOf(sourceId);
  const destIdx = order.indexOf(destId);
  const isBackward = destIdx < sourceIdx;

  if (isBackward) return { allowed: true, reasons: [] };
  if (destId === "perdido") return { allowed: true, reasons: [] };

  if (sourceId === "prospecao" && destId === "qualificacao") {
    return canAdvanceToStage(lead, "qualificacao");
  }

  if (sourceId === "qualificacao" && destId === "proposta") {
    return canAdvanceToStage(lead, "proposta");
  }

  if (sourceId === "proposta" && destId === "contratacao") {
    return canAdvanceToStage(lead, "contratacao");
  }

  if (sourceId === "contratacao" && destId === "fechado") {
    return canAdvanceToStage(lead, "fechado");
  }

  // Avanço que “pula” etapa (ex.: arrastar duas colunas): exigir requisitos do destino
  if (destIdx > sourceIdx) {
    return canAdvanceToStage(lead, destId);
  }

  return { allowed: true, reasons: [] };
}
