"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LifeBuoy, Users, CheckCircle2, Clock3, AlertTriangle } from "lucide-react";
import type { Ticket } from "@/lib/helpdesk/types";

type PortalContextPayload = {
  user: { id: string; nome: string; isAdminCliente: boolean };
  clientes: Array<{ id: string; nome: string; empresa: string }>;
};

export default function PortalHomePage() {
  const [context, setContext] = useState<PortalContextPayload | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [usuarios, setUsuarios] = useState<Array<{ id: string; ativo: boolean }>>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [ctxRes, chamadosRes, usuariosRes] = await Promise.all([
          fetch("/api/portal/context", { cache: "no-store" }),
          fetch("/api/portal/chamados", { cache: "no-store" }),
          fetch("/api/portal/usuarios", { cache: "no-store" }),
        ]);
        if (!ctxRes.ok) throw new Error("Não foi possível carregar seu contexto de acesso.");
        const body = (await ctxRes.json()) as { data?: PortalContextPayload };
        const chamadosBody = (await chamadosRes.json().catch(() => null)) as { data?: { tickets?: Ticket[] } } | null;
        const usuariosBody = (await usuariosRes.json().catch(() => null)) as { data?: { usuarios?: Array<{ id: string; ativo: boolean }> } } | null;
        if (!active) return;
        setContext(body.data ?? null);
        setTickets(chamadosBody?.data?.tickets ?? []);
        setUsuarios(usuariosBody?.data?.usuarios ?? []);
      } catch (e) {
        if (!active) return;
        setErro(e instanceof Error ? e.message : "Falha ao carregar dados do portal.");
      } finally {
        if (active) setCarregando(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (carregando) return <p className="text-sm text-slate-500 dark:text-slate-400">Carregando painel do cliente...</p>;
  if (erro) return <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>;

  const ticketsAbertos = tickets.filter((t) => !["finalizado", "nao_solucionado"].includes(t.status)).length;
  const ticketsAtrasados = tickets.filter((t) => new Date(t.previsaoConclusao).getTime() < Date.now() && !["finalizado", "nao_solucionado"].includes(t.status)).length;
  const ticketsFinalizados = tickets.filter((t) => ["finalizado", "nao_solucionado"].includes(t.status)).length;
  const usuariosAtivos = usuarios.filter((u) => u.ativo).length;

  return (
    <section className="w-full min-w-0 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 sm:text-2xl">Bem-vindo ao Painel do Cliente</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Olá, <strong>{context?.user.nome ?? "Cliente"}</strong>. Aqui você acompanha os chamados e o andamento do atendimento.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Chamados abertos</p>
            <Clock3 className="h-4 w-4 text-[#6D28D9]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{ticketsAbertos}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Chamados atrasados</p>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{ticketsAtrasados}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Chamados finalizados</p>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{ticketsFinalizados}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Usuários ativos</p>
            <Users className="h-4 w-4 text-sky-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{usuariosAtivos}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href="/portal/chamados"
          className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-violet-600/60"
        >
          <LifeBuoy className="h-5 w-5 text-[#6D28D9] transition-transform group-hover:scale-105" />
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Suporte</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Abra novos chamados e acompanhe respostas da equipe.</p>
        </Link>

        <Link
          href="/portal/usuarios"
          className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-violet-600/60"
        >
          <Users className="h-5 w-5 text-[#6D28D9] transition-transform group-hover:scale-105" />
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Usuários</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Consulte os usuários vinculados ao seu cliente e permissões de acesso.</p>
        </Link>
      </div>

    </section>
  );
}

