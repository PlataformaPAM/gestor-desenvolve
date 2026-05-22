"use client";

import { Paperclip, Trash2 } from "lucide-react";
import type { Lead } from "@/lib/comercial/types";
import { MultiFileAttachment } from "@/components/ui/multifile-attachment";
import { useAuth } from "@/contexts/auth-context";
import { comercialLabelClass } from "./field-styles";

type LeadDetailContratosProps = {
  lead: Lead;
  onUpdateLead: (updates: Partial<Lead>) => void;
  readOnly?: boolean;
};

function createLogId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Lista unificada de anexos (novo modelo + migração legado) ordenada do mais recente ao mais antigo */
function anexosClienteList(lead: Lead): Array<{ nome: string; anexadoEm: string }> {
  const fromCliente = lead.contratoAnexosCliente ?? [];
  if (fromCliente.length > 0) {
    return [...fromCliente].sort(
      (a, b) => new Date(b.anexadoEm).getTime() - new Date(a.anexadoEm).getTime()
    );
  }
  const min = lead.contratoArquivos?.minuta ?? [];
  const ass = lead.contratoArquivos?.assinatura ?? [];
  const now = new Date().toISOString();
  const legacy = [...min, ...ass].map((nome) => ({ nome, anexadoEm: now }));
  return legacy.sort((a, b) => new Date(b.anexadoEm).getTime() - new Date(a.anexadoEm).getTime());
}

function formatAnexoData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LeadDetailContratos({ lead, onUpdateLead, readOnly = false }: LeadDetailContratosProps) {
  const { session } = useAuth();
  const currentUserName = session.userName ?? "Usuário";
  const currentUserId = session.userId ?? null;

  const checklist = lead.contratoChecklist ?? {
    aprovacaoCliente: false,
    recebimentoDocumentacao: false,
    envioDocumentacao: false,
    ordemCompra: false,
  };

  const itemList: { key: keyof typeof checklist; label: string }[] = [
    { key: "aprovacaoCliente", label: "Aprovação do cliente" },
    { key: "recebimentoDocumentacao", label: "Recebimento de documentação" },
    { key: "envioDocumentacao", label: "Envio de documentação" },
    { key: "ordemCompra", label: "Ordem de compra" },
  ];
  const completed = itemList.filter((x) => !!checklist[x.key]).length;
  const total = itemList.length;

  const anexosOrdenados = anexosClienteList(lead);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {readOnly
          ? "Visualização do checklist e dos anexos da etapa de contratação (somente leitura)."
          : "Conclua o checklist da etapa de contratação e anexe os documentos do cliente conforme o processo."}
      </p>

      <fieldset disabled={readOnly} className="m-0 min-w-0 border-0 p-0">
      <div className="space-y-2">
        <p className={comercialLabelClass}>Checklist da etapa</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {completed} de {total} concluídos
        </p>
        <ul className="space-y-2">
          {itemList.map(({ key, label }) => {
            const done = !!checklist[key];
            return (
              <li
                key={key}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800"
              >
                <input
                  type="checkbox"
                  id={`contrato-${key}`}
                  checked={done}
                  onChange={() => {
                    if (readOnly) return;
                    const next = !checklist[key];
                    onUpdateLead({
                      contratoChecklist: { ...checklist, [key]: next },
                      interactions: [
                        ...(lead.interactions ?? []),
                        {
                          id: createLogId(),
                          date: new Date().toISOString(),
                          user: currentUserName,
                          userId: currentUserId,
                          type: "sistema",
                          action: "UPDATE",
                          description: `${next ? "Marcou" : "Desmarcou"} no checklist de contratação: ${label}.`,
                        },
                      ],
                    });
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9]"
                />
                <label
                  htmlFor={`contrato-${key}`}
                  className={done ? "text-sm text-slate-500 line-through" : "text-sm text-slate-700 dark:text-slate-200"}
                >
                  {label}
                </label>
              </li>
            );
          })}
        </ul>
        {completed === total && (
          <p className="mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">Checklist concluído.</p>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <Paperclip className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
          Anexar arquivos do Cliente
        </h3>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          {readOnly
            ? "Arquivos enviados nesta etapa."
            : "Inclua minutas, assinaturas e qualquer documento necessário. Cada envio registra data e nome do arquivo."}
        </p>
        {!readOnly ? (
        <MultiFileAttachment
          existingFiles={[]}
          newFiles={[]}
          onNewFilesChange={(files) => {
            const now = new Date().toISOString();
            const novos = files.map((f) => ({ nome: f.name, anexadoEm: now }));
            if (!novos.length) return;
            const merged = [...anexosOrdenados, ...novos];
            const sorted = [...merged].sort(
              (a, b) => new Date(b.anexadoEm).getTime() - new Date(a.anexadoEm).getTime()
            );
            onUpdateLead({
              contratoAnexosCliente: sorted,
              interactions: [
                ...(lead.interactions ?? []),
                ...novos.map((a) => ({
                  id: createLogId(),
                  date: new Date().toISOString(),
                  user: currentUserName,
                  userId: currentUserId,
                  type: "sistema" as const,
                  action: "UPDATE" as const,
                  description: `Anexou arquivo do cliente: ${a.nome}.`,
                })),
              ],
            });
          }}
        />
        ) : null}
        {anexosOrdenados.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            {anexosOrdenados.map((a, idx) => (
              <li
                key={`${a.nome}-${a.anexadoEm}-${idx}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800/40"
              >
                <div className="min-w-0">
                  <span className="block truncate font-medium text-slate-800 dark:text-slate-100">{a.nome}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {formatAnexoData(a.anexadoEm)}
                  </span>
                </div>
                {!readOnly ? (
                <button
                  type="button"
                  onClick={() => {
                    const next = anexosOrdenados.filter((_, i) => i !== idx);
                    onUpdateLead({
                      contratoAnexosCliente: next,
                      interactions: [
                        ...(lead.interactions ?? []),
                        {
                          id: createLogId(),
                          date: new Date().toISOString(),
                          user: currentUserName,
                          userId: currentUserId,
                          type: "sistema",
                          action: "UPDATE",
                          description: `Removeu arquivo do cliente: ${a.nome}.`,
                        },
                      ],
                    });
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                  aria-label={`Excluir ${a.nome}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      </fieldset>
    </div>
  );
}
