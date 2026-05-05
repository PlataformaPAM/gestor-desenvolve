"use client";

import { useState } from "react";
import { AlertTriangle, BadgeHelp, CircleMinus, Mail, Phone, Text, User } from "lucide-react";
import { DrawerSheet } from "./drawer-sheet";
import type { Lead, LeadPriority, LeadOrigem, PipelineStageId } from "@/lib/comercial/types";
import { ORIGEM_OPCOES, ORIGEM_COM_DETALHE } from "@/lib/comercial/constants";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  FormSearchableSelectField,
  FormTextInput,
  formModalCancelButtonClass,
  formModalSubmitButtonClass,
} from "./field-styles";
import { formLabelClass } from "@/components/ui/field-patterns";
import { iconForOrigem } from "./origem-icons";

type NovoLeadPanelProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (raw: Partial<Lead> & Pick<Lead, "name" | "value" | "stageId" | "priority" | "origem">) => void;
};

const STAGE_PROSPECAO: PipelineStageId = "prospecao";

const PRIORIDADE_OPCOES: { value: LeadPriority; label: string; badgeClass: string }[] = [
  { value: "alta", label: "Alta", badgeClass: "bg-red-100 text-red-800 border-red-200" },
  { value: "media", label: "Média", badgeClass: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "baixa", label: "Baixa", badgeClass: "bg-slate-100 text-slate-700 border-slate-200" },
];

export function NovoLeadPanel({
  open,
  onClose,
  onSubmit,
}: NovoLeadPanelProps) {
  const [origem, setOrigem] = useState<LeadOrigem>("outro");
  const [origemDetalhe, setOrigemDetalhe] = useState("");
  const [name, setName] = useState("");
  const [priority, setPriority] = useState<LeadPriority>("media");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const showOrigemDetalhe = ORIGEM_COM_DETALHE.includes(origem);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
    });
    setOrigem("outro");
    setOrigemDetalhe("");
    setName("");
    setPriority("media");
    setContact("");
    setPhone("");
    setEmail("");
    onClose();
  };

  return (
    <DrawerSheet
      open={open}
      onClose={onClose}
      title="+ Novo Lead"
    >
      <div className="max-h-[85vh] overflow-y-auto p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
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
              leadingIcon={BadgeHelp}
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

          <div>
            <p className={formLabelClass}>Prioridade</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {PRIORIDADE_OPCOES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(opt.value)}
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all ${opt.badgeClass} ${
                    priority === opt.value ? "ring-2 ring-offset-1 ring-[#6D28D9]" : "hover:opacity-90"
                  }`}
                  aria-pressed={priority === opt.value}
                >
                  {opt.value === "alta" ? <AlertTriangle className="mr-1 h-3.5 w-3.5" /> : null}
                  {opt.value === "media" ? <BadgeHelp className="mr-1 h-3.5 w-3.5" /> : null}
                  {opt.value === "baixa" ? <CircleMinus className="mr-1 h-3.5 w-3.5" /> : null}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

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
            onChange={(e) => setPhone(e.target.value)}
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

          <div className="shrink-0 bg-white px-4 py-3 lg:px-6 lg:py-3">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button type="button" onClick={onClose} className={formModalCancelButtonClass}>
                Cancelar
              </button>
              <button type="submit" className={formModalSubmitButtonClass}>
                Salvar lead
              </button>
            </div>
          </div>
        </form>
      </div>
    </DrawerSheet>
  );
}
