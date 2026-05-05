"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useId } from "react";
import clsx from "clsx";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  Plus,
  Trash2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Home,
  Hash,
  User,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  CircleSlash2,
} from "lucide-react";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import {
  formInputClass,
  formInputCompactClass,
  formLabelClass,
  formModalCancelButtonClass,
  formModalSubmitButtonClass,
} from "@/components/ui/field-patterns";
import type { Cliente, Contato, ClienteEndereco, ClienteStatus, PapelContatoCliente } from "@/lib/clientes/types";
import { fetchCnpjBrasilApi } from "@/lib/clientes/brasilapi-cnpj";
import { fetchViaCep } from "@/lib/clientes/viacep";
import { PAPEIS_CONTATO_CLIENTE, STATUS_LABELS } from "@/lib/clientes/constants";

const defaultEndereco: ClienteEndereco = {
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  cep: "",
};

function maskCnpj(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

function maskCep(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function formatPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.replace(/(\d{0,2})/, "($1");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").slice(0, 15);
}

type TabId = "empresa" | "contatos";

const emptyContato = (): Contato => ({
  id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  nome: "",
  email: "",
  telefone: "",
  setor: "",
  cargo: "",
  papeis: [],
});

/** Input que exibe borda verde temporária após preenchimento automático por API */
function AutoFillInput({
  className,
  justFilled,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { justFilled?: boolean }) {
  return (
    <input
      className={clsx(
        formInputClass,
        justFilled && "border-emerald-500 ring-2 ring-emerald-400/50 ring-offset-1",
        className
      )}
      {...props}
    />
  );
}

type ClienteFormSheetProps = {
  open: boolean;
  onClose: () => void;
  initialCliente?: Cliente | null;
  onSave: (cliente: Cliente) => void;
};

export function ClienteFormSheet({
  open,
  onClose,
  initialCliente = null,
  onSave,
}: ClienteFormSheetProps) {
  const id = useId();
  const isEdit = !!initialCliente?.id;

  const [activeTab, setActiveTab] = useState<TabId>("empresa");

  // Dados da empresa
  const [cnpjRaw, setCnpjRaw] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [urlSiteOficial, setUrlSiteOficial] = useState("");
  const [endereco, setEndereco] = useState<ClienteEndereco>(defaultEndereco);

  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [flashCnpj, setFlashCnpj] = useState(false);
  const [flashCep, setFlashCep] = useState(false);
  const [erroCnpj, setErroCnpj] = useState<string>("");
  const lastFetchedCnpjRef = useRef<string>("");
  const lastFetchedCepRef = useRef<string>("");

  const [contatos, setContatos] = useState<Contato[]>([]);
  const [contatoIdParaRemover, setContatoIdParaRemover] = useState<string | null>(null);
  const [status, setStatus] = useState<ClienteStatus>("ativo");

  useEffect(() => {
    if (!open) return;
    lastFetchedCnpjRef.current = "";
    lastFetchedCepRef.current = "";
    if (initialCliente) {
      setCnpjRaw(initialCliente.cpfCnpj);
      setNome(initialCliente.nome || initialCliente.empresa || "");
      setEmail(initialCliente.email ?? "");
      setTelefone(initialCliente.telefone ?? "");
      setUrlSiteOficial(initialCliente.urlSiteOficial ?? "");
      setEndereco(initialCliente.endereco ? { ...defaultEndereco, ...initialCliente.endereco } : defaultEndereco);
      setStatus(initialCliente.status);
      const contatosInit = initialCliente.contatos?.length
        ? initialCliente.contatos.map((c) => ({
            ...c,
            papeis: c.papeis ?? [],
          }))
        : [];
      setContatos(contatosInit.length ? contatosInit : [emptyContato()]);
    } else {
      setCnpjRaw("");
      setNome("");
      setEmail("");
      setTelefone("");
      setUrlSiteOficial("");
      setEndereco(defaultEndereco);
      setContatos([emptyContato()]);
      setStatus("ativo");
    }
    setErroCnpj("");
    setActiveTab("empresa");
  }, [open, initialCliente]);

  const fetchByCnpj = useCallback(async (digits: string) => {
    if (digits.length !== 14) return;
    setLoadingCnpj(true);
    setErroCnpj("");
    try {
      const res = await fetchCnpjBrasilApi(digits);
      if (res) {
        setNome(res.nomeFantasia || res.empresa || "");
        setEndereco((prev) => ({ ...defaultEndereco, ...prev, ...res.endereco }));
        if (res.telefone) setTelefone(res.telefone);
        if (res.email) setEmail(res.email);
        setFlashCnpj(true);
        setTimeout(() => setFlashCnpj(false), 2000);
      } else {
        setErroCnpj("Não foi possível consultar o CNPJ na Receita. Verifique o número e tente novamente.");
      }
    } finally {
      setLoadingCnpj(false);
    }
  }, []);

  /** Busca automática ao atingir 14 dígitos (não depende de onBlur, mobile-first) */
  useEffect(() => {
    if (!open || initialCliente) return;
    const digits = cnpjRaw.replace(/\D/g, "");
    if (digits.length === 14 && digits !== lastFetchedCnpjRef.current) {
      lastFetchedCnpjRef.current = digits;
      fetchByCnpj(digits);
    }
    if (digits.length < 14) {
      lastFetchedCnpjRef.current = "";
      setErroCnpj("");
    }
  }, [open, initialCliente, cnpjRaw, fetchByCnpj]);

  const fetchByCep = useCallback(async (digits: string) => {
    if (digits.length !== 8) return;
    setLoadingCep(true);
    try {
      const res = await fetchViaCep(digits);
      if (res) {
        setEndereco((prev) => ({
          ...prev,
          logradouro: res.logradouro ?? prev.logradouro,
          bairro: res.bairro ?? prev.bairro,
          cidade: res.cidade ?? prev.cidade,
          uf: res.uf ?? prev.uf,
          cep: res.cep ?? prev.cep,
        }));
        setFlashCep(true);
        setTimeout(() => setFlashCep(false), 2000);
      }
    } finally {
      setLoadingCep(false);
    }
  }, []);

  /** Busca automática ao atingir 8 dígitos no CEP (não depende de onBlur, mobile-first) */
  useEffect(() => {
    if (!open || initialCliente) return;
    const digits = endereco.cep.replace(/\D/g, "");
    if (digits.length === 8 && digits !== lastFetchedCepRef.current) {
      lastFetchedCepRef.current = digits;
      fetchByCep(digits);
    }
    if (digits.length < 8) lastFetchedCepRef.current = "";
  }, [open, initialCliente, endereco.cep, fetchByCep]);

  const addContato = () => setContatos((prev) => [...prev, emptyContato()]);
  const updateContato = (contatoId: string, patch: Partial<Contato>) => {
    setContatos((prev) => prev.map((c) => (c.id === contatoId ? { ...c, ...patch } : c)));
  };
  const removeContato = (contatoId: string) => {
    setContatos((prev) => prev.filter((c) => c.id !== contatoId));
  };
  const contatoRemocaoNome =
    contatoIdParaRemover ? contatos.find((c) => c.id === contatoIdParaRemover)?.nome.trim() || "este contato" : "";
  const togglePapel = (contatoId: string, papel: PapelContatoCliente) => {
    setContatos((prev) =>
      prev.map((c) => {
        if (c.id !== contatoId) return c;
        const papeis = c.papeis ?? [];
        const next = papeis.includes(papel) ? papeis.filter((p) => p !== papel) : [...papeis, papel];
        return { ...c, papeis: next };
      })
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cliente: Cliente = {
      id: initialCliente?.id ?? String(Date.now()),
      nome: nome.trim() || empresaTrim,
      empresa: empresaTrim,
      cpfCnpj: cnpjRaw.replace(/\D/g, "").length === 14 ? maskCnpj(cnpjRaw.replace(/\D/g, "")) : cnpjRaw.trim(),
      status,
      valorMensal: initialCliente?.valorMensal ?? 0,
      segmento: initialCliente?.segmento ?? "outros",
      email: email.trim() || undefined,
      telefone: telefone.trim() || undefined,
      urlSiteOficial: urlSiteOficial.trim() || undefined,
      endereco: Object.values(endereco).some((v) => v && String(v).trim()) ? endereco : undefined,
      contatos: contatos.filter((c) => c.nome.trim() || c.email.trim() || c.telefone.trim()).map((c) => ({
        ...c,
        papeis: c.papeis ?? [],
      })),
      dataFechamento: initialCliente?.dataFechamento,
      propostas: initialCliente?.propostas,
      faturasPagas: initialCliente?.faturasPagas,
      faturasPendentes: initialCliente?.faturasPendentes,
      faturas: initialCliente?.faturas,
      tickets: initialCliente?.tickets,
    };
    onSave(cliente);
    onClose();
  };

  const empresaTrim = nome.trim() || "Razão social";

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: "empresa", label: "Dados da Empresa", icon: Building2 },
    { id: "contatos", label: "Contatos", icon: Users },
  ];
  const statusOptions: SearchableOption[] = [
    { value: "ativo", label: STATUS_LABELS.ativo, icon: CheckCircle2 },
    { value: "inativo", label: STATUS_LABELS.inativo, icon: CircleSlash2 },
    { value: "inadimplente", label: STATUS_LABELS.inadimplente, icon: AlertCircle },
  ];

  return (
    <>
    <DrawerSheet
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar Cliente" : "Novo Cliente"}
      maxWidth="sm:max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <div
          role="tablist"
          className="flex border-b border-slate-200 bg-slate-50/50"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "relative flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors",
                  isActive ? "text-[#6D28D9]" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId={`cliente-form-tab-${id}`}
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6D28D9]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                  />
                )}
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {activeTab === "empresa" && (
            <div className="space-y-6">
              <div>
                <label className={formLabelClass}>CNPJ *</label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <AutoFillInput
                    justFilled={flashCnpj}
                    value={cnpjRaw}
                    onChange={(e) => setCnpjRaw(maskCnpj(e.target.value))}
                    placeholder="00.000.000/0001-00"
                    required
                    disabled={loadingCnpj}
                    className="pl-9 pr-10"
                  />
                  {loadingCnpj && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-500">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#6D28D9]" />
                      <span className="text-xs">Buscando...</span>
                    </div>
                  )}
                </div>
                {erroCnpj ? (
                  <p className="mt-1 text-xs text-rose-600" role="status" aria-live="polite">
                    {erroCnpj}
                  </p>
                ) : null}
              </div>

              <div>
                <label className={formLabelClass}>Nome (Fantasia ou Razão Social) *</label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <AutoFillInput
                    justFilled={flashCnpj}
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Nome fantasia ou razão social"
                    required
                    className="pl-9"
                  />
                </div>
              </div>

              <div>
                <label className={formLabelClass}>Status</label>
                <SearchableSelect
                  options={statusOptions}
                  value={status}
                  onChange={(v) => setStatus(v as ClienteStatus)}
                  searchable={false}
                  leadingIcon={CheckCircle2}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={formLabelClass}>E-mail *</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@empresa.com"
                      className={`${formInputClass} pl-9`}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className={formLabelClass}>Telefone *</label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={telefone}
                      onChange={(e) => setTelefone(formatPhone(e.target.value))}
                      placeholder="(00) 00000-0000"
                      className={`${formInputClass} pl-9`}
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className={formLabelClass}>URL Site Oficial</label>
                <div className="relative">
                  <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="url"
                    value={urlSiteOficial}
                    onChange={(e) => setUrlSiteOficial(e.target.value)}
                    placeholder="https://www.empresa.com.br"
                    className={`${formInputClass} pl-9`}
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
                <h4 className="mb-3 text-sm font-semibold text-slate-800">Endereço</h4>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <label className={formLabelClass}>CEP *</label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <AutoFillInput
                        justFilled={flashCep}
                        value={endereco.cep}
                        onChange={(e) => setEndereco((p) => ({ ...p, cep: maskCep(e.target.value) }))}
                        placeholder="00000-000"
                        required
                        disabled={loadingCep}
                        className="pl-9 pr-10"
                      />
                      {loadingCep && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-500">
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-[#6D28D9]" />
                          <span className="text-xs">Buscando...</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={formLabelClass}>Rua *</label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <AutoFillInput
                        justFilled={flashCep || flashCnpj}
                        value={endereco.logradouro}
                        onChange={(e) => setEndereco((p) => ({ ...p, logradouro: e.target.value }))}
                        required
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={formLabelClass}>N° *</label>
                    <div className="relative">
                      <Hash className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <input
                        value={endereco.numero}
                        onChange={(e) => setEndereco((p) => ({ ...p, numero: e.target.value }))}
                        className={`${formInputCompactClass} pl-8`}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className={formLabelClass}>Complemento</label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <input
                        value={endereco.complemento ?? ""}
                        onChange={(e) => setEndereco((p) => ({ ...p, complemento: e.target.value || undefined }))}
                        placeholder="Sala, andar (opcional)"
                        className={`${formInputCompactClass} pl-8`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={formLabelClass}>Bairro *</label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <AutoFillInput
                        justFilled={flashCep || flashCnpj}
                        value={endereco.bairro}
                        onChange={(e) => setEndereco((p) => ({ ...p, bairro: e.target.value }))}
                        required
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={formLabelClass}>Cidade *</label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <AutoFillInput
                        justFilled={flashCep || flashCnpj}
                        value={endereco.cidade}
                        onChange={(e) => setEndereco((p) => ({ ...p, cidade: e.target.value }))}
                        required
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={formLabelClass}>UF *</label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <AutoFillInput
                        justFilled={flashCep || flashCnpj}
                        value={endereco.uf}
                        onChange={(e) => setEndereco((p) => ({ ...p, uf: e.target.value.toUpperCase().slice(0, 2) }))}
                        placeholder="SP"
                        required
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "contatos" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-800">Contatos vinculados</h4>
                <button
                  type="button"
                  onClick={addContato}
                  className={`${formModalSubmitButtonClass} inline-flex items-center gap-2`}
                >
                  <Plus className="h-4 w-4" /> Adicionar Contato
                </button>
              </div>

              <ul className="space-y-4">
                {contatos.map((c) => (
                  <li key={c.id} className="rounded-xl border border-slate-200 bg-slate-50/30 p-4 dark:border-slate-700 dark:bg-slate-800/30">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">
                        {c.nome.trim() || "Novo contato"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setContatoIdParaRemover(c.id)}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Remover contato"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className={formLabelClass}>Nome completo</label>
                        <div className="relative">
                          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            value={c.nome}
                            onChange={(e) => updateContato(c.id, { nome: e.target.value })}
                            className={`${formInputClass} pl-9`}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={formLabelClass}>E-mail</label>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="email"
                            value={c.email}
                            onChange={(e) => updateContato(c.id, { email: e.target.value })}
                            className={`${formInputClass} pl-9`}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={formLabelClass}>Telefone</label>
                        <div className="relative">
                          <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            value={c.telefone}
                            onChange={(e) => updateContato(c.id, { telefone: formatPhone(e.target.value) })}
                            className={`${formInputClass} pl-9`}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={formLabelClass}>Setor</label>
                        <div className="relative">
                          <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            value={c.setor ?? ""}
                            onChange={(e) => updateContato(c.id, { setor: e.target.value })}
                            className={`${formInputClass} pl-9`}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={formLabelClass}>Cargo</label>
                        <div className="relative">
                          <Briefcase className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            value={c.cargo ?? ""}
                            onChange={(e) => updateContato(c.id, { cargo: e.target.value })}
                            className={`${formInputClass} pl-9`}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">Papel (pode marcar mais de um)</label>
                      <div className="flex flex-wrap gap-2">
                        {PAPEIS_CONTATO_CLIENTE.map((opt) => {
                          const checked = (c.papeis ?? []).includes(opt.value);
                          return (
                            <label
                              key={opt.value}
                              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePapel(c.id, opt.value)}
                                className="h-3.5 w-3.5 rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9]"
                              />
                              {opt.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 lg:px-6 lg:py-3">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className={formModalCancelButtonClass}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={formModalSubmitButtonClass}
            >
              Salvar
            </button>
          </div>
        </div>
      </form>
    </DrawerSheet>
    <AlertDialog
      open={!!contatoIdParaRemover}
      onClose={() => setContatoIdParaRemover(null)}
      onConfirm={() => {
        if (contatoIdParaRemover) removeContato(contatoIdParaRemover);
      }}
      title="Remover contato?"
      description={
        contatoIdParaRemover ? (
          <>
            <strong className="text-slate-900 dark:text-slate-100">Esta ação é irreversível neste formulário:</strong> o
            contato <strong className="text-slate-900 dark:text-slate-100">{contatoRemocaoNome}</strong> será removido. Ao
            salvar o cliente, a alteração ficará permanente no sistema.
          </>
        ) : null
      }
      cancelLabel="Cancelar"
      confirmLabel="Sim, remover permanentemente"
      destructive
    />
    </>
  );
}
