"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Activity, BarChart3, Briefcase, CircleDollarSign, Layers, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { canViewResourceClient } from "@/lib/configuracoes/permission-client";

const AREAS = [
  {
    id: "saude-empresa",
    resourceId: "relatorios.saude_empresa",
    titulo: "Saúde da Empresa",
    descricao: "Visão executiva integrada com score por cliente e indicadores críticos da operação.",
    href: "/relatorios/saude-empresa",
    status: "Disponível",
    icon: Activity,
    enabled: true,
  },
  {
    id: "operacional",
    resourceId: "relatorios.operacional",
    titulo: "Operacional",
    descricao: "Relatórios de Tarefas Internas e Suporte para priorização e acompanhamento diário.",
    href: "/relatorios/operacional",
    status: "Disponível",
    icon: Layers,
    enabled: true,
  },
  {
    id: "financeiro",
    resourceId: "relatorios.financeiro",
    titulo: "Financeiro",
    descricao: "Fluxo de caixa, inadimplência, desempenho por categoria e visão de fechamento.",
    href: "/relatorios/financeiro",
    status: "Disponível",
    icon: CircleDollarSign,
    enabled: true,
  },
  {
    id: "comercial",
    resourceId: "relatorios.comercial",
    titulo: "Comercial",
    descricao: "Conversão de funil, propostas emitidas, ciclo de vendas e motivos de perda.",
    href: "/relatorios/comercial",
    status: "Disponível",
    icon: Briefcase,
    enabled: true,
  },
  {
    id: "prestacao-contas",
    resourceId: "relatorios.prestacao_contas",
    titulo: "Prestação de Contas",
    descricao: "Consolida resultados por cliente com foco em comunicação executiva e entrega mensal.",
    href: "/relatorios/prestacao-contas",
    status: "Disponível",
    icon: ShieldCheck,
    enabled: true,
  },
] as const;

export default function RelatoriosPage() {
  const { session } = useAuth();
  const areasVisiveis = useMemo(
    () => AREAS.filter((area) => canViewResourceClient(session, area.resourceId)),
    [session]
  );

  return (
    <section className="w-full min-w-0 space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <span className="mt-1 rounded-lg bg-violet-50 p-2 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
            <BarChart3 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Central de Relatórios</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Escolha a área do relatório para acessar modelos prontos com filtros e regras específicas por contexto.
            </p>
          </div>
        </div>
      </header>

      {areasVisiveis.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          Nenhuma área de relatórios liberada para o seu perfil.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {areasVisiveis.map((area) => {
          const Icon = area.icon;
          return area.enabled ? (
            <Link
              key={area.id}
              href={area.href}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-violet-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-violet-700"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-violet-50 p-2 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{area.titulo}</h3>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {area.status}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{area.descricao}</p>
              <p className="mt-4 text-xs font-medium text-violet-700 dark:text-violet-300">Abrir área de relatórios</p>
            </Link>
          ) : (
            <div
              key={area.id}
              className="rounded-2xl border border-slate-200/80 bg-slate-50 p-5 opacity-80 dark:border-slate-700 dark:bg-slate-900/60"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-slate-100 p-2 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{area.titulo}</h3>
                </div>
                <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {area.status}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{area.descricao}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
