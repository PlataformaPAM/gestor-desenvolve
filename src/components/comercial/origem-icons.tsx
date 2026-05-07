import type { ComponentType } from "react";
import clsx from "clsx";
import {
  BadgeHelp,
  Globe,
  Mail,
  Megaphone,
  PhoneCall,
  UserCircle2,
  MailPlus,
} from "lucide-react";

type IconProps = { className?: string };

function WhatsappBrandIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.47 14.38c-.27-.14-1.59-.78-1.84-.87-.25-.09-.43-.14-.61.14-.18.27-.7.87-.86 1.05-.16.18-.31.2-.58.07-.27-.14-1.12-.41-2.14-1.31-.79-.7-1.33-1.56-1.49-1.83-.16-.27-.02-.42.12-.56.12-.12.27-.31.41-.47.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.47-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.45-.61-.46h-.52c-.18 0-.47.07-.72.34-.25.27-.95.93-.95 2.27s.97 2.64 1.11 2.82c.14.18 1.9 2.9 4.61 4.06.65.28 1.15.45 1.55.57.65.21 1.24.18 1.71.11.52-.08 1.59-.65 1.82-1.28.22-.63.22-1.17.16-1.28-.07-.11-.25-.18-.52-.32Z" />
      <path d="M20.52 3.48A11.9 11.9 0 0 0 12.06 0C5.56 0 .27 5.3.27 11.8c0 2.08.54 4.11 1.56 5.9L0 24l6.47-1.69a11.75 11.75 0 0 0 5.58 1.42h.01c6.5 0 11.8-5.3 11.8-11.8 0-3.15-1.22-6.1-3.34-8.45ZM12.06 21.7h-.01a9.78 9.78 0 0 1-4.98-1.36l-.36-.21-3.84 1 1.02-3.74-.23-.39a9.8 9.8 0 0 1-1.5-5.2c0-5.42 4.41-9.83 9.84-9.83 2.62 0 5.08 1.02 6.93 2.89a9.74 9.74 0 0 1 2.87 6.95c0 5.42-4.41 9.83-9.83 9.83Z" />
    </svg>
  );
}

function InstagramBrandIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.9A3.85 3.85 0 0 0 3.9 7.75v8.5A3.85 3.85 0 0 0 7.75 20.1h8.5a3.85 3.85 0 0 0 3.85-3.85v-8.5a3.85 3.85 0 0 0-3.85-3.85h-8.5Zm9.35 1.45a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4ZM12 6.8a5.2 5.2 0 1 1 0 10.4 5.2 5.2 0 0 1 0-10.4Zm0 1.9a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6Z" />
    </svg>
  );
}

function FacebookBrandIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M13.5 21v-7h2.4l.4-2.8h-2.8V9.4c0-.8.22-1.35 1.38-1.35h1.47V5.53c-.25-.03-1.1-.1-2.08-.1-2.06 0-3.47 1.26-3.47 3.57v2h-2.33V14h2.33v7h2.74Z" />
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 18.1A8.1 8.1 0 1 1 12 3.9a8.1 8.1 0 0 1 0 16.2Z" />
    </svg>
  );
}

/**
 * Ícones da origem com cores de marca (WhatsApp, Instagram, Facebook) ou paleta alinhada ao restante.
 * Usa `!text-*` para prevalecer sobre o `text-slate-400` do `SearchableSelect`.
 */
export function iconForOrigem(value: string): ComponentType<{ className?: string }> {
  switch (value) {
    case "whatsapp":
      return ({ className }) => (
        <WhatsappBrandIcon className={clsx("!text-[#25D366]", className)} />
      );
    case "instagram":
      return ({ className }) => (
        <InstagramBrandIcon className={clsx("!text-[#E4405F]", className)} />
      );
    case "facebook":
      return ({ className }) => (
        <FacebookBrandIcon className={clsx("!text-[#1877F2]", className)} />
      );
    case "email":
      return ({ className }) => (
        <Mail className={clsx("!text-sky-600 dark:!text-sky-400", className)} />
      );
    case "ligacao":
      return ({ className }) => (
        <PhoneCall className={clsx("!text-emerald-600 dark:!text-emerald-400", className)} />
      );
    case "site":
      return ({ className }) => (
        <Globe className={clsx("!text-indigo-600 dark:!text-indigo-400", className)} />
      );
    case "email_marketing":
      return ({ className }) => (
        <MailPlus className={clsx("!text-violet-600 dark:!text-violet-400", className)} />
      );
    case "evento":
      return ({ className }) => (
        <Megaphone className={clsx("!text-rose-600 dark:!text-rose-400", className)} />
      );
    case "indicacao":
      return ({ className }) => (
        <UserCircle2 className={clsx("!text-cyan-600 dark:!text-cyan-400", className)} />
      );
    case "outro":
    default:
      return ({ className }) => (
        <BadgeHelp className={clsx("!text-slate-500 dark:!text-slate-400", className)} />
      );
  }
}
