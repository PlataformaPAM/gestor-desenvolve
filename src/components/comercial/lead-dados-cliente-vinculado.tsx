"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Lock, Building2, Mail, Phone, MapPin, Hash, Save, Unlink, X } from "lucide-react";
import type { Lead } from "@/lib/comercial/types";
import type { Cliente, ClienteEndereco } from "@/lib/clientes/types";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { fetchCnpjBrasilApi } from "@/lib/clientes/brasilapi-cnpj";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  comercialInputClass,
  comercialLabelClass,
  formModalCancelButtonClass,
  formModalSubmitButtonClass,
} from "./field-styles";
import { formInputCompactClass } from "@/components/ui/field-patterns";
import { formatBrazilianPhoneInput } from "@/lib/comercial/phone-input";

type LeadDadosClienteVinculadoProps = {
  lead: Lead;
  clientes: Cliente[];
  onVincularCliente: (clienteId: string | null) => void;
  onCadastrarCliente: (cliente: Omit<Cliente, "id">) => void;
  initialEmpresaName?: string;
};

const defaultEndereco: ClienteEndereco = {
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  cep: "",
};

export function LeadDadosClienteVinculado({
  lead,
  clientes,
  onVincularCliente,
  onCadastrarCliente,
  initialEmpresaName = "",
}: LeadDadosClienteVinculadoProps) {
  const [expandNovo, setExpandNovo] = useState(false);
  const [pedirDesvinculoCliente, setPedirDesvinculoCliente] = useState(false);

  const [cnpjRaw, setCnpjRaw] = useState("");
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [empresa, setEmpresa] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [endereco, setEndereco] = useState<ClienteEndereco>(defaultEndereco);
  const [emailEmpresa, setEmailEmpresa] = useState("");
  const [telefoneEmpresa, setTelefoneEmpresa] = useState("");

  const clienteVinculado = useMemo(
    () => (lead.clienteId ? clientes.find((c) => c.id === lead.clienteId) ?? null : null),
    [clientes, lead.clienteId]
  );

  useEffect(() => {
    const digits = cnpjRaw.replace(/\D/g, "");
    if (digits.length !== 14) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoadingCnpj(true);
    });
    fetchCnpjBrasilApi(digits)
      .then((res) => {
        if (cancelled || !res) return;
        setEmpresa(res.empresa);
        setNomeFantasia(res.nomeFantasia);
        setEndereco((prev) => ({ ...defaultEndereco, ...prev, ...res.endereco }));
        if (res.email) setEmailEmpresa(res.email);
        if (res.telefone) setTelefoneEmpresa(formatBrazilianPhoneInput(res.telefone));
      })
      .finally(() => setLoadingCnpj(false));
    return () => {
      cancelled = true;
    };
  }, [cnpjRaw]);

  useEffect(() => {
    if (!expandNovo) return;
    if (empresa.trim()) return;
    if (initialEmpresaName.trim()) {
      const nome = initialEmpresaName.trim();
      queueMicrotask(() => {
        setEmpresa(nome);
        setNomeFantasia(nome);
      });
    }
  }, [expandNovo, empresa, initialEmpresaName]);

  const resetNovoForm = () => {
    setCnpjRaw("");
    setEmpresa("");
    setNomeFantasia("");
    setEndereco(defaultEndereco);
    setEmailEmpresa("");
    setTelefoneEmpresa("");
    setExpandNovo(false);
  };

  const handleCadastrar = () => {
    const cnpjFormatado =
      cnpjRaw.replace(/\D/g, "").length === 14
        ? cnpjRaw.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
        : cnpjRaw;
    onCadastrarCliente({
      nome: nomeFantasia.trim() || empresa.trim() || "Sem nome",
      empresa: empresa.trim() || nomeFantasia.trim() || "Sem razão social",
      cpfCnpj: cnpjFormatado,
      status: "ativo",
      valorMensal: 0,
      segmento: "outros",
      email: emailEmpresa.trim() || undefined,
      telefone: telefoneEmpresa.trim() || undefined,
      endereco: Object.values(endereco).some((v) => v && String(v).trim()) ? endereco : undefined,
    });
    resetNovoForm();
  };

  if (clienteVinculado) {
    return (
      <>
        <div className="space-y-2">
          <label className={comercialLabelClass}>Cliente vinculado</label>
          <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                <Lock className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                {clienteVinculado.empresa || clienteVinculado.nome}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{clienteVinculado.cpfCnpj}</p>
              {clienteVinculado.endereco?.cidade && (
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {clienteVinculado.endereco.cidade} / {clienteVinculado.endereco.uf}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPedirDesvinculoCliente(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <Unlink className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Remover
            </button>
          </div>
        </div>
        <AlertDialog
          open={pedirDesvinculoCliente}
          onClose={() => setPedirDesvinculoCliente(false)}
          onConfirm={() => onVincularCliente(null)}
          title="Remover cliente deste lead?"
          description={
            <>
              <strong className="text-slate-900 dark:text-slate-100">Esta ação é irreversível ao salvar:</strong> o vínculo
              com{" "}
              <strong className="text-slate-900 dark:text-slate-100">
                {clienteVinculado.empresa || clienteVinculado.nome}
              </strong>{" "}
              será desfeito e poderá afetar checklist e contratos até novo vínculo.
            </>
          }
          cancelLabel="Cancelar"
          confirmLabel="Sim, remover permanentemente"
          destructive
        />
      </>
    );
  }

  return (
    <div className="space-y-3">
      {!expandNovo ? (
        <>
          <div className="space-y-1">
            <label className={comercialLabelClass}>Cliente vinculado</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <SearchableSelect
                  options={clientes.map((c) => ({
                    value: c.id,
                    label: c.empresa || c.nome,
                    subtitle: c.cpfCnpj,
                    icon: Building2,
                  }))}
                  value=""
                  onChange={(clienteId) => onVincularCliente(clienteId)}
                  placeholder="Selecionar cliente..."
                  searchPlaceholder="Buscar por CNPJ ou nome..."
                  emptyLabel="Nenhum cliente encontrado na base."
                  leadingIcon={Building2}
                />
              </div>
              <button
                type="button"
                onClick={() => setExpandNovo(true)}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
              >
                <Plus className="h-4 w-4" />
                Novo Cliente
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div>
            <label className={comercialLabelClass}>CNPJ (14 dígitos)</label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={cnpjRaw}
                onChange={(e) => setCnpjRaw(e.target.value.replace(/\D/g, "").slice(0, 14))}
                placeholder="00000000000000"
                className={`${comercialInputClass} pl-9 pr-10 font-mono`}
              />
            </div>
            {loadingCnpj && <p className="mt-1 text-xs text-slate-500">Consultando BrasilAPI...</p>}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={comercialLabelClass}>Razão Social</label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  className={`${comercialInputClass} pl-9`}
                />
              </div>
            </div>
            <div>
              <label className={comercialLabelClass}>Nome Fantasia</label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={nomeFantasia}
                  onChange={(e) => setNomeFantasia(e.target.value)}
                  className={`${comercialInputClass} pl-9`}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className={comercialLabelClass}>CEP</label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={endereco.cep}
                  onChange={(e) => setEndereco((p) => ({ ...p, cep: e.target.value }))}
                  className={`${comercialInputClass} pl-9`}
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className={comercialLabelClass}>Rua</label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={endereco.logradouro}
                  onChange={(e) => setEndereco((p) => ({ ...p, logradouro: e.target.value }))}
                  className={`${comercialInputClass} pl-9`}
                />
              </div>
            </div>
            <div>
              <label className={comercialLabelClass}>Número</label>
              <div className="relative">
                <Hash className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={endereco.numero}
                  onChange={(e) => setEndereco((p) => ({ ...p, numero: e.target.value }))}
                  placeholder="S/N"
                  className={`${formInputCompactClass} pl-8`}
                />
              </div>
            </div>
            <div>
              <label className={comercialLabelClass}>Bairro</label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={endereco.bairro}
                  onChange={(e) => setEndereco((p) => ({ ...p, bairro: e.target.value }))}
                  className={`${comercialInputClass} pl-9`}
                />
              </div>
            </div>
            <div>
              <label className={comercialLabelClass}>Cidade</label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={endereco.cidade}
                  onChange={(e) => setEndereco((p) => ({ ...p, cidade: e.target.value }))}
                  className={`${comercialInputClass} pl-9`}
                />
              </div>
            </div>
            <div>
              <label className={comercialLabelClass}>UF</label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={endereco.uf}
                  onChange={(e) => setEndereco((p) => ({ ...p, uf: e.target.value.toUpperCase().slice(0, 2) }))}
                  placeholder="UF"
                  className={`${comercialInputClass} pl-9`}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={comercialLabelClass}>E-mail da empresa</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={emailEmpresa}
                  onChange={(e) => setEmailEmpresa(e.target.value)}
                  className={`${comercialInputClass} pl-9`}
                />
              </div>
            </div>
            <div>
              <label className={comercialLabelClass}>Telefone</label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  value={telefoneEmpresa}
                  onChange={(e) => setTelefoneEmpresa(formatBrazilianPhoneInput(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className={`${comercialInputClass} pl-9`}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button type="button" onClick={resetNovoForm} className={formModalCancelButtonClass}>
              <span className="inline-flex items-center gap-2">
                <X className="h-4 w-4" />
                Cancelar
              </span>
            </button>
            <button
              type="button"
              onClick={handleCadastrar}
              disabled={!empresa.trim() || cnpjRaw.replace(/\D/g, "").length !== 14}
              className={formModalSubmitButtonClass}
            >
              <span className="inline-flex items-center gap-2">
                <Save className="h-4 w-4" />
                Cadastrar e vincular
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
