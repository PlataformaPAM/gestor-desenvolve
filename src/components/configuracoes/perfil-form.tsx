"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  FileText,
  Handshake,
  LifeBuoy,
  ListTodo,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  Wallet,
  LayoutGrid,
  BriefcaseBusiness,
  Save,
  X,
} from "lucide-react";
import type { PerfilAcesso, ModuloPermissao } from "@/lib/configuracoes/types";
import { MODULOS } from "@/lib/configuracoes/constants";
import {
  formInputClass,
  formLabelClass,
  formModalCancelButtonClass,
  formModalSubmitButtonClass,
  formTextareaClass,
} from "@/components/ui/field-patterns";

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

const MODULE_VISUALS: Record<ModuloPermissao, { icon: typeof BriefcaseBusiness; iconClassName: string; chipClassName: string }> = {
  comercial: {
    icon: Handshake,
    iconClassName: "text-blue-600 dark:text-blue-300",
    chipClassName: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-700/70 dark:bg-blue-900/40 dark:text-blue-200",
  },
  financeiro: {
    icon: Wallet,
    iconClassName: "text-emerald-600 dark:text-emerald-300",
    chipClassName:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/70 dark:bg-emerald-900/40 dark:text-emerald-200",
  },
  tarefas: {
    icon: ListTodo,
    iconClassName: "text-amber-600 dark:text-amber-300",
    chipClassName: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/70 dark:bg-amber-900/40 dark:text-amber-200",
  },
  clientes: {
    icon: Users,
    iconClassName: "text-cyan-600 dark:text-cyan-300",
    chipClassName: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-700/70 dark:bg-cyan-900/40 dark:text-cyan-200",
  },
  contratos: {
    icon: ScrollText,
    iconClassName: "text-teal-600 dark:text-teal-300",
    chipClassName:
      "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-700/70 dark:bg-teal-900/40 dark:text-teal-200",
  },
  solucoes: {
    icon: Package,
    iconClassName: "text-indigo-600 dark:text-indigo-300",
    chipClassName:
      "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-700/70 dark:bg-indigo-900/40 dark:text-indigo-200",
  },
  helpdesk: {
    icon: LifeBuoy,
    iconClassName: "text-orange-600 dark:text-orange-300",
    chipClassName:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-700/70 dark:bg-orange-900/40 dark:text-orange-200",
  },
  posVenda: {
    icon: CheckCircle2,
    iconClassName: "text-violet-600 dark:text-violet-300",
    chipClassName:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-700/70 dark:bg-violet-900/40 dark:text-violet-200",
  },
  rh: {
    icon: UserCog,
    iconClassName: "text-fuchsia-600 dark:text-fuchsia-300",
    chipClassName:
      "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-700/70 dark:bg-fuchsia-900/40 dark:text-fuchsia-200",
  },
  configuracoes: {
    icon: Settings,
    iconClassName: "text-violet-700 dark:text-violet-300",
    chipClassName:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-700/70 dark:bg-violet-900/40 dark:text-violet-200",
  },
  relatorios: {
    icon: BarChart3,
    iconClassName: "text-rose-700 dark:text-rose-300",
    chipClassName:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-700/70 dark:bg-rose-900/40 dark:text-rose-200",
  },
  configuracoes_construtor_documentos: {
    icon: FileText,
    iconClassName: "text-lime-700 dark:text-lime-300",
    chipClassName:
      "border-lime-200 bg-lime-50 text-lime-700 dark:border-lime-700/70 dark:bg-lime-900/40 dark:text-lime-200",
  },
  configuracoes_logs: {
    icon: Activity,
    iconClassName: "text-red-700 dark:text-red-300",
    chipClassName:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-700/70 dark:bg-red-900/40 dark:text-red-200",
  },
  configuracoes_perfis: {
    icon: ShieldCheck,
    iconClassName: "text-amber-700 dark:text-amber-300",
    chipClassName:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/70 dark:bg-amber-900/40 dark:text-amber-200",
  },
  configuracoes_usuarios: {
    icon: Users,
    iconClassName: "text-sky-700 dark:text-sky-300",
    chipClassName:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-700/70 dark:bg-sky-900/40 dark:text-sky-200",
  },
  portal_cliente: {
    icon: LayoutGrid,
    iconClassName: "text-sky-600 dark:text-sky-300",
    chipClassName:
      "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-700/70 dark:bg-sky-900/40 dark:text-sky-200",
  },
};

