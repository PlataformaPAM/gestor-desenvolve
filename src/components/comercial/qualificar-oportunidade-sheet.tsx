"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, Plus, User } from "lucide-react";
import { DrawerSheet } from "./drawer-sheet";
import { AlertDialog } from "@/components/ui/alert-dialog";
import type { Lead } from "@/lib/comercial/types";
import type { Cliente, Contato, ContatoPapel, ClienteEndereco } from "@/lib/clientes/types";
import { fetchCnpjBrasilApi } from "@/lib/clientes/brasilapi-cnpj";
import { comercialInputClass, comercialLabelClass, comercialSelectClass } from "./field-styles";

const CONTATO_PAPEL_OPTIONS: { value: ContatoPapel; label: string }[] = [
  { value: "gestor_empresa", label: "Gestor da Empresa" },
  { value: "gestor_contrato", label: "Gestor do Contrato" },
  { value: "responsavel_financeiro", label: "Responsável Financeiro" },
  { value: "outro", label: "Outro" },
];

type QualificarOportunidadeSheetProps = {
  open: boolean;
  onClose: () => void;
  lead: Lead | null;
  clientes: Cliente[];
  onVincularExistente: (leadId: string, clienteId: string) => void;
  onCadastrarEVincular: (
    leadId: string,
    cliente: Omit<Cliente, "id">,
    contatos: Contato[]
  ) => void;
};

type Modo = "busca" | "existente" | "novo";

