"use client";

import { useEffect, useId, useState } from "react";
import clsx from "clsx";
import { motion } from "framer-motion";
import { User, MessageSquare, Zap, FileText, FileCheck } from "lucide-react";
import type { Lead, LeadInteraction, PipelineStage } from "@/lib/comercial/types";
import type { Cliente, Contato } from "@/lib/clientes/types";
import type { UsuarioSistema } from "@/lib/configuracoes/types";
import { useAuth } from "@/contexts/auth-context";
import { LeadDetailDados } from "./lead-detail-dados";
import { LeadDetailHistorico } from "./lead-detail-historico";
import { LeadDetailAcoes } from "./lead-detail-acoes";
import { LeadDetailProposta } from "./lead-detail-proposta";
import { LeadDetailContratos } from "./lead-detail-contratos";

export type LeadDetailTabId = "dados" | "acoes" | "proposta" | "contrato" | "historico";

const TABS: { id: LeadDetailTabId; label: string; icon: React.ElementType }[] = [
  { id: "dados", label: "Dados Gerais", icon: User },
  { id: "acoes", label: "Ações", icon: Zap },
  { id: "proposta", label: "Proposta", icon: FileText },
  { id: "contrato", label: "Contrato", icon: FileCheck },
  { id: "historico", label: "Interações", icon: MessageSquare },
];

function getVisibleTabsByStage(stageId: Lead["stageId"]): LeadDetailTabId[] {
  if (stageId === "prospecao" || stageId === "qualificacao") {
    return ["dados", "acoes", "historico"];
  }
  if (stageId === "proposta") {
    return ["dados", "acoes", "proposta", "historico"];
  }
  if (stageId === "contratacao") {
    return ["dados", "acoes", "proposta", "contrato", "historico"];
  }
  return ["dados", "acoes", "proposta", "contrato", "historico"];
}

type LeadDetailTabsProps = {
  lead: Lead;
  stages: PipelineStage[];
  onUpdateLead: (updates: Partial<Lead>) => void;
  onMudarEtapa: (stageId: Lead["stageId"], options?: { motivoPerda?: string }) => void;
  onSolicitarLiberacaoFinanceiro?: (motivo: string) => void;
  onGerarPdfSuccess?: () => void;
  clientes?: Cliente[];
  /** Apenas adiciona cliente ao catálogo global ao cadastrar no modal (sem persistir o lead). */
  onClienteRegistrado?: (cliente: Cliente) => void;
  onAtualizarContatosCliente?: (clienteId: string, contatos: Contato[]) => void;
  usuarios?: UsuarioSistema[];
  onClose?: () => void;
  readOnly?: boolean;
};

export function LeadDetailTabs({
  lead,
  stages,
  onUpdateLead,
  onMudarEtapa,
  onSolicitarLiberacaoFinanceiro = () => {},
  onGerarPdfSuccess = () => {},
  clientes = [],
  onClienteRegistrado = () => {},
  onAtualizarContatosCliente = () => {},
  usuarios = [],
  onClose,
  readOnly = false,
}: LeadDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<LeadDetailTabId>("dados");
  const id = useId();
  const { session } = useAuth();
  const currentUserName = session.userName ?? "Usuário";
  const currentUserId = session.userId ?? null;
  const visibleTabIds = getVisibleTabsByStage(lead.stageId);
  const visibleTabs = TABS.filter((t) => visibleTabIds.includes(t.id));

  useEffect(() => {
    if (!visibleTabIds.includes(activeTab)) setActiveTab("dados");
  }, [activeTab, visibleTabIds]);

  const persistLead = readOnly
    ? (_updates: Partial<Lead>) => {}
    : onUpdateLead;
  const mudarEtapa = readOnly
    ? (_stageId: Lead["stageId"], _options?: { motivoPerda?: string }) => {}
    : onMudarEtapa;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {readOnly ? (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
          Modo somente leitura — você não pode editar este lead.
        </p>
      ) : null}
      <div
        role="tablist"
        aria-label="Abas do lead"
        className="flex flex-wrap border-b border-slate-300 bg-slate-50/50"
      >
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              id={`${id}-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`${id}-${tab.id}-panel`}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "relative flex min-w-0 flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors",
                isActive
                  ? "text-[#6D28D9]"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="lead-detail-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6D28D9]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === "dados" && (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <LeadDetailDados
            key={lead.id}
            lead={lead}
            onPersistLead={persistLead}
            readOnly={readOnly}
            clientes={clientes}
            onClienteRegistrado={onClienteRegistrado}
            onAtualizarContatosCliente={onAtualizarContatosCliente}
            usuarios={usuarios}
            onClose={onClose}
          />
        </div>
      )}
      {activeTab === "proposta" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <LeadDetailProposta
            lead={lead}
            onUpdateLead={persistLead}
            onGerarPdfSuccess={onGerarPdfSuccess}
            clientes={clientes}
            readOnly={readOnly}
          />
        </div>
      )}
      {activeTab === "contrato" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <LeadDetailContratos lead={lead} onUpdateLead={persistLead} readOnly={readOnly} />
        </div>
      )}
      {activeTab === "historico" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <LeadDetailHistorico
            interactions={lead.interactions ?? []}
            readOnly={readOnly}
            onAddInteraction={(entry) =>
              persistLead({
                interactions: [
                  ...(lead.interactions ?? []),
                  {
                    id: `int-${Date.now()}`,
                    date: new Date().toISOString(),
                    type: "observacao",
                    user: currentUserName,
                    userId: currentUserId,
                    ...entry,
                  } as LeadInteraction,
                ],
              })
            }
          />
        </div>
      )}
      {activeTab === "acoes" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <LeadDetailAcoes
            lead={lead}
            stages={stages}
            onMudarEtapa={mudarEtapa}
            readOnly={readOnly}
            onSolicitarLiberacaoFinanceiro={onSolicitarLiberacaoFinanceiro}
          />
        </div>
      )}
    </div>
  );
}
