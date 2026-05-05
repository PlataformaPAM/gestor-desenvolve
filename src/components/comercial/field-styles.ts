/** Reexporta os tokens globais para não quebrar imports existentes do módulo Comercial. */
export {
  formLabelClass as comercialLabelClass,
  formInputClass as comercialInputClass,
  formInputCompactClass as comercialInputCompactClass,
  formTextareaClass as comercialTextareaClass,
  formReadOnlyClass as comercialReadOnlyClass,
  formNativeSelectClass as comercialSelectClass,
} from "@/components/ui/field-patterns";