export function QualificarOportunidadeSheet({
  open,
  onClose,
  lead,
  clientes,
  onVincularExistente,
  onCadastrarEVincular,
}: QualificarOportunidadeSheetProps) {
  const [modo, setModo] = useState<Modo>("busca");
  const [busca, setBusca] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);

  // Novo cliente (CNPJ)
  const [cnpjRaw, setCnpjRaw] = useState("");
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [empresa, setEmpresa] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [endereco, setEndereco] = useState<ClienteEndereco>({
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    cep: "",
  });
  const [emailEmpresa, setEmailEmpresa] = useState("");
  const [whatsappEmpresa, setWhatsappEmpresa] = useState("");

  // Contatos
  const [contatos, setContatos] = useState<Contato[]>([
    { id: "c1", nome: "", email: "", telefone: "", papel: "gestor_empresa" },
  ]);
  const [contatoIdParaRemover, setContatoIdParaRemover] = useState<string | null>(null);

  const clientesFiltrados = useMemo(() => {
    if (!busca.trim()) return clientes.slice(0, 8);
    const q = busca.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        c.empresa.toLowerCase().includes(q) ||
        (c.cpfCnpj || "").replace(/\D/g, "").includes(q.replace(/\D/g, ""))
    ).slice(0, 8);
  }, [clientes, busca]);

  useEffect(() => {
    const digits = cnpjRaw.replace(/\D/g, "");
    if (digits.length !== 14) return;
    let cancelled = false;
    setLoadingCnpj(true);
    fetchCnpjBrasilApi(digits)
      .then((res) => {
        if (cancelled || !res) return;
        setEmpresa(res.empresa);
        setNomeFantasia(res.nomeFantasia);
        setEndereco((prev) => ({ ...prev, ...res.endereco }));
        if (res.email) setEmailEmpresa(res.email);
        if (res.telefone) setWhatsappEmpresa(res.telefone);
      })
      .finally(() => setLoadingCnpj(false));
    return () => { cancelled = true; };
  }, [cnpjRaw]);

  const resetForm = () => {
    setModo("busca");
    setBusca("");
    setSelectedCliente(null);
    setCnpjRaw("");
    setEmpresa("");
    setNomeFantasia("");
    setEndereco({
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      uf: "",
      cep: "",
    });
    setEmailEmpresa("");
    setWhatsappEmpresa("");
    setContatos([{ id: "c1", nome: "", email: "", telefone: "", papel: "gestor_empresa" }]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const addContato = () => {
    setContatos((prev) => [
      ...prev,
      { id: `c-${Date.now()}`, nome: "", email: "", telefone: "", papel: "outro" },
    ]);
  };

  const updateContato = (id: string, patch: Partial<Contato>) => {
    setContatos((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const removeContato = (id: string) => {
    setContatos((prev) => prev.filter((c) => c.id !== id));
  };

  const hasGestorEmpresa = contatos.some((c) => c.papel === "gestor_empresa");
  const gestorEmpresaValid = contatos.some(
    (c) => c.papel === "gestor_empresa" && c.nome.trim() && c.email.trim()
  );

  const handleVincularExistente = () => {
    if (!lead || !selectedCliente) return;
    onVincularExistente(lead.id, selectedCliente.id);
    handleClose();
  };

  const handleCadastrarEVincular = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    if (!gestorEmpresaValid) return;

    const novoCliente: Omit<Cliente, "id"> = {
      nome: contatos.find((c) => c.papel === "gestor_empresa")?.nome || empresa,
      empresa,
      cpfCnpj: cnpjRaw.replace(/\D/g, "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"),
      status: "ativo",
      valorMensal: 0,
      segmento: "outros",
      email: emailEmpresa || undefined,
      telefone: whatsappEmpresa || undefined,
      endereco: { ...endereco, numero: endereco.numero || "S/N" },
      contatos,
    };
    onCadastrarEVincular(lead.id, novoCliente, contatos);
    handleClose();
  };

  if (!lead) return null;

  const nomeContatoRemocao =
    contatoIdParaRemover ? contatos.find((c) => c.id === contatoIdParaRemover)?.nome.trim() || "este contato" : "";

  return (
    <>
    <DrawerSheet open={open} onClose={handleClose} title="Qualificar Oportunidade" maxWidth="sm:max-w-3xl">
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Buscar Cliente Existente ou Cadastrar Novo */}
        {modo === "busca" && (
          <div className="p-6 space-y-4">
            <div>
              <label className={comercialLabelClass}>
                Buscar Cliente Existente ou Cadastrar Novo
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome, empresa ou CNPJ..."
                  className={`${comercialInputClass} pl-10 pr-4`}
                />
              </div>
            </div>
            {busca.trim() && (
              <ul className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {clientesFiltrados.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCliente(c);
                        setModo("existente");
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6D28D9]/10 text-[#6D28D9]">
                        <User className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900 truncate">{c.empresa}</p>
                        <p className="text-sm text-slate-500 truncate">{c.nome} · {c.cpfCnpj}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setModo("novo")}
                className="inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2.5 text-sm font-medium text-[#6D28D9] hover:border-[#6D28D9] hover:bg-[#6D28D9]/5"
              >
                <Plus className="h-4 w-4" />
                Cadastrar novo cliente
              </button>
            </div>
          </div>
        )}

        {/* Cliente existente selecionado */}
        {modo === "existente" && selectedCliente && (
          <div className="p-6 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <p className="text-sm font-medium text-slate-700">Cliente selecionado</p>
              <p className="mt-1 font-semibold text-slate-900">{selectedCliente.empresa}</p>
              <p className="text-sm text-slate-500">{selectedCliente.nome} · {selectedCliente.cpfCnpj}</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setSelectedCliente(null); setModo("busca"); }}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 font-medium text-slate-600 hover:bg-slate-100"
              >
                Trocar
              </button>
              <button
                type="button"
                onClick={handleVincularExistente}
                className="flex-1 rounded-lg bg-[#6D28D9] px-4 py-2.5 font-semibold text-white hover:bg-purple-700"
              >
                Vincular e mover para Qualificação
              </button>
            </div>
          </div>
        )}

        {/* Novo cliente (formulário CNPJ + Contatos) */}
        {modo === "novo" && (
          <form onSubmit={handleCadastrarEVincular} className="flex flex-1 flex-col overflow-y-auto p-6 space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-800">Dados da empresa (CNPJ)</h3>
              <div>
                <label className={comercialLabelClass}>CNPJ (14 dígitos)</label>
                <input
                  type="text"
                  value={cnpjRaw}
                  onChange={(e) => setCnpjRaw(e.target.value.replace(/\D/g, "").slice(0, 14))}
                  placeholder="00000000000000"
                  className={`${comercialInputClass} font-mono`}
                />
                {loadingCnpj && <p className="mt-1 text-xs text-slate-500">Consultando BrasilAPI...</p>}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={comercialLabelClass}>Razão Social</label>
                  <input
                    type="text"
                    value={empresa}
                    onChange={(e) => setEmpresa(e.target.value)}
                    className={comercialInputClass}
                  />
                </div>
                <div>
                  <label className={comercialLabelClass}>Nome Fantasia</label>
                  <input
                    type="text"
                    value={nomeFantasia}
                    onChange={(e) => setNomeFantasia(e.target.value)}
                    className={comercialInputClass}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <label className={comercialLabelClass}>CEP</label>
                  <input
                    type="text"
                    value={endereco.cep}
                    onChange={(e) => setEndereco((p) => ({ ...p, cep: e.target.value }))}
                    className={comercialInputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={comercialLabelClass}>Rua</label>
                  <input
                    type="text"
                    value={endereco.logradouro}
                    onChange={(e) => setEndereco((p) => ({ ...p, logradouro: e.target.value }))}
                    className={comercialInputClass}
                  />
                </div>
                <div>
                  <label className={comercialLabelClass}>Número</label>
                  <input
                    type="text"
                    value={endereco.numero}
                    onChange={(e) => setEndereco((p) => ({ ...p, numero: e.target.value }))}
                    placeholder="S/N"
                    className={comercialInputClass}
                  />
                </div>
                <div>
                  <label className={comercialLabelClass}>Complemento</label>
                  <input
                    type="text"
                    value={endereco.complemento ?? ""}
                    onChange={(e) => setEndereco((p) => ({ ...p, complemento: e.target.value || undefined }))}
                    className={comercialInputClass}
                  />
                </div>
                <div>
                  <label className={comercialLabelClass}>Bairro</label>
                  <input
                    type="text"
                    value={endereco.bairro}
                    onChange={(e) => setEndereco((p) => ({ ...p, bairro: e.target.value }))}
                    className={comercialInputClass}
                  />
                </div>
                <div>
                  <label className={comercialLabelClass}>Cidade / UF</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={endereco.cidade}
                      onChange={(e) => setEndereco((p) => ({ ...p, cidade: e.target.value }))}
                      className={comercialInputClass}
                    />
                    <input
                      type="text"
                      value={endereco.uf}
                      onChange={(e) => setEndereco((p) => ({ ...p, uf: e.target.value.toUpperCase().slice(0, 2) }))}
                      placeholder="UF"
                      className={`${comercialInputClass} w-14 px-2 text-center`}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={comercialLabelClass}>E-mail da empresa</label>
                  <input
                    type="email"
                    value={emailEmpresa}
                    onChange={(e) => setEmailEmpresa(e.target.value)}
                    className={comercialInputClass}
                  />
                </div>
                <div>
                  <label className={comercialLabelClass}>WhatsApp</label>
                  <input
                    type="tel"
                    value={whatsappEmpresa}
                    onChange={(e) => setWhatsappEmpresa(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className={comercialInputClass}
                  />
                </div>
              </div>
            </div>

            {/* Contatos da Empresa */}
            <div className="space-y-4 border-t border-slate-200 pt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Contatos da Empresa</h3>
                <button
                  type="button"
                  onClick={addContato}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Plus className="h-4 w-4" /> Adicionar contato
                </button>
              </div>
              {!hasGestorEmpresa && (
                <p className="text-xs text-amber-700">É obrigatório ter pelo menos 1 contato como &quot;Gestor da Empresa&quot;.</p>
              )}
              <ul className="space-y-4">
                {contatos.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <select
                        value={c.papel}
                        onChange={(e) => updateContato(c.id, { papel: e.target.value as ContatoPapel })}
                      className={comercialSelectClass}
                      >
                        {CONTATO_PAPEL_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      {contatos.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setContatoIdParaRemover(c.id)}
                          className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          aria-label="Remover contato"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-0.5 block text-xs font-medium text-slate-500">Nome</label>
                        <input
                          type="text"
                          value={c.nome}
                          onChange={(e) => updateContato(c.id, { nome: e.target.value })}
                          className={comercialInputClass}
                        />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-xs font-medium text-slate-500">E-mail</label>
                        <input
                          type="email"
                          value={c.email}
                          onChange={(e) => updateContato(c.id, { email: e.target.value })}
                          className={comercialInputClass}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-0.5 block text-xs font-medium text-slate-500">WhatsApp</label>
                        <input
                          type="tel"
                          value={c.telefone}
                          onChange={(e) => updateContato(c.id, { telefone: e.target.value })}
                          placeholder="(00) 00000-0000"
                          className={comercialInputClass}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => { resetForm(); setModo("busca"); }}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!gestorEmpresaValid || !empresa.trim() || cnpjRaw.replace(/\D/g, "").length !== 14}
                className="rounded-lg bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:ring-offset-2"
              >
                Cadastrar cliente e mover para Qualificação
              </button>
            </div>
          </form>
        )}
      </div>
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
            contato <strong className="text-slate-900 dark:text-slate-100">{nomeContatoRemocao}</strong> será excluído da
            lista. Ao concluir o cadastro, a alteração segue junto ao cliente.
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
