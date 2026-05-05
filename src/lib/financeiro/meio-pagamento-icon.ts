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
