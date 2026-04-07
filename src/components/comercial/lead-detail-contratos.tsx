"use client";

import { Check } from "lucide-react";
import type { Lead } from "@/lib/comercial/types";
import { MultiFileAttachment } from "@/components/ui/multifile-attachment";
import { useAuth } from "@/contexts/auth-context";

type LeadDetailContratosProps = {
  lead: Lead;
  onUpdateLead: (updates: Partial<Lead>) => void;
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

export function LeadDetailContratos({ lead, onUpdateLead }: LeadDetailContratosProps) {
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
  const nomesAnexos = anexosOrdenados.map((a) => a.nome);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Conclua o checklist da etapa de contratação e anexe os documentos do cliente conforme o processo.
      </p>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Checklist da etapa</h3>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          {completed} de {total} concluídos
        </p>
        <ul className="space-y-2">
          {itemList.map(({ key, label }) => {
            const done = !!checklist[key];
            return (
              <li key={key} className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
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
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    done
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-300 bg-white text-slate-400 hover:border-[#6D28D9] hover:text-[#6D28D9] dark:border-slate-600 dark:bg-slate-900"
                  }`}
                  aria-label={done ? "Desmarcar" : "Marcar como concluído"}
                >
                  {done ? <Check className="h-4 w-4" /> : null}
                </button>
                <span className={done ? "text-slate-500 line-through" : "text-slate-800 dark:text-slate-200"}>
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
        {completed === total && (
          <p className="mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">Checklist concluído.</p>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          Anexar arquivos do Cliente
        </h3>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Inclua minutas, assinaturas e qualquer documento necessário. Cada envio registra data e nome do arquivo.
        </p>
        <MultiFileAttachment
          existingFiles={nomesAnexos}
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
        {anexosOrdenados.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            {anexosOrdenados.map((a) => (
              <li
                key={`${a.nome}-${a.anexadoEm}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800/50"
              >
                <span className="font-medium text-slate-800 dark:text-slate-100">{a.nome}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {formatAnexoData(a.anexadoEm)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
