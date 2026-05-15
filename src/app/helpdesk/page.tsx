"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Search } from "lucide-react";
import { OperacaoViews } from "@/components/ui/operacao-views";
import { TicketsTable } from "@/components/suporte/tickets-table";
import { TicketFormSheet } from "@/components/suporte/ticket-form-sheet";
import { Toast } from "@/components/ui/toast";
import { usePageHeader } from "@/contexts/page-header-context";
import { generateTicketId, getSlaEstado, STATUS_LABELS, CATEGORIA_LABELS } from "@/lib/suporte/constants";
import type { Ticket, TicketPrioridade, TicketStatus, TicketCategoria } from "@/lib/suporte/types";
import type { TicketFormPayload } from "@/components/suporte/ticket-form-sheet";
import {
  getSituacaoOperacional,
  sortByPriorizacao,
  type OperacaoViewId,
} from "@/lib/operacao/priorizacao";
import { useAuth } from "@/contexts/auth-context";
import { formLabelClass } from "@/components/ui/field-patterns";

type SlaFilter = "" | "no_prazo" | "atencao" | "atrasado";
const OPERACAO_VIEW_STORAGE_KEY = "operacao_view_suporte";

function normalizeForSearch(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
}

export default function SuportePage() {
  const { setPrimaryAction } = usePageHeader();
  const { session } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [operacaoView, setOperacaoView] = useState<OperacaoViewId>("abertos");
  const [clientes, setClientes] = useState<Array<{ id: string; nome: string; empresa?: string }>>([]);
  const [equipe, setEquipe] = useState<Array<{ id: string; nome: string }>>([]);
  const [prioridadeFilter, setPrioridadeFilter] = useState<"" | TicketPrioridade>("");
  const [statusFilter, setStatusFilter] = useState<"" | TicketStatus>("");
  const [categoriaFilter, setCategoriaFilter] = useState<"" | TicketCategoria>("");
  const [slaFilter, setSlaFilter] = useState<SlaFilter>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("Ticket aberto com sucesso!");
  const [pendingByTicketId, setPendingByTicketId] = useState<Record<string, number>>({});

  const saveTicket = useCallback(async (ticket: Ticket, isCreate = false) => {
    const url = isCreate ? "/api/suporte" : `/api/suporte/${ticket.id}`;
    const method = isCreate ? "POST" : "PATCH";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket }),
    });
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(OPERACAO_VIEW_STORAGE_KEY) as OperacaoViewId | null;
    if (!saved) return;
    if (["minha_fila", "abertos", "urgentes", "atrasados", "vence_logo", "fechados"].includes(saved)) {
      setOperacaoView(saved);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(OPERACAO_VIEW_STORAGE_KEY, operacaoView);
  }, [operacaoView]);

  useEffect(() => {
    setPrimaryAction({
      label: "Novo Ticket",
      showPlusIcon: true,
      onClick: () => {
        setSelectedTicket(null);
        setIsSheetOpen(true);
      },
    });
    return () => setPrimaryAction(null);
  }, [setPrimaryAction]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/suporte/bootstrap", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { data?: { tickets?: Ticket[] } };
        if (!active) return;
        setTickets(data?.data?.tickets ?? []);
        const [clientesRes, equipeRes] = await Promise.all([
          fetch("/api/clientes/bootstrap", { cache: "no-store" }),
          fetch("/api/tarefas/bootstrap", { cache: "no-store" }),
        ]);
        if (clientesRes.ok) {
          const c = (await clientesRes.json()) as { data?: { clientes?: Array<{ id: string; nome: string; empresa?: string }> } };
          if (active) setClientes(c?.data?.clientes ?? []);
        }
        if (equipeRes.ok) {
          const u = (await equipeRes.json()) as { data?: { usuarios?: Array<{ id: string; nome: string }> } };
          if (active) setEquipe(u?.data?.usuarios ?? []);
        }
      } catch {
        // no-op
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadSuporteAlertMarkers = async () => {
      try {
        const res = await fetch("/api/alertas/bootstrap", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          data?: { alertas?: Array<{ titulo: string; descricao: string; modulo: string; lida: boolean }> };
        };
        if (!active) return;
        const rows = (data?.data?.alertas ?? []).filter((a) => !a.lida && a.modulo === "helpdesk");
        const next: Record<string, number> = {};
        for (const t of tickets) {
          const count = rows.filter((a) => `${a.titulo} ${a.descricao}`.includes(t.id)).length;
          if (count > 0) next[t.id] = count;
        }
        setPendingByTicketId(next);
      } catch {
        // noop
      }
    };
    void loadSuporteAlertMarkers();
    const timer = window.setInterval(() => void loadSuporteAlertMarkers(), 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [tickets]);

  const ticketsOperacionais = useMemo(() => {
    const now = new Date();
    const ativos = tickets.filter((t) => !["finalizado", "nao_solucionado"].includes(t.status));
    let base: Ticket[] = [];
    if (operacaoView === "fechados") {
      return [...tickets.filter((t) => ["finalizado", "nao_solucionado"].includes(t.status))].sort((a, b) => {
        const aTime = new Date(a.updatedAt ?? a.ultimaAtualizacao).getTime();
        const bTime = new Date(b.updatedAt ?? b.ultimaAtualizacao).getTime();
        return bTime - aTime;
      });
    }
    if (operacaoView === "minha_fila") {
      base = ativos.filter((t) => (session.userId ? t.responsaveis.some((r) => r.id === session.userId) : false));
    } else if (operacaoView === "abertos") {
      base = ativos;
    } else if (operacaoView === "urgentes") {
      base = ativos.filter((t) => t.prioridade === "critica");
    } else if (operacaoView === "atrasados") {
      base = ativos.filter((t) => getSituacaoOperacional(t.previsaoConclusao, now) === "atrasado");
    } else {
      base = ativos.filter((t) => getSituacaoOperacional(t.previsaoConclusao, now) === "vence_logo");
    }
    return sortByPriorizacao(base, {
      prioridade: (t) => t.prioridade,
      vencimentoIso: (t) => t.previsaoConclusao,
      atualizadoIso: (t) => t.updatedAt ?? t.ultimaAtualizacao,
      now,
    });
  }, [tickets, operacaoView, session.userId]);

  const ticketsFiltrados = useMemo(() => {
    const term = normalizeForSearch(searchTerm);
    return ticketsOperacionais.filter((t) => {
      if (term) {
        const matchId = t.id.toLowerCase().includes(term);
        const matchAssunto = normalizeForSearch(t.assunto).includes(term);
        const matchCliente = normalizeForSearch(t.clienteNome ?? "").includes(term);
        if (!matchId && !matchAssunto && !matchCliente) return false;
      }
      if (prioridadeFilter && t.prioridade !== prioridadeFilter) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      if (categoriaFilter && t.categoria !== categoriaFilter) return false;
      if (slaFilter && getSlaEstado(t.previsaoConclusao) !== slaFilter) return false;
      return true;
    });
  }, [ticketsOperacionais, searchTerm, prioridadeFilter, statusFilter, categoriaFilter, slaFilter]);

  const handleSaveTicket = useCallback((data: TicketFormPayload) => {
    const now = new Date();
    if (selectedTicket) {
      let updatedTicket: Ticket | null = null;
      setTickets((prev) =>
        prev.map((t) =>
          t.id === selectedTicket.id
            ? (updatedTicket = {
                ...t,
                clienteId: data.clienteId,
                clienteNome: data.clienteNome,
                assunto: data.assunto,
                descricao: data.descricao,
                prioridade: data.prioridade,
                status: data.status,
                categoria: data.categoria,
                responsaveis: data.responsaveis,
                previsaoConclusao: data.previsaoConclusao,
                arquivos: data.arquivos ?? t.arquivos,
                historico: data.historico,
                ultimaAtualizacao: now.toISOString(),
              })
            : t
        )
      );
      if (updatedTicket) void saveTicket(updatedTicket, false).catch(() => undefined);
      setToastMessage("Ticket atualizado!");
      setToastVisible(true);
    } else {
      const previsao = new Date(now);
      previsao.setDate(previsao.getDate() + 3);
      setTickets((prev) => {
        const novo: Ticket = {
          id: generateTicketId(prev),
          clienteId: data.clienteId,
          clienteNome: data.clienteNome,
          assunto: data.assunto,
          descricao: data.descricao,
          prioridade: data.prioridade,
          status: data.status,
          categoria: data.categoria,
          responsaveis: data.responsaveis,
          dataCriacao: now.toISOString(),
          previsaoConclusao: data.previsaoConclusao ?? previsao.toISOString(),
          arquivos: data.arquivos ?? [],
          historico: data.historico?.length
            ? data.historico
            : [
                {
                  id: `h-${Date.now()}`,
                  data: now.toISOString(),
                  acao: "Chamado criado",
                  autor: "Sistema",
                },
              ],
          ultimaAtualizacao: now.toISOString(),
          registroCriadoPorNome: session.userName ?? null,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          comentarios: [
            {
              id: `c-${Date.now()}`,
              autor: data.clienteNome,
              autorTipo: "cliente",
              texto: data.descricao,
              data: now.toISOString(),
            },
          ],
        };
        void saveTicket(novo, true).catch(() => undefined);
        return [novo, ...prev];
      });
      setToastMessage("Ticket aberto com sucesso!");
      setToastVisible(true);
    }
    setIsSheetOpen(false);
    setSelectedTicket(null);
  }, [selectedTicket, saveTicket, session.userName]);

  const handleCloseSheet = useCallback(() => {
    setIsSheetOpen(false);
    setSelectedTicket(null);
  }, []);

  const handleSelectTicket = useCallback((ticket: Ticket) => {
    setSelectedTicket(ticket);
    setIsSheetOpen(true);
  }, []);

  const statusOptions = (Object.entries(STATUS_LABELS) as [TicketStatus, string][]).map(([value, label]) => ({
    value,
    label,
  }));
  const categoriaOptions = (Object.entries(CATEGORIA_LABELS) as [TicketCategoria, string][]).map(([value, label]) => ({
    value,
    label,
  }));

  const filterInputClass =
    "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

  return (
    <section className="w-full min-w-0 space-y-6">
      <OperacaoViews value={operacaoView} onChange={setOperacaoView} closedLabel="Fechados" />
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-nowrap lg:items-end lg:gap-3">
        <div className="relative w-full min-w-0 lg:max-w-sm lg:flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="search"
            placeholder="Busca por ID, assunto ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            aria-label="Buscar ticket"
          />
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:min-w-0 lg:flex-1 lg:flex-nowrap lg:items-end lg:gap-2">
          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2 lg:flex-1">
            <label htmlFor="filter-status" className={`${formLabelClass} shrink-0`}>Status</label>
            <select id="filter-status" value={statusFilter} onChange={(e) => setStatusFilter((e.target.value || "") as "" | TicketStatus)} className={`${filterInputClass} min-w-0 w-full lg:min-w-[7.5rem]`}>
              <option value="">Todos</option>
              {statusOptions.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2 lg:flex-1">
            <label htmlFor="filter-categoria" className={`${formLabelClass} shrink-0`}>Categoria</label>
            <select id="filter-categoria" value={categoriaFilter} onChange={(e) => setCategoriaFilter((e.target.value || "") as "" | TicketCategoria)} className={`${filterInputClass} min-w-0 w-full lg:min-w-[7.5rem]`}>
              <option value="">Todas</option>
              {categoriaOptions.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2 lg:flex-1">
            <label htmlFor="filter-prioridade" className={`${formLabelClass} shrink-0`}>Prioridade</label>
            <select id="filter-prioridade" value={prioridadeFilter} onChange={(e) => setPrioridadeFilter((e.target.value || "") as "" | TicketPrioridade)} className={`${filterInputClass} min-w-0 w-full lg:min-w-[7.5rem]`}>
              <option value="">Todas</option>
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
              <option value="critica">Crítica</option>
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2 lg:flex-1">
            <label htmlFor="filter-sla" className={`${formLabelClass} shrink-0`}>SLA</label>
            <select id="filter-sla" value={slaFilter} onChange={(e) => setSlaFilter((e.target.value || "") as SlaFilter)} className={`${filterInputClass} min-w-0 w-full lg:min-w-[7.5rem]`}>
              <option value="">Todos</option>
              <option value="no_prazo">No Prazo</option>
              <option value="atencao">Atenção</option>
              <option value="atrasado">Atrasado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de tickets */}
      <TicketsTable tickets={ticketsFiltrados} onSelectTicket={handleSelectTicket} pendingByTicketId={pendingByTicketId} />

      {/* Único Sheet: Criar ou Visualizar/Editar */}
      <TicketFormSheet
        open={isSheetOpen}
        onClose={handleCloseSheet}
        onSave={handleSaveTicket}
        clientes={clientes}
        equipe={equipe}
        usuarioAtual={{ id: session.userId ?? "usuario-atual", nome: session.userName ?? "Usuário" }}
        initialTicket={selectedTicket}
        title={
          selectedTicket ? (
            <span className="truncate font-semibold text-[#6D28D9] dark:text-violet-300">
              {selectedTicket.id}
            </span>
          ) : (
            "Novo Ticket"
          )
        }
      />

      <Toast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />
    </section>
  );
}
