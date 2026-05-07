import type { ComponentType } from "react";
import {
  Banknote,
  Barcode,
  CreditCard,
  FileText,
  Landmark,
  Smartphone,
  Wallet,
} from "lucide-react";

/** Ícone por palavra-chave no nome do meio (cadastro livre em Configurações). */
export function iconForMeioPagamentoNome(nome: string): ComponentType<{ className?: string }> {
  const n = nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (n.includes("pix")) return Smartphone;
  if (n.includes("boleto")) return Barcode;
  if (
    n.includes("cartao") ||
    n.includes("credito") ||
    n.includes("debito") ||
    n.includes("visa") ||
    n.includes("master") ||
    n.includes("elo") ||
    n.includes("amex")
  ) {
    return CreditCard;
  }
  if (n.includes("dinheiro") || n.includes("especie")) return Banknote;
  if (n.includes("ted") || n.includes("doc") || n.includes("transfer")) return Landmark;
  if (n.includes("cheque")) return FileText;
  return Wallet;
}

/**
 * Classes Tailwind para cor do ícone (mesma regra do modal Configurações do Financeiro).
 * Usa `!` para vencer o `text-slate-400` aplicado pelo `SearchableSelect` no trigger e na lista.
 */
export function meioPagamentoIconColorClass(nome: string): string {
  const n = nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (n.includes("pix")) return "!text-emerald-600 dark:!text-emerald-400";
  if (n.includes("boleto")) return "!text-sky-600 dark:!text-sky-400";
  if (
    n.includes("cartao") ||
    n.includes("credito") ||
    n.includes("debito") ||
    n.includes("visa") ||
    n.includes("master") ||
    n.includes("elo") ||
    n.includes("amex")
  ) {
    return "!text-violet-600 dark:!text-violet-400";
  }
  if (n.includes("dinheiro") || n.includes("especie")) return "!text-amber-600 dark:!text-amber-300";
  if (n.includes("ted") || n.includes("doc") || n.includes("transfer")) return "!text-blue-600 dark:!text-blue-400";
  if (n.includes("cheque")) return "!text-orange-600 dark:!text-orange-400";
  return "!text-slate-500 dark:!text-slate-400";
}
