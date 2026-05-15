"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import confetti from "canvas-confetti";

type FechadoCelebrationModalProps = {
  open: boolean;
  valorTotal: number;
  onClose: () => void;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function FechadoCelebrationModal({
  open,
  valorTotal,
  onClose,
}: FechadoCelebrationModalProps) {
  const fired = useRef(false);

  useEffect(() => {
    if (!open) {
      fired.current = false;
      return;
    }
    if (fired.current) return;
    fired.current = true;
    const duration = 2500;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ["#6D28D9", "#8B5CF6", "#A78BFA", "#C4B5FD"],
      });
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ["#6D28D9", "#8B5CF6", "#A78BFA", "#C4B5FD"],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fechado-modal-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 text-center">
          <span className="text-4xl" aria-hidden>
            🎉
          </span>
          <h2
            id="fechado-modal-title"
            className="mt-2 text-xl font-bold text-slate-900"
          >
            Parabéns pela Venda!
          </h2>
          <p className="mt-2 text-2xl font-semibold text-[#6D28D9]">
            {formatCurrency(valorTotal)}
          </p>
          <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-left text-sm leading-relaxed text-slate-600">
            <p>O Financeiro foi notificado para preparar o faturamento.</p>
            <p>
              O contrato segue pendente de aprovação financeira. Ao aprovar, o lançamento é gerado e as tarefas de
              Pós-venda (kick-off e playbook das soluções) são criadas automaticamente.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#6D28D9] py-2.5 text-sm font-medium text-white hover:bg-[#5B21B6]"
        >
          <X className="h-4 w-4 shrink-0" aria-hidden />
          Fechar
        </button>
      </div>
    </div>
  );
}
