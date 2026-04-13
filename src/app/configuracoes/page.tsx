import Link from "next/link";
import { FileText, ShieldCheck, Users, Activity } from "lucide-react";

const cards = [
  {
    title: "Construtor de Documentos",
    description: "Modelos reutilizáveis para propostas e mais.",
    href: "/configuracoes/construtor-documentos",
    icon: FileText,
  },
  {
    title: "Logs do Sistema",
    description: "Auditoria de ações e eventos.",
    href: "/configuracoes/logs",
    icon: Activity,
  },
  {
    title: "Perfis de Acesso",
    description: "Permissões por módulo e governança.",
    href: "/configuracoes/perfis",
    icon: ShieldCheck,
  },
  {
    title: "Usuários",
    description: "Cadastro, edição e vínculos de acesso.",
    href: "/configuracoes/usuarios",
    icon: Users,
  },
];

export default function ConfiguracoesPage() {
  return (
    <section className="w-full min-w-0 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.title}
              href={card.href}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#6D28D9]/40 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex rounded-xl bg-[#6D28D9]/10 p-2 text-[#6D28D9]">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900 group-hover:text-[#6D28D9] dark:text-slate-100">
                    {card.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{card.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
