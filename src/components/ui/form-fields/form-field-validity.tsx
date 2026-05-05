import clsx from "clsx";

/** Contorno suave para obrigatório não preenchido (mesmo padrão de Tarefas Internas). */
export function formFieldInvalidOutlineClass(active: boolean): string {
  return clsx(
    "w-full rounded-xl border-2 transition-[border-color,background-color,box-shadow] duration-150",
    active
      ? "border-red-400/55 bg-red-50/40 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.12)] dark:border-red-500/45 dark:bg-red-950/25 dark:shadow-[inset_0_0_0_1px_rgba(248,113,113,0.08)]"
      : "border-transparent bg-transparent"
  );
}
