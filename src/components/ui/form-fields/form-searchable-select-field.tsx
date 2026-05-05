"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import { FormLabel } from "./form-label";
import { formFieldInvalidOutlineClass } from "./form-field-validity";

export type FormSearchableSelectFieldProps = {
  id?: string;
  label?: ReactNode;
  required?: boolean;
  invalid?: boolean;
  /** Classes no wrapper externo */
  className?: string;
  children: ReactNode;
};

/** Rótulo + contorno de validação em volta do `SearchableSelect` (passe o componente como children). */
export function FormSearchableSelectField({
  id,
  label,
  required,
  invalid = false,
  className,
  children,
}: FormSearchableSelectFieldProps) {
  const wrap = (
    <div className={clsx(formFieldInvalidOutlineClass(invalid), className)}>{children}</div>
  );

  if (label === undefined) {
    return wrap;
  }

  return (
    <div>
      <FormLabel htmlFor={id} required={required}>
        {label}
      </FormLabel>
      {wrap}
    </div>
  );
}
