"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";
import { motion } from "framer-motion";
import { Building2, Users, Plus, Trash2 } from "lucide-react";
import type { ColaboradorParceiro, TipoPessoaRH, TipoContrato } from "@/lib/rh/types";
import type { Contato, PapelContatoCliente } from "@/lib/clientes/types";
import {
  TIPO_CONTRATO_LABELS,
  TIPO_CONTRATO_OPCOES_CONSULTOR,
  TIPO_CONTRATO_OPCOES_FORNECEDOR,
} from "@/lib/rh/constants";
import { PAPEIS_CONTATO_CLIENTE } from "@/lib/clientes/constants";
import { fetchCnpjBrasilApi } from "@/lib/clientes/brasilapi-cnpj";
import { AlertDialog } from "@/components/ui/alert-dialog";

/** Tipos de contrato permitidos para Equipe (PF). */
const TIPO_CONTRATO_EQUIPE: TipoContrato[] = ["clt", "estagio", "socio"];

export type NovoColaboradorPayload = Omit<ColaboradorParceiro, "id">;

type NovoColaboradorFormProps = {
  /** `id` pode vir do registro ao editar (usado só para não disparar consulta CNPJ). */
  initialValues?: (Partial<NovoColaboradorPayload> & { id?: string }) | null;
  /** Aba atual do RH ao criar (ex.: fornecedor_parceiro na aba Fornecedores). */
  defaultTipo?: TipoPessoaRH;
  /** Se true, o tipo fica fixo (ex.: criação pela aba Fornecedores). */
  lockTipo?: boolean;
  onSave: (payload: NovoColaboradorPayload) => void;
  onCancel: () => void;
};

