"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { AlertTriangle, BadgeHelp, CircleMinus, Text } from "lucide-react";
import type { Lead, LeadOrigem, LeadPriority } from "@/lib/comercial/types";
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
  comercialInputClass,
  comercialLabelClass,
  comercialReadOnlyClass,
} from "./field-styles";
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

export function LeadDetailDados({
  lead,
  onPersistLead,
  clientes = [],
  onClienteRegistrado,
  onAtualizarContatosCliente = () => {},
  usuarios = [],
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
    <form onSubmit={handleSalvar} className="space-y-5 p-4 lg:p-6">
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
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
          <h4 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            Responsável e equipe
          </h4>
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

        <div>
          <label htmlFor="lead-origem" className={comercialLabelClass}>
            Origem
          </label>
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
            leadingIcon={BadgeHelp}
          />
        </div>

        {showOrigemDetalhe && (
          <div>
            <label htmlFor="lead-origem-detalhe" className={comercialLabelClass}>
              Detalhar origem
            </label>
            <div className="relative">
              <Text className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="lead-origem-detalhe"
                type="text"
                value={formData.notes ?? ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Ex: Evento, indicador ou outro detalhe"
                className={`${comercialInputClass} pl-9`}
              />
            </div>
          </div>
        )}

        <div>
          <label htmlFor="lead-nome" className={comercialLabelClass}>
            Nome do Lead (Assunto + Entidade) *
          </label>
          <div className="relative">
            <Text className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="lead-nome"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: Implantação ERP - Empresa XYZ"
              className={`${comercialInputClass} pl-9`}
              required
            />
          </div>
        </div>

        <div>
          <p className="mb-1 block text-sm font-medium text-slate-700">Prioridade</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {(Object.keys(PRIORIDADE_LABELS) as LeadPriority[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, priority: p }))}
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all ${
                  p === "alta"
                    ? "bg-red-100 text-red-800 border-red-200"
                    : p === "media"
                      ? "bg-amber-100 text-amber-800 border-amber-200"
                      : "bg-slate-100 text-slate-700 border-slate-200"
                } ${formData.priority === p ? "ring-2 ring-offset-1 ring-[#6D28D9]" : "hover:opacity-90"}`}
                aria-pressed={formData.priority === p}
              >
                {p === "alta" ? <AlertTriangle className="mr-1 h-3.5 w-3.5" /> : null}
                {p === "media" ? <BadgeHelp className="mr-1 h-3.5 w-3.5" /> : null}
                {p === "baixa" ? <CircleMinus className="mr-1 h-3.5 w-3.5" /> : null}
                {PRIORIDADE_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isAfterProspecao ? (
        <>
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
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <p className="text-sm font-medium text-slate-700">Contato original da prospecção</p>
              <input
                type="text"
                value={formData.contact ?? ""}
                readOnly
                disabled
                className={comercialReadOnlyClass}
              />
              <input
                type="text"
                value={formData.phone ?? ""}
                readOnly
                disabled
                className={comercialReadOnlyClass}
              />
              <input
                type="email"
                value={formData.email ?? ""}
                readOnly
                disabled
                className={comercialReadOnlyClass}
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
        </>
      ) : (
        <>
          <div>
            <label htmlFor="lead-contact" className={comercialLabelClass}>
              Contato
            </label>
            <div className="relative">
              <Text className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="lead-contact"
                type="text"
                value={formData.contact ?? ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, contact: e.target.value }))}
                placeholder="Nome do contato"
                className={`${comercialInputClass} pl-9`}
              />
            </div>
          </div>

          <div>
            <label htmlFor="lead-phone" className={comercialLabelClass}>
              Telefone
            </label>
            <div className="relative">
              <Text className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="lead-phone"
                type="text"
                value={formData.phone ?? ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: formatPhoneInput(e.target.value) }))}
                placeholder="(00) 00000-0000"
                className={`${comercialInputClass} pl-9`}
              />
            </div>
          </div>

          <div>
            <label htmlFor="lead-email" className={comercialLabelClass}>
              E-mail
            </label>
            <div className="relative">
              <Text className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="lead-email"
                type="email"
                value={formData.email ?? ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="email@empresa.com"
                className={`${comercialInputClass} pl-9`}
              />
            </div>
          </div>
        </>
      )}

      {isQualificacao && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <h4 className="mb-2 text-sm font-semibold text-slate-800">Checklist da Etapa</h4>
          <p className="mb-3 text-xs text-slate-500">Conclua os itens para qualificar o lead.</p>
          <ul className="space-y-2">
            {CHECKLIST_DADOS_GERAIS.map((label, idx) => {
              const key = `geral-${idx}`;
              const checked = !!(formData.checklistProgress ?? {})[key];
              return (
                <li key={key} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={key}
                    checked={checked}
                    onChange={() => toggleChecklistItem(idx)}
                    className="h-4 w-4 rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9]"
                  />
                  <label htmlFor={key} className="text-sm text-slate-700">
                    {label}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <button
        type="submit"
        className="w-full rounded-xl bg-[#6D28D9] px-4 py-3 font-semibold text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:ring-offset-2"
      >
        Salvar alterações
      </button>
    </form>
  );
}
