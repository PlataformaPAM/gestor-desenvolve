"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import { TabsView, type ViewMode } from "@/components/comercial/tabs-view";
import { OperacaoViews } from "@/components/ui/operacao-views";
import { TarefasKanban } from "@/components/tarefas/tarefas-kanban";
import { TarefasTable } from "@/components/tarefas/tarefas-table";
import { TarefaDetalheDrawer, type TarefaSalvarPayload } from "@/components/tarefas/tarefa-detalhe-drawer";
import { NovaTarefaForm } from "@/components/tarefas/nova-tarefa-form";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Toast } from "@/components/ui/toast";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { formLabelClass, formModalCancelButtonClass } from "@/components/ui/field-patterns";
import { usePageHeader } from "@/contexts/page-header-context";
import {
  isTarefaNaVisaoAbertos,
  isTarefaNaVisaoArquivados,
  isTarefaNaVisaoFechadas,
  sortTarefasPorDataDesc,
} from "@/lib/tarefas/arquivamento";
import type { Tarefa, StatusTarefa, PrioridadeTarefa, UsuarioTarefa, SolucaoTarefa } from "@/lib/tarefas/types";
import { buildAnexoItens, mergeTarefaPreservandoAnexos, uploadTarefaAnexos } from "@/lib/tarefas/anexos";
import {
  STATUS_LABELS,
  PRIORIDADE_LABELS,
  TAREFA_STATUS_FECHADOS,
} from "@/lib/tarefas/constants";
import {
  getSituacaoOperacional,
  sortByPriorizacao,
  type OperacaoViewId,
} from "@/lib/operacao/priorizacao";
import { useAuth } from "@/contexts/auth-context";
import { useResourcePageGuard, useResourceRbac } from "@/hooks/use-rbac-resource";

const TAREFAS_RESOURCE = "tarefas.internas";
import type { Cliente } from "@/lib/clientes/types";
import type { DropResult } from "@hello-pangea/dnd";
import { User, AlertTriangle, X } from "lucide-react";
import {
  iconForPrioridade,
  iconForStatus,
  PRIORIDADE_LEADING_ICON,
  STATUS_LEADING_ICON,
} from "@/lib/tarefas/option-icons";

