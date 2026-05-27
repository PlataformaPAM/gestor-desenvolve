"use client";

import {
  AlertTriangle,
  ArrowLeftCircle,
  ArrowRightCircle,
  CheckCircle2,
  Send,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Lead, PipelineStage, PipelineStageId } from "@/lib/comercial/types";
import { comercialTextareaClass, formModalCancelButtonClass } from "./field-styles";

type LeadDetailAcoesProps = {
  lead: Lead;
  stages: PipelineStage[];
  onMudarEtapa: (stageId: PipelineStageId, options?: { motivoPerda?: string }) => void;
  onSolicitarLiberacaoFinanceiro?: (motivo: string) => void;
  onDeleteLead?: () => void;
  podeExcluir?: boolean;
  readOnly?: boolean;
};

export function LeadDetailAcoes({
  lead,
  stages,
  onMudarEtapa,
  onSolicitarLiberacaoFinanceiro = () => {},
  onDeleteLead,
  podeExcluir = false,
  readOnly = false,
}: LeadDetailAcoesProps) {
  const [motivoPerda, setMotivoPerda] = useState("");
  const [perdidoModalOpen, setPerdidoModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [motivoLiberacao, setMotivoLiberacao] = useState("");
  const linearOrder: PipelineStageId[] = ["prospecao", "qualificacao", "proposta", "contratacao"];
  const currentIdx = linearOrder.indexOf(lead.stageId);
  const prevId = currentIdx > 0 ? linearOrder[currentIdx - 1] : null;
  const nextId = currentIdx >= 0 && currentIdx < linearOrder.length - 1 ? linearOrder[currentIdx + 1] : null;
  const prevStageLinear = prevId ? stages.find((s) => s.id === prevId) : null;
  const nextStage = nextId ? stages.find((s) => s.id === nextId) : null;
  const isContrato = lead.stageId === "contratacao";
  const isLockedByFinanceiro = !!lead.financeiroFluxo?.bloqueadoEdicao || readOnly;
  const prevStageFechado = stages.find((s) => s.id === "contratacao") ?? null;
  const prevStage =
    lead.stageId === "fechado" && !isLockedByFinanceiro ? prevStageFechado : prevStageLinear;
  const canMarkAsPerdido =
    lead.stageId !== "perdido" &&
    !(lead.stageId === "fechado" && isLockedByFinanceiro);

  useEffect(() => {
    if (!perdidoModalOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPerdidoModalOpen(false);
    };
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [perdidoModalOpen]);

  useEffect(() => {
    if (!deleteModalOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDeleteModalOpen(false);
    };
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [deleteModalOpen]);

  const perdidoModal =
    perdidoModalOpen && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[70]">
            <div
              className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
              onMouseDown={() => setPerdidoModalOpen(false)}
              aria-hidden
            />
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="perdido-modal-title"
                className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
                  <p id="perdido-modal-title" className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    Motivo da perda
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Esta informação fica registrada no histórico e em destaque nos Dados Gerais enquanto o lead estiver em Perdido.
                  </p>
                </div>
                <div className="px-5 py-4">
                  <label htmlFor="motivo-perda-modal" className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Descreva o motivo
                  </label>
                  <textarea
                    id="motivo-perda-modal"
                    value={motivoPerda}
                    onChange={(e) => setMotivoPerda(e.target.value)}
                    rows={4}
                    placeholder="Ex.: Cliente interrompeu o projeto por restrição orçamentária."
                    className={comercialTextareaClass}
                    autoFocus
                  />
                </div>
                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700 sm:flex-row sm:justify-end sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setPerdidoModalOpen(false)}
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
                      if (!motivoPerda.trim()) return;
                      onMudarEtapa("perdido", { motivoPerda: motivoPerda.trim() });
                      setPerdidoModalOpen(false);
                    }}
                    disabled={!motivoPerda.trim()}
                    className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
                  >
                    <span className="inline-flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Marcar como Perdido
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  const deleteModal =
    deleteModalOpen && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[70]">
            <div
              className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
              onMouseDown={() => setDeleteModalOpen(false)}
              aria-hidden
            />
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-lead-modal-title"
                className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
                  <p id="delete-lead-modal-title" className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                    <Trash2 className="h-5 w-5 text-red-500" />
                    Excluir lead
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Esta ação remove permanentemente &quot;{lead.name}&quot; e todo o histórico vinculado.
                  </p>
                </div>
                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700 sm:flex-row sm:justify-end sm:gap-3">
                  <button type="button" onClick={() => setDeleteModalOpen(false)} className={formModalCancelButtonClass}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteLead?.();
                      setDeleteModalOpen(false);
                    }}
                    className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    Excluir lead
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">
          Navegação do pipeline
        </h3>
        <p className="mb-3 text-xs text-slate-500">
          A transição segue ordem linear do funil.
        </p>
        {isLockedByFinanceiro && (
          <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Este lead está bloqueado pelo Financeiro após lançamento. Solicite liberação para editar/mover.
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {prevStage && (
            <button
              type="button"
              onClick={() => onMudarEtapa(prevStage.id)}
              disabled={isLockedByFinanceiro}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-[#6D28D9]/40 hover:bg-[#6D28D9]/5 hover:text-[#6D28D9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9]"
            >
              <span className="flex items-center gap-2">
                <ArrowLeftCircle className="h-4 w-4" />
                Voltar para {prevStage.label}
              </span>
            </button>
          )}
          {!isContrato && nextStage && (
            <button
              type="button"
              onClick={() => onMudarEtapa(nextStage.id)}
              disabled={isLockedByFinanceiro}
              className="rounded-lg bg-[#6D28D9] px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9]"
            >
              <span className="flex items-center gap-2">
                <ArrowRightCircle className="h-4 w-4" />
                Avançar para {nextStage.label}
              </span>
            </button>
          )}
          {isContrato && (
            <>
              <button
                type="button"
                onClick={() => onMudarEtapa("fechado")}
                disabled={isLockedByFinanceiro}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Avançar para Fechado
                </span>
              </button>
            </>
          )}
          {canMarkAsPerdido && (
            <button
              type="button"
              onClick={() => setPerdidoModalOpen(true)}
              disabled={isLockedByFinanceiro}
              className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Marcar como Perdido
              </span>
            </button>
          )}
        </div>
        {isLockedByFinanceiro && (
          <div className="mt-4 space-y-1.5">
            <label htmlFor="motivo-liberacao" className="block text-xs font-medium text-slate-700">
              Solicitar liberação ao Financeiro (obrigatório)
            </label>
            <textarea
              id="motivo-liberacao"
              value={motivoLiberacao}
              onChange={(e) => setMotivoLiberacao(e.target.value)}
              rows={3}
              placeholder="Descreva o que precisa corrigir no lead..."
              className={comercialTextareaClass}
            />
            <button
              type="button"
              onClick={() => onSolicitarLiberacaoFinanceiro(motivoLiberacao)}
              disabled={!motivoLiberacao.trim()}
              className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                <Send className="h-4 w-4 shrink-0" aria-hidden />
                Solicitar liberação
              </span>
            </button>
          </div>
        )}
      </div>

      {podeExcluir && onDeleteLead && !readOnly && (
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900/50 dark:bg-red-950/20">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">Zona de perigo</h3>
          <p className="mt-1 text-xs text-red-700 dark:text-red-300">
            Exclui este lead e todos os dados associados (interações, checklist, contatos).
          </p>
          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/60"
          >
            <Trash2 className="h-4 w-4" />
            Excluir lead
          </button>
        </div>
      )}

      {perdidoModal}
      {deleteModal}
    </div>
  );
}




