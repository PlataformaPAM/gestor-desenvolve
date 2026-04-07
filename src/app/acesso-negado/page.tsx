"use client";

import Link from "next/link";
import { ShieldX } from "lucide-react";

export default function AcessoNegadoPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/50">
          <ShieldX className="h-7 w-7 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Acesso Negado</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Você não tem permissão para acessar esta área. Entre em contato com o administrador se acredita que isso é um erro.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