function generateId(): string {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDataHoraBr(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatClienteResumo(
  clienteIds: string[],
  clientes: Pick<Cliente, "id" | "nome" | "empresa">[]
): string | undefined {
  const ids = Array.from(new Set(clienteIds.filter(Boolean)));
  if (ids.length === 0) return undefined;
  const nomes = ids
    .map((id) => {
      const c = clientes.find((x) => x.id === id);
      return c ? (c.empresa?.trim() || c.nome || "") : "";
    })
    .filter(Boolean);
  if (nomes.length === 0) return undefined;
  if (clientes.length > 0 && ids.length === clientes.length) return "Todos os Clientes";
  if (nomes.length === 1) return nomes[0];
  return `${nomes[0]} e mais ${nomes.length - 1} cliente${nomes.length - 1 > 1 ? "s" : ""}`;
}

const STATUS_OPTIONS: { value: "" | StatusTarefa; label: string }[] = [
  { value: "", label: "Todos" },
  ...(Object.entries(STATUS_LABELS) as [StatusTarefa, string][]).map(([v, l]) => ({ value: v as "" | StatusTarefa, label: l })),
];

const PRIORIDADE_OPTIONS: { value: "" | PrioridadeTarefa; label: string }[] = [
  { value: "", label: "Todas" },
  ...(Object.entries(PRIORIDADE_LABELS) as [PrioridadeTarefa, string][]).map(([v, l]) => ({ value: v as "" | PrioridadeTarefa, label: l })),
];
const OPERACAO_VIEW_STORAGE_KEY = "operacao_view_tarefas";

const TAREFAS_VIEW_TOOLTIPS: Partial<Record<OperacaoViewId, string>> = {
  abertos:
    "Todas as tarefas em qualquer etapa, exceto concluídas de meses anteriores (que ficam em Arquivados).",
  minha_fila: "Tarefas em aberto em que você é responsável ou colaborador.",
  urgentes: "Tarefas em aberto com prioridade urgente.",
  atrasados: "Tarefas em aberto com prazo final já vencido.",
  vence_logo: "Tarefas em aberto com prazo nos próximos dias.",
  fechados: "Tarefas concluídas no mês atual e tarefas canceladas.",
  arquivados:
    "Tarefas concluídas em meses anteriores. Ao virar o mês, as concluídas saem de Fechadas e vêm para cá.",
};

export default function TarefasPage() {
  const { setPrimaryAction } = usePageHeader();
  const { session } = useAuth();
  const podeVer = useResourcePageGuard(TAREFAS_RESOURCE);
  const rbac = useResourceRbac(TAREFAS_RESOURCE);
  const podeCriarTarefa = rbac.podeCriar;
  const podeEditarTarefa = rbac.podeEditar;
  const podeExcluirTarefa = rbac.podeExcluir;
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioTarefa[]>([]);
  const [solucoes, setSolucoes] = useState<SolucaoTarefa[]>([]);
  const [clientes, setClientes] = useState<Pick<Cliente, "id" | "nome" | "empresa">[]>([]);
  const [operacaoView, setOperacaoView] = useState<OperacaoViewId>("abertos");
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [statusFilter, setStatusFilter] = useState<"" | StatusTarefa>("");
  const [prioridadeFilter, setPrioridadeFilter] = useState<"" | PrioridadeTarefa>("");
  const [responsavelFilter, setResponsavelFilter] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedTarefa, setSelectedTarefa] = useState<Tarefa | null>(null);
  const [tarefaToDelete, setTarefaToDelete] = useState<Tarefa | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; variant: "success" | "error" }>({
    visible: false,
    message: "",
    variant: "success",
  });
  const [kanbanCanceladoModal, setKanbanCanceladoModal] = useState<{
    sourceStatus: StatusTarefa;
    destStatus: StatusTarefa;
    tarefaId: string;
    tarefaTitulo: string;
  } | null>(null);
  const [kanbanMotivoCancelado, setKanbanMotivoCancelado] = useState("");

  const showToast = useCallback((message: string, variant: "success" | "error" = "success") => {
    setToast({ visible: false, message: "", variant });
    window.requestAnimationFrame(() => setToast({ visible: true, message, variant }));
  }, []);

  const saveTarefa = useCallback(async (tarefa: Tarefa, isCreate = false): Promise<Tarefa> => {
    const url = isCreate ? "/api/tarefas" : `/api/tarefas/${tarefa.id}`;
    const method = isCreate ? "POST" : "PATCH";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tarefa }),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      tarefa?: Tarefa;
      data?: { tarefa?: Tarefa };
      error?: { message?: string };
    };
    if (!res.ok) {
      throw new Error(payload?.error?.message || "Falha ao persistir tarefa");
    }
    const saved = payload?.tarefa ?? payload?.data?.tarefa;
    if (!saved) throw new Error("Resposta inválida ao persistir tarefa");
    return saved;
  }, []);

  const persistTarefa = useCallback(
    async (
      tarefa: Tarefa,
      options?: { isCreate?: boolean; novosArquivos?: File[]; previous?: Tarefa | null }
    ): Promise<Tarefa> => {
      const novos = options?.novosArquivos ?? [];
      const isCreate = options?.isCreate ?? false;
      let working = tarefa;

      if (isCreate) {
        const created = await saveTarefa(working, true);
        working = mergeTarefaPreservandoAnexos(created, working);
        if (!novos.length) return working;

        const uploaded = await uploadTarefaAnexos(working.id, novos);
        const anexos = Array.from(
          new Set([...(working.anexos ?? []), ...novos.map((file) => file.name)])
        );
        working = {
          ...working,
          anexos,
          anexoItens: buildAnexoItens(anexos, working.id, uploaded.anexoItens, working.anexoItens),
          arquivos: novos,
        };
        const savedAgain = await saveTarefa(working, false);
        return mergeTarefaPreservandoAnexos(savedAgain, working);
      }

      if (novos.length > 0) {
        const uploaded = await uploadTarefaAnexos(working.id, novos);
        const anexos = Array.from(
          new Set([...(working.anexos ?? []), ...novos.map((file) => file.name)])
        );
        working = {
          ...working,
          anexos,
          anexoItens: buildAnexoItens(anexos, working.id, uploaded.anexoItens, working.anexoItens),
          arquivos: novos,
        };
      }

      const saved = await saveTarefa(working, false);
      return mergeTarefaPreservandoAnexos(saved, options?.previous ?? working);
    },
    [saveTarefa]
  );

  const deleteTarefa = useCallback(async (tarefaId: string) => {
    const res = await fetch(`/api/tarefas/${tarefaId}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Falha ao excluir tarefa");
  }, []);

  const usuariosMap = useMemo(() => {
    const m = new Map<string, UsuarioTarefa>();
    usuarios.forEach((u) => m.set(u.id, u));
    return m;
  }, [usuarios]);

  const usuarioAtualId = session.userId ?? "";
  /** Quem registra edições/comentários no app. */
  const autorEdicao = useMemo(() => {
    const u = usuarioAtualId ? usuariosMap.get(usuarioAtualId) : undefined;
    return { id: usuarioAtualId || "usuario-atual", nome: session.userName ?? u?.nome ?? "Usuário" };
  }, [session.userName, usuarioAtualId, usuariosMap]);

  const RESPONSAVEL_OPTIONS: { value: string; label: string }[] = useMemo(
    () => [{ value: "", label: "Todos" }, ...usuarios.map((u) => ({ value: u.id, label: u.nome }))],
    [usuarios]
  );
  const statusFilterOptions: SearchableOption[] = useMemo(
    () =>
      STATUS_OPTIONS.map((o) => ({
        value: o.value,
        label: o.label,
        icon: o.value ? iconForStatus(o.value) : STATUS_LEADING_ICON,
      })),
    []
  );
  const prioridadeFilterOptions: SearchableOption[] = useMemo(
    () =>
      PRIORIDADE_OPTIONS.map((o) => ({
        value: o.value,
        label: o.label,
        icon: o.value ? iconForPrioridade(o.value) : PRIORIDADE_LEADING_ICON,
      })),
    []
  );
  const responsavelFilterOptions: SearchableOption[] = useMemo(
    () => RESPONSAVEL_OPTIONS.map((o) => ({ value: o.value, label: o.label, icon: User })),
    [RESPONSAVEL_OPTIONS]
  );

  useEffect(() => {
    if (!podeCriarTarefa) {
      setPrimaryAction(null);
      return;
    }
    setPrimaryAction({
      label: "Nova Tarefa",
      onClick: () => {
        setSelectedTarefa(null);
        setIsSheetOpen(true);
      },
      showPlusIcon: true,
    });
    return () => setPrimaryAction(null);
  }, [setPrimaryAction, podeCriarTarefa]);

  useEffect(() => {
    const saved = window.localStorage.getItem(OPERACAO_VIEW_STORAGE_KEY) as OperacaoViewId | null;
    if (!saved) return;
    if (["minha_fila", "abertos", "urgentes", "atrasados", "vence_logo", "fechados", "arquivados"].includes(saved)) {
      setOperacaoView(saved);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(OPERACAO_VIEW_STORAGE_KEY, operacaoView);
  }, [operacaoView]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/tarefas/bootstrap", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          data?: { tarefas?: Tarefa[]; usuarios?: UsuarioTarefa[]; solucoes?: SolucaoTarefa[] };
        };
        if (!active) return;
        setTarefas(data?.data?.tarefas ?? []);
        setUsuarios(data?.data?.usuarios ?? []);
        setSolucoes(data?.data?.solucoes ?? []);
      } catch {
        // keep UI resilient
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/clientes/bootstrap", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { data?: { clientes?: Cliente[] } };
        if (!active) return;
        const opts = (data?.data?.clientes ?? []).map((c) => ({
          id: c.id,
          nome: c.nome,
          empresa: c.empresa,
        }));
        setClientes(opts);
      } catch {
        // keep UI resilient
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const tarefasOperacionais = useMemo(() => {
    const aplicarResumoClientes = (lista: Tarefa[]) =>
      lista.map((t) => ({
        ...t,
        clienteNome:
          formatClienteResumo(
            t.clienteIds?.length ? t.clienteIds : ([t.clienteId].filter(Boolean) as string[]),
            clientes
          ) ?? t.clienteNome,
      }));
    const now = new Date();
    const isMinhaTarefa = (t: Tarefa) =>
      usuarioAtualId
        ? t.responsavel.id === usuarioAtualId || (t.colaboradores ?? []).some((c) => c.id === usuarioAtualId)
        : false;
    let base: Tarefa[] = [];
    if (operacaoView === "arquivados") {
      return aplicarResumoClientes(
        tarefas.filter((t) => isTarefaNaVisaoArquivados(t, now))
      ).sort(sortTarefasPorDataDesc);
    }
    if (operacaoView === "fechados") {
      return aplicarResumoClientes(
        tarefas.filter((t) => isTarefaNaVisaoFechadas(t, now))
      ).sort(sortTarefasPorDataDesc);
    }
    if (operacaoView === "minha_fila") {
      base = tarefas.filter((t) => isTarefaNaVisaoAbertos(t, now) && isMinhaTarefa(t));
    } else if (operacaoView === "abertos") {
      base = tarefas.filter((t) => isTarefaNaVisaoAbertos(t, now));
    } else if (operacaoView === "urgentes") {
      base = tarefas.filter((t) => isTarefaNaVisaoAbertos(t, now) && t.prioridade === "urgente");
    } else if (operacaoView === "atrasados") {
      base = tarefas.filter(
        (t) => isTarefaNaVisaoAbertos(t, now) && getSituacaoOperacional(t.dataFim, now) === "atrasado"
      );
    } else {
      base = tarefas.filter(
        (t) => isTarefaNaVisaoAbertos(t, now) && getSituacaoOperacional(t.dataFim, now) === "vence_logo"
      );
    }
    return aplicarResumoClientes(sortByPriorizacao(base, {
      prioridade: (t) => t.prioridade,
      vencimentoIso: (t) => t.dataFim,
      atualizadoIso: (t) => t.updatedAt ?? t.dataInicio,
      now,
    }));
  }, [tarefas, operacaoView, clientes, usuarioAtualId]);

  const tarefasFiltradas = useMemo(() => {
    const visaoComStatusLivre =
      operacaoView === "fechados" || operacaoView === "arquivados" || operacaoView === "abertos";
    const visaoComResponsavelLivre = operacaoView === "abertos";
    return tarefasOperacionais.filter((t) => {
      if (!visaoComStatusLivre && statusFilter && t.status !== statusFilter) return false;
      if (prioridadeFilter && t.prioridade !== prioridadeFilter) return false;
      if (!visaoComResponsavelLivre && responsavelFilter && t.responsavel.id !== responsavelFilter) return false;
      return true;
    });
  }, [tarefasOperacionais, statusFilter, prioridadeFilter, responsavelFilter, operacaoView]);

  const handleNovaTarefa = useCallback((nova: Omit<Tarefa, "id"> & { clienteIds?: string[] }) => {
    const nowIso = new Date().toISOString();
    const createdBy = session.userName ?? (usuarioAtualId ? usuariosMap.get(usuarioAtualId)?.nome : undefined) ?? "Usuário";
    const clienteIds = Array.from(
      new Set((nova.clienteIds?.length ? nova.clienteIds : [nova.clienteId]).filter(Boolean) as string[])
    );
    const solucaoIds = Array.from(new Set((nova.solucaoIds ?? []).filter(Boolean)));
    const clienteNome = formatClienteResumo(clienteIds, clientes);
    const created: Tarefa = {
      ...nova,
      id: generateId(),
      clienteId: clienteIds[0] || undefined,
      clienteIds,
      clienteNome,
      solucaoIds,
      solucoes: solucoes.filter((s) => solucaoIds.includes(s.id)),
      registroCriadoPorNome: createdBy,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setTarefas((prev) => [...prev, created]);
    void persistTarefa(created, {
      isCreate: true,
      novosArquivos: created.arquivos ?? [],
      previous: created,
    })
      .then((merged) => {
        setTarefas((prev) => prev.map((t) => (t.id === created.id ? merged : t)));
        // Garante visibilidade imediata da tarefa recém-criada (independente da visão/filtros anteriores).
        setOperacaoView("abertos");
        setStatusFilter("");
        setPrioridadeFilter("");
        setResponsavelFilter("");
        showToast("Tarefa interna salva com sucesso.", "success");
      })
      .catch((error) => {
        // Evita “fantasma” no Kanban/lista quando o backend falha.
        setTarefas((prev) => prev.filter((t) => t.id !== created.id));
        showToast(error instanceof Error ? error.message : "Falha ao salvar a tarefa interna.", "error");
      });
    setIsSheetOpen(false);
    setSelectedTarefa(null);
  }, [persistTarefa, usuariosMap, clientes, solucoes, session.userName, usuarioAtualId, showToast]);

  const handleCloseSheet = useCallback(() => {
    setIsSheetOpen(false);
    setSelectedTarefa(null);
  }, []);

  const abrirTarefa = useCallback((t: Tarefa) => {
    setSelectedTarefa(t);
    setIsSheetOpen(true);
  }, []);

  const applyKanbanMove = useCallback(
    (params: {
      sourceStatus: StatusTarefa;
      destStatus: StatusTarefa;
      tarefaId: string;
      motivoCancelado?: string;
    }) => {
      const { sourceStatus, destStatus, tarefaId, motivoCancelado } = params;
      const historicoBase = {
        id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        data: new Date().toISOString(),
        autor: autorEdicao.nome,
        autorId: autorEdicao.id,
      };
      const historicoEntry =
        destStatus === "cancelado" && motivoCancelado?.trim()
          ? {
              ...historicoBase,
              acao: `Tarefa marcada como Cancelada. Motivo: ${motivoCancelado.trim()}`,
            }
          : {
              ...historicoBase,
              acao: `Status alterado de ${STATUS_LABELS[sourceStatus]} para ${STATUS_LABELS[destStatus]} via Kanban`,
            };
      let updatedForPersist: Tarefa | null = null;
      let previousForRollback: Tarefa | null = null;
      setTarefas((prev) =>
        prev.map((t) => {
          if (t.id !== tarefaId) return t;
          previousForRollback = t;
          const next = {
            ...t,
            status: destStatus,
            updatedAt: new Date().toISOString(),
            historico: [...t.historico, historicoEntry],
          };
          updatedForPersist = next;
          return next;
        })
      );
      setSelectedTarefa((t) => {
        if (t?.id !== tarefaId) return t;
        return {
          ...t,
          status: destStatus,
          historico: [...t.historico, historicoEntry],
        };
      });
      if (updatedForPersist) {
        void persistTarefa(updatedForPersist, { previous: updatedForPersist })
          .then((merged) => {
            setTarefas((prev) => prev.map((t) => (t.id === merged.id ? merged : t)));
            setSelectedTarefa((prev) => (prev?.id === merged.id ? merged : prev));
            if (TAREFA_STATUS_FECHADOS.includes(destStatus) && operacaoView !== "fechados") {
              setOperacaoView("fechados");
              setStatusFilter("");
              showToast(
                destStatus === "cancelado"
                  ? "Tarefa cancelada e exibida na visão Fechados."
                  : "Tarefa concluída e exibida na visão Fechados.",
                "success"
              );
            }
          })
          .catch((error) => {
            if (!previousForRollback) return;
            setTarefas((prev) =>
              prev.map((t) => (t.id === previousForRollback!.id ? previousForRollback! : t))
            );
            setSelectedTarefa((prev) =>
              prev?.id === previousForRollback!.id ? previousForRollback : prev
            );
            showToast(error instanceof Error ? error.message : "Falha ao mover tarefa.", "error");
          });
      }
    },
    [persistTarefa, autorEdicao, showToast, operacaoView]
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;
      const sourceStatus = result.source.droppableId as StatusTarefa;
      const destStatus = result.destination.droppableId as StatusTarefa;
      if (sourceStatus === destStatus) return;
      const tarefaId = result.draggableId;
      const tarefa = tarefas.find((t) => t.id === tarefaId);

      if (sourceStatus !== destStatus && destStatus === "cancelado" && sourceStatus !== "cancelado") {
        setKanbanCanceladoModal({
          sourceStatus,
          destStatus,
          tarefaId,
          tarefaTitulo: tarefa?.titulo ?? "Tarefa",
        });
        setKanbanMotivoCancelado("");
        showToast(
          "O cartão volta à coluna de origem até você confirmar. Preencha o motivo do cancelamento na janela para concluir o envio para Cancelado.",
          "success"
        );
        return;
      }

      applyKanbanMove({ sourceStatus, destStatus, tarefaId });
    },
    [tarefas, applyKanbanMove, showToast]
  );

  const handleSalvarTarefa = useCallback(
    (tarefaId: string, payload: TarefaSalvarPayload) => {
      const responsavel = usuariosMap.get(payload.responsavelId);
      if (!responsavel) return;
      const colaboradores = payload.colaboradorIds
        .filter((id) => id !== payload.responsavelId)
        .map((id) => usuariosMap.get(id))
        .filter(Boolean) as UsuarioTarefa[];

      const current = selectedTarefa?.id === tarefaId ? selectedTarefa : tarefas.find((t) => t.id === tarefaId);
      if (!current) return;

      const entries: {
        id: string;
        data: string;
        acao: string;
        autor?: string;
        autorId?: string;
        anexos?: string[];
      }[] = [];
      const autor = autorEdicao.nome;
      const autorId = autorEdicao.id;
      const now = new Date().toISOString();

      if (current.titulo.trim() !== payload.titulo.trim()) {
        entries.push({
          id: `h-${Date.now()}-ti`,
          data: now,
          acao: `Título alterado de "${current.titulo}" para "${payload.titulo.trim()}"`,
          autor,
          autorId,
        });
      }
      const currDesc = (current.descricao ?? "").trim();
      const nextDesc = (payload.descricao ?? "").trim();
      if (currDesc !== nextDesc) {
        entries.push({
          id: `h-${Date.now()}-de`,
          data: now,
          acao: "Descrição da tarefa atualizada",
          autor,
          autorId,
        });
      }
      if ((current.categoria ?? "") !== (payload.categoria ?? "")) {
        entries.push({
          id: `h-${Date.now()}-ca`,
          data: now,
          acao: `Categoria alterada de ${current.categoria || "Sem categoria"} para ${payload.categoria || "Sem categoria"}`,
          autor,
          autorId,
        });
      }
      if (current.status !== payload.status) {
        entries.push({
          id: `h-${Date.now()}-s`,
          data: now,
          acao: `Status alterado de ${STATUS_LABELS[current.status]} para ${STATUS_LABELS[payload.status]}`,
          autor,
          autorId,
        });
      }
      if (current.prioridade !== payload.prioridade) {
        entries.push({
          id: `h-${Date.now()}-p`,
          data: now,
          acao: `Prioridade alterada de ${PRIORIDADE_LABELS[current.prioridade]} para ${PRIORIDADE_LABELS[payload.prioridade]}`,
          autor,
          autorId,
        });
      }
      if (current.responsavel.id !== payload.responsavelId) {
        entries.push({
          id: `h-${Date.now()}-r`,
          data: now,
          acao: `Responsável alterado de ${current.responsavel.nome} para ${responsavel.nome}`,
          autor,
          autorId,
        });
      }
      if (current.dataInicio !== payload.dataInicio) {
        entries.push({
          id: `h-${Date.now()}-di`,
          data: now,
          acao: `Data de início alterada de ${formatDataHoraBr(current.dataInicio)} para ${formatDataHoraBr(payload.dataInicio)}`,
          autor,
          autorId,
        });
      }
      if (current.dataFim !== payload.dataFim) {
        entries.push({
          id: `h-${Date.now()}-df`,
          data: now,
          acao: `Prazo final alterado de ${formatDataHoraBr(current.dataFim)} para ${formatDataHoraBr(payload.dataFim)}`,
          autor,
          autorId,
        });
      }
      const currentClienteIds = [...(current.clienteIds?.length ? current.clienteIds : [current.clienteId].filter(Boolean) as string[])].sort().join(",");
      const nextClienteIds = [...(payload.clienteIds?.length ? payload.clienteIds : [payload.clienteId].filter(Boolean) as string[])].sort().join(",");
      if (currentClienteIds !== nextClienteIds) {
        const clienteAnterior = current.clienteNome?.trim() || "Nenhum";
        const clienteNovo =
          formatClienteResumo(
            payload.clienteIds?.length
              ? payload.clienteIds
              : ([payload.clienteId].filter(Boolean) as string[]),
            clientes
          ) || "Nenhum";
        entries.push({
          id: `h-${Date.now()}-cl`,
          data: now,
          acao: `Cliente vinculado alterado de ${clienteAnterior} para ${clienteNovo}`,
          autor,
          autorId,
        });
      }
      const currentSolIds = [...(current.solucaoIds?.length ? current.solucaoIds : [current.solucaoId].filter(Boolean) as string[])].sort().join(",");
      const nextSolIds = [...(payload.solucaoIds ?? [])].sort().join(",");
      if (currentSolIds !== nextSolIds) {
        const nomesAnteriores =
          (current.solucoes ?? []).map((s) => s.nome).join(", ") ||
          solucoes
            .filter((s) => (current.solucaoIds ?? []).includes(s.id))
            .map((s) => s.nome)
            .join(", ") ||
          "Nenhuma";
        const nomesNovos =
          solucoes
            .filter((s) => (payload.solucaoIds ?? []).includes(s.id))
            .map((s) => s.nome)
            .join(", ") || "Nenhuma";
        entries.push({
          id: `h-${Date.now()}-so`,
          data: now,
          acao: `Soluções vinculadas alteradas de ${nomesAnteriores} para ${nomesNovos}`,
          autor,
          autorId,
        });
      }
      const currentColIds = (current.colaboradores ?? []).map((c) => c.id).sort().join(",");
      const newColIds = [...payload.colaboradorIds].filter((id) => id !== payload.responsavelId).sort().join(",");
      if (currentColIds !== newColIds) {
        const nomes = colaboradores.map((c) => c.nome).join(", ") || "Nenhum";
        entries.push({
          id: `h-${Date.now()}-c`,
          data: now,
          acao: `Colaboradores alterados para: ${nomes}`,
          autor,
          autorId,
        });
      }

      const novos = payload.novosArquivos ?? [];
      const anexosAdicionados = novos.map((f) => f.name);
      const anexosAnteriores = [...(current.anexos ?? [])];
      const anexosMantidos = payload.anexos ?? anexosAnteriores;
      const anexosRemovidos = anexosAnteriores.filter((nome) => !anexosMantidos.includes(nome));
      if (anexosRemovidos.length > 0) {
        entries.push({
          id: `h-${Date.now()}-axr`,
          data: now,
          acao: `Anexos removidos: ${anexosRemovidos.join(", ")}`,
          autor,
          autorId,
        });
      }
      if (anexosAdicionados.length > 0) {
        entries.push({
          id: `h-${Date.now()}-ax`,
          data: now,
          acao: `Novos anexos adicionados: ${anexosAdicionados.join(", ")}`,
          autor,
          autorId,
          anexos: anexosAdicionados,
        });
      }

      const anexosFinal = [...anexosMantidos, ...anexosAdicionados];
      const arquivosFinal = [
        ...(current.arquivos ?? []).filter((f) => anexosMantidos.includes(f.name)),
        ...novos,
      ];
      const anexoItens = buildAnexoItens(anexosFinal, current.id, current.anexoItens);

      const updated: Tarefa = {
        ...current,
        titulo: payload.titulo.trim(),
        descricao: payload.descricao?.trim() || undefined,
        categoria: payload.categoria,
        status: payload.status,
        prioridade: payload.prioridade,
        responsavel,
        clienteId: (payload.clienteIds?.[0] ?? payload.clienteId) || undefined,
        clienteIds: payload.clienteIds?.length
          ? payload.clienteIds
          : [payload.clienteId].filter(Boolean) as string[],
        clienteNome: formatClienteResumo(
          payload.clienteIds?.length
            ? payload.clienteIds
            : ([payload.clienteId].filter(Boolean) as string[]),
          clientes
        ),
        solucaoIds: payload.solucaoIds,
        solucoes: solucoes.filter((s) => (payload.solucaoIds ?? []).includes(s.id)),
        colaboradores,
        dataInicio: payload.dataInicio,
        dataFim: payload.dataFim,
        anexos: anexosFinal,
        anexoItens,
        arquivos: arquivosFinal,
        historico: [...current.historico, ...entries],
      };

      setTarefas((prev) => prev.map((t) => (t.id === tarefaId ? updated : t)));
      setSelectedTarefa((prev) => (prev?.id === tarefaId ? updated : prev));
      void persistTarefa(updated, { novosArquivos: novos, previous: updated })
        .then((merged) => {
          setTarefas((prev) => prev.map((t) => (t.id === merged.id ? merged : t)));
          setSelectedTarefa((prev) => (prev?.id === merged.id ? merged : prev));
          showToast("Tarefa atualizada com sucesso.", "success");
        })
        .catch((error) => {
          showToast(error instanceof Error ? error.message : "Falha ao atualizar a tarefa.", "error");
        });
    },
    [usuariosMap, selectedTarefa, tarefas, persistTarefa, autorEdicao, clientes, solucoes, showToast]
  );

  const handleExcluirClick = useCallback((t: Tarefa) => {
    setTarefaToDelete(t);
  }, []);

  const handleConfirmExcluir = useCallback(() => {
    if (!tarefaToDelete) return;
    const id = tarefaToDelete.id;
    setTarefas((prev) => prev.filter((t) => t.id !== tarefaToDelete.id));
    if (selectedTarefa?.id === tarefaToDelete.id) {
      setSelectedTarefa(null);
      setIsSheetOpen(false);
    }
    setTarefaToDelete(null);
    void deleteTarefa(id).catch((error) => {
      showToast(error instanceof Error ? error.message : "Falha ao excluir a tarefa.", "error");
    });
  }, [tarefaToDelete, selectedTarefa?.id, deleteTarefa, showToast]);

  const sheetTitle = selectedTarefa ? selectedTarefa.codigo : "Nova Tarefa";

  if (!podeVer) return null;

  return (
    <section className="w-full min-w-0 space-y-6">
      <OperacaoViews
        value={operacaoView}
        onChange={setOperacaoView}
        closedLabel="Fechadas"
        archivedLabel="Arquivados"
        viewTooltips={TAREFAS_VIEW_TOOLTIPS}
      />
      {/* Barra: Filtros + toggle visão (padrão unificado) */}
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:flex-nowrap lg:items-end lg:gap-3">
        <div className="flex w-full min-w-0 flex-wrap items-end justify-start gap-x-2 gap-y-2 sm:flex-nowrap sm:gap-3 lg:flex-1">
          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <label className={`${formLabelClass} mb-0 shrink-0`}>Status</label>
            <div className="w-full min-w-[9rem] sm:w-auto sm:min-w-[11rem]">
              <SearchableSelect
                options={statusFilterOptions}
                value={statusFilter}
                onChange={(v) => setStatusFilter((v || "") as "" | StatusTarefa)}
                searchable={false}
                placeholder="Todos"
                leadingIcon={STATUS_LEADING_ICON}
              />
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <label className={`${formLabelClass} mb-0 shrink-0`}>Prioridade</label>
            <div className="w-full min-w-[9rem] sm:w-auto sm:min-w-[11rem]">
              <SearchableSelect
                options={prioridadeFilterOptions}
                value={prioridadeFilter}
                onChange={(v) => setPrioridadeFilter((v || "") as "" | PrioridadeTarefa)}
                searchable={false}
                placeholder="Todas"
                leadingIcon={PRIORIDADE_LEADING_ICON}
              />
            </div>
          </div>
          <div className="flex min-w-0 max-w-full flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <label className={`${formLabelClass} mb-0 shrink-0`}>Responsável</label>
            <div className="min-w-0 w-full max-w-[min(100%,20rem)] sm:w-[min(20rem,42vw)]">
              <SearchableSelect
                options={responsavelFilterOptions}
                value={responsavelFilter}
                onChange={setResponsavelFilter}
                placeholder="Todos"
                searchPlaceholder="Buscar responsável..."
                leadingIcon={User}
              />
            </div>
          </div>
        </div>
        <div className="shrink-0 self-start lg:self-end">
          <TabsView value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {viewMode === "kanban" ? (
        <TarefasKanban
          tarefas={tarefasFiltradas}
          onAbrirTarefa={abrirTarefa}
          onDragEnd={podeEditarTarefa ? handleDragEnd : undefined}
        />
      ) : (
        <TarefasTable
          tarefas={tarefasFiltradas}
          onAbrirTarefa={abrirTarefa}
          onExcluir={podeExcluirTarefa ? handleExcluirClick : undefined}
        />
      )}

      {/* Sheet único: Nova Tarefa ou Detalhe */}
      <DrawerSheet
        open={isSheetOpen}
        onClose={handleCloseSheet}
        title={sheetTitle}
        scrollBody={false}
        mobileContentPaddingClassName="px-0"
        desktopContentPaddingClassName="px-0"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {selectedTarefa ? (
            <TarefaDetalheDrawer
              tarefa={selectedTarefa}
              usuariosMap={usuariosMap}
              clientes={clientes}
              solucoes={solucoes}
              currentUserId={usuarioAtualId}
              onClose={handleCloseSheet}
              onTrocarResponsavel={(t, novoId) => {
                const u = usuariosMap.get(novoId);
                if (!u) return;
                setTarefas((prev) =>
                  prev.map((x) =>
                    x.id === t.id ? { ...x, responsavel: u } : x
                  )
                );
                setSelectedTarefa((x) =>
                  x?.id === t.id ? { ...x, responsavel: u } : x
                );
              }}
              onAdicionarHistorico={(tarefaId, acao, anexos, novosArquivos) => {
                const anexosNomes = anexos ?? [];
                const entry = {
                  id: `h-${Date.now()}`,
                  data: new Date().toISOString(),
                  acao,
                  autor: autorEdicao.nome,
                  autorId: autorEdicao.id,
                  anexos: anexosNomes.length ? anexosNomes : undefined,
                };
                let updatedForPersist: Tarefa | null = null;
                setTarefas((prev) =>
                  prev.map((x) => {
                    if (x.id !== tarefaId) return x;
                    const anexosMerged = anexosNomes.length
                      ? Array.from(new Set([...(x.anexos ?? []), ...anexosNomes]))
                      : x.anexos ?? [];
                    const next = {
                      ...x,
                      anexos: anexosMerged,
                      anexoItens: anexosNomes.length
                        ? buildAnexoItens(anexosMerged, x.id, x.anexoItens)
                        : x.anexoItens,
                      historico: [...x.historico, entry],
                    };
                    updatedForPersist = next;
                    return next;
                  })
                );
                setSelectedTarefa((x) => {
                  if (x?.id !== tarefaId) return x;
                  const anexosMerged = anexosNomes.length
                    ? Array.from(new Set([...(x.anexos ?? []), ...anexosNomes]))
                    : x.anexos ?? [];
                  return {
                    ...x,
                    anexos: anexosMerged,
                    anexoItens: anexosNomes.length
                      ? buildAnexoItens(anexosMerged, x.id, x.anexoItens)
                      : x.anexoItens,
                    historico: [...x.historico, entry],
                  };
                });
                if (updatedForPersist) {
                  void persistTarefa(updatedForPersist, {
                    previous: updatedForPersist,
                    novosArquivos: novosArquivos ?? [],
                  })
                    .then((merged) => {
                      setTarefas((prev) => prev.map((t) => (t.id === merged.id ? merged : t)));
                      setSelectedTarefa((prev) => (prev?.id === merged.id ? merged : prev));
                    })
                    .catch(() => undefined);
                }
              }}
              onSalvar={podeEditarTarefa ? handleSalvarTarefa : undefined}
            />
          ) : podeCriarTarefa ? (
            <NovaTarefaForm
              usuarios={usuarios}
              clientes={clientes}
              solucoes={solucoes}
              currentUserId={usuarioAtualId || "usuario-atual"}
              onSave={handleNovaTarefa}
              onCancel={handleCloseSheet}
            />
          ) : (
            <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Sem permissão para criar tarefas.
            </p>
          )}
        </div>
      </DrawerSheet>

      {podeExcluirTarefa && (
      <AlertDialog
        open={!!tarefaToDelete}
        onClose={() => setTarefaToDelete(null)}
        onConfirm={handleConfirmExcluir}
        title="Excluir Tarefa?"
        description={
          tarefaToDelete ? (
            <>
              <strong className="text-slate-900 dark:text-slate-100">Esta ação é irreversível.</strong> A tarefa{" "}
              <strong className="text-slate-900 dark:text-slate-100">{tarefaToDelete.titulo}</strong> será excluída
              permanentemente e não poderá ser recuperada.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Sim, excluir permanentemente"
        destructive
      />
      )}

      <Toast
        visible={toast.visible}
        message={toast.message}
        variant={toast.variant}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />

      {kanbanCanceladoModal ? (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/40 px-4"
          onMouseDown={() => {
            setKanbanCanceladoModal(null);
            setKanbanMotivoCancelado("");
            showToast("Movimentação para Cancelado cancelada.", "success");
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-5 shadow-2xl dark:border-rose-500/40 dark:bg-slate-900"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-600 dark:text-rose-400" />
              <div>
                <h3 className="text-base font-semibold text-rose-700 dark:text-rose-300">
                  Motivo do cancelamento
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Informe o motivo para mover <strong>{kanbanCanceladoModal.tarefaTitulo}</strong> para
                  Cancelado.
                </p>
              </div>
            </div>

            <textarea
              value={kanbanMotivoCancelado}
              onChange={(e) => setKanbanMotivoCancelado(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-0 transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-rose-400 dark:focus:ring-rose-900/40"
              placeholder="Descreva o motivo do cancelamento..."
            />

            <div className="mt-4 flex flex-col-reverse gap-2 border-t border-slate-200 pt-3 dark:border-slate-700 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  setKanbanCanceladoModal(null);
                  setKanbanMotivoCancelado("");
                  showToast("Movimentação para Cancelado cancelada.", "success");
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
                  if (!kanbanMotivoCancelado.trim()) {
                    showToast("Informe o motivo do cancelamento para mover para Cancelado.", "error");
                    return;
                  }
                  applyKanbanMove({
                    sourceStatus: kanbanCanceladoModal.sourceStatus,
                    destStatus: kanbanCanceladoModal.destStatus,
                    tarefaId: kanbanCanceladoModal.tarefaId,
                    motivoCancelado: kanbanMotivoCancelado.trim(),
                  });
                  setKanbanCanceladoModal(null);
                  setKanbanMotivoCancelado("");
                }}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
              >
                <span className="inline-flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Marcar como Cancelado
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
