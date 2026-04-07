"use client";

import { Trash2, MapPin, Mail, Phone, Building2, ChevronRight } from "lucide-react";
import type { Cliente, Contato } from "@/lib/clientes/types";
import { STATUS_LABELS } from "@/lib/clientes/constants";

type ClientesTableProps = {
  clientes: Cliente[];
  onVerDetalhes: (cliente: Cliente) => void;
  onExcluir?: (cliente: Cliente) => void;
};

/** Iniciais das 2 primeiras letras do Nome Fantasia (empresa) */
function iniciaisNomeFantasia(empresa: string): string {
  const trimmed = empresa.trim();
  if (!trimmed) return "??";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2)
    return (words[0][0] + words[1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

/** Contato com papel Gestor Principal (papeis B2B ou papel legado) */
function getContatoPrincipal(contatos: Contato[] | undefined): Contato | null {
  if (!contatos?.length) return null;
  const principal = contatos.find(
    (c) =>
      (c.papeis && c.papeis.includes("gestor_principal")) ||
      c.papel === "gestor_empresa"
  );
  return principal ?? contatos[0] ?? null;
}

/** Dias corridos desde a data de cadastro (início do dia) até hoje. */
function diasDesdeCadastro(createdAtIso: string | undefined): number {
  if (!createdAtIso) return 0;
  const start = new Date(createdAtIso);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - start.getTime()) / 86400000);
  return Math.max(0, diff);
}

function textoDesdeCadastro(createdAtIso: string | undefined): string {
  if (!createdAtIso) return "Desde de: —";
  const d = new Date(createdAtIso);
  const dataStr = Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
  const n = diasDesdeCadastro(createdAtIso);
  const diasTxt = n === 1 ? "1 dia ativo" : `${n} dias ativo`;
  return `Desde de: ${dataStr} · ${diasTxt}`;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-purple-100/80 text-[#6D28D9] dark:bg-violet-950/50 dark:text-violet-300">
        <Building2 className="h-10 w-10" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Nenhum cliente cadastrado
      </h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
        Comece adicionando seu primeiro cliente corporativo para movimentar o funil de vendas.
      </p>
    </div>
  );
}

export function ClientesTable({
  clientes,
  onVerDetalhes,
  onExcluir,
}: ClientesTableProps) {
  const isEmpty = clientes.length === 0;

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
      {/* Desktop: Rich Table */}
      <div className="hidden md:block">
        {!isEmpty && (
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Empresa
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Contato principal
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Localização
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Status
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {clientes.map((cliente) => {
              const contatoPrincipal = getContatoPrincipal(cliente.contatos);
              const totalContatos = cliente.contatos?.length ?? 0;
              const cidadeUf = cliente.endereco
                ? `${cliente.endereco.cidade} - ${cliente.endereco.uf}`
                : "—";

              return (
                <tr
                  key={cliente.id}
                  onClick={() => onVerDetalhes(cliente)}
                  className="cursor-pointer transition-colors hover:bg-slate-50 transition-shadow dark:hover:bg-slate-800/60"
                >
                  {/* Coluna 1: Empresa (destaque principal) */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 font-bold text-sm text-[#6D28D9] dark:bg-violet-950/60 dark:text-violet-300">
                        {iniciaisNomeFantasia(cliente.empresa)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {cliente.empresa}
                        </p>
                        <p className="mt-0.5 text-xs font-mono text-slate-500 dark:text-slate-400">
                          {cliente.cpfCnpj}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {textoDesdeCadastro(cliente.createdAt)}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Coluna 2: Contato principal */}
                  <td className="px-6 py-4">
                    {contatoPrincipal ? (
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {contatoPrincipal.nome}
                        </p>
                        <p className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                          <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                          <span className="truncate">{contatoPrincipal.email || "—"}</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                            <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                            {contatoPrincipal.telefone || "—"}
                          </span>
                          {totalContatos > 1 && (
                            <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              +{totalContatos - 1} Contato{totalContatos - 1 === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </td>

                  {/* Coluna 3: Localização */}
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      {cidadeUf}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={
                        cliente.status === "ativo"
                          ? "rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : cliente.status === "inativo"
                            ? "rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            : "rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                      }
                    >
                      {STATUS_LABELS[cliente.status]}
                    </span>
                  </td>

                  {/* Coluna 4: Ações (padrão: à direita, ícone h-4 w-4) */}
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    {onExcluir && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onExcluir(cliente);
                        }}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] dark:hover:bg-red-950/50 dark:hover:text-red-400"
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <ChevronRight className="ml-1 inline-block h-4 w-4 text-slate-400" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        )}
        {isEmpty && <EmptyState />}
      </div>

      {/* Mobile: cards (rounded-xl, border-slate-200, hover:shadow-md) */}
      <div className="md:hidden space-y-3 mt-6">
        {!isEmpty &&
          clientes.map((cliente) => {
            const contatoPrincipal = getContatoPrincipal(cliente.contatos);
            const totalContatos = cliente.contatos?.length ?? 0;
            const cidadeUf = cliente.endereco
              ? `${cliente.endereco.cidade} - ${cliente.endereco.uf}`
              : "—";
            return (
              <div
                key={cliente.id}
                role="button"
                tabIndex={0}
                onClick={() => onVerDetalhes(cliente)}
                onKeyDown={(e) => e.key === "Enter" && onVerDetalhes(cliente)}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 cursor-pointer transition-all hover:shadow-md hover:bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/50"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 font-bold text-sm text-[#6D28D9] dark:bg-violet-950/60 dark:text-violet-300">
                    {iniciaisNomeFantasia(cliente.empresa)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{cliente.empresa}</p>
                    <p className="mt-0.5 text-xs font-mono text-slate-500">{cliente.cpfCnpj}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {textoDesdeCadastro(cliente.createdAt)}
                    </p>
                    <div className="mt-2">
                      <span
                        className={
                          cliente.status === "ativo"
                            ? "rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : cliente.status === "inativo"
                              ? "rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                              : "rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                        }
                      >
                        {STATUS_LABELS[cliente.status]}
                      </span>
                    </div>
                  </div>
                </div>
                {contatoPrincipal && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{contatoPrincipal.nome}</p>
                    <p className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                      <Mail className="h-3 w-3 shrink-0" />
                      {contatoPrincipal.email || "—"}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3 shrink-0" />
                        {contatoPrincipal.telefone || "—"}
                      </span>
                      {totalContatos > 1 && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          +{totalContatos - 1} Contato{totalContatos - 1 === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {cidadeUf}
                </div>
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <ChevronRight className="h-4 w-4 self-center text-slate-400" />
                  {onExcluir && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onExcluir(cliente);
                      }}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 inline-flex items-center justify-center"
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        {isEmpty && <EmptyState />}
      </div>
    </div>
  );
}
