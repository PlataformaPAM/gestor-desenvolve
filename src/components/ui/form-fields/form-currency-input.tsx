"use client";

import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { Wallet } from "lucide-react";
import { forwardRef } from "react";
import {
  formInputClass,
  formInputCompactClass,
  formInputLeadingIconPaddingClass,
} from "@/components/ui/field-patterns";
import { FormLabel } from "./form-label";
import { formFieldInvalidOutlineClass } from "./form-field-validity";

export type FormCurrencyInputProps = Omit<
  React.ComponentPropsWithoutRef<"input">,
  "className" | "type"
> & {
  label?: React.ReactNode;
  /** Padrão: carteira / valor */
  icon?: LucideIcon;
  /** Campo compacto (linhas de tabela / grids densos) */
  compact?: boolean;
  inputClassName?: string;
  fieldClassName?: string;
  invalid?: boolean;
};

/** Entrada monetária com máscara livre no pai (`value` já formatado ou dígitos). Ícone à esquerda. */
export const FormCurrencyInput = forwardRef<HTMLInputElement, FormCurrencyInputProps>(
  function FormCurrencyInput(
    {
      label,
      icon: Icon = Wallet,
      id,
      required,
      compact,
      inputClassName,
      fieldClassName,
      invalid = false,
      inputMode = "numeric",
      autoComplete = "off",
      ...inputProps
    },
    ref
  ) {
    const shell = compact ? formInputCompactClass : formInputClass;
    const showInvalid = Boolean(invalid);

    const control = (
      <div className={clsx(formFieldInvalidOutlineClass(showInvalid))}>
        <div className="relative">
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={ref}
            id={id}
            type="text"
            inputMode={inputMode}
            autoComplete={autoComplete}
            aria-invalid={showInvalid}
            className={clsx(
              shell,
              formInputLeadingIconPaddingClass,
              "font-mono tabular-nums",
              inputClassName
            )}
            {...inputProps}
          />
        </div>
      </div>
    );

    if (label === undefined) {
      return <div className={fieldClassName}>{control}</div>;
    }

    return (
      <div className={fieldClassName}>
        <FormLabel htmlFor={id} required={required}>
          {label}
        </FormLabel>
        {control}
      </div>
    );
  }
);
