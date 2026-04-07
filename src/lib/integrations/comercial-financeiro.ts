"use client";

export type FinanceiroAprovacaoPendente = {
  leadId: string;
  leadNome: string;
  clienteId: string;
  clienteNome: string;
  valorTotal: number;
  solicitadoEm: string;
};

export type FinanceiroDecision =
  | {
      id: string;
      leadId: string;
      tipo: "aprovado_lancado";
      data: string;
      resumo: string;
    }
  | {
      id: string;
      leadId: string;
      tipo: "recusado";
      data: string;
      motivo: string;
    };

export type FinanceiroUnlockRequest = {
  id: string;
  leadId: string;
  leadNome: string;
  solicitadoEm: string;
  motivo: string;
};

export type FinanceiroUnlockDecision = {
  id: string;
  leadId: string;
  data: string;
  aprovado: boolean;
  motivo?: string;
};

const KEY_APROVACOES = "integracao.comercial_financeiro.aprovacoes_pendentes";
const KEY_DECISOES = "integracao.comercial_financeiro.decisoes";
const KEY_UNLOCK_REQUESTS = "integracao.comercial_financeiro.unlock_requests";
const KEY_UNLOCK_DECISOES = "integracao.comercial_financeiro.unlock_decisoes";

function readJsonArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeJsonArray<T>(key: string, value: T[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getAprovacoesPendentes(): FinanceiroAprovacaoPendente[] {
  return readJsonArray<FinanceiroAprovacaoPendente>(KEY_APROVACOES);
}

export function upsertAprovacaoPendente(item: FinanceiroAprovacaoPendente): void {
  const list = getAprovacoesPendentes();
  const next = [...list.filter((x) => x.leadId !== item.leadId), item];
  writeJsonArray(KEY_APROVACOES, next);
}

export function removeAprovacaoPendenteByLead(leadId: string): void {
  const list = getAprovacoesPendentes();
  writeJsonArray(
    KEY_APROVACOES,
    list.filter((x) => x.leadId !== leadId)
  );
}

export function pushDecision(item: FinanceiroDecision): void {
  const list = readJsonArray<FinanceiroDecision>(KEY_DECISOES);
  writeJsonArray(KEY_DECISOES, [...list, item]);
}

export function consumeDecisions(): FinanceiroDecision[] {
  const list = readJsonArray<FinanceiroDecision>(KEY_DECISOES);
  writeJsonArray<FinanceiroDecision>(KEY_DECISOES, []);
  return list;
}

export function getUnlockRequests(): FinanceiroUnlockRequest[] {
  return readJsonArray<FinanceiroUnlockRequest>(KEY_UNLOCK_REQUESTS);
}

export function pushUnlockRequest(item: FinanceiroUnlockRequest): void {
  const list = getUnlockRequests();
  const next = [...list.filter((x) => x.leadId !== item.leadId), item];
  writeJsonArray(KEY_UNLOCK_REQUESTS, next);
}

export function removeUnlockRequestByLead(leadId: string): void {
  const list = getUnlockRequests();
  writeJsonArray(
    KEY_UNLOCK_REQUESTS,
    list.filter((x) => x.leadId !== leadId)
  );
}

export function pushUnlockDecision(item: FinanceiroUnlockDecision): void {
  const list = readJsonArray<FinanceiroUnlockDecision>(KEY_UNLOCK_DECISOES);
  writeJsonArray(KEY_UNLOCK_DECISOES, [...list, item]);
}

export function consumeUnlockDecisions(): FinanceiroUnlockDecision[] {
  const list = readJsonArray<FinanceiroUnlockDecision>(KEY_UNLOCK_DECISOES);
  writeJsonArray<FinanceiroUnlockDecision>(KEY_UNLOCK_DECISOES, []);
  return list;
}

