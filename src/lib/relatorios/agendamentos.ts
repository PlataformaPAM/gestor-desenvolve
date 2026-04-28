export const RELATORIOS_AGENDAMENTOS_CHAVE = "relatorios_agendamentos";
export const RELATORIOS_AGENDAMENTOS_ESTADO_CHAVE = "relatorios_agendamentos_estado";

export type AgendamentoRelatorio = {
  id: string;
  nome: string;
  clienteId: string;
  modeloId: string;
  periodoTipo: "mensal";
  diaExecucao: number;
  destinatarios: string[];
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AgendamentoExecLog = {
  id: string;
  agendamentoId: string;
  agendamentoNome: string;
  referenciaMes: string;
  status: "sucesso" | "erro";
  mensagem: string;
  destinatarios: string[];
  executadoEm: string;
};

export type AgendamentoEstado = {
  lastRunByAgendamento: Record<string, string>;
  logs: AgendamentoExecLog[];
  updatedAt: string;
};

export function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeAgendamentos(raw: unknown): AgendamentoRelatorio[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(Boolean) as AgendamentoRelatorio[];
}

export function normalizeEstado(raw: unknown): AgendamentoEstado {
  if (!raw || typeof raw !== "object") {
    return { lastRunByAgendamento: {}, logs: [], updatedAt: nowIso() };
  }
  const obj = raw as Record<string, unknown>;
  const lastRunByAgendamento =
    obj.lastRunByAgendamento && typeof obj.lastRunByAgendamento === "object"
      ? (obj.lastRunByAgendamento as Record<string, string>)
      : {};
  const logs = Array.isArray(obj.logs) ? (obj.logs as AgendamentoExecLog[]) : [];
  return {
    lastRunByAgendamento,
    logs,
    updatedAt: typeof obj.updatedAt === "string" ? obj.updatedAt : nowIso(),
  };
}

export function previousMonthPeriod(reference = new Date()): {
  inicio: string;
  fim: string;
  referenciaMes: string;
} {
  const y = reference.getFullYear();
  const m = reference.getMonth();
  const prev = new Date(y, m - 1, 1);
  const lastPrev = new Date(y, m, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    inicio: fmt(prev),
    fim: fmt(lastPrev),
    referenciaMes: `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`,
  };
}
