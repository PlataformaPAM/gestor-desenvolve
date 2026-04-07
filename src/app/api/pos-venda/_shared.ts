import type { Cliente, Tarefa, Usuario } from "@prisma/client";
import type { Cliente as ClienteFront } from "@/lib/clientes/types";
import type { ClienteHealth, EventoHistorico, TarefaRegua } from "@/lib/pos-venda/types";
import { TIPO_TAREFA_LABELS } from "@/lib/pos-venda/constants";

const MARKER = "[POSVENDA_META]";

type Meta = Partial<
  Pick<
    TarefaRegua,
    | "tipo"
    | "categoria"
    | "objetivo"
    | "scriptSugerido"
    | "intervaloRecorrenciaDias"
    | "proximaEtapaTipo"
    | "prioridadeCritica"
    | "motivoCritico"
    | "clienteNome"
    | "dataConclusao"
    | "removidaEm"
    | "removidaMotivo"
    | "removidaPor"
    | "playbook"
  >
> & {
  /** Rastreio: tarefas geradas após aprovação financeira do fechamento */
  origemLeadId?: string;
  playbookEtapaTitulo?: string;
};

export function getPosVendaMarker(): string {
  return MARKER;
}

export function encodePosVendaMeta(meta: Meta, descricao?: string | null): string {
  const clean = (descricao || "").trim();
  return `${MARKER}${JSON.stringify(meta)}\n${clean}`.trim();
}

export function decodePosVendaMeta(descricao?: string | null): { meta: Meta; descricao: string } {
  const raw = (descricao || "").trim();
  if (!raw.startsWith(MARKER)) return { meta: {}, descricao: raw };
  const firstLineEnd = raw.indexOf("\n");
  const metaRaw = firstLineEnd === -1 ? raw.slice(MARKER.length) : raw.slice(MARKER.length, firstLineEnd);
  const tail = firstLineEnd === -1 ? "" : raw.slice(firstLineEnd + 1);
  try {
    return { meta: JSON.parse(metaRaw) as Meta, descricao: tail };
  } catch {
    return { meta: {}, descricao: tail };
  }
}

export function mapClienteSlim(c: Cliente): ClienteFront {
  return {
    id: c.id,
    nome: c.nome,
    empresa: c.empresa,
    cpfCnpj: c.cpfCnpj,
    status: c.status as ClienteFront["status"],
    valorMensal: c.valorMensal,
    segmento: c.segmento as ClienteFront["segmento"],
    contatos: [],
    propostas: [],
    faturas: [],
    faturasPagas: 0,
    faturasPendentes: 0,
    tickets: [],
    email: c.email ?? undefined,
    telefone: c.telefone ?? undefined,
  };
}

export function mapHealthFromCliente(c: Cliente): ClienteHealth {
  const healthScore: ClienteHealth["healthScore"] =
    c.status === "inadimplente" ? "risco" : c.status === "inativo" ? "neutro" : "engajado";
  return {
    clienteId: c.id,
    clienteNome: c.empresa || c.nome,
    healthScore,
    score: healthScore === "engajado" ? 85 : healthScore === "neutro" ? 55 : 30,
    pendentes: 0,
    atrasadas: 0,
    concluidasTotal: 0,
    motivoPrincipal: healthScore === "risco" ? "Cliente com sinal de risco financeiro." : "Sem sinais críticos neste momento.",
    proximaAcao: healthScore === "engajado" ? "Manter cadência de relacionamento." : "Revisar plano de ação com o cliente.",
  };
}

export function mapPosVendaTask(
  t: Tarefa & { cliente: Cliente | null; historico: Array<{ id: string; data: Date; acao: string }> }
): TarefaRegua {
  const { meta } = decodePosVendaMeta(t.descricao);
  const status: TarefaRegua["status"] =
    t.status === "concluido" ? "concluida" : t.status === "impedimento" ? "adiada" : "pendente";
  return {
    id: t.id,
    tipo: (meta.tipo as TarefaRegua["tipo"]) || "outro",
    titulo: t.titulo || TIPO_TAREFA_LABELS[(meta.tipo as TarefaRegua["tipo"]) || "outro"],
    clienteId: t.clienteId || "",
    // ClienteNome precisa refletir alterações feitas em `Clientes` sem depender do que foi "carimbado" no meta.
    clienteNome: t.cliente?.empresa || t.cliente?.nome || meta.clienteNome || "Cliente",
    dataAgendada: t.dataFim.toISOString().slice(0, 10),
    status,
    dataConclusao: meta.dataConclusao,
    categoria: meta.categoria,
    objetivo: meta.objetivo,
    scriptSugerido: meta.scriptSugerido,
    intervaloRecorrenciaDias: meta.intervaloRecorrenciaDias,
    proximaEtapaTipo: meta.proximaEtapaTipo,
    prioridadeCritica: meta.prioridadeCritica,
    motivoCritico: meta.motivoCritico,
    removidaEm: meta.removidaEm,
    removidaMotivo: meta.removidaMotivo,
    removidaPor: meta.removidaPor,
    playbook: meta.playbook,
  };
}

export function mapEventosFromTask(
  t: TarefaRegua,
  historico: Array<{ id: string; data: Date; acao: string }>
): EventoHistorico[] {
  return historico.map((h) => ({
    id: h.id,
    clienteId: t.clienteId,
    tipo: h.acao.toLowerCase().includes("alerta") ? "alerta" : "tarefa_concluida",
    titulo: h.acao,
    data: h.data.toISOString(),
    tarefaId: t.id,
    categoria: t.categoria,
  }));
}

export function pickResponsavelId(users: Usuario[]): string | null {
  return users[0]?.id ?? null;
}

