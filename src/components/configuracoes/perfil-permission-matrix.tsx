"use client";

import { Fragment, useMemo } from "react";
import clsx from "clsx";
import {
  groupPermissionResources,
  PERMISSION_ACTIONS,
  type PermissionResourceDef,
  type RecursoGrant,
} from "@/lib/configuracoes/permission-catalog";
import type { GrantsMap } from "@/lib/configuracoes/permission-grants";
import { getPermissionResourceVisual } from "@/lib/configuracoes/permission-resource-icons";

type Props = {
  grants: GrantsMap;
  onChange: (next: GrantsMap) => void;
  readOnly?: boolean;
  /** Quando true, renderiza só a tabela (rolagem e título ficam no formulário pai). */
  tableOnly?: boolean;
};

/** Colunas de ação: largura fixa dentro da tabela (não estoura o modal). */
const ACTION_COL_CLASS = "px-0.5 text-center";

function ActionHeaderLabel({ actionKey, label }: { actionKey: string; label: string }) {
  if (actionKey === "verTodos") {
    return (
      <span className="mx-auto inline-flex max-w-full flex-col items-center gap-0 leading-[1.2] normal-case tracking-normal">
        <span>Ver de</span>
        <span>todos</span>
      </span>
    );
  }
  return <span className="whitespace-nowrap">{label}</span>;
}

const THEAD_TH_CLASS =
  "sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-2 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 shadow-[0_1px_0_0_rgb(226,232,240)] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:shadow-[0_1px_0_0_rgb(51,65,85)]";

const GROUP_BODY_TONES = [
  "bg-white dark:bg-slate-900",
  "bg-violet-50/90 dark:bg-violet-950/30",
] as const;

function groupBodyTone(groupIndex: number): string {
  return GROUP_BODY_TONES[groupIndex % GROUP_BODY_TONES.length];
}

const ROW_COPY: Record<string, { title: string; hint: string }> = {
  "central.dashboard": { title: "Central", hint: "Página inicial e resumos do dia" },
  "comercial.pipeline": { title: "Comercial", hint: "Oportunidades e funil de vendas" },
  "financeiro.lancamentos": { title: "Lançamentos", hint: "Entradas, saídas e fluxo de caixa" },
  "financeiro.comissoes": { title: "Comissões", hint: "Pagamentos da equipe de vendas" },
  "financeiro.extrato": { title: "Extrato", hint: "Histórico de movimentações" },
  "financeiro.aprovacoes": { title: "Aprovações", hint: "Liberar vendas fechadas no comercial" },
  "financeiro.venda_direta": { title: "Venda direta", hint: "Registrar venda sem passar pelo funil" },
  "clientes.cadastro": {
    title: "Clientes",
    hint: "Sem «Ver de todos»: só clientes dos seus leads ou que você cadastrou",
  },
  "contratos.lista": { title: "Contratos", hint: "Contratos e documentos da venda" },
  "solucoes.catalogo": { title: "Soluções", hint: "Produtos e serviços oferecidos" },
  "helpdesk.tickets": { title: "Suporte", hint: "Chamados e atendimento" },
  "posvenda.tarefas": { title: "Pós-venda", hint: "Acompanhamento após a venda" },
  "tarefas.internas": { title: "Tarefas internas", hint: "Tarefas da equipe" },
  "rh.colaboradores": {
    title: "RH e parceiros",
    hint: "Sem «Ver de todos»: só o colaborador vinculado ao seu usuário",
  },
  "relatorios.comercial": { title: "Relatório comercial", hint: "Resultados de vendas" },
  "relatorios.financeiro": { title: "Relatório financeiro", hint: "Resultados do caixa" },
  "relatorios.operacional": { title: "Relatório operacional", hint: "Tarefas e suporte no dia a dia" },
  "relatorios.saude_empresa": { title: "Saúde da empresa", hint: "Visão geral para a diretoria" },
  "relatorios.prestacao_contas": { title: "Prestação de contas", hint: "Entrega de resultados ao cliente" },
  "configuracoes.dados_empresa": { title: "Dados da empresa", hint: "Nome, CNPJ e contatos da PAM" },
  "configuracoes.papeis_timbrados": { title: "Papéis timbrados", hint: "Modelos de papel para documentos" },
  "configuracoes.construtor_documentos": { title: "Modelos de documentos", hint: "Propostas e textos padrão" },
  "configuracoes.logs": { title: "Histórico do sistema", hint: "O que foi feito e por quem" },
  "configuracoes.perfis": { title: "Perfis de acesso", hint: "Quem pode ver e fazer o quê" },
  "configuracoes.usuarios": { title: "Usuários", hint: "Quem entra no sistema" },
  "portal.acesso": { title: "Portal do cliente", hint: "Área que o cliente acessa" },
  "alertas.caixa": { title: "Minha caixa", hint: "Avisos e pendências pessoais" },
};

function PermissionResourceIcon({ def }: { def: PermissionResourceDef }) {
  const visual = getPermissionResourceVisual(def.id, def);
  if (!visual) return null;
  const Icon = visual.icon;
  return (
    <span
      className={clsx(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
        visual.chipClassName
      )}
      aria-hidden
    >
      <Icon className={clsx("h-3.5 w-3.5", visual.iconClassName)} />
    </span>
  );
}

