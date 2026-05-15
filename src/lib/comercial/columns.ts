import type { Lead, PipelineStageId } from "./types";

export type ColumnsState = Record<PipelineStageId, Lead[]>;

const STAGE_ORDER: PipelineStageId[] = [
  "prospecao",
  "qualificacao",
  "proposta",
  "contratacao",
  "fechado",
  "perdido",
];

export function columnsFromLeads(leads: Lead[]): ColumnsState {
  const list = Array.isArray(leads) ? leads : [];
  const columns: ColumnsState = {
    prospecao: [],
    qualificacao: [],
    proposta: [],
    contratacao: [],
    fechado: [],
    perdido: [],
  };
  list.forEach((lead) => {
    if (!lead || typeof lead !== "object" || !lead.stageId) return;
    if (columns[lead.stageId]) {
      columns[lead.stageId].push(lead);
    }
  });
  // Leads devolvidos pelo Financeiro devem ficar no topo de Contratação para correção imediata.
  columns.contratacao = [...columns.contratacao].sort((a, b) => {
    const aDev = a.financeiroFluxo?.status === "devolvido" ? 1 : 0;
    const bDev = b.financeiroFluxo?.status === "devolvido" ? 1 : 0;
    if (aDev !== bDev) return bDev - aDev;
    const aDevolvidoEm = a.financeiroFluxo?.devolvidoEm ? new Date(a.financeiroFluxo.devolvidoEm).getTime() : 0;
    const bDevolvidoEm = b.financeiroFluxo?.devolvidoEm ? new Date(b.financeiroFluxo.devolvidoEm).getTime() : 0;
    if (aDevolvidoEm !== bDevolvidoEm) return bDevolvidoEm - aDevolvidoEm;
    const aEntered = a.enteredStageAt ? new Date(a.enteredStageAt).getTime() : 0;
    const bEntered = b.enteredStageAt ? new Date(b.enteredStageAt).getTime() : 0;
    return bEntered - aEntered;
  });
  return columns;
}

export function leadsFromColumns(columns: ColumnsState): Lead[] {
  const result: Lead[] = [];
  STAGE_ORDER.forEach((id) => {
    result.push(...(columns[id] ?? []));
  });
  return result;
}

export function getEmptyColumns(): ColumnsState {
  return {
    prospecao: [],
    qualificacao: [],
    proposta: [],
    contratacao: [],
    fechado: [],
    perdido: [],
  };
}
