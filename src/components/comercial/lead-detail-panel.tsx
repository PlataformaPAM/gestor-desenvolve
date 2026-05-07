"use client";

import { DrawerSheet } from "./drawer-sheet";
import { LeadDetailTabs } from "./lead-detail-tabs";
import type { Lead, PipelineStage } from "@/lib/comercial/types";
import type { Cliente, Contato } from "@/lib/clientes/types";
import type { UsuarioSistema } from "@/lib/configuracoes/types";

type LeadDetailPanelProps = {
  lead: Lead | null;
  stages: PipelineStage[];
  open: boolean;
  onClose: () => void;
  onUpdateLead: (updates: Partial<Lead>) => void;
  onMudarEtapa: (stageId: Lead["stageId"], options?: { motivoPerda?: string }) => void;
  onSolicitarLiberacaoFinanceiro?: (motivo: string) => void;
  onGerarPdfSuccess?: () => void;
  clientes?: Cliente[];
  onClienteRegistrado?: (cliente: Cliente) => void;
  onAtualizarContatosCliente?: (clienteId: string, contatos: Contato[]) => void;
  usuarios?: UsuarioSistema[];
};

export function LeadDetailPanel({
  lead,
  stages,
  open,
  onClose,
  onUpdateLead,
  onMudarEtapa,
  onSolicitarLiberacaoFinanceiro = () => {},
  onGerarPdfSuccess,
  clientes = [],
  onClienteRegistrado = () => {},
  onAtualizarContatosCliente = () => {},
  usuarios = [],
}: LeadDetailPanelProps) {
  if (!lead) return null;

  return (
    <DrawerSheet
      open={open}
      onClose={onClose}
      title={lead.name}
      maxWidth="sm:max-w-3xl"
      mobileContentPaddingClassName="px-0"
      desktopContentPaddingClassName="px-0"
    >
      <LeadDetailTabs
        lead={lead}
        stages={stages}
        onClose={onClose}
        onUpdateLead={onUpdateLead}
        onMudarEtapa={onMudarEtapa}
        onSolicitarLiberacaoFinanceiro={onSolicitarLiberacaoFinanceiro}
        onGerarPdfSuccess={onGerarPdfSuccess}
        clientes={clientes}
        onClienteRegistrado={onClienteRegistrado}
        onAtualizarContatosCliente={onAtualizarContatosCliente}
        usuarios={usuarios}
      />
    </DrawerSheet>
  );
}
