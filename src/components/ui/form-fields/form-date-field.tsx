"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import { DateField } from "@/components/ui/date-field";
import { FormLabel } from "./form-label";
import { formFieldInvalidOutlineClass } from "./form-field-validity";

export type FormDateFieldProps = {
  id?: string;
  label?: ReactNode;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  /** `max-w-xs` etc. */
  className?: string;
  invalid?: boolean;
};

export function FormDateField({
  id,
  label,
  required,
  value,
  onChange,
  placeholder,
  min,
  max,
  disabled,
  className,
  invalid = false,
}: FormDateFieldProps) {
  const inner = (
    <div className={clsx(formFieldInvalidOutlineClass(invalid), className)}>
      <DateField
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        max={max}
        disabled={disabled}
      />
    </div>
  );

  if (label === undefined) {
    return inner;
  }

  return (
    <div>
      <FormLabel htmlFor={id} required={required}>
        {label}
      </FormLabel>
      {inner}
    </div>
  );
}
