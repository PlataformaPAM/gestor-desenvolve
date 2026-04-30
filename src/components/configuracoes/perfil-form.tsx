"use client";

import { useState, useEffect } from "react";
import type { PerfilAcesso, ModuloPermissao } from "@/lib/configuracoes/types";
import { MODULOS, MODULO_LABELS } from "@/lib/configuracoes/constants";

export type PerfilFormPayload = {
  id?: string;
  nome: string;
  descricao?: string;
  permissoes: Record<ModuloPermissao, boolean>;
};

type PerfilFormProps = {
  initialPerfil?: PerfilAcesso | null;
  onSave: (p: PerfilFormPayload) => void;
  onCancel: () => void;
  allowedModules?: ModuloPermissao[];
  moduleLabels?: Partial<Record<ModuloPermissao, string>>;
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
const labelClass = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

export function PerfilForm({
  initialPerfil,
  onSave,
  onCancel,
  allowedModules,
  moduleLabels,
}: PerfilFormProps) {
  const modules = allowedModules ?? MODULOS;
  const resolveLabel = (mod: ModuloPermissao) => moduleLabels?.[mod] ?? MODULO_LABELS[mod];
  const [nome, setNome] = useState(initialPerfil?.nome ?? "");
  const [descricao, setDescricao] = useState(initialPerfil?.descricao ?? "");
  const initialPermissoes = (): Record<ModuloPermissao, boolean> =>
    MODULOS.reduce((acc, m) => ({ ...acc, [m]: false }), {} as Record<ModuloPermissao, boolean>);

  const [permissoes, setPermissoes] = useState<Record<ModuloPermissao, boolean>>(
    () => initialPerfil?.permissoes ?? initialPermissoes()
  );

  useEffect(() => {
    if (initialPerfil) {
      setNome(initialPerfil.nome);
      setDescricao(initialPerfil.descricao ?? "");
      setPermissoes(initialPerfil.permissoes);
    } else {
      setNome("");
      setDescricao("");
      setPermissoes(initialPermissoes());
    }
  }, [initialPerfil]);

  const handleToggle = (mod: ModuloPermissao) => {
    setPermissoes((prev) => ({ ...prev, [mod]: !prev[mod] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    const payload: PerfilFormPayload = {
      nome: nome.trim(),
      descricao: descricao.trim() || undefined,
      permissoes: { ...permissoes },
    };
    if (initialPerfil) payload.id = initialPerfil.id;
    onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="space-y-1">
        <label htmlFor="perfil-nome" className={labelClass}>
          Nome do perfil *
        </label>
        <input
          id="perfil-nome"
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Vendedor Externo"
          className={inputClass}
          required
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="perfil-desc" className={labelClass}>
          Descrição
        </label>
        <input
          id="perfil-desc"
          type="text"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Breve descrição do perfil"
          className={inputClass}
        />
      </div>

      <div>
        <span className={labelClass}>Permissões por módulo</span>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Marque os módulos que este perfil pode visualizar na sidebar.
        </p>
        <ul className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-600 dark:bg-slate-800/50">
          {modules.map((mod) => (
            <li key={mod} className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!permissoes[mod]}
                  onChange={() => handleToggle(mod)}
                  className="h-4 w-4 rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800"
                />
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {resolveLabel(mod)}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 dark:border-slate-700 sm:flex-row sm:justify-end sm:gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-lg bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
        >
          {initialPerfil ? "Salvar alterações" : "Criar perfil"}
        </button>
      </div>
    </form>
  );
}
