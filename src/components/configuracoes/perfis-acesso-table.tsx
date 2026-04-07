"use client";

import { Pencil } from "lucide-react";
import type { PerfilAcesso, ModuloPermissao } from "@/lib/configuracoes/types";
import { MODULO_LABELS, MODULOS } from "@/lib/configuracoes/constants";

type PerfisAcessoTableProps = {
  perfis: PerfilAcesso[];
  onEditar?: (p: PerfilAcesso) => void;
  onToggle?: (perfilId: string, modulo: ModuloPermissao, value: boolean) => void;
  readOnly?: boolean;
};

export function PerfisAcessoTable({
  perfis,
  onEditar,
  onToggle,
  readOnly = true,
}: PerfisAcessoTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Perfil
              </th>
              {MODULOS.map((mod) => (
                <th
                  key={mod}
                  scope="col"
                  className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider"
                >
                  {MODULO_LABELS[mod]}
                </th>
              ))}
              {onEditar && (
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Ações
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {perfis.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{p.nome}</div>
                  {p.descricao && (
                    <div className="text-xs text-slate-500">{p.descricao}</div>
                  )}
                </td>
                {MODULOS.map((mod) => (
                  <td key={mod} className="px-3 py-3 text-center">
                    {readOnly ? (
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded border ${
                          p.permissoes[mod]
                            ? "border-violet-300 bg-violet-100 text-violet-700"
                            : "border-slate-200 bg-slate-50 text-slate-400"
                        }`}
                      >
                        {p.permissoes[mod] ? "✓" : "—"}
                      </span>
                    ) : (
                      <label className="flex cursor-pointer justify-center">
                        <input
                          type="checkbox"
                          checked={!!p.permissoes[mod]}
                          onChange={(e) =>
                            onToggle?.(p.id, mod, e.target.checked)
                          }
                          className="h-4 w-4 rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9]"
                        />
                      </label>
                    )}
                  </td>
                ))}
                {onEditar && (
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onEditar(p)}
                      className="rounded-lg p-2 text-slate-500 hover:bg-violet-50 hover:text-[#6D28D9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9]"
                      aria-label="Editar perfil"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
