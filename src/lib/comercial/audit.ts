import type { Lead, LeadInteraction } from "./types";
import { PIPELINE_STAGES } from "./constants";

const AUDIT_BLACKLIST = new Set([
  "id",
  "updatedAt",
  "createdAt",
  "history",
  "interactions",
  "anexos",
  "criadoPorId",
  "contatosOportunidade",
  "checklistProgress",
  "clienteId",
  "registroCriadoPorNome",
  "registroAtualizadoPorNome",
  "registroCriadoEm",
  "registroAtualizadoEm",
  /** Já registrado na aba Contrato (“Marcou no checklist…”). */
  "contratoChecklist",
  /** Já registrado na aba Contrato (“Anexou arquivo…”). */
  "contratoAnexosCliente",
]);

const STAGE_LABEL = Object.fromEntries(PIPELINE_STAGES.map((s) => [s.id, s.label])) as Record<string, string>;

const REC_LABEL: Record<string, string> = {
  mensal: "mensal",
  unica: "pagamento único",
  parcelado: "parcelado",
};

const CONTRATO_CHECKLIST_LABELS: Record<string, string> = {
  aprovacaoCliente: "Aprovação do cliente",
  recebimentoDocumentacao: "Recebimento de documentação",
  envioDocumentacao: "Envio de documentação",
  ordemCompra: "Ordem de compra",
};

const FIN_STATUS_LABEL: Record<string, string> = {
  nenhum: "sem pendência financeira",
  pendente_aprovacao: "pendente de aprovação financeira",
  lancado: "lançado / aprovado",
  devolvido: "devolvido pelo financeiro",
};

function createLogId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function valuesAreEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function fmtAuditValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return "—";
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
      const d = new Date(t);
      if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
    }
    return t.length > 180 ? `${t.slice(0, 180)}…` : t;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    if (!v.length) return "—";
    if (v.length <= 3) return v.map((x) => fmtAuditValue(x)).join(", ");
    return `${v.length} item(ns)`;
  }
  if (typeof v === "object") {
    try {
      return JSON.stringify(v).slice(0, 200);
    } catch {
      return "—";
    }
  }
  return String(v);
}

function formatStageId(v: unknown): string {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return STAGE_LABEL[s] ?? s;
}

function formatSolucoesAudit(v: unknown): string {
  if (!Array.isArray(v) || v.length === 0) return "—";
  const brl = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
  return v
    .map((row) => {
      if (!row || typeof row !== "object") return "?";
      const o = row as Record<string, unknown>;
      const nome = String(o.nome ?? "Solução");
      const valor = typeof o.valor === "number" ? brl(o.valor) : null;
      const rec = o.recorrenciaPagamento != null ? String(o.recorrenciaPagamento) : "";
      const recTxt = rec ? REC_LABEL[rec] ?? rec : "";
      const parc = typeof o.parcelas === "number" && rec === "parcelado" ? `, ${o.parcelas}x` : "";
      const bits = [nome, valor, recTxt && `(${recTxt}${parc})`].filter(Boolean);
      return bits.join(" ");
    })
    .join(" · ");
}

function formatContratoChecklistAudit(v: unknown): string {
  if (!v || typeof v !== "object") return "—";
  const o = v as Record<string, unknown>;
  return Object.entries(CONTRATO_CHECKLIST_LABELS)
    .map(([k, label]) => `${label}: ${o[k] === true ? "sim" : "não"}`)
    .join("; ");
}

function formatContratoAnexosAudit(v: unknown): string {
  if (!Array.isArray(v) || v.length === 0) return "—";
  return v
    .map((row) => {
      if (!row || typeof row !== "object") return "?";
      return String((row as Record<string, unknown>).nome ?? "?");
    })
    .join(", ");
}

function formatFinanceiroFluxoAudit(v: unknown): string {
  if (!v || typeof v !== "object") return "—";
  const f = v as Record<string, unknown>;
  const statusRaw = typeof f.status === "string" ? f.status : "";
  const status = (FIN_STATUS_LABEL[statusRaw] ?? statusRaw) || "—";
  const bloq = f.bloqueadoEdicao === true ? "edição bloqueada" : "edição liberada";
  const motivo =
    typeof f.motivoDevolucao === "string" && f.motivoDevolucao.trim()
      ? `; motivo devolução: ${f.motivoDevolucao.trim()}`
      : "";
  return `${status}; ${bloq}${motivo}`;
}

/** Texto curto conforme o campo — evita JSON bruto na linha do histórico. */
function fmtAuditValueForKey(key: string, v: unknown): string {
  switch (key) {
    case "stageId":
      return formatStageId(v);
    case "solucoes":
      return formatSolucoesAudit(v);
    case "contratoChecklist":
      return formatContratoChecklistAudit(v);
    case "contratoAnexosCliente":
      return formatContratoAnexosAudit(v);
    case "financeiroFluxo":
      return formatFinanceiroFluxoAudit(v);
    default:
      return fmtAuditValue(v);
  }
}

function buildAuditDescription(key: string, oldValue: unknown, newValue: unknown): string {
  const labels: Record<string, string> = {
    name: "Nome do lead",
    origem: "Origem",
    priority: "Prioridade",
    contact: "Contato",
    phone: "Telefone",
    email: "E-mail",
    notes: "Observações / detalhe da origem",
    previsaoFechamento: "Previsão de fechamento",
    value: "Valor base",
    valorTotal: "Valor total",
    stageId: "Etapa do funil",
    enteredStageAt: "Data de entrada na etapa",
    propostaGeradaEm: "Proposta gerada em",
    solucoes: "Soluções / itens da proposta",
    contratoChecklist: "Checklist de contratação",
    contratoArquivos: "Arquivos de contrato",
    contratoAnexosCliente: "Anexos do cliente",
    financeiroFluxo: "Situação no financeiro",
    checklistProgress: "Progresso do checklist",
    municipioUf: "Município / UF",
    entidade: "Entidade",
    cargo: "Cargo",
    cpf: "CPF",
    company: "Empresa",
  };
  const label = labels[key] ?? key;
  return `${label} alterado: ${fmtAuditValueForKey(key, oldValue)} → ${fmtAuditValueForKey(key, newValue)}`;
}

export function generateAuditLogs(
  oldData: Partial<Lead>,
  newData: Partial<Lead>,
  currentUser: { nome: string; userId?: string | null }
): LeadInteraction[] {
  const now = new Date().toISOString();
  const logs: LeadInteraction[] = [];

  Object.keys(newData).forEach((key) => {
    if (AUDIT_BLACKLIST.has(key)) return;
    const oldValue = (oldData as Record<string, unknown>)[key];
    const newValue = (newData as Record<string, unknown>)[key];
    if (valuesAreEqual(oldValue, newValue)) return;

    const auditField = key === "stageId" ? "etapa" : key;
    logs.push({
      id: createLogId(),
      date: now,
      user: currentUser.nome,
      userId: currentUser.userId?.trim() || null,
      type: key === "stageId" ? "etapa" : "sistema",
      action: "UPDATE",
      field: auditField,
      fieldKey: auditField,
      oldValue,
      newValue,
      description: buildAuditDescription(key, oldValue, newValue),
    });
  });

  return logs;
}

export function createLeadCreatedLog(currentUser: { nome: string; userId?: string | null }): LeadInteraction {
  return {
    id: createLogId(),
    date: new Date().toISOString(),
    user: currentUser.nome,
    userId: currentUser.userId?.trim() || null,
    type: "sistema",
    action: "CREATE",
    description: `Lead criado por ${currentUser.nome}`,
  };
}
