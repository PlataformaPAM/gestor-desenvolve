"use client";

import { useState } from "react";
import { Globe2, Mail, Phone, Save, Text, User, X } from "lucide-react";
import type { PrioridadeTarefa } from "@/lib/tarefas/types";
import { iconForPrioridade, PRIORIDADE_LEADING_ICON } from "@/lib/tarefas/option-icons";
import { DrawerSheet } from "./drawer-sheet";
import type { Lead, LeadPriority, LeadOrigem, PipelineStageId } from "@/lib/comercial/types";
import { ORIGEM_OPCOES, ORIGEM_COM_DETALHE, PRIORIDADE_LABELS } from "@/lib/comercial/constants";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  FormSearchableSelectField,
  FormTextInput,
  formModalCancelButtonClass,
  formModalSubmitButtonClass,
} from "./field-styles";
import { iconForOrigem } from "./origem-icons";
import { formatBrazilianPhoneInput } from "@/lib/comercial/phone-input";

type NovoLeadPanelProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    raw: Partial<Lead> & Pick<Lead, "name" | "value" | "stageId" | "priority" | "origem">
  ) => void | Promise<void>;
};

const STAGE_PROSPECAO: PipelineStageId = "prospecao";

/** Igual a `lead-detail-dados.tsx` (modal de visualização do lead). */
const PRIORIDADE_SEARCH_OPTIONS = (
  Object.entries(PRIORIDADE_LABELS) as [LeadPriority, string][]
).map(([value, label]) => ({
  value,
  label,
  icon: iconForPrioridade(value as PrioridadeTarefa),
}));

export function NovoLeadPanel({ open, onClose, onSubmit }: NovoLeadPanelProps) {
  const [origem, setOrigem] = useState<LeadOrigem>("outro");
  const [origemDetalhe, setOrigemDetalhe] = useState("");
  const [name, setName] = useState("");
  const [priority, setPriority] = useState<LeadPriority>("media");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [salvando, setSalvando] = useState(false);

  const showOrigemDetalhe = ORIGEM_COM_DETALHE.includes(origem);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    setSalvando(true);
    try {
      await Promise.resolve(
        onSubmit({
          name: name.trim() || "Sem nome",
          value: 0,
          valorTotal: 0,
          stageId: STAGE_PROSPECAO,
          priority,
          origem,
          contact: contact.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          notes: showOrigemDetalhe && origemDetalhe.trim() ? origemDetalhe.trim() : undefined,
        })
      );
      setOrigem("outro");
      setOrigemDetalhe("");
      setName("");
      setPriority("media");
      setContact("");
      setPhone("");
      setEmail("");
      onClose();
    } catch {
      /* Erro e rollback tratados em `handleNovoLeadSubmit` (página Comercial). */
    } finally {
      setSalvando(false);
    }
  };

  return (
    <DrawerSheet
      open={open}
      onClose={onClose}
      title="Novo Lead"
      maxWidth="sm:max-w-3xl"
      mobileContentPaddingClassName="px-0"
      desktopContentPaddingClassName="px-0"
    >
      <form
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 lg:p-6">
          <FormSearchableSelectField id="novo-lead-origem" label="Origem">
            <SearchableSelect
              options={ORIGEM_OPCOES.map((opt) => ({
                value: opt.value,
                label: opt.label,
                icon: iconForOrigem(opt.value),
              }))}
              value={origem}
              onChange={(v) => setOrigem(v as LeadOrigem)}
              placeholder="Selecione a origem..."
              searchPlaceholder="Buscar origem..."
              searchable={false}
              leadingIcon={Globe2}
            />
          </FormSearchableSelectField>

          {showOrigemDetalhe && (
            <FormTextInput
              id="novo-lead-origem-detalhe"
              label="Detalhar origem"
              icon={Text}
              value={origemDetalhe}
              onChange={(e) => setOrigemDetalhe(e.target.value)}
              placeholder={
                origem === "evento"
                  ? "Ex: Feira XPTO 2025"
                  : origem === "indicacao"
                    ? "Ex: João Silva"
                    : "Ex: Detalhes da origem"
              }
            />
          )}

          <FormTextInput
            id="novo-lead-name"
            label="Nome do Lead (Assunto + Entidade)"
            required
            icon={Text}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Implantação ERP - Empresa XYZ"
          />

          <FormSearchableSelectField id="novo-lead-prioridade" label="Prioridade">
            <SearchableSelect
              options={PRIORIDADE_SEARCH_OPTIONS}
              value={priority}
              onChange={(v) => setPriority(v as LeadPriority)}
              placeholder="Selecione a prioridade..."
              searchPlaceholder="Buscar prioridade..."
              searchable={false}
              leadingIcon={PRIORIDADE_LEADING_ICON}
            />
          </FormSearchableSelectField>

          <FormTextInput
            id="novo-lead-contact"
            label="Contato"
            icon={User}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Nome do contato"
          />

          <FormTextInput
            id="novo-lead-phone"
            label="Telefone"
            icon={Phone}
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatBrazilianPhoneInput(e.target.value))}
            placeholder="(00) 00000-0000"
          />

          <FormTextInput
            id="novo-lead-email"
            label="E-mail"
            icon={Mail}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@empresa.com"
          />
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 lg:px-6">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button type="button" onClick={onClose} disabled={salvando} className={formModalCancelButtonClass}>
              <span className="inline-flex items-center gap-2">
                <X className="h-4 w-4" />
                Cancelar
              </span>
            </button>
            <button type="submit" disabled={salvando} className={formModalSubmitButtonClass}>
              <span className="inline-flex items-center gap-2">
                <Save className="h-4 w-4" />
                {salvando ? "Salvando…" : "Salvar"}
              </span>
            </button>
          </div>
        </div>
      </form>
    </DrawerSheet>
  );
}
