"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Upload, FileText } from "lucide-react";
import { PRIORIDADE_LABELS, CATEGORIA_LABELS } from "@/lib/helpdesk/constants";
import type { TicketPrioridade, TicketCategoria } from "@/lib/helpdesk/types";

export type NovoChamadoPayload = {
  clienteId: string;
  clienteNome: string;
  assunto: string;
  prioridade: TicketPrioridade;
  categoria: TicketCategoria;
  descricao: string;
  anexoNome?: string;
};

type NovoChamadoFormProps = {
  clientes?: Array<{ id: string; nome: string; empresa?: string }>;
  onSave: (data: NovoChamadoPayload) => void;
  onCancel: () => void;
};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";
const labelClass = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

export function NovoChamadoForm({ clientes = [], onSave, onCancel }: NovoChamadoFormProps) {
  const [clienteId, setClienteId] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [buscaCliente, setBuscaCliente] = useState("");
  const [abertoCliente, setAbertoCliente] = useState(false);
  const [assunto, setAssunto] = useState("");
  const [prioridade, setPrioridade] = useState<TicketPrioridade>("media");
  const [categoria, setCategoria] = useState<TicketCategoria>("duvida");
  const [descricao, setDescricao] = useState("");
  const [anexoNome, setAnexoNome] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clientesFiltrados = useMemo(() => {
    if (!buscaCliente.trim()) return clientes.slice(0, 8);
    const q = buscaCliente.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        (c.empresa || "").toLowerCase().includes(q)
    ).slice(0, 8);
  }, [buscaCliente, clientes]);

  useEffect(() => {
    if (!abertoCliente) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-helpdesk-cliente]")) setAbertoCliente(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [abertoCliente]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId || !clienteNome.trim() || !assunto.trim()) return;
    onSave({
      clienteId,
      clienteNome: clienteNome.trim(),
      assunto: assunto.trim(),
      prioridade,
      categoria,
      descricao: descricao.trim(),
      anexoNome: anexoNome ?? undefined,
    });
  };

  const handleSelectCliente = (id: string, nome: string) => {
    setClienteId(id);
    setClienteNome(nome);
    setBuscaCliente("");
    setAbertoCliente(false);
  };

  const handleAnexoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setAnexoNome(file ? file.name : null);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 lg:p-6">
      {/* Cliente */}
      <div data-helpdesk-cliente className="space-y-1">
        <label htmlFor="novo-cliente" className={labelClass}>
          Cliente *
        </label>
        <div className="relative">
          <input
            id="novo-cliente"
            type="text"
            value={abertoCliente ? buscaCliente : clienteNome}
            onChange={(e) => {
              setBuscaCliente(e.target.value);
              setAbertoCliente(true);
              if (!abertoCliente) setClienteId("");
            }}
            onFocus={() => setAbertoCliente(true)}
            placeholder="Buscar por nome ou empresa..."
            className={inputClass}
            autoComplete="off"
          />
          {abertoCliente && (
            <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900">
              {clientesFiltrados.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectCliente(c.id, c.nome)}
                    className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-violet-50 dark:hover:bg-violet-950/40"
                  >
                    <span className="font-medium text-slate-900 dark:text-slate-100">{c.nome}</span>
                    {c.empresa && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">{c.empresa}</span>
                    )}
                  </button>
                </li>
              ))}
              {clientesFiltrados.length === 0 && (
                <li className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                  Nenhum cliente encontrado.
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Assunto */}
      <div className="space-y-1">
        <label htmlFor="novo-assunto" className={labelClass}>
          Assunto *
        </label>
        <input
          id="novo-assunto"
          type="text"
          value={assunto}
          onChange={(e) => setAssunto(e.target.value)}
          placeholder="Resumo do problema ou solicitação"
          className={inputClass}
          required
        />
      </div>

      {/* Prioridade + Categoria em linha no desktop */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="novo-prioridade" className={labelClass}>
            Prioridade *
          </label>
          <select
            id="novo-prioridade"
            value={prioridade}
            onChange={(e) => setPrioridade(e.target.value as TicketPrioridade)}
            className={inputClass}
          >
            {(Object.entries(PRIORIDADE_LABELS) as [TicketPrioridade, string][]).map(
              ([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              )
            )}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="novo-categoria" className={labelClass}>
            Categoria *
          </label>
          <select
            id="novo-categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as TicketCategoria)}
            className={inputClass}
          >
            {(Object.entries(CATEGORIA_LABELS) as [TicketCategoria, string][]).map(
              ([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {/* Descrição */}
      <div className="space-y-1">
        <label htmlFor="novo-descricao" className={labelClass}>
          Descrição *
        </label>
        <textarea
          id="novo-descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Detalhe o problema ou solicitação..."
          rows={4}
          className={`${inputClass} min-h-[100px] resize-y`}
          required
        />
      </div>

      {/* Anexo */}
      <div className="space-y-1">
        <span className={labelClass}>Anexo</span>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleAnexoChange}
          className="hidden"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/50 py-6 text-sm text-slate-600 transition-colors hover:border-[#6D28D9] hover:bg-violet-50/30 hover:text-[#6D28D9] dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:border-violet-500 dark:hover:bg-violet-950/30 dark:hover:text-violet-300"
        >
          {anexoNome ? (
            <>
              <FileText className="h-5 w-5" />
              <span className="truncate">{anexoNome}</span>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5" />
              <span>Arraste ou clique para anexar</span>
            </>
          )}
        </button>
      </div>

      {/* Ações */}
      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 dark:border-slate-700 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-lg bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 dark:focus-visible:outline-none dark:focus-visible:ring-2 dark:focus-visible:ring-[#6D28D9] dark:focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
        >
          Salvar chamado
        </button>
      </div>
    </form>
  );
}
