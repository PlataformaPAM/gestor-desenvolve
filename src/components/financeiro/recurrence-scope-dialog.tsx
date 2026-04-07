"use client";

import { Dialog } from "@/components/ui/dialog";
import type { RecurrenceScope } from "@/lib/financeiro/recurrence-save";

type RecurrenceScopeDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (scope: RecurrenceScope) => void;
  disabled?: boolean;
};

export function RecurrenceScopeDialog({ open, onClose, onConfirm, disabled }: RecurrenceScopeDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={disabled ? () => {} : onClose}
      title="Recorrência: como aplicar a alteração?"
      maxWidth="sm:max-w-lg"
      zIndexClass="z-[70]"
    >
      <div className="space-y-4 px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
        <p>
          Este lançamento faz parte de uma recorrência (fixo mensal ou parcelado). Escolha em quais meses ou
          parcelas a alteração deve valer.
        </p>
        <ul className="list-inside list-disc space-y-1 text-xs text-slate-600 dark:text-slate-400">
          <li>
            <strong>Alterar apenas este</strong> — só o lançamento que você está editando.
          </li>
          <li>
            <strong>Alterar este e os próximos</strong> — este e todos os vencimentos posteriores do mesmo grupo.
          </li>
          <li>
            <strong>Alterar todos</strong> — do primeiro ao último lançamento do grupo.
          </li>
        </ul>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Valores já pagos não têm o valor monetário alterado em lote (exceto na linha que você editou). Texto e
          dados de cadastro replicam conforme a opção.
        </p>
        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onConfirm("single")}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            Alterar apenas este
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onConfirm("future")}
            className="rounded-lg border border-[#6D28D9]/40 bg-violet-50 px-4 py-2.5 text-sm font-medium text-[#5B21B6] hover:bg-violet-100 disabled:opacity-50 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-900/50"
          >
            Este e os próximos
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onConfirm("all")}
            className="rounded-lg bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
          >
            Alterar todos
          </button>
        </div>
      </div>
    </Dialog>
  );
}
