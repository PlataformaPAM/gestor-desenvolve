"use client";

import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { forwardRef } from "react";
import {
  formInputClass,
  formInputLeadingIconPaddingClass,
  formTextareaLeadingIconTopClass,
} from "@/components/ui/field-patterns";
import { FormLabel } from "./form-label";
import { formFieldInvalidOutlineClass } from "./form-field-validity";

export type FormTextareaProps = Omit<
  React.ComponentPropsWithoutRef<"textarea">,
  "className"
> & {
  label?: React.ReactNode;
  icon: LucideIcon;
  textareaClassName?: string;
  fieldClassName?: string;
  controlWrapClassName?: string;
  invalid?: boolean;
};

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  function FormTextarea(
    {
      label,
      icon: Icon,
      id,
      required,
      textareaClassName,
      fieldClassName,
      controlWrapClassName,
      rows = 3,
      invalid = false,
      "aria-invalid": ariaInvalid,
      ...areaProps
    },
    ref
  ) {
    const showInvalid = Boolean(invalid || ariaInvalid);

    const control = (
      <div className={clsx(formFieldInvalidOutlineClass(showInvalid), controlWrapClassName)}>
        <div className="relative">
          <Icon
            className={clsx(
              "pointer-events-none absolute left-3 text-slate-400",
              formTextareaLeadingIconTopClass
            )}
          />
          <textarea
            ref={ref}
            id={id}
            rows={rows}
            aria-invalid={ariaInvalid ?? showInvalid}
            className={clsx(
              formInputClass,
              formInputLeadingIconPaddingClass,
              "min-h-[80px] resize-y",
              textareaClassName
            )}
            {...areaProps}
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