function AreaTitleBlock({ def, title, hint }: { def: PermissionResourceDef; title: string; hint: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <PermissionResourceIcon def={def} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium leading-snug text-slate-800 dark:text-slate-100">{title}</div>
        <p className="mt-0.5 text-xs leading-snug text-slate-500 dark:text-slate-400">{hint}</p>
      </div>
    </div>
  );
}

function rowDisplay(def: PermissionResourceDef): { title: string; hint: string } {
  const custom = ROW_COPY[def.id];
  if (custom) return custom;
  return {
    title: def.label,
    hint: def.ajuda?.replace(/[“”]/g, '"') ?? `Acesso em ${def.groupLabel}`,
  };
}

function toggleGrant(
  grants: GrantsMap,
  resourceId: string,
  key: keyof RecursoGrant,
  def: PermissionResourceDef
): GrantsMap {
  const current = grants[resourceId] ?? {
    ver: false,
    criar: false,
    editar: false,
    excluir: false,
    verTodos: false,
  };
  if (key === "excluir" && def.bloquearExcluir) return grants;
  if (key === "verTodos" && def.bloquearVerTodos) return grants;

  const nextVal = !current[key];
  const updated: RecursoGrant = { ...current, [key]: nextVal };

  if (key === "ver" && !nextVal) {
    updated.criar = false;
    updated.editar = false;
    updated.excluir = false;
    updated.verTodos = false;
  }
  if ((key === "criar" || key === "editar" || key === "excluir" || key === "verTodos") && nextVal) {
    updated.ver = true;
  }

  return { ...grants, [resourceId]: updated };
}

function AreaCell({
  def,
  groupLabel,
  isMulti,
  resourceIndex,
}: {
  def: PermissionResourceDef;
  groupLabel: string;
  isMulti: boolean;
  resourceIndex: number;
}) {
  const { title, hint } = rowDisplay(def);

  if (!isMulti) {
    return (
      <td className="py-2.5 pl-3 pr-2 align-middle">
        <AreaTitleBlock def={def} title={title} hint={hint} />
      </td>
    );
  }

  if (resourceIndex === 0) {
    return (
      <td className="py-2.5 pl-3 pr-2 align-middle">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-800 dark:text-violet-200">
          {groupLabel}
          <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-500 dark:text-slate-400">
            · várias áreas
          </span>
        </p>
        <div className="mt-1.5">
          <AreaTitleBlock def={def} title={title} hint={hint} />
        </div>
      </td>
    );
  }

  return (
    <td className="py-2 pl-3 pr-2 align-middle">
      <div className="border-l-2 border-violet-300/80 py-0.5 pl-3 dark:border-violet-500/45">
        <AreaTitleBlock def={def} title={title} hint={hint} />
      </div>
    </td>
  );
}

export function PerfilPermissionMatrix({
  grants,
  onChange,
  readOnly = false,
  tableOnly = false,
}: Props) {
  const groups = useMemo(() => groupPermissionResources(), []);

  const table = (
    <div
      className={clsx(
        "w-full min-w-0 overflow-hidden",
        tableOnly ? "" : "rounded-xl border border-slate-200 dark:border-slate-700"
      )}
    >
      <table className="w-full min-w-0 table-fixed border-collapse text-sm">
        <colgroup>
          <col />
          {PERMISSION_ACTIONS.map((a) => (
            <col key={a.key} className="w-[4.75rem]" />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className={clsx(THEAD_TH_CLASS, "pl-3 pr-2 text-left")}>Área</th>
            {PERMISSION_ACTIONS.map((a) => (
              <th
                key={a.key}
                className={clsx(
                  THEAD_TH_CLASS,
                  ACTION_COL_CLASS,
                  a.key === "verTodos" && "whitespace-normal px-0.5 py-2"
                )}
              >
                <ActionHeaderLabel actionKey={a.key} label={a.label} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group, groupIdx) => {
            const isMulti = group.resources.length > 1;
            const tone = groupBodyTone(groupIdx);
            return (
              <Fragment key={group.groupId}>
                {group.resources.map((def, resIdx) => {
                  const g = grants[def.id];
                  const showModuleSeparator = groupIdx > 0 && resIdx === 0;
                  return (
                    <tr
                      key={def.id}
                      className={clsx(
                        tone,
                        showModuleSeparator && "border-t border-slate-200 dark:border-slate-700"
                      )}
                    >
                      <AreaCell
                        def={def}
                        groupLabel={group.groupLabel}
                        isMulti={isMulti}
                        resourceIndex={resIdx}
                      />
                      {PERMISSION_ACTIONS.map((action) => {
                        const disabled =
                          readOnly ||
                          (action.key === "excluir" && def.bloquearExcluir) ||
                          (action.key === "verTodos" && def.bloquearVerTodos);
                        const checked = g?.[action.key] === true;
                        return (
                          <td key={action.key} className={clsx(ACTION_COL_CLASS, "py-2 align-middle")}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => onChange(toggleGrant(grants, def.id, action.key, def))}
                              className={clsx(
                                "h-4 w-4 rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800",
                                disabled && "cursor-not-allowed opacity-40"
                              )}
                              aria-label={`${rowDisplay(def).title} — ${action.label}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  if (tableOnly) {
    return table;
  }

  return (
    <div className="space-y-3">
      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Permissões detalhadas
        </span>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {readOnly
            ? "Perfil Administrador: acesso total a todas as áreas e ações."
            : "Marque o que este perfil pode fazer em cada área da plataforma."}
        </p>
      </div>
      {table}
    </div>
  );
}
