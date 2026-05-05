/**
 * Padrões visuais dos formulários (modais).
 *
 * **Componentes compostos** (rótulo + ícone + validação): `@/components/ui/form-fields`
 * (`FormTextInput`, `FormTextarea`, `FormDateField`, `FormCurrencyInput`, `FormSearchableSelectField`, …).
 *
 * | Tipo | Componente / classe |
 * |------|---------------------|
 * | Texto com ícone | `FormTextInput` ou `formInputClass` + `formInputLeadingIconPaddingClass` |
 * | Textarea com ícone | `FormTextarea` ou `formTextareaClass` |
 * | Somente leitura | `formReadOnlyClass` |
 * | Data | `FormDateField` ou `DateField` em `@/components/ui/date-field` |
 * | Valor (R$) | `FormCurrencyInput` |
 * | Seleção pesquisável | `FormSearchableSelectField` + `SearchableSelect` |
 * | Select nativo | `FormNativeSelectField` ou `formNativeSelectClass` |
 * | Input compacto (grids) | `formInputCompactClass` |
 * | Label + * | `FormLabel` ou `formLabelClass` |
 * | Zona de anexo | `FormAttachmentField` ou `formAttachmentDropzoneClass` + `formAttachmentFileRowClass` |
 * | Botões de rodapé de modal | `formModalCancelButtonClass`, `formModalSubmitButtonClass` |
 */

export const formLabelClass =
  "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

/** Rótulo de seção sem margem inferior extra (ex.: “Anexos” acima de área customizada) */
export const formSectionLabelClass =
  "block text-sm font-medium text-slate-700 dark:text-slate-300";

/**
 * Padding extra quando há ícone Lucide à esquerda (alinha texto com `SearchableSelect` / `DateField`).
 * Use em `<input>` / `<textarea>` junto do ícone absoluto em `left-3`.
 */
export const formInputLeadingIconPaddingClass = "pl-10";

/** Posição vertical do ícone à esquerda em textarea com várias linhas */
export const formTextareaLeadingIconTopClass = "top-3.5";

/** Campo de texto / número — borda suave, foco violeta (#6D28D9), cantos xl */
export const formInputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";

export const formInputCompactClass =
  "w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";

export const formTextareaClass = formInputClass;

export const formReadOnlyClass =
  "w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300";

/** `<select>` nativo — mesma casca do input de texto */
export const formNativeSelectClass = formInputClass;

export const formAttachmentDropzoneClass =
  "flex w-full items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 py-6 text-sm text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100/80 hover:text-slate-700 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800";

export const formAttachmentFileRowClass =
  "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900";

export const formModalCancelButtonClass =
  "rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800";

export const formModalSubmitButtonClass =
  "rounded-lg bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-slate-900";
