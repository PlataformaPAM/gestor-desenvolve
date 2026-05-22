"use client";

import Link from "next/link";
import { Activity, ChevronRight, FileText, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { canViewResourceClient } from "@/lib/configuracoes/permission-client";
import { useMemo } from "react";

const cards = [
  {
    title: "Construtor de Documentos",
    description: "Modelos reutilizáveis para propostas e mais.",
    href: "/configuracoes/construtor-documentos",
    icon: FileText,
    resourceId: "configuracoes.construtor_documentos",
  },
  {
    title: "Logs do Sistema",
    description: "Auditoria de ações e eventos.",
    href: "/configuracoes/logs",
    icon: Activity,
    resourceId: "configuracoes.logs",
  },
  {
    title: "Perfis de Acesso",
    description: "Permissões por módulo e governança.",
    href: "/configuracoes/perfis",
    icon: ShieldCheck,
    resourceId: "configuracoes.perfis",
  },
  {
    title: "Usuários",
    description: "Cadastro, edição e vínculos de acesso.",
    href: "/configuracoes/usuarios",
    icon: Users,
    resourceId: "configuracoes.usuarios",
  },
] as const;

export default function ConfiguracoesPage() {
  const { session } = useAuth();
  const visibleCards = useMemo(
    () => cards.filter((c) => canViewResourceClient(session, c.resourceId)),
    [session]
  );

  if (visibleCards.length === 0) {
    return (
      <section className="w-full min-w-0 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-10 text-center text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-400">
        Seu perfil não possui acesso a nenhuma área de Configurações.
      </section>
    );
  }

  return (
    <section className="w-full min-w-0 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {visibleCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.title}
              href={card.href}
              className="group flex items-stretch justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#6D28D9]/40 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="inline-flex shrink-0 rounded-xl bg-[#6D28D9]/10 p-2 text-[#6D28D9]">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900 group-hover:text-[#6D28D9] dark:text-slate-100">
                    {card.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{card.description}</p>
                </div>
              </div>
              <ChevronRight
                className="mt-1 h-5 w-5 shrink-0 text-slate-400 transition group-hover:text-[#6D28D9] dark:text-slate-500"
                aria-hidden
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
