"use client";

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { flushSync } from "react-dom";
import { useSearchParams } from "next/navigation";
import type { DropResult } from "@hello-pangea/dnd";
import { AlertTriangle, X } from "lucide-react";
import { TabsView, type ViewMode } from "@/components/comercial/tabs-view";
import { LeadList } from "@/components/comercial/lead-list";
import { LeadDetailPanel } from "@/components/comercial/lead-detail-panel";
import { NovoLeadPanel } from "@/components/comercial/novo-lead-panel";
import { ComercialKanban } from "@/components/comercial/comercial-kanban";
import { QualificarOportunidadeSheet } from "@/components/comercial/qualificar-oportunidade-sheet";
import { FechadoCelebrationModal } from "@/components/comercial/fechado-celebration-modal";
import { Toast } from "@/components/ui/toast";
import { PIPELINE_STAGES } from "@/lib/comercial/constants";
import type { Lead, PipelineStageId } from "@/lib/comercial/types";
import type { Cliente, Contato } from "@/lib/clientes/types";
import type { UsuarioSistema } from "@/lib/configuracoes/types";
import {
  columnsFromLeads,
  leadsFromColumns,
  getEmptyColumns,
  type ColumnsState,
} from "@/lib/comercial/columns";
import { canTransitionStage } from "@/lib/comercial/stage-gates";
import { usePageHeader } from "@/contexts/page-header-context";
import { useAuth } from "@/contexts/auth-context";
import { useComercialPageGuard, useComercialRbac } from "@/hooks/use-rbac-resource";
import { createLeadCreatedLog, generateAuditLogs } from "@/lib/comercial/audit";
import { createInitialOwnershipInteraction } from "@/lib/comercial/ownership";
import { formModalCancelButtonClass } from "@/components/ui/field-patterns";

function withAudit(
  oldLead: Lead,
  newLead: Lead,
  currentUser: { nome: string; userId?: string | null }
): Lead {
  const newLogs = generateAuditLogs(oldLead, newLead, currentUser);
  if (!newLogs.length) return newLead;
  return {
    ...newLead,
    interactions: [...newLogs, ...(newLead.interactions ?? [])],
  };
}

