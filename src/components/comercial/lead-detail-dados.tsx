"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { AlertTriangle, Globe2, Mail, Phone, Text, User } from "lucide-react";
import type { Lead, LeadOrigem, LeadPriority } from "@/lib/comercial/types";
import type { PrioridadeTarefa } from "@/lib/tarefas/types";
import { iconForPrioridade, PRIORIDADE_LEADING_ICON } from "@/lib/tarefas/option-icons";
import type { Cliente, Contato } from "@/lib/clientes/types";
import type { UsuarioSistema } from "@/lib/configuracoes/types";
import {
  ORIGEM_OPCOES,
  ORIGEM_COM_DETALHE,
  PRIORIDADE_LABELS,
  CHECKLIST_DADOS_GERAIS,
} from "@/lib/comercial/constants";
import { LeadDadosClienteVinculado } from "./lead-dados-cliente-vinculado";
import { LeadDadosContatosOportunidade } from "./lead-dados-contatos-oportunidade";
import { LeadResponsavelEquipe } from "./lead-responsavel-equipe";
import { useAuth } from "@/contexts/auth-context";
import { buildOwnershipInteraction, getLeadOwnership } from "@/lib/comercial/ownership";
import {
  comercialReadOnlyClass,
  FormSearchableSelectField,
  FormTextInput,
  formModalCancelButtonClass,
  formModalSubmitButtonClass,
} from "./field-styles";
import { formLabelClass } from "@/components/ui/field-patterns";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { iconForOrigem } from "./origem-icons";

type LeadDetailDadosProps = {
  lead: Lead;
  /** Persiste alterações do lead (PATCH). Aceita parcial; use skipSuccessToast em autosaves. */
  onPersistLead: (
    updates: Partial<Lead>,
    opts?: { skipSuccessToast?: boolean; allowWhileFinanceiroLocked?: boolean }
  ) => void;
  clientes?: Cliente[];
  /** Apenas registra cliente novo no catálogo global (sem persistir lead). Opcional. */
  onClienteRegistrado?: (cliente: Cliente) => void;
  /** Atualiza contatos no cadastro do cliente vinculado. */
  onAtualizarContatosCliente?: (clienteId: string, contatos: Contato[]) => void;
  usuarios?: UsuarioSistema[];
  onClose?: () => void;
};

function deepCloneLead(l: Lead): Lead {
  return JSON.parse(JSON.stringify(l)) as Lead;
}

function formatPhoneInput(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.replace(/(\d{0,2})/, "($1");
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .slice(0, 15);
}

function createLogId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const PRIORIDADE_SEARCH_OPTIONS = (
  Object.entries(PRIORIDADE_LABELS) as [LeadPriority, string][]
).map(([value, label]) => ({
  value,
  label,
  icon: iconForPrioridade(value as PrioridadeTarefa),
}));

