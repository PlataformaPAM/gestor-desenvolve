"use client";

import { ChevronRight, Pencil } from "lucide-react";
import type { UsuarioSistema, PerfilAcesso, PessoaParaVinculo } from "@/lib/configuracoes/types";
import clsx from "clsx";

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length !== 11) return value;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function labelTipoRh(rhTipo?: PessoaParaVinculo["rhTipo"]): string {
  if (rhTipo === "equipe_interna") return "Equipe";
  if (rhTipo === "vendedor_externo") return "Consultor";
  if (rhTipo === "fornecedor_parceiro") return "Fornecedor";
  return "Equipe";
}

function labelVinculo(
  u: UsuarioSistema,
  pessoasVinculo: PessoaParaVinculo[] | undefined
): string {
  const lista = u.vinculos?.length ? u.vinculos : u.vinculacao ? [u.vinculacao] : [];
  if (!lista.length) return "—";
  return (
    lista
      .map((v) => {
        const pessoa = pessoasVinculo?.find((p) => p.id === v.id && p.tipo === v.tipo);
        const nome = ("nome" in v ? (v as { nome?: string }).nome : undefined) ?? pessoa?.nome;
        if (v.tipo === "rh") return `${labelTipoRh(pessoa?.rhTipo)} - ${nome ?? v.id}`;
        return `Cliente - ${nome ?? v.id}`;
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
  hideVinculoColumn?: boolean;
};

export function UsuariosTable({
  usuarios,
  perfis,
  pessoasVinculo,
  onEditar,
  hideVinculoColumn = false,
}: UsuariosTableProps) {
  const statusButtonClass = (ativo: boolean) =>
    ativo
      ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700/70 dark:bg-emerald-900/30 dark:text-emerald-200"
      : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-700/70 dark:bg-amber-900/30 dark:text-amber-200";

  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900 md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800/70">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Nome / E-mail
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  CPF
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Perfil
                </th>
                {!hideVinculoColumn && (
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Vínculo
                  </th>
                )}
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
              {usuarios.map((u) => {
                const perfil = perfis.find((p) => p.id === u.perfilId);
                const vinculo = labelVinculo(u, pessoasVinculo);
                return (
                  <tr
                    key={u.id}
                    onClick={() => onEditar?.(u)}
                    className="cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/60"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {u.nomeExibicao || u.email}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{formatCpf(u.cpf)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                      {perfil?.nome ?? u.perfilId}
                    </td>
                    {!hideVinculoColumn && <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{vinculo}</td>}
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          "inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold",
                          statusButtonClass(u.ativo)
                        )}
                      >
                        {u.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 text-slate-400">
                        <Pencil className="h-4 w-4" aria-hidden />
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="space-y-2 md:hidden">
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
              className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:bg-slate-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900 dark:text-slate-100">{u.nomeExibicao || u.email}</p>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">{u.email}</p>
                  <p className="mt-1 text-xs font-mono text-slate-500 dark:text-slate-400">{formatCpf(u.cpf)}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {hideVinculoColumn ? (perfil?.nome ?? u.perfilId) : `${perfil?.nome ?? u.perfilId} • ${vinculo}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={clsx(
                      "inline-flex rounded-lg border px-2 py-1 text-xs font-semibold",
                      statusButtonClass(u.ativo)
                    )}
                  >
                    {u.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex justify-end gap-1.5 text-slate-400">
                <Pencil className="h-4 w-4" aria-hidden />
                <ChevronRight className="h-4 w-4" aria-hidden />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
