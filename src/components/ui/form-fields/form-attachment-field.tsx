"use client";

import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Paperclip } from "lucide-react";
import {
  formAttachmentDropzoneClass,
  formSectionLabelClass,
} from "@/components/ui/field-patterns";

const defaultSectionLabel = (
  <span className="inline-flex items-center gap-2">
    <Paperclip className="h-4 w-4 shrink-0" aria-hidden />
    Anexos
  </span>
);

export type FormAttachmentFieldProps = {
  /** Texto da “seção” acima da zona (usa `formSectionLabelClass`) */
  sectionLabel?: ReactNode;
  /** Conteúdo interno do botão da zona (ícone + texto) */
  dropzoneChildren: ReactNode;
  dropzoneProps?: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "children">;
  /** Lista de arquivos / conteúdo abaixo da zona */
  children?: ReactNode;
  className?: string;
};

/**
 * Bloco padrão “Anexos”: rótulo de seção + zona tracejada (`formAttachmentDropzoneClass`).
 */
export function FormAttachmentField({
  sectionLabel = defaultSectionLabel,
  dropzoneChildren,
  dropzoneProps,
  children,
  className,
}: FormAttachmentFieldProps) {
  const { className: dzClass, ...rest } = dropzoneProps ?? {};
  return (
    <div className={clsx("space-y-1", className)}>
      <span className={formSectionLabelClass}>{sectionLabel}</span>
      <button type="button" className={clsx(formAttachmentDropzoneClass, dzClass)} {...rest}>
        {dropzoneChildren}
      </button>
      {children}
    </div>
  );
}
