"use client";

import { useState } from "react";
import { Clock, Eye, FileText, Phone, Plus, Trophy, MessageSquare } from "lucide-react";
import type { LeadInteraction } from "@/lib/comercial/types";
import { MultiFileAttachment } from "@/components/ui/multifile-attachment";

type LeadDetailHistoricoProps = {
  interactions: LeadInteraction[];
  onAddInteraction: (entry: { description: string; anexos?: Array<string | { name: string; url: string }> }) => void;
  readOnly?: boolean;
};

const TYPE_CONFIG: Record<
  LeadInteraction["type"],
  { label: string; icon: React.ElementType; className: string }
> = {
  etapa: {
    label: "Etapa",
    icon: Clock,
    className: "bg-[#6D28D9]/10 text-[#6D28D9]",
  },
  contato: {
    label: "Contato",
    icon: Phone,
    className: "bg-slate-100 text-slate-600",
  },
  observacao: {
    label: "Observação",
    icon: FileText,
    className: "bg-amber-50 text-amber-700",
  },
  ganhou: {
    label: "Ganhou",
    icon: Trophy,
    className: "bg-emerald-50 text-emerald-700",
  },
  sistema: {
    label: "Sistema",
    icon: FileText,
    className: "bg-blue-50 text-blue-700",
  },
  arquivo: {
    label: "Arquivo",
    icon: FileText,
    className: "bg-violet-50 text-violet-700",
  },
  proposta: {
    label: "Proposta",
    icon: FileText,
    className: "bg-indigo-50 text-indigo-700",
  },
};

