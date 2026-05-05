/** Reexporta os tokens globais para não quebrar imports existentes do módulo Comercial. */
export {
  formLabelClass as comercialLabelClass,
  formInputClass as comercialInputClass,
  formInputCompactClass as comercialInputCompactClass,
  formTextareaClass as comercialTextareaClass,
  formReadOnlyClass as comercialReadOnlyClass,
  formNativeSelectClass as comercialSelectClass,
  formInputLeadingIconPaddingClass as comercialInputLeadingIconPaddingClass,
  formTextareaLeadingIconTopClass as comercialTextareaLeadingIconTopClass,
  formModalCancelButtonClass,
  formModalSubmitButtonClass,
} from "@/components/ui/field-patterns";

/** Campos compostos (rótulo + ícone + validação) — padrão único do sistema */
export {
  FormLabel,
  FormTextInput,
  FormTextarea,
  FormDateField,
  FormCurrencyInput,
  FormSearchableSelectField,
  FormNativeSelectField,
  FormAttachmentField,
  formFieldInvalidOutlineClass,
} from "@/components/ui/form-fields";
