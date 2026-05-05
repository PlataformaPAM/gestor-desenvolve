"use client";

import { ArrowRightCircle, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import type { Lead, PipelineStage, PipelineStageId } from "@/lib/comercial/types";
import { comercialTextareaClass } from "./field-styles";

type LeadDetailAcoesProps = {
  lead: Lead;
  stages: PipelineStage[];
  onMudarEtapa: (stageId: PipelineStageId, options?: { motivoPerda?: string }) => void;
  onSolicitarLiberacaoFinanceiro?: (motivo: string) => void;
};

export function LeadDetailAcoes({
  lead,
  stages,
  onMudarEtapa,
  onSolicitarLiberacaoFinanceiro = () => {},
}: LeadDetailAcoesProps) {
  const [motivoPerda, setMotivoPerda] = useState("");
  const [motivoLiberacao, setMotivoLiberacao] = useState("");
  const linearOrder: PipelineStageId[] = ["prospecao", "qualificacao", "proposta", "contratacao"];
  const currentIdx = linearOrder.indexOf(lead.stageId);
  const prevId = currentIdx > 0 ? linearOrder[currentIdx - 1] : null;
  const nextId = currentIdx >= 0 && currentIdx < linearOrder.length - 1 ? linearOrder[currentIdx + 1] : null;
  const prevStage = prevId ? stages.find((s) => s.id === prevId) : null;
  const nextStage = nextId ? stages.find((s) => s.id === nextId) : null;
  const isContrato = lead.stageId === "contratacao";
  const isLockedByFinanceiro = !!lead.financeiroFluxo?.bloqueadoEdicao;

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
              Voltar para {prevStage.label}
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
              <button
                type="button"
                onClick={() => onMudarEtapa("perdido", { motivoPerda })}
                disabled={!motivoPerda.trim() || isLockedByFinanceiro}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Marcar como Perdido
                </span>
              </button>
            </>
          )}
        </div>
        {isContrato && (
          <div className="mt-4 space-y-1.5">
            <label htmlFor="motivo-perda" className="block text-xs font-medium text-slate-700">
              Motivo da perda (obrigatório para mover para Perdido)
            </label>
            <textarea
              id="motivo-perda"
              value={motivoPerda}
              onChange={(e) => setMotivoPerda(e.target.value)}
              rows={3}
              placeholder="Explique por que a venda não foi concluída..."
              className={comercialTextareaClass}
            />
          </div>
        )}
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
              Solicitar liberação
            </button>
          </div>
        )}
      </div>

    </div>
  );
}