function formatInteractionDate(iso: string): string {
  const d = new Date(iso);
  const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${data} ${hora}`;
}

const fieldTranslations: Record<string, string> = {
  priority: "Prioridade",
  notes: "Observações",
  origem: "Origem do Lead",
  clienteId: "Cliente Vinculado",
  contato: "Contato",
  checklist: "Checklist",
  stageId: "Etapa do Funil",
  etapa: "Etapa",
  name: "Nome do Lead",
  contact: "Contato",
  phone: "Telefone",
  email: "E-mail",
  solucoes: "Soluções",
  propostaGeradaEm: "Proposta Gerada Em",
  contratoChecklist: "Checklist de Contratação",
  contratoArquivos: "Arquivos de Contrato",
  previsaoFechamento: "Previsão de Fechamento",
};

function formatValue(value: unknown): string {
  const valueTranslations: Record<string, string> = {
    prospecao: "Prospecção",
    qualificacao: "Qualificação",
    proposta: "Proposta",
    contratacao: "Contratação",
    fechado: "Fechado",
    perdido: "Perdido",
  };
  if (value === null || value === undefined) return "Vazio";
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return "Vazio";
    return valueTranslations[raw] ?? raw;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (!value.length) return "Vazio";
    return value
      .map((item) => {
        if (item === null || item === undefined) return "Vazio";
        if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") return String(item);
        if (typeof item === "object") {
          const obj = item as Record<string, unknown>;
          return String(obj.nome ?? obj.name ?? obj.title ?? obj.label ?? obj.filename ?? obj.id ?? "Item");
        }
        return "Item";
      })
      .join(", ");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const direct = obj.nome ?? obj.name ?? obj.title ?? obj.label ?? obj.filename;
    if (direct) return String(direct);
    const keys = Object.keys(obj);
    if (!keys.length) return "Vazio";
    return keys.map((k) => `${k}: ${formatValue(obj[k])}`).join(" | ");
  }
  return String(value);
}

export function LeadDetailHistorico({
  interactions,
  onAddInteraction,
  readOnly = false,
}: LeadDetailHistoricoProps) {
  const [novaAtualizacao, setNovaAtualizacao] = useState("");
  const [arquivosAtualizacao, setArquivosAtualizacao] = useState<File[]>([]);

  const handleAdicionarAtualizacao = () => {
    if (!novaAtualizacao.trim() && arquivosAtualizacao.length === 0) return;
    const anexos = arquivosAtualizacao.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
    }));
    onAddInteraction({
      description: novaAtualizacao.trim() || "Atualização registrada com anexos.",
      anexos,
    });
    setNovaAtualizacao("");
    setArquivosAtualizacao([]);
  };

  const mappedFieldKeysLower = new Set(
    [
      "priority",
      "notes",
      "origem",
      "clienteid",
      "contato",
      "checklist",
      "stageid",
      "etapa",
      "name",
      "contact",
      "phone",
      "email",
      "solucoes",
      "propostageradaem",
      "contratochecklist",
      "contratoarquivos",
      "previsaofechamento",
      "valortotal",
      "value",
      "enteredstageat",
    ].map((k) => k.toLowerCase())
  );
  const ignoredTechnicalFields = new Set([
    "interacoes",
    "interactions",
    "contatosoportunidade",
    "updatedat",
    "id",
  ]);
  const visibleInteractions = interactions.filter((item) => {
    if (item.action === "CREATE") return true;
    if (item.type !== "sistema") return true;
    if (item.description?.trim()) return true;
    const fieldKey = (item.field ?? item.fieldKey)?.trim().toLowerCase();
    if (!fieldKey) return false;
    if (ignoredTechnicalFields.has(fieldKey)) return false;
    return mappedFieldKeysLower.has(fieldKey);
  });

  const sorted = [...visibleInteractions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {!readOnly ? (
      <div className="space-y-3">
        <div className="relative">
          <MessageSquare className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <textarea
            value={novaAtualizacao}
            onChange={(e) => setNovaAtualizacao(e.target.value)}
            placeholder="Descreva a ação realizada, resposta ao cliente ou nota interna..."
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20"
          />
        </div>
        <MultiFileAttachment
          existingFiles={[]}
          newFiles={arquivosAtualizacao}
          onNewFilesChange={setArquivosAtualizacao}
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleAdicionarAtualizacao}
            disabled={!novaAtualizacao.trim() && arquivosAtualizacao.length === 0}
            className="rounded-lg bg-[#6D28D9] px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              Adicionar
            </span>
          </button>
        </div>
      </div>
      ) : null}

      <ul className={`relative space-y-0 ${readOnly ? "" : "border-t border-slate-200 pt-6"}`}>
        <span
          className="absolute left-[11px] top-2 bottom-2 w-px bg-slate-200"
          aria-hidden
        />
        {sorted.length === 0 ? (
          <li className="text-sm text-slate-500">Nenhuma ação registrada ainda.</li>
        ) : (
          sorted.map((item) => {
            const config = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.sistema;
            const Icon = config.icon;
            return (
              <li key={item.id} className="relative flex gap-3 pb-6 last:pb-0">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${config.className}`}
                >
                  <Icon className="h-3 w-3" />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-xs font-medium text-slate-500">
                    {formatInteractionDate(item.date)} - {item.user?.trim() || "Sistema"}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-700">
                    {item.description?.trim()
                      ? item.description
                      : item.action === "CREATE"
                        ? item.description
                        : item.action === "UPDATE" && (item.field ?? item.fieldKey)
                          ? (item.field ?? item.fieldKey) === "etapa" ||
                            (item.field ?? item.fieldKey) === "stageId"
                            ? `Etapa alterada de ${formatValue(item.oldValue)} para ${formatValue(item.newValue)}`
                            : `Campo ${fieldTranslations[(item.field ?? item.fieldKey) as string] ?? (item.field ?? item.fieldKey)} alterado de ${formatValue(item.oldValue)} para ${formatValue(item.newValue)}`
                          : "—"}
                  </p>
                  {item.anexos?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.anexos.map((anexo, idx) => {
                        const nome = typeof anexo === "string" ? anexo : anexo.name;
                        const url = typeof anexo === "string" ? (/^https?:\/\//i.test(anexo) ? anexo : undefined) : anexo.url;
                        if (!url) return null;
                        return (
                          <a
                            key={`${nome}-${idx}`}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 transition-colors hover:bg-slate-200"
                          >
                            <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                            <span className="text-xs font-medium text-slate-700">{nome}</span>
                            <Eye className="h-4 w-4 text-slate-400" />
                          </a>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