export function LeadDetailDados({
  lead,
  onPersistLead,
  clientes = [],
  onClienteRegistrado,
  onAtualizarContatosCliente = () => {},
  usuarios = [],
  onClose,
}: LeadDetailDadosProps) {
  const { session } = useAuth();
  const usuarioAtual = { nome: session.userName ?? "Usuário", userId: session.userId };

  /** Estado intocável para comparação (deep clone no mount / troca de lead) */
  const [snapshotOriginal, setSnapshotOriginal] = useState<Lead>(() => deepCloneLead(lead));
  /** Estado mutável que o formulário edita */
  const [formData, setFormData] = useState<Lead>(() => deepCloneLead(lead));
  const [draftClientes, setDraftClientes] = useState<Cliente[]>(() => [...clientes]);

  const [saveFeedback, setSaveFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  /** Novo lead ou vínculo de cliente atualizado no pai (ex.: cli-local → UUID após POST cliente). */
  useEffect(() => {
    setSnapshotOriginal(deepCloneLead(lead));
    setFormData(deepCloneLead(lead));
    setDraftClientes([...clientes]);
  }, [lead.id, lead.clienteId]);

  /** Catálogo do pai atualiza sem trocar o lead (ex.: outro fluxo adiciona cliente). */
  useEffect(() => {
    setDraftClientes((prev) => {
      const map = new Map<string, Cliente>();
      clientes.forEach((c) => map.set(c.id, c));
      prev.forEach((c) => {
        if (!map.has(c.id)) map.set(c.id, c);
      });
      return Array.from(map.values());
    });
  }, [clientes]);

  const showOrigemDetalhe = ORIGEM_COM_DETALHE.includes(formData.origem);
  const isProspecao = formData.stageId === "prospecao";
  const isQualificacao = formData.stageId === "qualificacao";
  const isAfterProspecao = !isProspecao;
  const hasContatoOficial = (formData.contatosOportunidade?.length ?? 0) > 0;
  const motivoPerdaDestaque = useMemo(() => {
    if (formData.stageId !== "perdido") return null;
    const interactions = formData.interactions ?? [];
    for (let i = interactions.length - 1; i >= 0; i -= 1) {
      const desc = interactions[i]?.description ?? "";
      const match = desc.match(/Lead marcado como Perdido\.\s*Motivo:\s*(.+)$/i);
      if (match?.[1]?.trim()) return match[1].trim();
    }
    return null;
  }, [formData.stageId, formData.interactions]);
  const clienteSelecionado = draftClientes.find((c) => c.id === formData.clienteId);
  const contatosClienteDisponiveis = clienteSelecionado?.contatos ?? [];

  const membrosEquipe = useMemo(
    () =>
      usuarios
        .filter((u) => u.ativo)
        .map((u) => ({ id: u.id, nome: (u.nomeExibicao?.trim() || u.email) })),
    [usuarios]
  );

  const resolveNomeCliente = useCallback(
    (clienteId: string | null) => {
      if (!clienteId) return null;
      const c = draftClientes.find((x) => x.id === clienteId);
      return c?.nome || c?.empresa || null;
    },
    [draftClientes]
  );

  const handleSalvar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const novosLogs: NonNullable<Lead["interactions"]> = [];
    const dataHora = new Date().toISOString();

    /** Campos mantidos na aba Proposta / estado do pai — não podem ser sobrescritos por formData desatualizado. */
    const merged: Lead = {
      ...formData,
      name: formData.name.trim() || formData.name,
      notes: showOrigemDetalhe ? formData.notes?.trim() || undefined : undefined,
      contact: formData.contact?.trim() || undefined,
      phone: formData.phone?.trim() || undefined,
      email: formData.email?.trim() || undefined,
      previsaoFechamento: lead.previsaoFechamento ?? formData.previsaoFechamento ?? undefined,
      solucoes: lead.solucoes ?? formData.solucoes,
      valorTotal: lead.valorTotal ?? formData.valorTotal,
      propostaGeradaEm: lead.propostaGeradaEm ?? formData.propostaGeradaEm,
    };

    // 1. CHECAGEM BRUTA DE CLIENTE
    const clienteAntigo = snapshotOriginal.clienteId ?? null;
    const clienteNovo = merged.clienteId ?? null;

    if (clienteAntigo !== clienteNovo) {
      if (clienteNovo) {
        const nomeExibicao =
          resolveNomeCliente(clienteNovo) ?? "Novo Cliente";
        novosLogs.push({
          id: createLogId(),
          date: dataHora,
          user: usuarioAtual.nome,
          userId: usuarioAtual.userId ?? null,
          type: "sistema",
          action: "UPDATE",
          description: `Vinculou o cliente: ${nomeExibicao}`,
        });
      } else {
        novosLogs.push({
          id: createLogId(),
          date: dataHora,
          user: usuarioAtual.nome,
          userId: usuarioAtual.userId ?? null,
          type: "sistema",
          action: "UPDATE",
          description: "Desvinculou o cliente.",
        });
      }
    }

    // 2. CONTATOS — por ID (nome em cada inclusão/remoção)
    const oldContatos = snapshotOriginal.contatosOportunidade ?? [];
    const newContatos = merged.contatosOportunidade ?? [];
    const oldIds = new Set(oldContatos.map((c) => c.id));
    const newIds = new Set(newContatos.map((c) => c.id));
    for (const c of newContatos) {
      if (!oldIds.has(c.id)) {
        const nome = c.nome?.trim() || "Novo contato";
        novosLogs.push({
          id: createLogId(),
          date: dataHora,
          user: usuarioAtual.nome,
          userId: usuarioAtual.userId ?? null,
          type: "sistema",
          action: "UPDATE",
          description: `Adicionou o contato: ${nome}.`,
        });
      }
    }
    for (const c of oldContatos) {
      if (!newIds.has(c.id)) {
        const nome = c.nome?.trim() || "Contato";
        novosLogs.push({
          id: createLogId(),
          date: dataHora,
          user: usuarioAtual.nome,
          userId: usuarioAtual.userId ?? null,
          type: "sistema",
          action: "UPDATE",
          description: `Removeu o contato: ${nome}.`,
        });
      }
    }
    if (
      oldContatos.length === newContatos.length &&
      oldContatos.length > 0 &&
      JSON.stringify(oldContatos) !== JSON.stringify(newContatos)
    ) {
      novosLogs.push({
        id: createLogId(),
        date: dataHora,
        user: usuarioAtual.nome,
        userId: usuarioAtual.userId ?? null,
        type: "sistema",
        action: "UPDATE",
        description: "Atualizou dados de um ou mais contatos da oportunidade.",
      });
    }

    // 3. Checklist Qualificação (geral-*) — itens marcados/desmarcados
    const checklistLinhas: string[] = [];
    CHECKLIST_DADOS_GERAIS.forEach((label, idx) => {
      const k = `geral-${idx}`;
      const antes = !!(snapshotOriginal.checklistProgress ?? {})[k];
      const depois = !!(merged.checklistProgress ?? {})[k];
      if (antes !== depois) {
        checklistLinhas.push(depois ? `Marcou: "${label}"` : `Desmarcou: "${label}"`);
      }
    });
    if (checklistLinhas.length > 0) {
      novosLogs.push({
        id: createLogId(),
        date: dataHora,
        user: usuarioAtual.nome,
        userId: usuarioAtual.userId ?? null,
        type: "sistema",
        action: "UPDATE",
        field: "checklist",
        fieldKey: "checklist",
        description: `Checklist de Qualificação: ${checklistLinhas.join("; ")}.`,
      });
    }

    const ownershipAnterior = getLeadOwnership(snapshotOriginal);
    const ownershipAtual = getLeadOwnership(merged);

    /** Base no lead do pai (evita perder histórico vindo de outras abas); dedup por id. */
    const baseInteractions = lead.interactions ?? snapshotOriginal.interactions ?? [];
    const withOwnership = buildOwnershipInteraction({
      base: baseInteractions,
      previous: ownershipAnterior,
      next: ownershipAtual,
      userName: usuarioAtual.nome,
      userId: usuarioAtual.userId ?? null,
    });
    const idsNaBase = new Set(withOwnership.map((i) => i.id));
    const interactionsFinais = [
      ...withOwnership,
      ...novosLogs.filter((log) => !idsNaBase.has(log.id)),
    ];

    const payloadParaSalvar: Lead = {
      ...merged,
      interactions: interactionsFinais,
    };

    try {
      await Promise.resolve(onPersistLead(payloadParaSalvar));
      const baseline = deepCloneLead(payloadParaSalvar);
      setSnapshotOriginal(baseline);
      setFormData(baseline);
      setSaveFeedback({ kind: "success", text: "Salvo com sucesso!" });
      setTimeout(() => setSaveFeedback(null), 4000);
    } catch {
      setSaveFeedback({ kind: "error", text: "Erro ao salvar os dados." });
      setTimeout(() => setSaveFeedback(null), 6000);
    }
  };

  const toggleChecklistItem = (idx: number) => {
    const key = `geral-${idx}`;
    setFormData((prev) => ({
      ...prev,
      checklistProgress: {
        ...(prev.checklistProgress ?? {}),
        [key]: !(prev.checklistProgress ?? {})[key],
      },
    }));
  };

  return (
    <form onSubmit={handleSalvar} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 lg:p-6">
      {saveFeedback && (
        <div
          role="status"
          className={
            saveFeedback.kind === "success"
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              : "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          }
        >
          {saveFeedback.text}
        </div>
      )}

      <div className="space-y-4">
        {motivoPerdaDestaque && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-900/60 dark:bg-red-950/30">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4" />
              Motivo da perda
            </p>
            <p className="mt-1 text-sm font-medium text-red-800 dark:text-red-200">{motivoPerdaDestaque}</p>
          </div>
        )}
        <FormTextInput
          id="lead-nome"
          label="Nome do Lead (Assunto + Entidade)"
          required
          icon={Text}
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Ex: Implantação ERP - Empresa XYZ"
        />

        <FormSearchableSelectField id="lead-origem" label="Origem">
          <SearchableSelect
            options={ORIGEM_OPCOES.map((opt) => ({
              value: opt.value,
              label: opt.label,
              icon: iconForOrigem(opt.value),
            }))}
            value={formData.origem}
            onChange={(v) => setFormData((prev) => ({ ...prev, origem: v as LeadOrigem }))}
            placeholder="Selecione a origem..."
            searchPlaceholder="Buscar origem..."
            searchable={false}
            leadingIcon={Globe2}
          />
        </FormSearchableSelectField>

        {showOrigemDetalhe && (
          <FormTextInput
            id="lead-origem-detalhe"
            label="Detalhar origem"
            icon={Text}
            value={formData.notes ?? ""}
            onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Ex: Evento, indicador ou outro detalhe"
          />
        )}

        <FormSearchableSelectField id="lead-prioridade" label="Prioridade">
          <SearchableSelect
            options={PRIORIDADE_SEARCH_OPTIONS}
            value={formData.priority}
            onChange={(v) => setFormData((prev) => ({ ...prev, priority: v as LeadPriority }))}
            placeholder="Selecione a prioridade..."
            searchPlaceholder="Buscar prioridade..."
            searchable={false}
            leadingIcon={PRIORIDADE_LEADING_ICON}
          />
        </FormSearchableSelectField>

        <LeadResponsavelEquipe
          usuarioAtual={{ id: session.userId ?? "", nome: session.userName ?? "Usuário" }}
          membrosEquipe={membrosEquipe}
          leadContext={{
            interactions: formData.interactions,
            criadoPorId: formData.criadoPorId,
            registroCriadoPorNome: formData.registroCriadoPorNome,
          }}
          onApplyOwnership={(previous, next) => {
            setFormData((prev) => ({
              ...prev,
              interactions: buildOwnershipInteraction({
                base: prev.interactions ?? [],
                previous,
                next,
                userName: usuarioAtual.nome,
                userId: usuarioAtual.userId ?? null,
              }),
            }));
          }}
        />
      </div>

      {isAfterProspecao ? (
        <div className="space-y-4">
          {isQualificacao && !formData.clienteId && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Vincule ou cadastre um cliente para avançar na etapa de Qualificação.
            </div>
          )}
          <LeadDadosClienteVinculado
            lead={formData}
            clientes={draftClientes}
            onVincularCliente={(clienteId) => {
              if (!clienteId) {
                setFormData((prev) => ({ ...prev, clienteId: null, contatosOportunidade: [] }));
                onPersistLead({ clienteId: null, contatosOportunidade: [] }, { skipSuccessToast: true });
                return;
              }
              setFormData((prev) => ({ ...prev, clienteId, contatosOportunidade: [] }));
              onPersistLead({ clienteId, contatosOportunidade: [] }, { skipSuccessToast: true });
            }}
            onCadastrarCliente={(cliente) => {
              const newId = `cli-local-${Date.now()}`;
              const newCliente: Cliente = { ...cliente, id: newId };
              setDraftClientes((prev) => [...prev, newCliente]);
              setFormData((prev) => ({ ...prev, clienteId: newId, contatosOportunidade: [] }));
              onClienteRegistrado?.(newCliente);
            }}
          />
          {!hasContatoOficial && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                Contato original da prospecção
              </p>
              <FormTextInput
                id="lead-co-contact"
                label="Contato"
                icon={User}
                value={formData.contact ?? ""}
                readOnly
                disabled
                inputClassName={comercialReadOnlyClass}
              />
              <FormTextInput
                id="lead-co-phone"
                label="Telefone"
                icon={Phone}
                type="tel"
                value={formData.phone ?? ""}
                readOnly
                disabled
                inputClassName={comercialReadOnlyClass}
              />
              <FormTextInput
                id="lead-co-email"
                label="E-mail"
                icon={Mail}
                type="email"
                value={formData.email ?? ""}
                readOnly
                disabled
                inputClassName={comercialReadOnlyClass}
              />
            </div>
          )}
          <LeadDadosContatosOportunidade
            lead={formData}
            onApplyLocal={(updates) => setFormData((prev) => ({ ...prev, ...updates }))}
            onPersistToServer={(updates) => onPersistLead(updates, { skipSuccessToast: true })}
            initialContatoNome={formData.contact ?? ""}
            initialContatoTelefone={formData.phone ?? ""}
            initialContatoEmail={formData.email ?? ""}
            contatosClienteDisponiveis={contatosClienteDisponiveis}
            onCriarContatoNoCliente={(novoContato) => {
              if (!formData.clienteId) return;
              const nextContatos = [
                ...(clienteSelecionado?.contatos ?? []).filter((c) => c.id !== novoContato.id),
                novoContato,
              ];
              onAtualizarContatosCliente(formData.clienteId, nextContatos);
              setDraftClientes((prev) =>
                prev.map((c) => (c.id === formData.clienteId ? { ...c, contatos: nextContatos } : c))
              );
            }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <FormTextInput
            id="lead-contact"
            label="Contato"
            icon={User}
            value={formData.contact ?? ""}
            onChange={(e) => setFormData((prev) => ({ ...prev, contact: e.target.value }))}
            placeholder="Nome do contato"
          />
          <FormTextInput
            id="lead-phone"
            label="Telefone"
            icon={Phone}
            type="tel"
            value={formData.phone ?? ""}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, phone: formatPhoneInput(e.target.value) }))
            }
            placeholder="(00) 00000-0000"
          />
          <FormTextInput
            id="lead-email"
            label="E-mail"
            icon={Mail}
            type="email"
            value={formData.email ?? ""}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="email@empresa.com"
          />
        </div>
      )}

      {isQualificacao && (
        <div className="space-y-2">
          <p className={formLabelClass}>Checklist da Etapa</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Conclua os itens para qualificar o lead.
          </p>
          <ul className="space-y-2">
            {CHECKLIST_DADOS_GERAIS.map((label, idx) => {
              const key = `geral-${idx}`;
              const checked = !!(formData.checklistProgress ?? {})[key];
              return (
                <li
                  key={key}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    id={key}
                    checked={checked}
                    onChange={() => toggleChecklistItem(idx)}
                    className="h-4 w-4 rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9]"
                  />
                  <label htmlFor={key} className="text-sm text-slate-700 dark:text-slate-200">
                    {label}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 lg:px-6">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
        {onClose ? (
          <button type="button" onClick={onClose} className={formModalCancelButtonClass}>
            Cancelar
          </button>
        ) : null}
        <button type="submit" className={formModalSubmitButtonClass}>
          Salvar
        </button>
        </div>
      </div>
    </form>
  );
}
