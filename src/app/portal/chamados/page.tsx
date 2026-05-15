"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TicketsTable } from "@/components/helpdesk/tickets-table";
import type { Ticket, TicketCategoria, TicketPrioridade, TicketStatus } from "@/lib/helpdesk/types";
import { CATEGORIA_LABELS, PRIORIDADE_LABELS, STATUS_LABELS, getSlaEstado } from "@/lib/helpdesk/constants";
import { Search } from "lucide-react";
import { formInputClass, formNativeSelectClass } from "@/components/ui/field-patterns";
import { usePageHeader } from "@/contexts/page-header-context";
import { OperacaoViews } from "@/components/ui/operacao-views";
import { getSituacaoOperacional, sortByPriorizacao, type OperacaoViewId } from "@/lib/operacao/priorizacao";
import { TicketFormSheet, type TicketFormPayload } from "@/components/helpdesk/ticket-form-sheet";

type PortalContextPayload = {
  user: { id: string; nome: string; isAdminCliente: boolean };
  clientes: Array<{ id: string; nome: string; empresa?: string }>;
};

export default function PortalChamadosPage() {
  const { setPrimaryAction } = usePageHeader();
  const [context, setContext] = useState<PortalContextPayload | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [operacaoView, setOperacaoView] = useState<OperacaoViewId>("minha_fila");
  const [busca, setBusca] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | TicketStatus>("");
  const [categoriaFilter, setCategoriaFilter] = useState<"" | TicketCategoria>("");
  const [prioridadeFilter, setPrioridadeFilter] = useState<"" | TicketPrioridade>("");
  const [slaFilter, setSlaFilter] = useState<"" | "no_prazo" | "atencao" | "atrasado">("");
  const [ticketSelecionado, setTicketSelecionado] = useState<Ticket | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const load = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [ctxRes, chamadosRes] = await Promise.all([
        fetch("/api/portal/context", { cache: "no-store" }),
        fetch("/api/portal/chamados", { cache: "no-store" }),
      ]);
      if (!ctxRes.ok) throw new Error("Não foi possível validar o acesso ao portal.");
      if (!chamadosRes.ok) throw new Error("Não foi possível carregar os chamados.");

      const ctxBody = (await ctxRes.json()) as { data?: PortalContextPayload };
      const chamadosBody = (await chamadosRes.json()) as { data?: { tickets?: Ticket[] } };
      setContext(ctxBody.data ?? null);
      setTickets(chamadosBody.data?.tickets ?? []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar os chamados.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPrimaryAction({
      label: "Novo Chamado",
      showPlusIcon: true,
      onClick: () => {
        setTicketSelecionado(null);
        setSheetOpen(true);
      },
    });
    return () => setPrimaryAction(null);
  }, [setPrimaryAction]);

  const ticketsOperacionais = useMemo(() => {
    const now = new Date();
    const ativos = tickets.filter((t) => !["finalizado", "nao_solucionado"].includes(t.status));
    if (operacaoView === "fechados") {
      return [...tickets.filter((t) => ["finalizado", "nao_solucionado"].includes(t.status))].sort((a, b) => {
        const aTime = new Date(a.updatedAt ?? a.ultimaAtualizacao).getTime();
        const bTime = new Date(b.updatedAt ?? b.ultimaAtualizacao).getTime();
        return bTime - aTime;
      });
    }
    if (operacaoView === "urgentes") {
      return ativos.filter((t) => t.prioridade === "critica");
    }
    if (operacaoView === "atrasados") {
      return ativos.filter((t) => getSituacaoOperacional(t.previsaoConclusao, now) === "atrasado");
    }
    if (operacaoView === "vence_logo") {
      return ativos.filter((t) => getSituacaoOperacional(t.previsaoConclusao, now) === "vence_logo");
    }
    return sortByPriorizacao(ativos, {
      prioridade: (t) => t.prioridade,
      vencimentoIso: (t) => t.previsaoConclusao,
      atualizadoIso: (t) => t.updatedAt ?? t.ultimaAtualizacao,
      now,
    });
  }, [tickets, operacaoView]);

  const ticketsFiltrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return ticketsOperacionais.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (categoriaFilter && t.categoria !== categoriaFilter) return false;
      if (prioridadeFilter && t.prioridade !== prioridadeFilter) return false;
      if (slaFilter && getSlaEstado(t.previsaoConclusao) !== slaFilter) return false;
      if (!q) return true;
      return `${t.id} ${t.assunto} ${t.clienteNome}`.toLowerCase().includes(q);
    });
  }, [ticketsOperacionais, busca, statusFilter, categoriaFilter, prioridadeFilter, slaFilter]);

  const salvarChamado = async (data: TicketFormPayload) => {
    setErro(null);
    try {
      const endpoint = ticketSelecionado ? `/api/portal/chamados/${ticketSelecionado.id}` : "/api/portal/chamados";
      const method = ticketSelecionado ? "PATCH" : "POST";
      const body = ticketSelecionado
        ? { ticket: { ...ticketSelecionado, ...data } }
        : {
            clienteId: data.clienteId,
            assunto: data.assunto,
            descricao: data.descricao,
            prioridade: data.prioridade,
            categoria: data.categoria,
            previsaoConclusao: data.previsaoConclusao,
          };
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message || "Não foi possível salvar o chamado.");
      }
      setSheetOpen(false);
      setTicketSelecionado(null);
      await load();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar chamado.");
    }
  };

  const selectClass = `${formNativeSelectClass} h-10 min-w-0`;
  if (carregando) return <p className="text-sm text-slate-500 dark:text-slate-400">Carregando chamados...</p>;

  return (
    <section className="w-full min-w-0 space-y-6">
      <div className="sticky top-0 z-10 space-y-4 rounded-xl border border-slate-200/90 bg-white/90 px-3 py-3 shadow-sm backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/90">
        <OperacaoViews value={operacaoView} onChange={setOperacaoView} closedLabel="Fechados" />

        <div className="flex flex-col gap-3 lg:flex-row lg:flex-nowrap lg:items-end lg:gap-3">
          <div className="relative w-full min-w-0 lg:max-w-sm lg:flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Busca por ID, assunto ou cliente..."
              className={`${formInputClass} h-10 min-w-0 pl-9`}
            />
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:min-w-0 lg:flex-1 lg:flex-nowrap lg:items-end lg:gap-2">
            <select value={statusFilter} onChange={(e) => setStatusFilter((e.target.value || "") as "" | TicketStatus)} className={`${selectClass} w-full lg:min-w-[7.5rem]`}>
              <option value="">Status: Todos</option>
              {(Object.entries(STATUS_LABELS) as [TicketStatus, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select value={categoriaFilter} onChange={(e) => setCategoriaFilter((e.target.value || "") as "" | TicketCategoria)} className={`${selectClass} w-full lg:min-w-[7.5rem]`}>
              <option value="">Categoria: Todas</option>
              {(Object.entries(CATEGORIA_LABELS) as [TicketCategoria, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select value={prioridadeFilter} onChange={(e) => setPrioridadeFilter((e.target.value || "") as "" | TicketPrioridade)} className={`${selectClass} w-full lg:min-w-[7.5rem]`}>
              <option value="">Prioridade: Todas</option>
              {(Object.entries(PRIORIDADE_LABELS) as [TicketPrioridade, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select value={slaFilter} onChange={(e) => setSlaFilter((e.target.value || "") as "" | "no_prazo" | "atencao" | "atrasado")} className={`${selectClass} w-full lg:min-w-[7.5rem]`}>
              <option value="">SLA: Todos</option>
              <option value="no_prazo">No Prazo</option>
              <option value="atencao">Atenção</option>
              <option value="atrasado">Atrasado</option>
            </select>
          </div>
        </div>
      </div>

      {erro ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700/40 dark:bg-red-950/30 dark:text-red-300">
          {erro}
        </div>
      ) : null}

      <TicketsTable
        tickets={ticketsFiltrados}
        onSelectTicket={(ticket) => {
          setTicketSelecionado(ticket);
          setSheetOpen(true);
        }}
      />

      <TicketFormSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setTicketSelecionado(null);
        }}
        onSave={(data) => {
          void salvarChamado(data);
        }}
        clientes={context?.clientes ?? []}
        equipe={[]}
        usuarioAtual={{ id: context?.user.id ?? "portal-user", nome: context?.user.nome ?? "Cliente" }}
        initialTicket={ticketSelecionado}
        title={
          ticketSelecionado ? (
            <span className="truncate font-semibold text-[#6D28D9] dark:text-violet-300">
              {ticketSelecionado.id}
            </span>
          ) : (
            "Novo Chamado"
          )
        }
        hideClienteField
        hideResponsavelSection
        readOnlyStatus
        hideSlaPreview
        fixedCliente={
          context?.clientes?.[0]
            ? { id: context.clientes[0].id, nome: context.clientes[0].empresa?.trim() || context.clientes[0].nome }
            : null
        }
      />
    </section>
  );
}