const CONFIGURACOES_SUBOPTIONS: Array<{
  id: string;
  label: string;
  moduleKey: ModuloPermissao;
  icon: typeof BriefcaseBusiness;
}> = [
  {
    id: "construtor-documentos",
    label: "Construtor de Documentos",
    moduleKey: "configuracoes_construtor_documentos",
    icon: FileText,
  },
  { id: "logs-sistema", label: "Logs do Sistema", moduleKey: "configuracoes_logs", icon: Activity },
  { id: "perfis-acesso", label: "Perfis de Acesso", moduleKey: "configuracoes_perfis", icon: ShieldCheck },
  { id: "usuarios", label: "Usuários", moduleKey: "configuracoes_usuarios", icon: Users },
] as const;

const SIDEBAR_PERMISSION_OPTIONS: Array<{
  id: string;
  label: string;
  icon: typeof BriefcaseBusiness;
  moduleKey?: ModuloPermissao;
  visualFrom?: ModuloPermissao;
  readOnly?: boolean;
}> = [
  { id: "comercial", label: "Comercial", icon: Handshake, moduleKey: "comercial" },
  { id: "financeiro", label: "Financeiro", icon: Wallet, moduleKey: "financeiro" },
  { id: "clientes", label: "Clientes", icon: Users, moduleKey: "clientes" },
  { id: "contratos", label: "Contratos", icon: ScrollText, moduleKey: "contratos", visualFrom: "clientes" },
  { id: "solucoes", label: "Soluções", icon: Package, moduleKey: "solucoes", visualFrom: "posVenda" },
  { id: "helpdesk", label: "Suporte", icon: LifeBuoy, moduleKey: "helpdesk" },
  { id: "pos-venda", label: "Pós-venda", icon: CheckCircle2, moduleKey: "posVenda" },
  { id: "minha-caixa", label: "Minha Caixa", icon: Bell, readOnly: true },
  { id: "tarefas", label: "Tarefas Internas", icon: ListTodo, moduleKey: "tarefas" },
  { id: "relatorios", label: "Relatórios", icon: BarChart3, moduleKey: "relatorios", visualFrom: "relatorios" },
  { id: "rh", label: "RH e Parceiros", icon: UserCog, moduleKey: "rh" },
  { id: "configuracoes", label: "Configurações", icon: Settings, moduleKey: "configuracoes" },
  { id: "portal-cliente", label: "Portal do Cliente", icon: LayoutGrid, moduleKey: "portal_cliente" },
];

