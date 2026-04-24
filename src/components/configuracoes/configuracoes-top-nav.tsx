"use client";

import Link from "next/link";

type Props = {
  className?: string;
  /** Só no fluxo do Construtor de Documentos (atalhos para Dados da Empresa / Papéis Timbrados). */
  atalhosDocumentos?: boolean;
  returnHref?: string;
  returnLabel?: string;
};

export function ConfiguracoesTopNav({
  className = "ml-auto",
  atalhosDocumentos = false,
  returnHref = "/configuracoes",
  returnLabel = "Voltar ao Configurações",
}: Props) {
  return (
    <div className={`${className} flex flex-wrap items-center gap-2`}>
      {atalhosDocumentos ? (
        <>
          <Link
            href="/configuracoes/dados-empresa"
            className="inline-flex h-10 shrink-0 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Dados da Empresa
          </Link>
          <Link
            href="/configuracoes/papeis-timbrados"
            className="inline-flex h-10 shrink-0 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Papéis Timbrados
          </Link>
        </>
      ) : null}
      <Link
        href={returnHref}
        className="inline-flex h-10 shrink-0 items-center rounded-lg bg-amber-500 px-3 text-sm font-medium text-white transition-colors hover:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:bg-amber-600 dark:hover:bg-amber-500"
      >
        {returnLabel}
      </Link>
    </div>
  );
}

