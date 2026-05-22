import type { SessionPayload } from "@/lib/auth";
import { authorize, isSessionAdmin } from "@/lib/server/authorize";
import { filterClientesForSession } from "@/lib/server/cliente-access";
import { filterLancamentosForSession } from "@/lib/server/financeiro-access";
import { filterHelpdeskTicketsForScope } from "@/lib/server/helpdesk-access";
import { filterLeadIdsForResourceScope } from "@/lib/server/lead-access";
import { filterRelatorioTarefasRaw } from "@/lib/server/relatorio-scope";
import { isPrismaSchemaDriftError } from "@/lib/server/prisma-schema";
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

function hasAnyDashboardModule(flags: {
  comercial: boolean;
  financeiro: boolean;
  financeiroNav: boolean;
  clientes: boolean;
  helpdesk: boolean;
  tarefas: boolean;
  posVenda: boolean;
}): boolean {
  return (
    flags.comercial ||
    flags.financeiro ||
    flags.financeiroNav ||
    flags.clientes ||
    flags.helpdesk ||
    flags.tarefas ||
    flags.posVenda
  );
}

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
  const posVenda = authorize(session, "posvenda.tarefas", "ver").allowed;
  const financeiroNav = hasAnyFinanceiroSubmodule(session);

  const modules = {
    comercial: comercial.allowed,
    financeiro: financeiro.allowed,
    financeiroNav,
    clientes: clientes.allowed,
    helpdesk: helpdesk.allowed,
    tarefas: tarefas.allowed,
    posVenda,
  };

  return {
    central: central.allowed || hasAnyDashboardModule(modules),
    ...modules,
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

export type DashboardLeadRow = {
  id: string;
  stageId: string;
  priority: string;
  previsaoFechamento: Date | null;
  company: string | null;
  name: string;
};

const DASHBOARD_LEAD_SELECT = {
  id: true,
  stageId: true,
  priority: true,
  previsaoFechamento: true,
  company: true,
  name: true,
} as const;

async function queryDashboardLeads(): Promise<DashboardLeadRow[]> {
  try {
    return await prisma.lead.findMany({
      where: { registroLead: "oportunidade" },
      select: DASHBOARD_LEAD_SELECT,
    });
  } catch (error) {
    if (!isPrismaSchemaDriftError(error, "registroLead")) throw error;
    console.warn("[dashboard] coluna registroLead ausente — carregando todos os leads da Central.");
    return prisma.lead.findMany({ select: DASHBOARD_LEAD_SELECT });
  }
}

export async function loadDashboardLeads(
  session: SessionPayload,
  userId: string | null,
  visibility: DashboardVisibility
): Promise<DashboardLeadRow[]> {
  if (!visibility.comercial) return [];
  try {
    const rows = await queryDashboardLeads();
    if (isSessionAdmin(session) || visibility.comercialScope === "todos") {
      return rows;
    }
    const allowed = await filterLeadIdsForResourceScope(
      rows.map((r) => ({ id: r.id })),
      session,
      userId,
      "comercial.pipeline"
    );
    const allowedIds = new Set(allowed.map((r) => r.id));
    return rows.filter((r) => allowedIds.has(r.id));
  } catch (error) {
    console.error("[dashboard] falha ao carregar leads:", error);
    return [];
  }
}

export async function loadDashboardLancamentos(
  session: SessionPayload,
  userId: string | null,
  visibility: DashboardVisibility
): Promise<Lancamento[]> {
  if (!visibility.financeiro) return [];
  try {
    const rows = await prisma.lancamento.findMany();
    if (isSessionAdmin(session) || visibility.financeiroScope === "todos") {
      return rows;
    }
    return filterLancamentosForSession(rows, userId, visibility.financeiroScope);
  } catch (error) {
    console.error("[dashboard] falha ao carregar lançamentos:", error);
    return [];
  }
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
  } catch (error) {
    console.error("[dashboard] falha ao carregar clientes:", error);
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
  } catch (error) {
    console.error("[dashboard] falha ao carregar tickets:", error);
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
  } catch (error) {
    console.error("[dashboard] falha ao carregar tarefas:", error);
    return [];
  }
}
