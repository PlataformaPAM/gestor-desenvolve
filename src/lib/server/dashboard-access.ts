import type { SessionPayload } from "@/lib/auth";
import { authorize, isSessionAdmin } from "@/lib/server/authorize";
import { mapLeadFromDb } from "@/app/api/comercial/_shared";
import { filterLeadsForSession } from "@/lib/server/comercial-lead-access";
import { filterClientesForSession } from "@/lib/server/cliente-access";
import { filterLancamentosForSession } from "@/lib/server/financeiro-access";
import { filterHelpdeskTicketsForScope } from "@/lib/server/helpdesk-access";
import { filterRelatorioTarefasRaw } from "@/lib/server/relatorio-scope";
import {
  getFinanceiroDefaultHref,
  hasAnyFinanceiroSubmodule,
} from "@/lib/financeiro/financeiro-nav";
import { prisma } from "@/lib/prisma";
import type { Lancamento } from "@prisma/client";

export type DashboardVisibility = {
  central: boolean;
  comercial: boolean;
  /** Gráficos/KPIs de lançamentos (fluxo de caixa). */
  financeiro: boolean;
  /** Card/link Financeiro na Central (qualquer submódulo). */
  financeiroNav: boolean;
  clientes: boolean;
  helpdesk: boolean;
  tarefas: boolean;
  posVenda: boolean;
  financeiroHref: string;
  comercialScope: "todos" | "vinculados";
  financeiroScope: "todos" | "vinculados";
  clientesScope: "todos" | "vinculados";
  helpdeskScope: "todos" | "vinculados";
  tarefasScope: "todos" | "vinculados";
};

export function getDashboardVisibility(
  session: SessionPayload,
  userId: string | null
): DashboardVisibility {
  if (isSessionAdmin(session)) {
    return {
      central: true,
      comercial: true,
      financeiro: true,
      financeiroNav: true,
      clientes: true,
      helpdesk: true,
      tarefas: true,
      posVenda: true,
      financeiroHref: "/financeiro",
      comercialScope: "todos",
      financeiroScope: "todos",
      clientesScope: "todos",
      helpdeskScope: "todos",
      tarefasScope: "todos",
    };
  }

  const central = authorize(session, "central.dashboard", "ver");
  const comercial = authorize(session, "comercial.pipeline", "ver");
  const financeiro = authorize(session, "financeiro.lancamentos", "ver");
  const clientes = authorize(session, "clientes.cadastro", "ver");
  const helpdesk = authorize(session, "helpdesk.tickets", "ver");
  const tarefas = authorize(session, "tarefas.internas", "ver");
  return {
    central: central.allowed,
    comercial: comercial.allowed,
    financeiro: financeiro.allowed,
    financeiroNav: hasAnyFinanceiroSubmodule(session),
    clientes: clientes.allowed,
    helpdesk: helpdesk.allowed,
    tarefas: tarefas.allowed,
    posVenda: authorize(session, "posvenda.tarefas", "ver").allowed,
    financeiroHref: getFinanceiroDefaultHref({
      isSystemAdmin: session.isSystemAdmin,
      perfilNome: session.perfilNome,
      permissoes: session.permissoes,
      permissoesGranulares: session.permissoesGranulares,
    }),
    comercialScope: comercial.scope,
    financeiroScope: financeiro.scope,
    clientesScope: clientes.scope,
    helpdeskScope: helpdesk.scope,
    tarefasScope: tarefas.scope,
  };
}

/** `mapLeadFromDb` exige o mesmo include do bootstrap comercial. */
const LEAD_DASHBOARD_INCLUDE = {
  criadoPor: { select: { nomeExibicao: true } },
  atualizadoPor: { select: { nomeExibicao: true } },
  solucoes: { include: { solucaoCatalogo: true } },
  contatos: { include: { papeis: true } },
  checklistItems: true,
  contratoChecklist: true,
  contratoArquivos: true,
  financeiroFluxo: true,
  interactions: { include: { user: true, anexos: true }, orderBy: { date: "asc" as const } },
} as const;

export async function loadDashboardLeads(
  session: SessionPayload,
  userId: string | null,
  visibility: DashboardVisibility
) {
  if (!visibility.comercial) return [];
  const rows = await prisma.lead.findMany({
    where: { registroLead: "oportunidade" },
    include: LEAD_DASHBOARD_INCLUDE,
  });
  const mapped = rows.flatMap((r) => {
    try {
      return [mapLeadFromDb(r as never)];
    } catch (e) {
      console.warn("[dashboard] lead ignorado no map:", r.id, e);
      return [];
    }
  });
  if (isSessionAdmin(session) || visibility.comercialScope === "todos") {
    return mapped;
  }
  return filterLeadsForSession(mapped, session, userId);
}

export async function loadDashboardLancamentos(
  session: SessionPayload,
  userId: string | null,
  visibility: DashboardVisibility
): Promise<Lancamento[]> {
  if (!visibility.financeiro) return [];
  const rows = await prisma.lancamento.findMany();
  if (isSessionAdmin(session) || visibility.financeiroScope === "todos") {
    return rows;
  }
  return filterLancamentosForSession(rows, userId, visibility.financeiroScope);
}

export type DashboardClienteRow = {
  id: string;
  status: string;
  criadoPorId: string | null;
};

export async function loadDashboardClientes(
  session: SessionPayload,
  userId: string | null,
  visibility: DashboardVisibility
): Promise<DashboardClienteRow[]> {
  if (!visibility.clientes) return [];
  try {
    const rows = await prisma.cliente.findMany({
      select: { id: true, status: true, criadoPorId: true },
    });
    if (isSessionAdmin(session) || visibility.clientesScope === "todos") return rows;
    return filterClientesForSession(rows, userId, visibility.clientesScope);
  } catch {
    return [];
  }
}

export type DashboardTicketRow = {
  id: string;
  codigo: string;
  assunto: string;
  status: string;
  prioridade: string;
  previsaoConclusao: Date;
  responsaveis: Array<{ usuarioId: string }>;
};

export async function loadDashboardTickets(
  session: SessionPayload,
  userId: string | null,
  visibility: DashboardVisibility
): Promise<DashboardTicketRow[]> {
  if (!visibility.helpdesk) return [];
  try {
    const rows = await prisma.helpdeskTicket.findMany({
      select: {
        id: true,
        codigo: true,
        assunto: true,
        status: true,
        prioridade: true,
        previsaoConclusao: true,
        responsaveis: { select: { usuarioId: true } },
      },
    });
    if (isSessionAdmin(session) || visibility.helpdeskScope === "todos") return rows;
    return filterHelpdeskTicketsForScope(rows, userId, visibility.helpdeskScope);
  } catch {
    return [];
  }
}

export type DashboardTarefaRow = {
  id: string;
  titulo: string;
  status: string;
  dataFim: Date;
  responsavelId: string;
  colaboradores: Array<{ usuarioId: string }>;
};

export async function loadDashboardTarefas(
  session: SessionPayload,
  userId: string | null,
  visibility: DashboardVisibility
): Promise<DashboardTarefaRow[]> {
  if (!visibility.tarefas) return [];
  try {
    const rows = await prisma.tarefa.findMany({
      select: {
        id: true,
        titulo: true,
        status: true,
        dataFim: true,
        responsavelId: true,
        colaboradores: { select: { usuarioId: true } },
      },
    });
    if (isSessionAdmin(session) || visibility.tarefasScope === "todos") return rows;
    return filterRelatorioTarefasRaw(rows, userId, visibility.tarefasScope);
  } catch {
    return [];
  }
}
