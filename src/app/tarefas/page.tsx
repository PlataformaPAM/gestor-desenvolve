"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import { TabsView, type ViewMode } from "@/components/comercial/tabs-view";
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
import type { DropResult } from "@hello-pangea/dnd";

function generateId(): string {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDataBr(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
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

export default function TarefasPage() {
  const { setPrimaryAction } = usePageHeader();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioTarefa[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [statusFilter, setStatusFilter] = useState<"" | StatusTarefa>("");
  const [prioridadeFilter, setPrioridadeFilter] = useState<"" | PrioridadeTarefa>("");
  const [responsavelFilter, setResponsavelFilter] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedTarefa, setSelectedTarefa] = useState<Tarefa | null>(null);
  const [tarefaToDelete, setTarefaToDelete] = useState<Tarefa | null>(null);

  const saveTarefa = useCallback(async (tarefa: Tarefa, isCreate = false) => {
    const url = isCreate ? "/api/tarefas" : `/api/tarefas/${tarefa.id}`;
    const method = isCreate ? "POST" : "PATCH";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tarefa }),
    });
    if (!res.ok) throw new Error("Falha ao persistir tarefa");
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

  const tarefasFiltradas = useMemo(() => {
    return tarefas.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (prioridadeFilter && t.prioridade !== prioridadeFilter) return false;
      if (responsavelFilter && t.responsavel.id !== responsavelFilter) return false;
      return true;
    });
  }, [tarefas, statusFilter, prioridadeFilter, responsavelFilter]);

  const handleNovaTarefa = useCallback((nova: Omit<Tarefa, "id">) => {
    const created: Tarefa = { ...nova, id: generateId() };
    setTarefas((prev) => [
      ...prev,
      created,
    ]);
    void saveTarefa(created, true).catch(() => undefined);
    setIsSheetOpen(false);
    setSelectedTarefa(null);
  }, [saveTarefa]);

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
      id: `h-${Date.now()}`,
      data: new Date().toISOString(),
      acao: `Status alterado de ${STATUS_LABELS[sourceStatus]} para ${STATUS_LABELS[destStatus]} via Kanban`,
      autor: undefined as string | undefined,
    };
    setTarefas((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        historicoEntry.autor = t.responsavel.nome;
        return {
          ...t,
          status: destStatus,
          historico: [...t.historico, { ...historicoEntry }],
        };
      })
    );
    setSelectedTarefa((t) => {
      if (t?.id !== id) return t;
      historicoEntry.autor = t.responsavel.nome;
      return {
        ...t,
        status: destStatus,
        historico: [...t.historico, { ...historicoEntry }],
      };
    });
    const changed = tarefas.find((t) => t.id === id);
    if (changed) {
      const updated = {
        ...changed,
        status: destStatus,
        historico: [...changed.historico, { ...historicoEntry }],
      };
      void saveTarefa(updated).catch(() => undefined);
    }
  }, [tarefas, saveTarefa]);

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

      const entries: { id: string; data: string; acao: string; autor?: string; anexos?: string[] }[] = [];
      const autor = responsavel.nome;
      const now = new Date().toISOString();

      if (current.titulo.trim() !== payload.titulo.trim()) {
        entries.push({
          id: `h-${Date.now()}-ti`,
          data: now,
          acao: `Título alterado de "${current.titulo}" para "${payload.titulo.trim()}"`,
          autor,
        });
      }
      const currDesc = (current.descricao ?? "").trim();
      const nextDesc = (payload.descricao ?? "").trim();
      if (currDesc !== nextDesc) {
        entries.push({
          id: `h-${Date.now()}-de`,
          data: now,
          acao: "Descrição do ticket atualizada".replace("ticket", "tarefa"),
          autor,
        });
      }
      if (current.status !== payload.status) {
        entries.push({ id: `h-${Date.now()}-s`, data: now, acao: `Status alterado de ${STATUS_LABELS[current.status]} para ${STATUS_LABELS[payload.status]}`, autor });
      }
      if (current.prioridade !== payload.prioridade) {
        entries.push({ id: `h-${Date.now()}-p`, data: now, acao: `Prioridade alterada de ${PRIORIDADE_LABELS[current.prioridade]} para ${PRIORIDADE_LABELS[payload.prioridade]}`, autor });
      }
      if (current.responsavel.id !== payload.responsavelId) {
        entries.push({ id: `h-${Date.now()}-r`, data: now, acao: `Responsabilidade transferida de ${current.responsavel.nome} para ${responsavel.nome}`, autor });
      }
      if (current.dataInicio !== payload.dataInicio) {
        entries.push({ id: `h-${Date.now()}-di`, data: now, acao: `Data de início alterada de ${formatDataBr(current.dataInicio)} para ${formatDataBr(payload.dataInicio)}`, autor });
      }
      if (current.dataFim !== payload.dataFim) {
        entries.push({ id: `h-${Date.now()}-df`, data: now, acao: `Prazo limite alterado de ${formatDataBr(current.dataFim)} para ${formatDataBr(payload.dataFim)}`, autor });
      }
      const currentColIds = (current.colaboradores ?? []).map((c) => c.id).sort().join(",");
      const newColIds = [...payload.colaboradorIds].filter((id) => id !== payload.responsavelId).sort().join(",");
      if (currentColIds !== newColIds) {
        const nomes = colaboradores.map((c) => c.nome).join(", ") || "Nenhum";
        entries.push({ id: `h-${Date.now()}-c`, data: now, acao: `Colaboradores alterados para: ${nomes}`, autor });
      }

      const novos = payload.novosArquivos ?? [];
      const anexosAdicionados = novos.map((f) => f.name);
      if (anexosAdicionados.length > 0) {
        entries.push({
          id: `h-${Date.now()}-ax`,
          data: now,
          acao: `Novos anexos adicionados: ${anexosAdicionados.join(", ")}`,
          autor,
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
        colaboradores,
        dataInicio: payload.dataInicio,
        dataFim: payload.dataFim,
        anexos: [...(current.anexos ?? []), ...anexosAdicionados],
        arquivos: [...(current.arquivos ?? []), ...novos],
        historico: [...current.historico, ...entries],
      };

      setTarefas((prev) => prev.map((t) => (t.id === tarefaId ? updated : t)));
      setSelectedTarefa((prev) => (prev?.id === tarefaId ? updated : prev));
      void saveTarefa(updated).catch(() => undefined);
    },
    [usuariosMap, selectedTarefa, tarefas, saveTarefa]
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

  const sheetTitle = selectedTarefa ? selectedTarefa.titulo : "Nova Tarefa";

  const filterInputClass =
    "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
  const labelClass = "text-sm font-medium text-slate-700 dark:text-slate-300";

  return (
    <section className="w-full min-w-0 space-y-6">
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
                  autor: selectedTarefa?.responsavel.nome,
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
                  void saveTarefa(updatedForPersist).catch(() => undefined);
                }
              }}
              onSalvar={handleSalvarTarefa}
            />
          ) : (
            <div className="overflow-y-auto">
              <NovaTarefaForm
                usuarios={usuarios}
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
