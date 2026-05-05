import clsx from "clsx";
import type { LabelHTMLAttributes, ReactNode } from "react";
import { formLabelClass } from "@/components/ui/field-patterns";

export type FormLabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  children: ReactNode;
  /** Exibe asterisco vermelho ao lado do texto */
  required?: boolean;
};

export function FormLabel({ children, className, required, ...props }: FormLabelProps) {
  return (
    <label {...props} className={clsx(formLabelClass, className)}>
      {children}
      {required ? (
        <span className="text-red-600 dark:text-red-400" aria-hidden>
          {" "}
          *
        </span>
      ) : null}
    </label>
  );
}
