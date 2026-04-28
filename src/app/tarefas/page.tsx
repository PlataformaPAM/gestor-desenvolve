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
import { usePageHeader } from "@/contexts/page-header-context";
import {
  CURRENT_USER_ID,
  STATUS_LABELS,
  PRIORIDADE_LABELS,
} from "@/lib/tarefas/constants";
import type { Tarefa, StatusTarefa, PrioridadeTarefa, UsuarioTarefa } from "@/lib/tarefas/types";
import {
  getSituacaoOperacional,
  sortByPriorizacao,
  type OperacaoViewId,
} from "@/lib/operacao/priorizacao";
import type { Cliente } from "@/lib/clientes/types";
import type { DropResult } from "@hello-pangea/dnd";

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

const STATUS_OPTIONS: { value: "" | StatusTarefa; label: string }[] = [
  { value: "", label: "Todos" },
  ...(Object.entries(STATUS_LABELS) as [StatusTarefa, string][]).map(([v, l]) => ({ value: v as "" | StatusTarefa, label: l })),
];

const PRIORIDADE_OPTIONS: { value: "" | PrioridadeTarefa; label: string }[] = [
  { value: "", label: "Todas" },
  ...(Object.entries(PRIORIDADE_LABELS) as [PrioridadeTarefa, string][]).map(([v, l]) => ({ value: v as "" | PrioridadeTarefa, label: l })),
];
const OPERACAO_VIEW_STORAGE_KEY = "operacao_view_tarefas";

