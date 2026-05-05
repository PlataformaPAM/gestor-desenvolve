"use client";

import { useState } from "react";
import { DrawerSheet } from "./drawer-sheet";
import type { Lead } from "@/lib/comercial/types";
import { comercialInputClass, comercialLabelClass } from "./field-styles";

type QualificacaoSheetProps = {
  open: boolean;
  onClose: () => void;
  lead: Lead | null;
  onVincularCliente: (leadId: string, clienteId: string) => void;
};

/**
 * Sheet aberto quando o usuário tenta arrastar um lead para Qualificação sem cliente vinculado.
 * Permite vincular um cliente (ID) ao lead para desbloquear a transição.
 */
export function QualificacaoSheet({
  open,
  onClose,
  lead,
  onVincularCliente,
}: QualificacaoSheetProps) {
  const [clienteId, setClienteId] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !clienteId.trim()) return;
    onVincularCliente(lead.id, clienteId.trim());
    setClienteId("");
    onClose();
  };

  if (!lead) return null;

  return (
    <DrawerSheet
      open={open}
      onClose={onClose}
      title="Qualificação / Cadastro de Cliente"
      maxWidth="sm:max-w-3xl"
    >
      <div className="overflow-y-auto p-6">
        <p className="mb-4 text-sm text-slate-600">
          Para avançar este lead para <strong>Qualificação</strong>, vincule um cliente. O lead
          &quot;{lead.name}&quot; será associado ao cliente informado.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="qualificacao-cliente-id" className={comercialLabelClass}>
              ID do Cliente *
            </label>
            <input
              id="qualificacao-cliente-id"
              type="text"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              placeholder="Ex.: cli-123 ou cadastre no módulo Clientes"
              className={comercialInputClass}
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              Use o ID do cliente já cadastrado no módulo Clientes, ou cadastre primeiro e depois vincule aqui.
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-[#6D28D9] px-4 py-2.5 font-semibold text-white hover:bg-purple-700"
            >
              Vincular e liberar
            </button>
          </div>
        </form>
      </div>
    </DrawerSheet>
  );
}
