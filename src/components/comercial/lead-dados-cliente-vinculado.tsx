"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, Plus, Lock, Building2 } from "lucide-react";
import type { Lead } from "@/lib/comercial/types";
import type { Cliente, ClienteEndereco } from "@/lib/clientes/types";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { fetchCnpjBrasilApi } from "@/lib/clientes/brasilapi-cnpj";

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
  const [busca, setBusca] = useState("");
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

  const clientesFiltrados = useMemo(() => {
    if (!busca.trim()) return clientes.slice(0, 8);
    const q = busca.toLowerCase().replace(/\D/g, "");
    return clientes
      .filter(
        (c) =>
          c.nome.toLowerCase().includes(busca.toLowerCase()) ||
          c.empresa.toLowerCase().includes(busca.toLowerCase()) ||
          (c.cpfCnpj || "").replace(/\D/g, "").includes(q)
      )
      .slice(0, 8);
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
        setEndereco((prev) => ({ ...defaultEndereco, ...prev, ...res.endereco }));
        if (res.email) setEmailEmpresa(res.email);
        if (res.telefone) setTelefoneEmpresa(res.telefone);
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
      setEmpresa(initialEmpresaName.trim());
      setNomeFantasia(initialEmpresaName.trim());
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
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Building2 className="h-4 w-4" />
            Cliente Vinculado
          </h4>
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-white p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Lock className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{clienteVinculado.empresa || clienteVinculado.nome}</p>
              <p className="text-sm text-slate-500">{clienteVinculado.cpfCnpj}</p>
              {clienteVinculado.endereco?.cidade && (
                <p className="mt-0.5 text-xs text-slate-500">
                  {clienteVinculado.endereco.cidade} / {clienteVinculado.endereco.uf}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPedirDesvinculoCliente(true)}
              className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
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
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Building2 className="h-4 w-4" />
        Cliente Vinculado
      </h4>

      {!expandNovo ? (
        <>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por CNPJ ou nome..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9]"
            />
          </div>
          {busca.trim() && clientesFiltrados.length > 0 && (
            <ul className="mb-3 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
              {clientesFiltrados.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onVincularCliente(c.id)}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-900">{c.empresa || c.nome}</span>
                    <span className="text-xs text-slate-500">{c.cpfCnpj}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {busca.trim() && clientesFiltrados.length === 0 && (
            <p className="mb-2 text-xs text-slate-500">Nenhum cliente encontrado na base.</p>
          )}
          <button
            type="button"
            onClick={() => setExpandNovo(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#6D28D9] px-3 py-2 text-sm font-medium text-white hover:bg-[#5B21B6]"
          >
            <Plus className="h-4 w-4" /> Cadastrar Novo Cliente
          </button>
        </>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">CNPJ (14 dígitos)</label>
            <input
              type="text"
              value={cnpjRaw}
              onChange={(e) => setCnpjRaw(e.target.value.replace(/\D/g, "").slice(0, 14))}
              placeholder="00000000000000"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-slate-900 placeholder-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9]"
            />
            {loadingCnpj && <p className="mt-1 text-xs text-slate-500">Consultando BrasilAPI...</p>}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Razão Social</label>
              <input
                type="text"
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Nome Fantasia</label>
              <input
                type="text"
                value={nomeFantasia}
                onChange={(e) => setNomeFantasia(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">CEP</label>
              <input
                type="text"
                value={endereco.cep}
                onChange={(e) => setEndereco((p) => ({ ...p, cep: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Rua</label>
              <input
                type="text"
                value={endereco.logradouro}
                onChange={(e) => setEndereco((p) => ({ ...p, logradouro: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Número</label>
              <input
                type="text"
                value={endereco.numero}
                onChange={(e) => setEndereco((p) => ({ ...p, numero: e.target.value }))}
                placeholder="S/N"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Bairro</label>
              <input
                type="text"
                value={endereco.bairro}
                onChange={(e) => setEndereco((p) => ({ ...p, bairro: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Cidade</label>
              <input
                type="text"
                value={endereco.cidade}
                onChange={(e) => setEndereco((p) => ({ ...p, cidade: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">UF</label>
              <input
                type="text"
                value={endereco.uf}
                onChange={(e) => setEndereco((p) => ({ ...p, uf: e.target.value.toUpperCase().slice(0, 2) }))}
                placeholder="UF"
                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-center text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9]"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">E-mail da empresa</label>
              <input
                type="email"
                value={emailEmpresa}
                onChange={(e) => setEmailEmpresa(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Telefone</label>
              <input
                type="tel"
                value={telefoneEmpresa}
                onChange={(e) => setTelefoneEmpresa(e.target.value)}
                placeholder="(00) 00000-0000"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9]"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetNovoForm}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCadastrar}
              disabled={!empresa.trim() || cnpjRaw.replace(/\D/g, "").length !== 14}
              className="rounded-lg bg-[#6D28D9] px-3 py-2 text-sm font-medium text-white hover:bg-[#5B21B6] disabled:opacity-50"
            >
              Cadastrar e vincular
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