export function PerfilForm({
  initialPerfil,
  onSave,
  onCancel,
  allowedModules,
  moduleLabels,
}: PerfilFormProps) {
  const restrictModuleSelection = Array.isArray(allowedModules) && allowedModules.length > 0;

  const sidebarOptionsFiltered = useMemo(() => {
    if (!restrictModuleSelection || !allowedModules) return SIDEBAR_PERMISSION_OPTIONS;
    const allowedSet = new Set(allowedModules);
    const seenModulo = new Set<ModuloPermissao>();
    return SIDEBAR_PERMISSION_OPTIONS.filter((option) => {
      if (option.readOnly) return true;
      const mod = option.moduleKey;
      if (!mod) return false;
      if (!allowedSet.has(mod)) return false;
      if (seenModulo.has(mod)) return false;
      seenModulo.add(mod);
      return true;
    });
  }, [allowedModules, restrictModuleSelection]);

  /** Sub-itens de Configurações (Construtor, Logs, etc.) só aparecem se a lista permitida incluir esses módulos granulares (portal não inclui — só helpdesk + configuracoes). */
  const showConfiguracoesGranular =
    !restrictModuleSelection ||
    CONFIGURACOES_SUBOPTIONS.some((sub) => allowedModules?.includes(sub.moduleKey) ?? false);

  const initialPermissoes = (): Record<ModuloPermissao, boolean> =>
    MODULOS.reduce((acc, m) => ({ ...acc, [m]: false }), {} as Record<ModuloPermissao, boolean>);

  const sanitizePermissoes = useCallback(
    (raw: Record<ModuloPermissao, boolean>): Record<ModuloPermissao, boolean> => {
      if (!restrictModuleSelection || !allowedModules) return raw;
      const next = { ...raw };
      for (const m of MODULOS) {
        if (!allowedModules.includes(m)) next[m] = false;
      }
      return next;
    },
    [restrictModuleSelection, allowedModules]
  );

  const [nome, setNome] = useState(initialPerfil?.nome ?? "");
  const [descricao, setDescricao] = useState(initialPerfil?.descricao ?? "");

  const [permissoes, setPermissoes] = useState<Record<ModuloPermissao, boolean>>(() =>
    sanitizePermissoes(initialPerfil?.permissoes ?? initialPermissoes())
  );

  useEffect(() => {
    if (initialPerfil) {
      setNome(initialPerfil.nome);
      setDescricao(initialPerfil.descricao ?? "");
      setPermissoes(sanitizePermissoes(initialPerfil.permissoes));
    } else {
      setNome("");
      setDescricao("");
      setPermissoes(sanitizePermissoes(initialPermissoes()));
    }
  }, [initialPerfil, sanitizePermissoes]);

  const handleToggle = (mod: ModuloPermissao) => {
    setPermissoes((prev) => ({ ...prev, [mod]: !prev[mod] }));
  };

  const hasConfiguracoesChildEnabled = CONFIGURACOES_SUBOPTIONS.some(
    (sub) => !!permissoes[sub.moduleKey]
  );

  const handleToggleConfiguracoesParent = () => {
    const nextValue = !(permissoes.configuracoes || hasConfiguracoesChildEnabled);
    setPermissoes((prev) => ({
      ...prev,
      configuracoes: nextValue,
      configuracoes_construtor_documentos: nextValue,
      configuracoes_logs: nextValue,
      configuracoes_perfis: nextValue,
      configuracoes_usuarios: nextValue,
    }));
  };

  const handleToggleConfiguracoesChild = (key: ModuloPermissao) => {
    setPermissoes((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      const childEnabled = CONFIGURACOES_SUBOPTIONS.some((sub) => !!updated[sub.moduleKey]);
      updated.configuracoes = childEnabled || updated.configuracoes;
      if (!childEnabled) updated.configuracoes = false;
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    const payload: PerfilFormPayload = {
      nome: nome.trim(),
      descricao: descricao.trim() || undefined,
      permissoes: sanitizePermissoes({ ...permissoes }),
    };
    if (initialPerfil) payload.id = initialPerfil.id;
    onSave(payload);
  };

  const resolveOptionLabel = (option: (typeof SIDEBAR_PERMISSION_OPTIONS)[number]) => {
    const mod = option.moduleKey;
    if (mod && moduleLabels?.[mod]) return moduleLabels[mod]!;
    return option.label;
  };

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4 lg:p-6">
        <div className="space-y-1">
          <label htmlFor="perfil-nome" className={formLabelClass}>
            Nome do perfil <span className="text-red-600 dark:text-red-400">*</span>
          </label>
          <input
            id="perfil-nome"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Vendedor Externo"
            className={formInputClass}
            required
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="perfil-desc" className={formLabelClass}>
            Descrição
          </label>
          <div className="relative">
            <FileText className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <textarea
              id="perfil-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Breve descrição do perfil"
              rows={3}
              className={`${formTextareaClass} pl-10`}
            />
          </div>
        </div>

        <div>
          <span className={formLabelClass}>Permissões por módulo</span>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            {restrictModuleSelection
              ? "Marque apenas os acessos disponíveis no portal para este perfil."
              : "Marque os módulos que este perfil pode visualizar na sidebar."}
          </p>
          <ul className="space-y-1">
            {sidebarOptionsFiltered.map((option) => {
              const mod = option.moduleKey;
              const isReadOnly = option.readOnly === true || !mod;
              const isEnabled =
                option.id === "configuracoes"
                  ? showConfiguracoesGranular
                    ? !!permissoes.configuracoes || hasConfiguracoesChildEnabled
                    : !!permissoes.configuracoes
                  : mod
                    ? !!permissoes[mod]
                    : true;
              const visualSource = option.visualFrom ?? mod ?? "configuracoes";
              const visual = MODULE_VISUALS[visualSource];
              const Icon = option.icon;
              return (
                <li key={option.id} className="border-t border-slate-200 py-2 first:border-t-0 dark:border-slate-700">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => {
                        if (option.id === "configuracoes") {
                          if (showConfiguracoesGranular) handleToggleConfiguracoesParent();
                          else if (mod) handleToggle(mod);
                          return;
                        }
                        if (mod) handleToggle(mod);
                      }}
                      disabled={isReadOnly}
                      className="h-4 w-4 rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800"
                    />
                    <span
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${visual.chipClassName}`}
                      aria-hidden
                    >
                      <Icon className={`h-4 w-4 ${isReadOnly ? "text-slate-500 dark:text-slate-300" : visual.iconClassName}`} />
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                      {resolveOptionLabel(option)}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                        isReadOnly
                          ? "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          : isEnabled
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/70 dark:bg-emerald-900/40 dark:text-emerald-200"
                          : "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {!isReadOnly && isEnabled && <Check className="h-3 w-3" />}
                      {isReadOnly ? "Sempre visível" : isEnabled ? "Ativo" : "Inativo"}
                    </span>
                  </label>
                  {option.id === "configuracoes" && showConfiguracoesGranular && (
                    <div className="ml-7 mt-2 space-y-1 border-l border-slate-200 pl-3 dark:border-slate-700">
                      {CONFIGURACOES_SUBOPTIONS.map((sub) => {
                        const SubIcon = sub.icon;
                        const subVisual = MODULE_VISUALS[sub.moduleKey];
                        const subEnabled = !!permissoes[sub.moduleKey];
                        return (
                          <label key={sub.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/70">
                            <input
                              type="checkbox"
                              checked={subEnabled}
                              onChange={() => handleToggleConfiguracoesChild(sub.moduleKey)}
                              className="h-4 w-4 rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800"
                            />
                            <span
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${subVisual.chipClassName}`}
                              aria-hidden
                            >
                              <SubIcon className={`h-4 w-4 ${subVisual.iconClassName}`} />
                            </span>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{sub.label}</span>
                            <span
                              className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                                subEnabled
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/70 dark:bg-emerald-900/40 dark:text-emerald-200"
                                  : "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                              }`}
                            >
                              {!!subEnabled && <Check className="h-3 w-3" />}
                              {!!subEnabled ? "Ativo" : "Inativo"}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:justify-end sm:gap-3 lg:px-6">
        <button type="button" onClick={onCancel} className={formModalCancelButtonClass}>
          <span className="inline-flex items-center gap-2">
            <X className="h-4 w-4 shrink-0" aria-hidden />
            Cancelar
          </span>
        </button>
        <button type="submit" className={formModalSubmitButtonClass}>
          <span className="inline-flex items-center gap-2">
            <Save className="h-4 w-4 shrink-0" aria-hidden />
            Salvar
          </span>
        </button>
      </div>
    </form>
  );
}
