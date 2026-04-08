"use client";

import { ChevronRight } from "lucide-react";
import type { UsuarioSistema, PerfilAcesso, PessoaParaVinculo } from "@/lib/configuracoes/types";
import clsx from "clsx";

function labelVinculo(
  u: UsuarioSistema,
  pessoasVinculo: PessoaParaVinculo[] | undefined
): string {
  const lista = u.vinculos?.length ? u.vinculos : u.vinculacao ? [u.vinculacao] : [];
  if (!lista.length) return "—";
  return (
    lista
      .map((v) => {
        const nome =
          ("nome" in v ? (v as { nome?: string }).nome : undefined) ??
          pessoasVinculo?.find((p) => p.id === v.id && p.tipo === v.tipo)?.nome;
        return `${v.tipo === "rh" ? "RH" : "Cliente"} - ${nome ?? v.id}`;
      })
      .join(" | ") || "—"
  );
}

type UsuariosTableProps = {
  usuarios: UsuarioSistema[];
  perfis: PerfilAcesso[];
  /** Fallback para resolver nome quando a API ainda não enviou `nome` no vínculo. */
  pessoasVinculo?: PessoaParaVinculo[];
  onEditar?: (u: UsuarioSistema) => void;
  onToggleAtivo?: (u: UsuarioSistema) => void;
};

export function UsuariosTable({
  usuarios,
  perfis,
  pessoasVinculo,
  onEditar,
  onToggleAtivo,
}: UsuariosTableProps) {
  const statusButtonClass = (ativo: boolean) =>
    ativo
      ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
      : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100";

  return (
    <>
      <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Nome / E-mail
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  CPF
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Perfil
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Vínculo
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {usuarios.map((u) => {
                const perfil = perfis.find((p) => p.id === u.perfilId);
                const vinculo = labelVinculo(u, pessoasVinculo);
                return (
                  <tr
                    key={u.id}
                    onClick={() => onEditar?.(u)}
                    className="cursor-pointer transition-colors hover:bg-slate-50/80"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {u.nomeExibicao || u.email}
                      </div>
                      <div className="text-sm text-slate-500">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{u.cpf}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {perfil?.nome ?? u.perfilId}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{vinculo}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleAtivo?.(u);
                        }}
                        className={clsx(
                          "rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
                          statusButtonClass(u.ativo)
                        )}
                      >
                        {u.ativo ? "Ativo" : "Inativo"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="md:hidden space-y-2">
        {usuarios.map((u) => {
          const perfil = perfis.find((p) => p.id === u.perfilId);
          const vinculo = labelVinculo(u, pessoasVinculo);
          return (
            <div
              key={u.id}
              role="button"
              tabIndex={0}
              onClick={() => onEditar?.(u)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onEditar?.(u);
                }
              }}
              className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:bg-slate-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 truncate">{u.nomeExibicao || u.email}</p>
                  <p className="text-sm text-slate-500 truncate">{u.email}</p>
                  <p className="text-xs font-mono text-slate-500 mt-1">{u.cpf}</p>
                  <p className="text-xs text-slate-500 mt-1">{perfil?.nome ?? u.perfilId} • {vinculo}</p>
                </div>
                <div className="text-right shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleAtivo?.(u);
                    }}
                    className={clsx(
                      "rounded-lg border px-2 py-1 text-xs font-semibold transition-colors",
                      statusButtonClass(u.ativo)
                    )}
                  >
                    {u.ativo ? "Ativo" : "Inativo"}
                  </button>
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