function tipoContratoInicial(
  iv: NovoColaboradorFormProps["initialValues"],
  defaultTipo: TipoPessoaRH | undefined
): TipoContrato {
  if (iv?.tipoContrato) return iv.tipoContrato;
  if (defaultTipo === "fornecedor_parceiro") return "fornecedor";
  if (defaultTipo === "vendedor_externo") return "consultor";
  return "clt";
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";
const labelClass = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200";

function maskCpfDigits(d: string): string {
  const x = d.slice(0, 11);
  if (x.length <= 3) return x;
  if (x.length <= 6) return `${x.slice(0, 3)}.${x.slice(3)}`;
  if (x.length <= 9) return `${x.slice(0, 3)}.${x.slice(3, 6)}.${x.slice(6)}`;
  return `${x.slice(0, 3)}.${x.slice(3, 6)}.${x.slice(6, 9)}-${x.slice(9)}`;
}

function maskCnpjDigits(d: string): string {
  const v = d.slice(0, 14);
  if (v.length <= 2) return v;
  if (v.length <= 5) return `${v.slice(0, 2)}.${v.slice(2)}`;
  if (v.length <= 8) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5)}`;
  if (v.length <= 12) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8)}`;
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12, 14)}`;
}

function formatCpfCnpjInput(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) return maskCpfDigits(d);
  return maskCnpjDigits(d);
}

function formatPhoneInput(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

const emptyContato = (): Contato => ({
  id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  nome: "",
  email: "",
  telefone: "",
  setor: "",
  cargo: "",
  papeis: [],
});

function AutoFillInput({
  className,
  justFilled,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { justFilled?: boolean }) {
  return (
    <input
      className={clsx(
        inputClass,
        justFilled && "border-emerald-500 ring-2 ring-emerald-400/50 ring-offset-1",
        className
      )}
      {...props}
    />
  );
}

export function NovoColaboradorForm({
  initialValues,
  defaultTipo,
  lockTipo = false,
  onSave,
  onCancel,
}: NovoColaboradorFormProps) {
  const fornecedorTabListId = useId();

  const [nome, setNome] = useState(initialValues?.nome ?? "");
  const [cargoOuFuncao, setCargoOuFuncao] = useState(initialValues?.cargoOuFuncao ?? "");
  const [cpfCnpj, setCpfCnpj] = useState(initialValues?.cpfCnpj ?? "");
  const [tipo, setTipo] = useState<TipoPessoaRH>(
    initialValues?.tipo ?? defaultTipo ?? "equipe_interna"
  );
  const [tipoContrato, setTipoContrato] = useState<TipoContrato>(() =>
    tipoContratoInicial(initialValues, defaultTipo)
  );
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [telefone, setTelefone] = useState(initialValues?.telefone ?? "");
  const [status, setStatus] = useState<ColaboradorParceiro["status"]>(initialValues?.status ?? "ativo");

  const [activeTab, setActiveTab] = useState<"dados" | "contatos">("dados");
  const [contatos, setContatos] = useState<Contato[]>(() => {
    const t = initialValues?.tipo ?? defaultTipo ?? "equipe_interna";
    if (
      (t === "fornecedor_parceiro" || t === "vendedor_externo") &&
      initialValues?.contatos?.length
    ) {
      return initialValues.contatos.map((c) => ({ ...c, papeis: c.papeis ?? [] }));
    }
    return [emptyContato()];
  });
  const [contatoIdParaRemover, setContatoIdParaRemover] = useState<string | null>(null);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [flashCnpj, setFlashCnpj] = useState(false);
  const lastFetchedCnpjRef = useRef<string>("");

  const isFornecedor = tipo === "fornecedor_parceiro";
  const isConsultor = tipo === "vendedor_externo";
  const isB2bTabs = isFornecedor || isConsultor;
  const isEquipeInterna = tipo === "equipe_interna";
  const docDigits = cpfCnpj.replace(/\D/g, "");
  const isCnpj = docDigits.length === 14;
  const mostrarAbaContatos = isB2bTabs && isCnpj;
  const opcoesContratoB2b = isFornecedor
    ? TIPO_CONTRATO_OPCOES_FORNECEDOR
    : TIPO_CONTRATO_OPCOES_CONSULTOR;

  useEffect(() => {
    if (lockTipo && defaultTipo) setTipo(defaultTipo);
  }, [lockTipo, defaultTipo]);

  useEffect(() => {
    setNome(initialValues?.nome ?? "");
    setCargoOuFuncao(initialValues?.cargoOuFuncao ?? "");
    setCpfCnpj(initialValues?.cpfCnpj ?? "");
    setTipo(initialValues?.tipo ?? defaultTipo ?? "equipe_interna");
    setTipoContrato(tipoContratoInicial(initialValues, defaultTipo));
    setEmail(initialValues?.email ?? "");
    setTelefone(initialValues?.telefone ?? "");
    setStatus(initialValues?.status ?? "ativo");
    lastFetchedCnpjRef.current = "";
    if (initialValues?.tipo === "fornecedor_parceiro" || initialValues?.tipo === "vendedor_externo") {
      setContatos(
        initialValues.contatos?.length
          ? initialValues.contatos.map((c) => ({ ...c, papeis: c.papeis ?? [] }))
          : [emptyContato()]
      );
      setActiveTab("dados");
    } else {
      setContatos([emptyContato()]);
    }
  }, [initialValues, defaultTipo]);

  useEffect(() => {
    if (!isEquipeInterna) return;
    if (!TIPO_CONTRATO_EQUIPE.includes(tipoContrato)) {
      setTipoContrato("clt");
    }
  }, [isEquipeInterna, tipoContrato]);

  useEffect(() => {
    if (!isB2bTabs) return;
    const allowed = isFornecedor ? TIPO_CONTRATO_OPCOES_FORNECEDOR : TIPO_CONTRATO_OPCOES_CONSULTOR;
    setTipoContrato((prev) => (allowed.includes(prev) ? prev : allowed[0]));
  }, [isB2bTabs, isFornecedor, tipo]);

  const fetchByCnpj = useCallback(async (digits: string, cargoPadrao: string) => {
    if (digits.length !== 14) return;
    setLoadingCnpj(true);
    try {
      const res = await fetchCnpjBrasilApi(digits);
      if (res) {
        setNome(res.nomeFantasia?.trim() || res.empresa || "");
        setCargoOuFuncao((prev) => (prev.trim() ? prev : cargoPadrao));
        if (res.telefone) setTelefone(formatPhoneInput(res.telefone.replace(/\D/g, "")));
        if (res.email) setEmail(res.email);
        setFlashCnpj(true);
        setTimeout(() => setFlashCnpj(false), 2000);
      }
    } finally {
      setLoadingCnpj(false);
    }
  }, []);

  /** Consulta automática só na criação; em edição não sobrescreve dados ao alterar o CNPJ. */
  useEffect(() => {
    if (!isB2bTabs || initialValues?.id) return;
    if (docDigits.length === 14 && docDigits !== lastFetchedCnpjRef.current) {
      lastFetchedCnpjRef.current = docDigits;
      const cargoPadrao = isFornecedor ? "Fornecedor" : "Consultor";
      setActiveTab("dados");
      void fetchByCnpj(docDigits, cargoPadrao);
    }
    if (docDigits.length < 14) lastFetchedCnpjRef.current = "";
  }, [isB2bTabs, isFornecedor, initialValues?.id, docDigits, fetchByCnpj]);

  useEffect(() => {
    if (!mostrarAbaContatos && activeTab === "contatos") {
      setActiveTab("dados");
    }
  }, [mostrarAbaContatos, activeTab]);

  const addContato = () => setContatos((prev) => [...prev, emptyContato()]);
  const updateContato = (contatoId: string, patch: Partial<Contato>) => {
    setContatos((prev) => prev.map((c) => (c.id === contatoId ? { ...c, ...patch } : c)));
  };
  const removeContato = (contatoId: string) => {
    setContatos((prev) => prev.filter((c) => c.id !== contatoId));
  };
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

  const contatoRemocaoNome =
    contatoIdParaRemover ? contatos.find((c) => c.id === contatoIdParaRemover)?.nome.trim() || "este contato" : "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !cargoOuFuncao.trim() || !cpfCnpj.trim()) return;
    if (isEquipeInterna && docDigits.length !== 11) {
      alert("Informe um CPF válido (11 dígitos).");
      return;
    }

    const base: NovoColaboradorPayload = {
      nome: nome.trim(),
      cargoOuFuncao: cargoOuFuncao.trim(),
      cpfCnpj: cpfCnpj.trim(),
      tipo,
      tipoContrato,
      status,
      email: email.trim() || undefined,
    };

    if (isB2bTabs) {
      const contatosSave = contatos
        .filter((c) => c.nome.trim() || c.email.trim() || c.telefone.trim())
        .map((c) => ({ ...c, papeis: c.papeis ?? [] }));
      if (isCnpj && contatosSave.length === 0) {
        const rotulo = isFornecedor ? "Fornecedor" : "Consultor";
        alert(`${rotulo} pessoa jurídica (CNPJ): inclua pelo menos um contato na aba Contatos.`);
        setActiveTab("contatos");
        return;
      }
      onSave({
        ...base,
        telefone: telefone.trim() || undefined,
        contatos: contatosSave.length ? contatosSave : undefined,
      });
      return;
    }

    onSave({
      ...base,
      ...(isEquipeInterna
        ? { telefone: telefone.replace(/\D/g, "").length > 0 ? telefone.trim() : undefined }
        : {}),
    });
  };

  const tabsFornecedor: { id: "dados" | "contatos"; label: string; icon: typeof Building2 }[] =
    mostrarAbaContatos
      ? [
          { id: "dados", label: "Dados", icon: Building2 },
          { id: "contatos", label: "Contatos", icon: Users },
        ]
      : [{ id: "dados", label: "Dados", icon: Building2 }];

  if (isB2bTabs) {
    return (
      <>
        <form onSubmit={handleSubmit} className="flex flex-col">
          {mostrarAbaContatos && (
            <div
              role="tablist"
              aria-label="Seções do cadastro"
              className="flex flex-wrap border-b border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50"
            >
              {tabsFornecedor.map((t) => {
                const Icon = t.icon;
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    id={`${fornecedorTabListId}-tab-${t.id}`}
                    aria-selected={isActive}
                    aria-controls={`${fornecedorTabListId}-${t.id}-panel`}
                    onClick={() => setActiveTab(t.id)}
                    className={clsx(
                      "relative flex min-w-0 flex-1 items-center justify-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors sm:px-4",
                      isActive
                        ? "text-[#6D28D9] dark:text-violet-400"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId={`rh-fornecedor-form-tab-${fornecedorTabListId}`}
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6D28D9]"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                      />
                    )}
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex-1 space-y-4 p-4 lg:p-6">
            {activeTab === "dados" && (
              <div
                id={`${fornecedorTabListId}-dados-panel`}
                role="tabpanel"
                aria-labelledby={`${fornecedorTabListId}-tab-dados`}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="rh-forn-doc" className={labelClass}>
                    CPF/CNPJ * {loadingCnpj && <span className="font-normal text-slate-500">(consultando…)</span>}
                  </label>
                  <AutoFillInput
                    id="rh-forn-doc"
                    justFilled={flashCnpj}
                    value={cpfCnpj}
                    onChange={(e) => setCpfCnpj(formatCpfCnpjInput(e.target.value))}
                    placeholder="CPF ou CNPJ"
                    required
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="rh-forn-nome" className={labelClass}>
                    Nome / Razão social *
                  </label>
                  <input
                    id="rh-forn-nome"
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="rh-forn-cargo" className={labelClass}>
                    Cargo / Função *
                  </label>
                  <input
                    id="rh-forn-cargo"
                    type="text"
                    value={cargoOuFuncao}
                    onChange={(e) => setCargoOuFuncao(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="rh-forn-contrato" className={labelClass}>
                    Tipo de contrato
                  </label>
                  <select
                    id="rh-forn-contrato"
                    value={tipoContrato}
                    onChange={(e) => setTipoContrato(e.target.value as TipoContrato)}
                    className={inputClass}
                  >
                    {opcoesContratoB2b.map((k) => (
                      <option key={k} value={k}>
                        {TIPO_CONTRATO_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="rh-forn-status" className={labelClass}>
                    Status
                  </label>
                  <select
                    id="rh-forn-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ColaboradorParceiro["status"])}
                    className={inputClass}
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                    <option value="ferias">Férias</option>
                    <option value="afastado">Afastado</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="rh-forn-email" className={labelClass}>
                    E-mail
                  </label>
                  <input
                    id="rh-forn-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="rh-forn-tel" className={labelClass}>
                    Telefone
                  </label>
                  <input
                    id="rh-forn-tel"
                    type="text"
                    inputMode="tel"
                    value={telefone}
                    onChange={(e) => setTelefone(formatPhoneInput(e.target.value))}
                    placeholder="(00) 00000-0000"
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {activeTab === "contatos" && (
              <div
                id={`${fornecedorTabListId}-contatos-panel`}
                role="tabpanel"
                aria-labelledby={`${fornecedorTabListId}-tab-contatos`}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Contatos vinculados</h4>
                  <button
                    type="button"
                    onClick={addContato}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#6D28D9] px-3 py-2 text-sm font-medium text-white hover:bg-[#5B21B6]"
                  >
                    <Plus className="h-4 w-4" /> Adicionar contato
                  </button>
                </div>
                <ul className="space-y-4">
                  {contatos.map((c) => (
                    <li key={c.id} className="rounded-xl border border-slate-200 bg-slate-50/30 p-4 dark:border-slate-600 dark:bg-slate-900/40">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          {c.nome.trim() || "Novo contato"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setContatoIdParaRemover(c.id)}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                          aria-label="Remover contato"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                            Nome completo
                          </label>
                          <input
                            value={c.nome}
                            onChange={(e) => updateContato(c.id, { nome: e.target.value })}
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                            E-mail
                          </label>
                          <input
                            type="email"
                            value={c.email}
                            onChange={(e) => updateContato(c.id, { email: e.target.value })}
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                            Telefone
                          </label>
                          <input
                            value={c.telefone}
                            inputMode="tel"
                            onChange={(e) => updateContato(c.id, { telefone: formatPhoneInput(e.target.value) })}
                            placeholder="(00) 00000-0000"
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                            Setor
                          </label>
                          <input
                            value={c.setor ?? ""}
                            onChange={(e) => updateContato(c.id, { setor: e.target.value })}
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                            Cargo
                          </label>
                          <input
                            value={c.cargo ?? ""}
                            onChange={(e) => updateContato(c.id, { cargo: e.target.value })}
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          />
                        </div>
                      </div>
                      <div className="mt-3">
                        <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                          Papel (pode marcar mais de um)
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {PAPEIS_CONTATO_CLIENTE.map((opt) => {
                            const checked = (c.papeis ?? []).includes(opt.value);
                            return (
                              <label
                                key={opt.value}
                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700 sm:flex-row sm:justify-end sm:gap-3 lg:px-6 lg:py-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:ring-offset-2"
            >
              Salvar
            </button>
          </div>
        </form>
        <AlertDialog
          open={!!contatoIdParaRemover}
          onClose={() => setContatoIdParaRemover(null)}
          onConfirm={() => {
            if (contatoIdParaRemover) removeContato(contatoIdParaRemover);
            setContatoIdParaRemover(null);
          }}
          title="Remover contato?"
          description={
            contatoIdParaRemover ? (
              <>
                O contato <strong className="text-slate-900 dark:text-slate-100">{contatoRemocaoNome}</strong> será
                removido desta lista. Confirme para continuar.
              </>
            ) : null
          }
          cancelLabel="Cancelar"
          confirmLabel="Remover"
          destructive
        />
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 lg:p-6">
      <div>
        <label htmlFor="rh-nome" className={labelClass}>
          Nome *
        </label>
        <input
          id="rh-nome"
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className={inputClass}
          required
        />
      </div>
      <div>
        <label htmlFor="rh-cargo" className={labelClass}>
          Cargo / Função *
        </label>
        <input
          id="rh-cargo"
          type="text"
          value={cargoOuFuncao}
          onChange={(e) => setCargoOuFuncao(e.target.value)}
          className={inputClass}
          required
        />
      </div>
      <div>
        <label htmlFor="rh-cpf-cnpj" className={labelClass}>
          {isEquipeInterna ? "CPF *" : "CPF/CNPJ *"}
        </label>
        <input
          id="rh-cpf-cnpj"
          type="text"
          inputMode={isEquipeInterna ? "numeric" : "text"}
          value={cpfCnpj}
          onChange={(e) =>
            isEquipeInterna
              ? setCpfCnpj(maskCpfDigits(e.target.value.replace(/\D/g, "")))
              : setCpfCnpj(e.target.value)
          }
          placeholder={isEquipeInterna ? "000.000.000-00" : undefined}
          className={inputClass}
          required
        />
      </div>
      <div>
        <label htmlFor="rh-contrato" className={labelClass}>
          Tipo de contrato
        </label>
        <select
          id="rh-contrato"
          value={tipoContrato}
          onChange={(e) => setTipoContrato(e.target.value as TipoContrato)}
          className={inputClass}
        >
          {(isEquipeInterna ? TIPO_CONTRATO_EQUIPE : (Object.keys(TIPO_CONTRATO_LABELS) as TipoContrato[])).map(
            (k) => (
              <option key={k} value={k}>
                {TIPO_CONTRATO_LABELS[k]}
              </option>
            )
          )}
        </select>
      </div>
      <div>
        <label htmlFor="rh-status" className={labelClass}>
          Status
        </label>
        <select
          id="rh-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as ColaboradorParceiro["status"])}
          className={inputClass}
        >
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
          <option value="ferias">Férias</option>
          <option value="afastado">Afastado</option>
        </select>
      </div>
      <div>
        <label htmlFor="rh-email" className={labelClass}>
          E-mail
        </label>
        <input
          id="rh-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </div>
      {isEquipeInterna && (
        <div>
          <label htmlFor="rh-tel-equipe" className={labelClass}>
            Telefone
          </label>
          <input
            id="rh-tel-equipe"
            type="text"
            inputMode="tel"
            value={telefone}
            onChange={(e) => setTelefone(formatPhoneInput(e.target.value))}
            placeholder="(00) 00000-0000"
            className={inputClass}
            autoComplete="tel"
          />
        </div>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-lg bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:ring-offset-2"
        >
          Salvar
        </button>
      </div>
    </form>
  );
}
