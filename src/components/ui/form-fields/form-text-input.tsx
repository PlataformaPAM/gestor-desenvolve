"use client";

import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { forwardRef } from "react";
import {
  formInputClass,
  formInputLeadingIconPaddingClass,
} from "@/components/ui/field-patterns";
import { FormLabel } from "./form-label";
import { formFieldInvalidOutlineClass } from "./form-field-validity";

export type FormTextInputProps = Omit<
  React.ComponentPropsWithoutRef<"input">,
  "className"
> & {
  label?: React.ReactNode;
  /** Ícone à esquerda (mesmo alinhamento dos selects) */
  icon: LucideIcon;
  /** Classes extras no `<input>` */
  inputClassName?: string;
  /** Classes no wrapper externo do campo (label + controle) */
  fieldClassName?: string;
  /** Classes no wrapper só do input (anel de validação + ícone) */
  controlWrapClassName?: string;
  invalid?: boolean;
};

export const FormTextInput = forwardRef<HTMLInputElement, FormTextInputProps>(
  function FormTextInput(
    {
      label,
      icon: Icon,
      id,
      required,
      inputClassName,
      fieldClassName,
      controlWrapClassName,
      invalid = false,
      "aria-invalid": ariaInvalid,
      ...inputProps
    },
    ref
  ) {
    const showInvalid = Boolean(invalid || ariaInvalid);

    const control = (
      <div className={clsx(formFieldInvalidOutlineClass(showInvalid), controlWrapClassName)}>
        <div className="relative">
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={ref}
            id={id}
            required={required}
            aria-invalid={ariaInvalid ?? showInvalid}
            className={clsx(formInputClass, formInputLeadingIconPaddingClass, inputClassName)}
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