export default function TarefasPage() {
  const { setPrimaryAction } = usePageHeader();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioTarefa[]>([]);
  const [clientes, setClientes] = useState<Pick<Cliente, "id" | "nome" | "empresa">[]>([]);
  const [operacaoView, setOperacaoView] = useState<OperacaoViewId>("minha_fila");
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [statusFilter, setStatusFilter] = useState<"" | StatusTarefa>("");
  const [prioridadeFilter, setPrioridadeFilter] = useState<"" | PrioridadeTarefa>("");
  const [responsavelFilter, setResponsavelFilter] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedTarefa, setSelectedTarefa] = useState<Tarefa | null>(null);
  const [tarefaToDelete, setTarefaToDelete] = useState<Tarefa | null>(null);

  const saveTarefa = useCallback(async (tarefa: Tarefa, isCreate = false): Promise<Tarefa> => {
    const url = isCreate ? "/api/tarefas" : `/api/tarefas/${tarefa.id}`;
    const method = isCreate ? "POST" : "PATCH";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tarefa }),
    });
    if (!res.ok) throw new Error("Falha ao persistir tarefa");
    const payload = (await res.json()) as { tarefa?: Tarefa; data?: { tarefa?: Tarefa } };
    const saved = payload?.tarefa ?? payload?.data?.tarefa;
    if (!saved) throw new Error("Resposta inválida ao persistir tarefa");
    return saved;
  }, []);

  const deleteTarefa = useCallback(async (tarefaId: string) => {
    const res = await fetch(`/api/tarefas/${tarefaId}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Falha ao excluir tarefa");
  }, []);

  const usuariosMap = useMemo(() => {
    const m = new Map<string, UsuarioTarefa>();
    usuarios.forEach((u) => m.set(u.id, u));
    return m;
  }, [usuarios]);

  /** Quem registra edições/comentários no app (demo: `CURRENT_USER_ID`). */
  const autorEdicao = useMemo(() => {
    const u = usuariosMap.get(CURRENT_USER_ID);
    return { id: CURRENT_USER_ID, nome: u?.nome ?? "Usuário" };
  }, [usuariosMap]);

  const RESPONSAVEL_OPTIONS: { value: string; label: string }[] = useMemo(
    () => [{ value: "", label: "Todos" }, ...usuarios.map((u) => ({ value: u.id, label: u.nome }))],
    [usuarios]
  );

  useEffect(() => {
    setPrimaryAction({
      label: "Nova Tarefa",
      onClick: () => {
        setSelectedTarefa(null);
        setIsSheetOpen(true);
      },
    });
    return () => setPrimaryAction(null);
  }, [setPrimaryAction]);

  useEffect(() => {
    const saved = window.localStorage.getItem(OPERACAO_VIEW_STORAGE_KEY) as OperacaoViewId | null;
    if (!saved) return;
    if (["minha_fila", "urgentes", "atrasados", "vence_logo", "fechados"].includes(saved)) {
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
        const data = (await res.json()) as { data?: { tarefas?: Tarefa[]; usuarios?: UsuarioTarefa[] } };
        if (!active) return;
        setTarefas(data?.data?.tarefas ?? []);
        setUsuarios(data?.data?.usuarios ?? []);
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
    const now = new Date();
    const ativas = tarefas.filter((t) => t.status !== "concluido");
    const isMinhaTarefa = (t: Tarefa) =>
      t.responsavel.id === CURRENT_USER_ID || (t.colaboradores ?? []).some((c) => c.id === CURRENT_USER_ID);
    let base: Tarefa[] = [];
    if (operacaoView === "fechados") {
      return [...tarefas.filter((t) => t.status === "concluido")].sort((a, b) => {
        const aTime = new Date(a.updatedAt ?? a.dataFim).getTime();
        const bTime = new Date(b.updatedAt ?? b.dataFim).getTime();
        return bTime - aTime;
      });
    }
    if (operacaoView === "minha_fila") {
      const minhas = ativas.filter(isMinhaTarefa);
      base = minhas.length > 0 ? minhas : ativas;
    } else if (operacaoView === "urgentes") {
      base = ativas.filter((t) => t.prioridade === "urgente");
    } else if (operacaoView === "atrasados") {
      base = ativas.filter((t) => getSituacaoOperacional(t.dataFim, now) === "atrasado");
    } else {
      base = ativas.filter((t) => getSituacaoOperacional(t.dataFim, now) === "vence_logo");
    }
    return sortByPriorizacao(base, {
      prioridade: (t) => t.prioridade,
      vencimentoIso: (t) => t.dataFim,
      atualizadoIso: (t) => t.updatedAt ?? t.dataInicio,
      now,
    });
  }, [tarefas, operacaoView]);

  const tarefasFiltradas = useMemo(() => {
    return tarefasOperacionais.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (prioridadeFilter && t.prioridade !== prioridadeFilter) return false;
      if (responsavelFilter && t.responsavel.id !== responsavelFilter) return false;
      return true;
    });
  }, [tarefasOperacionais, statusFilter, prioridadeFilter, responsavelFilter]);

  const handleNovaTarefa = useCallback((nova: Omit<Tarefa, "id">) => {
    const nowIso = new Date().toISOString();
    const createdBy = usuariosMap.get(CURRENT_USER_ID)?.nome ?? "Usuário";
    const cliente = nova.clienteId ? clientes.find((c) => c.id === nova.clienteId) : undefined;
    const clienteNome = cliente ? (cliente.empresa?.trim() || cliente.nome || "") : undefined;
    const created: Tarefa = {
      ...nova,
      id: generateId(),
      clienteNome: clienteNome || undefined,
      registroCriadoPorNome: createdBy,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setTarefas((prev) => [
      ...prev,
      created,
    ]);
    void saveTarefa(created, true)
      .then((saved) => {
        setTarefas((prev) => prev.map((t) => (t.id === created.id ? saved : t)));
      })
      .catch(() => undefined);
    setIsSheetOpen(false);
    setSelectedTarefa(null);
  }, [saveTarefa, usuariosMap, clientes]);

  const handleCloseSheet = useCallback(() => {
    setIsSheetOpen(false);
    setSelectedTarefa(null);
  }, []);

  const abrirTarefa = useCallback((t: Tarefa) => {
    setSelectedTarefa(t);
    setIsSheetOpen(true);
  }, []);

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const sourceStatus = result.source.droppableId as StatusTarefa;
    const destStatus = result.destination.droppableId as StatusTarefa;
    if (sourceStatus === destStatus) return;
    const id = result.draggableId;
    const historicoEntry = {
      id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      data: new Date().toISOString(),
      acao: `Status alterado de ${STATUS_LABELS[sourceStatus]} para ${STATUS_LABELS[destStatus]} via Kanban`,
      autor: autorEdicao.nome,
      autorId: autorEdicao.id,
    };
    let updatedForPersist: Tarefa | null = null;
    setTarefas((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
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
      if (t?.id !== id) return t;
      return {
        ...t,
        status: destStatus,
        historico: [...t.historico, historicoEntry],
      };
    });
    if (updatedForPersist) {
      void saveTarefa(updatedForPersist)
        .then((saved) => {
          setTarefas((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
          setSelectedTarefa((prev) => (prev?.id === saved.id ? saved : prev));
        })
        .catch(() => undefined);
    }
  }, [saveTarefa, autorEdicao]);

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
      if ((current.clienteId ?? "") !== (payload.clienteId ?? "")) {
        const clienteAnterior = current.clienteNome?.trim() || "Nenhum";
        const clienteNovoObj = payload.clienteId ? clientes.find((c) => c.id === payload.clienteId) : undefined;
        const clienteNovo = clienteNovoObj ? (clienteNovoObj.empresa?.trim() || clienteNovoObj.nome || "") : "Nenhum";
        entries.push({
          id: `h-${Date.now()}-cl`,
          data: now,
          acao: `Cliente vinculado alterado de ${clienteAnterior} para ${clienteNovo}`,
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

      const updated: Tarefa = {
        ...current,
        titulo: payload.titulo.trim(),
        descricao: payload.descricao?.trim() || undefined,
        status: payload.status,
        prioridade: payload.prioridade,
        responsavel,
        clienteId: payload.clienteId,
        clienteNome: payload.clienteId
          ? ((clientes.find((c) => c.id === payload.clienteId)?.empresa?.trim()
              || clientes.find((c) => c.id === payload.clienteId)?.nome
              || ""))
          : undefined,
        colaboradores,
        dataInicio: payload.dataInicio,
        dataFim: payload.dataFim,
        anexos: [...(current.anexos ?? []), ...anexosAdicionados],
        arquivos: [...(current.arquivos ?? []), ...novos],
        historico: [...current.historico, ...entries],
      };

      setTarefas((prev) => prev.map((t) => (t.id === tarefaId ? updated : t)));
      setSelectedTarefa((prev) => (prev?.id === tarefaId ? updated : prev));
      void saveTarefa(updated)
        .then((saved) => {
          setTarefas((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
          setSelectedTarefa((prev) => (prev?.id === saved.id ? saved : prev));
        })
        .catch(() => undefined);
    },
    [usuariosMap, selectedTarefa, tarefas, saveTarefa, autorEdicao, clientes]
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
    void deleteTarefa(id).catch(() => undefined);
  }, [tarefaToDelete, selectedTarefa?.id, deleteTarefa]);

  const sheetTitle = selectedTarefa ? (
    <span className="truncate font-semibold text-[#6D28D9] dark:text-violet-300">{selectedTarefa.codigo}</span>
  ) : (
    "Nova Tarefa"
  );

  const filterInputClass =
    "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
  const labelClass = "text-sm font-medium text-slate-700 dark:text-slate-300";

  return (
    <section className="w-full min-w-0 space-y-6">
      <OperacaoViews value={operacaoView} onChange={setOperacaoView} closedLabel="Concluídas" />
      {/* Barra: Filtros + toggle visão (padrão unificado) */}
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:flex-nowrap lg:items-end lg:gap-3">
        <div className="flex w-full min-w-0 flex-wrap items-end justify-start gap-x-2 gap-y-2 sm:flex-nowrap sm:gap-3 lg:flex-1">
          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <label htmlFor="filter-status" className={`${labelClass} shrink-0`}>Status</label>
            <select id="filter-status" value={statusFilter} onChange={(e) => setStatusFilter((e.target.value || "") as "" | StatusTarefa)} className={`${filterInputClass} w-full min-w-[9rem] sm:w-auto`}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <label htmlFor="filter-prioridade" className={`${labelClass} shrink-0`}>Prioridade</label>
            <select id="filter-prioridade" value={prioridadeFilter} onChange={(e) => setPrioridadeFilter((e.target.value || "") as "" | PrioridadeTarefa)} className={`${filterInputClass} w-full min-w-[9rem] sm:w-auto`}>
              {PRIORIDADE_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 max-w-full flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <label htmlFor="filter-responsavel" className={`${labelClass} shrink-0`}>Responsável</label>
            <select id="filter-responsavel" value={responsavelFilter} onChange={(e) => setResponsavelFilter(e.target.value)} className={`${filterInputClass} min-w-0 w-full max-w-[min(100%,20rem)] sm:w-[min(20rem,42vw)]`}>
              {RESPONSAVEL_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>{o.label}</option>
              ))}
            </select>
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
          onDragEnd={handleDragEnd}
        />
      ) : (
        <TarefasTable
          tarefas={tarefasFiltradas}
          onAbrirTarefa={abrirTarefa}
          onExcluir={handleExcluirClick}
        />
      )}

      {/* Sheet único: Nova Tarefa ou Detalhe */}
      <DrawerSheet
        open={isSheetOpen}
        onClose={handleCloseSheet}
        title={sheetTitle}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {selectedTarefa ? (
            <TarefaDetalheDrawer
              tarefa={selectedTarefa}
              usuariosMap={usuariosMap}
              clientes={clientes}
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
              onAdicionarHistorico={(tarefaId, acao, anexos) => {
                const entry = {
                  id: `h-${Date.now()}`,
                  data: new Date().toISOString(),
                  acao,
                  autor: autorEdicao.nome,
                  autorId: autorEdicao.id,
                  anexos: anexos?.length ? anexos : undefined,
                };
                let updatedForPersist: Tarefa | null = null;
                setTarefas((prev) =>
                  prev.map((x) => {
                    if (x.id !== tarefaId) return x;
                    const next = { ...x, historico: [...x.historico, entry] };
                    updatedForPersist = next;
                    return next;
                  })
                );
                setSelectedTarefa((x) =>
                  x?.id === tarefaId
                    ? { ...x!, historico: [...x.historico, entry] }
                    : x
                );
                if (updatedForPersist) {
                  void saveTarefa(updatedForPersist)
                    .then((saved) => {
                      setTarefas((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
                      setSelectedTarefa((prev) => (prev?.id === saved.id ? saved : prev));
                    })
                    .catch(() => undefined);
                }
              }}
              onSalvar={handleSalvarTarefa}
            />
          ) : (
            <div className="overflow-y-auto">
              <NovaTarefaForm
                usuarios={usuarios}
                clientes={clientes}
                currentUserId={CURRENT_USER_ID}
                onSave={handleNovaTarefa}
                onCancel={handleCloseSheet}
              />
            </div>
          )}
        </div>
      </DrawerSheet>

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
    </section>
  );
}
