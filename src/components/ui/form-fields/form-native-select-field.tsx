"use client";

import clsx from "clsx";
import type { ReactNode, SelectHTMLAttributes } from "react";
import { formNativeSelectClass } from "@/components/ui/field-patterns";
import { FormLabel } from "./form-label";
import { formFieldInvalidOutlineClass } from "./form-field-validity";

export type FormNativeSelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode;
  required?: boolean;
  invalid?: boolean;
  /** `<option>` elements */
  children: ReactNode;
  selectClassName?: string;
};

export function FormNativeSelectField({
  label,
  id,
  required,
  invalid = false,
  children,
  className,
  selectClassName,
  ...selectProps
}: FormNativeSelectFieldProps) {
  const control = (
    <div className={clsx(formFieldInvalidOutlineClass(invalid))}>
      <select
        id={id}
        aria-invalid={invalid}
        className={clsx(formNativeSelectClass, selectClassName)}
        {...selectProps}
      >
        {children}
      </select>
    </div>
  );

  if (label === undefined) {
    return <div className={className}>{control}</div>;
  }

  return (
    <div className={className}>
      <FormLabel htmlFor={id} required={required}>
        {label}
      </FormLabel>
      {control}
    </div>
  );
}