/** ID estável e único para o lead antes do POST (evita colisão de `Date.now()` no mesmo ms). */
function newLeadClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `lead-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function createSystemLog(
  currentUser: { nome: string; userId?: string | null },
  description: string
): NonNullable<Lead["interactions"]>[number] {
  return {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    date: new Date().toISOString(),
    user: currentUser.nome,
    userId: currentUser.userId?.trim() || null,
    type: "sistema",
    action: "UPDATE",
    description,
  };
}

function clearFinanceiroFluxoPendente(lead: Lead): NonNullable<Lead["financeiroFluxo"]> {
  return {
    ...(lead.financeiroFluxo ?? { status: "nenhum", bloqueadoEdicao: false }),
    status: "nenhum",
    bloqueadoEdicao: false,
    solicitadoEm: undefined,
    aprovadoEm: undefined,
    devolvidoEm: undefined,
    motivoDevolucao: undefined,
    liberacaoSolicitadaEm: undefined,
    motivoSolicitacaoLiberacao: undefined,
  };
}

function ComercialPageContent() {
  const { setPrimaryAction } = usePageHeader();
  const { session } = useAuth();
  const podeVerComercial = useComercialPageGuard();
  const { podeCriar: podeCriarLead, podeEditar: podeEditarLead } = useComercialRbac();
  const currentUserName = session.userName ?? "Usuário";
  const searchParams = useSearchParams();

  const [columns, setColumns] = useState<ColumnsState>(getEmptyColumns());
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [novoLeadOpen, setNovoLeadOpen] = useState(false);
  const [toastError, setToastError] = useState({ visible: false, message: "", duration: 12000 });
  const [toastPdfSuccess, setToastPdfSuccess] = useState({ visible: false, message: "" });
  const [toastSave, setToastSave] = useState<{ visible: boolean; message: string; duration?: number }>({
    visible: false,
    message: "",
  });
  const [fechadoCelebration, setFechadoCelebration] = useState<{ show: boolean; valorTotal: number }>({
    show: false,
    valorTotal: 0,
  });
  const [leadToQualifyId, setLeadToQualifyId] = useState<string | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [pendingLeadCountById, setPendingLeadCountById] = useState<Record<string, number>>({});
  const [pendingStageCountById, setPendingStageCountById] = useState<Partial<Record<PipelineStageId, number>>>({});
  /** Destaque visual no card (~3s) após criar, editar ou mudar etapa. */
  const [pulsingLeadIds, setPulsingLeadIds] = useState<Record<string, boolean>>({});
  /** IDs retornados por `window.setTimeout` no browser (compatível com DOM + tipos Node). */
  const pulseClearTimeoutsRef = useRef<Map<string, number>>(new Map());
  const [kanbanPerdaModal, setKanbanPerdaModal] = useState<{
    sourceId: PipelineStageId;
    destId: PipelineStageId;
    sourceIndex: number;
    destIndex: number;
    leadId: string;
    leadName: string;
  } | null>(null);
  const [kanbanMotivoPerda, setKanbanMotivoPerda] = useState("");
  const orderKey = useMemo(() => `pam.comercial.order.${session.userId ?? session.userName ?? "user"}`, [session.userId, session.userName]);

  const showErrorToast = useCallback((message: string, duration = 12000) => {
    window.requestAnimationFrame(() => {
      setToastError({ visible: true, message, duration });
    });
  }, []);

  const persistLead = useCallback(async (lead: Lead) => {
    const res = await fetch(`/api/comercial/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead }),
    });
    if (!res.ok) {
      const err = new Error("Falha ao persistir lead");
      throw err;
    }
    const json = (await res.json()) as { data?: { lead?: Lead } };
    const saved = json?.data?.lead;
    if (!saved) return;
    setColumns((prev) => {
      const all = leadsFromColumns(prev);
      const i = all.findIndex((l) => String(l.id) === String(saved.id));
      if (i === -1) return prev;
      const nextList = [...all.slice(0, i), saved, ...all.slice(i + 1)];
      return columnsFromLeads(nextList);
    });
  }, []);

  const createLead = useCallback(async (lead: Lead) => {
    const res = await fetch("/api/comercial/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      data?: { lead?: Lead };
      error?: { message?: string };
    };
    if (!res.ok || json?.success === false) {
      throw new Error(json?.error?.message ?? `Falha ao criar lead (${res.status}).`);
    }
    const saved = json?.data?.lead;
    if (saved) {
      setColumns((prev) => {
        const all = leadsFromColumns(prev);
        const i = all.findIndex((l) => String(l.id) === String(lead.id));
        if (i === -1) return prev;
        const nextList = [...all.slice(0, i), saved, ...all.slice(i + 1)];
        return columnsFromLeads(nextList);
      });
    }
  }, []);

  const createCliente = useCallback(async (cliente: Omit<Cliente, "id"> & { contatos?: Contato[] }) => {
    const res = await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cliente }),
    });
    if (!res.ok) throw new Error("Falha ao criar cliente");
    const data = (await res.json()) as { cliente: Cliente };
    return data.cliente;
  }, []);

  const persistClienteContatos = useCallback(async (clienteId: string, contatos: Contato[]) => {
    await fetch(`/api/clientes/${clienteId}/contatos`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contatos }),
    });
  }, []);

  const loadBootstrap = useCallback(async () => {
    const res = await fetch("/api/comercial/bootstrap?debug=1", { cache: "no-store" });
    const text = await res.text();
    const trimmed = text.trim();
    let body: {
      success?: boolean;
      data?: unknown;
      error?: { message?: string };
    };
    try {
      const parsed: unknown = trimmed ? JSON.parse(trimmed) : {};
      body =
        typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
          ? (parsed as typeof body)
          : {};
    } catch {
      throw new Error(`Resposta inválida do servidor (HTTP ${res.status}). Corpo: ${trimmed.slice(0, 300)}`);
    }
    if (!res.ok) {
      throw new Error(body?.error?.message ?? `Erro ${res.status} ao carregar kanban.`);
    }
    if (body.success === false) {
      throw new Error(body.error?.message ?? "Bootstrap comercial indisponível.");
    }
    const root = (body.data ?? {}) as {
      leads?: unknown;
      clientes?: unknown;
      meta?: {
        scope?: string;
        totalDb?: number;
        totalVisible?: number;
        totalHidden?: number;
        userId?: string | null;
        userName?: string | null;
        hiddenSample?: Array<{ id: string; name: string }>;
      };
      data?: { leads?: unknown; clientes?: unknown; meta?: typeof root.meta };
    };
    const leadsRaw = root.leads ?? root.data?.leads;
    const clientesRaw = root.clientes ?? root.data?.clientes;
    const meta = root.meta ?? root.data?.meta;
    const leads = Array.isArray(leadsRaw) ? (leadsRaw as Lead[]) : [];
    const clientes = Array.isArray(clientesRaw) ? (clientesRaw as Cliente[]) : [];
    return { leads, clientes, meta };
  }, []);

  const persistOrder = useCallback((state: ColumnsState) => {
    try {
      const payload = {
        prospecao: (state.prospecao ?? []).map((l) => l.id),
        qualificacao: (state.qualificacao ?? []).map((l) => l.id),
        proposta: (state.proposta ?? []).map((l) => l.id),
        contratacao: (state.contratacao ?? []).map((l) => l.id),
        fechado: (state.fechado ?? []).map((l) => l.id),
        perdido: (state.perdido ?? []).map((l) => l.id),
      };
      window.localStorage.setItem(orderKey, JSON.stringify(payload));
    } catch {
      // noop
    }
  }, [orderKey]);

  const applyPersistedOrder = useCallback((state: ColumnsState): ColumnsState => {
    try {
      const raw = window.localStorage.getItem(orderKey);
      if (!raw) return state;
      const order = JSON.parse(raw) as Partial<Record<PipelineStageId, string[]>>;
      const sortStage = (stage: PipelineStageId) => {
        const list = [...(state[stage] ?? [])];
        const ids = order[stage] ?? [];
        if (!ids.length) return list;
        const rank = new Map(ids.map((id, i) => [id, i]));
        return list.sort((a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER));
      };
      return {
        prospecao: sortStage("prospecao"),
        qualificacao: sortStage("qualificacao"),
        proposta: sortStage("proposta"),
        contratacao: sortStage("contratacao"),
        fechado: sortStage("fechado"),
        perdido: sortStage("perdido"),
      };
    } catch {
      return state;
    }
  }, [orderKey]);

  const rollbackFromServer = useCallback(async () => {
    const data = await loadBootstrap();
    setColumns(applyPersistedOrder(columnsFromLeads(data.leads ?? [])));
    setClientes(data.clientes ?? []);
  }, [loadBootstrap, applyPersistedOrder]);

  const recomputePendingAlerts = useCallback(async (leadList: Lead[]) => {
    try {
      const res = await fetch("/api/alertas/bootstrap", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        data?: { alertas?: Array<{ titulo: string; descricao: string; modulo: string; lida: boolean }> };
      };
      const rows = (data?.data?.alertas ?? []).filter((a) => !a.lida && a.modulo === "comercial");
      setPendingLeadCountById((prev) => {
        const next: Record<string, number> = {};
        for (const l of leadList) {
          const name = l.name?.toLowerCase() ?? "";
          const count = rows.filter((a) =>
            `${a.titulo} ${a.descricao}`.toLowerCase().includes(name)
          ).length;
          if (count > 0) next[l.id] = count;
        }
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });
    } catch {
      // noop
    }
  }, []);

  /** Alertas de “novo lead” ficam associados ao nome; ao sair de Prospecção o card não deve mais exibir o badge. */
  const clearComercialPendingBadgeIfLeftProspecao = useCallback(
    (leadId: string, fromStage: PipelineStageId, toStage: PipelineStageId) => {
      if (fromStage !== "prospecao" || toStage === "prospecao") return;
      const id = String(leadId);
      setPendingLeadCountById((prev) => {
        if ((prev[id] ?? 0) === 0) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    []
  );

  const pulseLeadCard = useCallback((leadId: string) => {
    const id = String(leadId);
    const existing = pulseClearTimeoutsRef.current.get(id);
    if (existing) window.clearTimeout(existing);
    /* Remove e recoloca a classe para o CSS animation voltar a rodar a cada ação. */
    setPulsingLeadIds((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });
    queueMicrotask(() => {
      setPulsingLeadIds((p) => ({ ...p, [id]: true }));
      const t = window.setTimeout(() => {
        setPulsingLeadIds((p) => {
          const next = { ...p };
          delete next[id];
          return next;
        });
        pulseClearTimeoutsRef.current.delete(id);
      }, 3000);
      pulseClearTimeoutsRef.current.set(id, t);
    });
  }, []);

  /** Após arrastar ou salvar: o DnD/React ainda ajustam o frame no mesmo tick; 2× rAF deixa o pulso visível. */
  const scheduleLeadCardPulse = useCallback(
    (leadId: string) => {
      const id = String(leadId);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          pulseLeadCard(id);
        });
      });
    },
    [pulseLeadCard]
  );

  const leads = useMemo(() => leadsFromColumns(columns), [columns]);
  const leadsRef = useRef<Lead[]>([]);
  leadsRef.current = leads;
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const selectedLead = useMemo(
    () => (selectedLeadId ? leads.find((l) => l.id === selectedLeadId) ?? null : null),
    [leads, selectedLeadId]
  );
  const leadToQualify = useMemo(
    () => (leadToQualifyId ? leads.find((l) => l.id === leadToQualifyId) ?? null : null),
    [leads, leadToQualifyId]
  );

  useEffect(() => {
    if (!podeCriarLead) {
      setPrimaryAction(null);
      return;
    }
    setPrimaryAction({
      label: "Novo Lead",
      onClick: () => setNovoLeadOpen(true),
      showPlusIcon: true,
    });
    return () => setPrimaryAction(null);
  }, [setPrimaryAction, podeCriarLead]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const data = await loadBootstrap();
        if (!active) return;
        setColumns(applyPersistedOrder(columnsFromLeads(data.leads ?? [])));
        setClientes(data.clientes ?? []);
        const meta = data.meta;
        if (meta && (meta.totalHidden ?? 0) > 0) {
          const sample = (meta.hiddenSample ?? [])
            .map((h) => h.name)
            .filter(Boolean)
            .join(", ");
          showErrorToast(
            `Kanban ocultou ${meta.totalHidden} lead(s) pelo escopo "${meta.scope ?? "vinculados"}". ` +
              `No banco: ${meta.totalDb ?? "?"}, visíveis: ${meta.totalVisible ?? "?"}. ` +
              `Usuário: ${meta.userName ?? meta.userId ?? "?"}. ` +
              (sample ? `Ex.: ${sample}. ` : "") +
              `Veja logs no Railway: filtro [comercial/bootstrap].`,
            20000
          );
        }
      } catch (err) {
        if (!active) return;
        setColumns(getEmptyColumns());
        setClientes([]);
        const msg = err instanceof Error ? err.message : "Falha ao carregar o funil comercial.";
        showErrorToast(msg, 20000);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadBootstrap, applyPersistedOrder, showErrorToast]);

  useEffect(() => {
    if (loading) return;
    const lid = searchParams.get("leadId")?.trim();
    if (!lid) return;
    const found = leads.some((l) => l.id === lid);
    if (found) {
      setSelectedLeadId(lid);
      setDetailOpen(true);
    }
  }, [loading, searchParams, leads]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/configuracoes/bootstrap", { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as { data?: { usuarios?: UsuarioSistema[] } };
        if (!active) return;
        setUsuarios(payload?.data?.usuarios ?? []);
      } catch {
        // noop
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void recomputePendingAlerts(leadsRef.current);
    const timer = window.setInterval(() => {
      void recomputePendingAlerts(leadsRef.current);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [leads, recomputePendingAlerts]);

  useEffect(
    () => () => {
      pulseClearTimeoutsRef.current.forEach((t) => window.clearTimeout(t));
      pulseClearTimeoutsRef.current.clear();
    },
    []
  );

  useEffect(() => {
    const next: Partial<Record<PipelineStageId, number>> = {};
    for (const lead of leads) {
      const count = pendingLeadCountById[lead.id] ?? 0;
      if (count > 0) {
        next[lead.stageId] = (next[lead.stageId] ?? 0) + count;
      }
    }
    setPendingStageCountById(next);
  }, [leads, pendingLeadCountById]);

  useEffect(() => {
    if (detailOpen) return;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const data = await loadBootstrap();
          setColumns(applyPersistedOrder(columnsFromLeads(data.leads ?? [])));
          setClientes(data.clientes ?? []);
        } catch {
          // No-op para não poluir UX com toasts de polling.
        }
      })();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [loadBootstrap, applyPersistedOrder, detailOpen]);

  const openDetail = useCallback((lead: Lead) => {
    setSelectedLeadId(lead.id);
    setDetailOpen(true);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailOpen(false);
    setSelectedLeadId(null);
  }, []);

  const applyKanbanMove = useCallback(
    (params: {
      sourceId: PipelineStageId;
      destId: PipelineStageId;
      sourceIndex: number;
      destIndex: number;
      leadId?: string;
      motivoPerda?: string;
    }) => {
      const { sourceId, destId, sourceIndex, destIndex, leadId, motivoPerda } = params;
      let movedLeadForFechado: Lead | undefined;
      let movedLeadPersist: Lead | undefined;
      let gateMessage: string | null = null;

      setColumns((prev) => {
        const next: ColumnsState = {
          prospecao: [...(prev.prospecao ?? [])],
          qualificacao: [...(prev.qualificacao ?? [])],
          proposta: [...(prev.proposta ?? [])],
          contratacao: [...(prev.contratacao ?? [])],
          fechado: [...(prev.fechado ?? [])],
          perdido: [...(prev.perdido ?? [])],
        };
        const sourceList = next[sourceId];
        const resolvedSourceIndex =
          leadId != null ? sourceList.findIndex((l) => String(l.id) === String(leadId)) : sourceIndex;
        if (resolvedSourceIndex < 0) return prev;
        const [removed] = sourceList.splice(resolvedSourceIndex, 1);
        if (!removed) return prev;

        const movingAcrossStages = sourceId !== destId;
        if (movingAcrossStages && removed.financeiroFluxo?.bloqueadoEdicao) {
          sourceList.splice(resolvedSourceIndex, 0, removed);
          gateMessage = "Lead bloqueado pelo Financeiro. Solicite liberação para editar ou mover.";
          return prev;
        }

        if (movingAcrossStages) {
          const gate = canTransitionStage(removed, sourceId, destId);
          if (!gate.allowed) {
            sourceList.splice(resolvedSourceIndex, 0, removed);
            gateMessage = `Ação bloqueada. Pendências:\n${gate.reasons.join("\n")}`;
            return prev;
          }
        }

        movedLeadForFechado = removed;
        const moveNow = new Date().toISOString();
        const updated: Lead = movingAcrossStages
          ? {
              ...removed,
              stageId: destId,
              enteredStageAt: moveNow,
              registroAtualizadoEm: moveNow,
              financeiroFluxo:
                destId === "fechado"
                  ? {
                      ...(removed.financeiroFluxo ?? { status: "nenhum", bloqueadoEdicao: false }),
                      status: "pendente_aprovacao",
                      bloqueadoEdicao: false,
                      solicitadoEm: new Date().toISOString(),
                    }
                  : sourceId === "fechado" && !removed.financeiroFluxo?.bloqueadoEdicao
                    ? clearFinanceiroFluxoPendente(removed)
                  : removed.financeiroFluxo,
              interactions:
                destId === "perdido" && motivoPerda?.trim()
                  ? [
                      ...(removed.interactions ?? []),
                      createSystemLog(
                        { nome: currentUserName, userId: session.userId },
                        `Lead marcado como Perdido. Motivo: ${motivoPerda.trim()}`
                      ),
                    ]
                  : removed.interactions,
            }
          : removed;

        movedLeadPersist = movingAcrossStages
          ? withAudit(removed, updated, { nome: currentUserName, userId: session.userId })
          : updated;
        next[destId].splice(destIndex, 0, movedLeadPersist);
        persistOrder(next);
        return next;
      });

      if (gateMessage) {
        showErrorToast(gateMessage, 10000);
        return;
      }
      if (destId === "fechado" && sourceId !== destId && movedLeadForFechado) {
        const valorTotal = movedLeadForFechado.valorTotal ?? movedLeadForFechado.value;
        setFechadoCelebration({ show: true, valorTotal });
      }
      if (movedLeadPersist) {
        scheduleLeadCardPulse(String(movedLeadPersist.id));
      }
      if (movedLeadPersist && sourceId !== destId) {
        clearComercialPendingBadgeIfLeftProspecao(String(movedLeadPersist.id), sourceId, destId);
        void persistLead(movedLeadPersist).catch(() => {
          void rollbackFromServer();
          showErrorToast("Não foi possível salvar a movimentação. Os dados foram recarregados.");
        });
      }
    },
    [
      currentUserName,
      session.userId,
      persistLead,
      rollbackFromServer,
      persistOrder,
      showErrorToast,
      scheduleLeadCardPulse,
      clearComercialPendingBadgeIfLeftProspecao,
    ]
  );

  const onDragEnd = useCallback((result: DropResult) => {
    if (!podeEditarLead) return;
    const { source, destination } = result;
    if (!destination) return;

    const sourceId = source.droppableId as PipelineStageId;
    const destId = destination.droppableId as PipelineStageId;
    if (sourceId === destId && source.index === destination.index) return;

    if (sourceId !== destId && destId === "perdido" && sourceId !== "perdido") {
      const sourceLead = columns[sourceId]?.[source.index];
      setKanbanPerdaModal({
        sourceId,
        destId,
        sourceIndex: source.index,
        destIndex: destination.index,
        leadId: String(sourceLead?.id ?? ""),
        leadName: sourceLead?.name ?? "Lead",
      });
      setKanbanMotivoPerda("");
      setToastSave({
        visible: true,
        message:
          "O cartão volta à coluna de origem até você confirmar. Preencha o motivo da perda na janela para concluir o envio para Perdido.",
        duration: 12000,
      });
      return;
    }

    applyKanbanMove({
      sourceId,
      destId,
      sourceIndex: source.index,
      destIndex: destination.index,
    });
  }, [columns, applyKanbanMove, podeEditarLead]);

  const handleNovoLeadSubmit = useCallback(
    async (raw: Partial<Lead> & Pick<Lead, "name" | "value" | "stageId" | "priority">) => {
      if (!podeCriarLead) return;
      const now = new Date().toISOString();
      const lead: Lead = {
        origem: "outro",
        registroLead: "oportunidade",
        clienteId: null,
        solucoes: [],
        valorTotal: raw.valorTotal ?? raw.value,
        checklistProgress: {},
        ...raw,
        id: newLeadClientId(),
        enteredStageAt: now,
        registroAtualizadoEm: now,
        criadoPorId: session.userId ?? null,
        interactions: [
          createLeadCreatedLog({ nome: currentUserName, userId: session.userId }),
          createInitialOwnershipInteraction(session.userId, currentUserName),
        ],
      };
      try {
        flushSync(() => {
          setColumns((prev) => ({
            ...prev,
            prospecao: [...(prev.prospecao ?? []), lead],
          }));
        });
        pulseLeadCard(lead.id);
        await createLead(lead);
        try {
          const refreshed = await loadBootstrap();
          setColumns(applyPersistedOrder(columnsFromLeads(refreshed.leads ?? [])));
          setClientes(refreshed.clientes ?? []);
          const found = (refreshed.leads ?? []).some((l) => String(l.id) === String(lead.id));
          if (!found) {
            showErrorToast(
              `Lead salvo no servidor, mas não apareceu no kanban após recarregar. ` +
                `Escopo: ${refreshed.meta?.scope ?? "?"}. ` +
                `DB: ${refreshed.meta?.totalDb ?? "?"}, visíveis: ${refreshed.meta?.totalVisible ?? "?"}. ` +
                `Abra Railway → serviço → Logs e busque [comercial/bootstrap] ou [POST /api/comercial/leads].`,
              25000
            );
          }
        } catch (refreshErr) {
          const msg =
            refreshErr instanceof Error ? refreshErr.message : "Falha ao recarregar kanban após salvar.";
          showErrorToast(`Lead salvo, mas erro ao recarregar kanban: ${msg}`, 20000);
        }
        void recomputePendingAlerts(leadsFromColumns(columnsRef.current));
        setToastSave({ visible: true, message: "Lead salvo com sucesso!" });
        setNovoLeadOpen(false);
      } catch (err) {
        void rollbackFromServer();
        const detail = err instanceof Error && err.message.trim() ? err.message.trim() : "";
        showErrorToast(
          detail
            ? `Não foi possível criar o lead: ${detail}`
            : "Não foi possível criar o lead no banco. Os dados foram recarregados.",
          12000
        );
        throw err;
      }
    },
    [
      currentUserName,
      session.userId,
      createLead,
      loadBootstrap,
      applyPersistedOrder,
      rollbackFromServer,
      showErrorToast,
      pulseLeadCard,
      recomputePendingAlerts,
      podeCriarLead,
    ]
  );

  const handleUpdateLead = useCallback(
    (
      updates: Partial<Lead>,
      opts?: { allowWhileFinanceiroLocked?: boolean; skipSuccessToast?: boolean }
    ) => {
    if (!podeEditarLead) return;
    if (!selectedLeadId) return;
    if (
      selectedLead?.financeiroFluxo?.bloqueadoEdicao &&
      !opts?.allowWhileFinanceiroLocked
    ) {
      showErrorToast("Lead bloqueado pelo Financeiro. Solicite liberação na aba Ações.");
      return;
    }
    try {
      let saved = false;
      let updatedLeadPersist: Lead | null = null;
      setColumns((prev) => {
        const next = { ...prev };
        for (const id of Object.keys(next) as PipelineStageId[]) {
          const list = next[id];
          const idx = list.findIndex((l) => String(l.id) === String(selectedLeadId));
          if (idx === -1) continue;
          next[id] = list.slice();
          const current = list[idx];
          const updated = { ...current, ...updates } as Lead;
          const audited = withAudit(current, updated, {
            nome: currentUserName,
            userId: session.userId,
          });
          updatedLeadPersist = { ...audited, registroAtualizadoEm: new Date().toISOString() };
          next[id][idx] = updatedLeadPersist;
          saved = true;
          return next;
        }
        return prev;
      });
      if (saved && updatedLeadPersist) {
        scheduleLeadCardPulse(String(selectedLeadId));
        void persistLead(updatedLeadPersist).catch(() => {
          void rollbackFromServer();
          showErrorToast("Não foi possível salvar a alteração. Os dados foram recarregados.");
        });
        if (!opts?.skipSuccessToast) {
          setToastSave({ visible: true, message: "Salvo com sucesso!" });
        }
      }
    } catch {
      showErrorToast("Erro ao salvar alterações.");
    }
  },
  [
    selectedLeadId,
    selectedLead,
    currentUserName,
    session.userId,
    persistLead,
    rollbackFromServer,
    showErrorToast,
    scheduleLeadCardPulse,
    podeEditarLead,
  ]);

  const handleMudarEtapa = useCallback(
    (stageId: PipelineStageId, options?: { motivoPerda?: string }) => {
      if (!podeEditarLead) return;
      if (!selectedLeadId || !selectedLead) return;
      if (selectedLead.financeiroFluxo?.bloqueadoEdicao) {
        showErrorToast("Lead bloqueado pelo Financeiro. Solicite liberação na aba Ações.");
        return;
      }
      if (stageId === "perdido" && !options?.motivoPerda?.trim()) {
        showErrorToast("Informe o motivo da perda para mover para Perdido.");
        return;
      }
      const gate = canTransitionStage(selectedLead, selectedLead.stageId, stageId);
      if (!gate.allowed) {
        showErrorToast(`Ação bloqueada. Pendências:\n${gate.reasons.join("\n")}`, 10000);
        return;
      }
      const nowEtapa = new Date().toISOString();
      const updated = withAudit(
        selectedLead,
        {
          ...selectedLead,
          stageId,
          enteredStageAt: nowEtapa,
          registroAtualizadoEm: nowEtapa,
          financeiroFluxo:
            stageId === "fechado"
              ? {
                  ...(selectedLead.financeiroFluxo ?? { status: "nenhum", bloqueadoEdicao: false }),
                  status: "pendente_aprovacao",
                  bloqueadoEdicao: false,
                  solicitadoEm: new Date().toISOString(),
                }
              : selectedLead.stageId === "fechado" && !selectedLead.financeiroFluxo?.bloqueadoEdicao
                ? clearFinanceiroFluxoPendente(selectedLead)
              : selectedLead.financeiroFluxo,
          interactions:
            stageId === "perdido" && options?.motivoPerda?.trim()
              ? [
                  ...(selectedLead.interactions ?? []),
                  createSystemLog(
                    { nome: currentUserName, userId: session.userId },
                    `Lead marcado como Perdido. Motivo: ${options.motivoPerda.trim()}`
                  ),
                ]
              : selectedLead.interactions,
        },
        { nome: currentUserName, userId: session.userId }
      );
      clearComercialPendingBadgeIfLeftProspecao(String(selectedLeadId), selectedLead.stageId, stageId);
      setColumns((prev) => {
        const sid = String(selectedLeadId);
        const next: ColumnsState = {
          prospecao: (prev.prospecao ?? []).filter((l) => String(l.id) !== sid),
          qualificacao: (prev.qualificacao ?? []).filter((l) => String(l.id) !== sid),
          proposta: (prev.proposta ?? []).filter((l) => String(l.id) !== sid),
          contratacao: (prev.contratacao ?? []).filter((l) => String(l.id) !== sid),
          fechado: (prev.fechado ?? []).filter((l) => String(l.id) !== sid),
          perdido: (prev.perdido ?? []).filter((l) => String(l.id) !== sid),
        };
        next[stageId] = [...(next[stageId] ?? []), updated];
        return next;
      });
      scheduleLeadCardPulse(String(selectedLeadId));
      void persistLead(updated).catch(() => {
        void rollbackFromServer();
        showErrorToast("Não foi possível salvar a etapa. Os dados foram recarregados.");
      });
      if (stageId === "fechado") {
        const valorTotal = updated.valorTotal ?? updated.value;
        setFechadoCelebration({ show: true, valorTotal });
      } else {
        setToastSave({ visible: true, message: "Etapa atualizada com sucesso!" });
      }
    },
    [
      selectedLeadId,
      selectedLead,
      currentUserName,
      session.userId,
      persistLead,
      rollbackFromServer,
      showErrorToast,
      scheduleLeadCardPulse,
      clearComercialPendingBadgeIfLeftProspecao,
      podeEditarLead,
    ]
  );

  /** Move o lead para a coluna Qualificação e aplica updates (ex.: clienteId) */
  const moveLeadToQualificacao = useCallback((leadId: string, updates: Partial<Lead> = {}) => {
    let updatedPersist: Lead | null = null;
    let movedFromStage: PipelineStageId | null = null;
    setColumns((prev) => {
      let originalLead: Lead | null = null;
      let updatedLead: Lead | null = null;
      const stageIds: PipelineStageId[] = ["prospecao", "qualificacao", "proposta", "contratacao", "fechado", "perdido"];
      const next: ColumnsState = {
        prospecao: [],
        qualificacao: [...(prev.qualificacao ?? [])],
        proposta: [],
        contratacao: [],
        fechado: [],
        perdido: [],
      };
      for (const id of stageIds) {
        const list = prev[id] ?? [];
        for (const lead of list) {
          if (String(lead.id) === String(leadId)) {
            originalLead = lead;
            const qNow = new Date().toISOString();
            const clienteLog =
              updates.clienteId &&
              String(updates.clienteId) !== String(lead.clienteId ?? "") &&
              updates.clienteId
                ? [
                    createSystemLog(
                      { nome: currentUserName, userId: session.userId },
                      "Cliente vinculado à oportunidade ao avançar para Qualificação."
                    ),
                  ]
                : [];
            updatedLead = {
              ...lead,
              ...updates,
              stageId: "qualificacao",
              enteredStageAt: qNow,
              registroAtualizadoEm: qNow,
              interactions: [...(lead.interactions ?? []), ...clienteLog],
            };
          } else {
            next[id].push(lead);
          }
        }
      }
      if (originalLead && updatedLead) {
        movedFromStage = originalLead.stageId;
        const audited = withAudit(originalLead, updatedLead, {
          nome: currentUserName,
          userId: session.userId,
        });
        updatedPersist = { ...audited, registroAtualizadoEm: updatedLead.registroAtualizadoEm };
        next.qualificacao.push(updatedPersist);
      }
      return next;
    });
    if (movedFromStage != null) {
      clearComercialPendingBadgeIfLeftProspecao(leadId, movedFromStage, "qualificacao");
    }
    if (updatedPersist) {
      scheduleLeadCardPulse(leadId);
      void persistLead(updatedPersist).catch(() => {
        void rollbackFromServer();
        showErrorToast("Não foi possível mover para Qualificação. Os dados foram recarregados.");
      });
    }
    setLeadToQualifyId(null);
  }, [
    currentUserName,
    session.userId,
    persistLead,
    rollbackFromServer,
    showErrorToast,
    scheduleLeadCardPulse,
    clearComercialPendingBadgeIfLeftProspecao,
  ]);

  const handleQualificarComExistente = useCallback((leadId: string, clienteId: string) => {
    moveLeadToQualificacao(leadId, { clienteId });
  }, [moveLeadToQualificacao]);

  const handleQualificarComNovo = useCallback(
    (leadId: string, cliente: Omit<Cliente, "id">, contatos: Contato[]) => {
      void (async () => {
        try {
          const savedCliente = await createCliente({ ...cliente, contatos });
          setClientes((prev) => [...prev, savedCliente]);
          moveLeadToQualificacao(leadId, { clienteId: savedCliente.id });
        } catch {
          showErrorToast("Não foi possível cadastrar cliente no banco.");
        }
      })();
    },
    [moveLeadToQualificacao, createCliente, showErrorToast]
  );

  /** Só adiciona cliente ao catálogo quando cadastrado no modal (persistência do lead é no Salvar). */
  const handleClienteRegistrado = useCallback(
    (novo: Cliente) => {
      if (clientes.some((c) => c.id === novo.id)) return;
      if (novo.id.startsWith("cli-local")) {
        void (async () => {
          try {
            const saved = await createCliente({ ...novo, contatos: novo.contatos });
            setClientes((prev) => (prev.some((c) => c.id === saved.id) ? prev : [...prev, saved]));
            if (selectedLeadId && selectedLead?.clienteId === novo.id) {
              handleUpdateLead({ clienteId: saved.id }, { skipSuccessToast: true });
            }
          } catch {
            showErrorToast("Cliente criado localmente, mas falhou ao persistir no banco.");
            setClientes((prev) => [...prev, novo]);
          }
        })();
        return;
      }
      setClientes((prev) => (prev.some((c) => c.id === novo.id) ? prev : [...prev, novo]));
    },
    [clientes, createCliente, selectedLeadId, selectedLead?.clienteId, handleUpdateLead, showErrorToast]
  );

  const handleAtualizarContatosCliente = useCallback((clienteId: string, contatos: Contato[]) => {
    setClientes((prev) =>
      prev.map((c) => (c.id === clienteId ? { ...c, contatos } : c))
    );
    void persistClienteContatos(clienteId, contatos).catch(() => {
      showErrorToast("Contatos atualizados na tela, mas falhou ao salvar no banco.");
    });
  }, [persistClienteContatos, showErrorToast]);

  const handleSolicitarLiberacaoFinanceiro = useCallback(
    (motivo: string) => {
      if (!selectedLeadId || !selectedLead) return;
      if (!motivo.trim()) {
        showErrorToast("Informe o motivo para solicitar liberação ao Financeiro.");
        return;
      }
      handleUpdateLead(
        {
          financeiroFluxo: {
            ...(selectedLead.financeiroFluxo ?? { status: "nenhum", bloqueadoEdicao: false }),
            liberacaoSolicitadaEm: new Date().toISOString(),
            motivoSolicitacaoLiberacao: motivo.trim(),
          },
          interactions: [
            ...(selectedLead.interactions ?? []),
            createSystemLog(
              { nome: currentUserName, userId: session.userId },
              `Comercial solicitou liberação ao Financeiro. Motivo: ${motivo.trim()}`
            ),
          ],
        },
        { allowWhileFinanceiroLocked: true }
      );
      setToastSave({ visible: true, message: "Solicitação de liberação enviada ao Financeiro." });
    },
    [selectedLeadId, selectedLead, handleUpdateLead, currentUserName, session.userId, showErrorToast]
  );

  if (!podeVerComercial) return null;

  return (
    <section className="w-full min-w-0 space-y-6">
      <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end sm:gap-3">
        <TabsView value={viewMode} onChange={setViewMode} />
      </div>

      {viewMode === "kanban" ? (
        <div className="w-full min-w-0 max-w-full overflow-x-visible">
          <ComercialKanban
            columns={columns}
            clientes={clientes}
            onDragEnd={onDragEnd}
            selectedLeadId={selectedLeadId}
            onSelectLead={openDetail}
            isLoading={loading}
            pendingLeadCountById={pendingLeadCountById}
            pendingStageCountById={pendingStageCountById}
            pulsingLeadIds={pulsingLeadIds}
            dragEnabled={podeEditarLead}
          />
        </div>
      ) : (
        <div className="w-full min-w-0 max-w-full">
          <LeadList
            leads={leads}
            clientes={clientes}
            stages={PIPELINE_STAGES}
            selectedLeadId={selectedLeadId}
            onSelectLead={openDetail}
            isLoading={loading}
            pulsingLeadIds={pulsingLeadIds}
          />
        </div>
      )}

      <LeadDetailPanel
        lead={selectedLead}
        stages={PIPELINE_STAGES}
        open={detailOpen}
        onClose={closeDetail}
        onUpdateLead={handleUpdateLead}
        onMudarEtapa={handleMudarEtapa}
        onGerarPdfSuccess={() =>
          setToastPdfSuccess({ visible: true, message: "Proposta PDF gerada com sucesso!" })
        }
        clientes={clientes}
        onClienteRegistrado={handleClienteRegistrado}
        onAtualizarContatosCliente={handleAtualizarContatosCliente}
        onSolicitarLiberacaoFinanceiro={handleSolicitarLiberacaoFinanceiro}
        usuarios={usuarios}
        readOnly={!podeEditarLead}
      />

      <NovoLeadPanel
        open={novoLeadOpen}
        onClose={() => setNovoLeadOpen(false)}
        onSubmit={handleNovoLeadSubmit}
      />

      <QualificarOportunidadeSheet
        open={!!leadToQualifyId}
        onClose={() => setLeadToQualifyId(null)}
        lead={leadToQualify}
        clientes={clientes}
        onVincularExistente={handleQualificarComExistente}
        onCadastrarEVincular={handleQualificarComNovo}
      />

      {kanbanPerdaModal ? (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/40 px-4"
          onMouseDown={() => {
            setKanbanPerdaModal(null);
            setKanbanMotivoPerda("");
            setToastSave({
              visible: true,
              message: "Movimentação para Perdido cancelada.",
              duration: 4500,
            });
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-5 shadow-2xl dark:border-red-500/40 dark:bg-slate-900"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600 dark:text-red-400" />
              <div>
                <h3 className="text-base font-semibold text-red-700 dark:text-red-300">
                  Motivo da perda
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Informe o motivo para mover <strong>{kanbanPerdaModal.leadName}</strong> para
                  Perdido.
                </p>
              </div>
            </div>

            <textarea
              value={kanbanMotivoPerda}
              onChange={(e) => setKanbanMotivoPerda(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-0 transition focus:border-red-300 focus:ring-2 focus:ring-red-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-red-400 dark:focus:ring-red-900/40"
              placeholder="Descreva o motivo da perda..."
            />

            <div className="mt-4 flex flex-col-reverse gap-2 border-t border-slate-200 pt-3 dark:border-slate-700 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  setKanbanPerdaModal(null);
                  setKanbanMotivoPerda("");
                  setToastSave({
                    visible: true,
                    message: "Movimentação para Perdido cancelada.",
                    duration: 4500,
                  });
                }}
                className={formModalCancelButtonClass}
              >
                <span className="inline-flex items-center gap-2">
                  <X className="h-4 w-4" />
                  Cancelar
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!kanbanMotivoPerda.trim()) {
                    showErrorToast("Informe o motivo da perda para mover para Perdido.");
                    return;
                  }
                  applyKanbanMove({
                    sourceId: kanbanPerdaModal.sourceId,
                    destId: kanbanPerdaModal.destId,
                    sourceIndex: kanbanPerdaModal.sourceIndex,
                    destIndex: kanbanPerdaModal.destIndex,
                    leadId: kanbanPerdaModal.leadId,
                    motivoPerda: kanbanMotivoPerda.trim(),
                  });
                  setKanbanPerdaModal(null);
                  setKanbanMotivoPerda("");
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                <span className="inline-flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Marcar como Perdido
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Toast
        message={toastError.message}
        visible={toastError.visible}
        onDismiss={() => setToastError((e) => ({ ...e, visible: false }))}
        variant="error"
        duration={toastError.duration > 0 ? toastError.duration : 12000}
        closeButton
      />
      <Toast
        message={toastPdfSuccess.message}
        visible={toastPdfSuccess.visible}
        onDismiss={() => setToastPdfSuccess((t) => ({ ...t, visible: false }))}
        variant="success"
        duration={4000}
      />
      <Toast
        message={toastSave.message}
        visible={toastSave.visible}
        onDismiss={() => setToastSave((t) => ({ ...t, visible: false }))}
        variant="success"
        duration={toastSave.duration ?? 2500}
      />
      <FechadoCelebrationModal
        open={fechadoCelebration.show}
        valorTotal={fechadoCelebration.valorTotal}
        onClose={() => setFechadoCelebration((c) => ({ ...c, show: false }))}
      />
    </section>
  );
}

export default function ComercialPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-slate-500 dark:text-slate-400">
          Carregando Comercial…
        </div>
      }
    >
      <ComercialPageContent />
    </Suspense>
  );
}
