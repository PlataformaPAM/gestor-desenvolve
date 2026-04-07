"use client";

import clsx from "clsx";
import { formatDateDMY } from "@/lib/format/dates";

type EntityMetaStripProps = {
  /** Nome de quem criou o registro. */
  criadoPorNome?: string | null;
  criadoEm?: string | Date | null;
  atualizadoEm?: string | Date | null;
  responsavelLabel?: string;
  className?: string;
};

export function EntityMetaStrip({
  criadoPorNome,
  criadoEm,
  atualizadoEm,
  responsavelLabel = "Usuário",
  className,
}: EntityMetaStripProps) {
  const nome = criadoPorNome?.trim() || "—";
  return (
    <p
      className={clsx(
        "text-[11px] leading-snug text-slate-500 dark:text-slate-400",
        className
      )}
    >
      <span className="font-medium text-slate-600 dark:text-slate-300">{responsavelLabel}:</span> {nome}
      <span className="mx-1 text-slate-300 dark:text-slate-600">·</span>
      <span className="font-medium text-slate-600 dark:text-slate-300">Criado:</span>{" "}
      {formatDateDMY(criadoEm)}
      <span className="mx-1 text-slate-300 dark:text-slate-600">·</span>
      <span className="font-medium text-slate-600 dark:text-slate-300">Alterado:</span>{" "}
      {formatDateDMY(atualizadoEm)}
    </p>
  );
}
