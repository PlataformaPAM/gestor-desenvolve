"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

type DrawerSheetProps = {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  /** Largura máxima no desktop. Padrão global: igual Helpdesk (sm:max-w-3xl) */
  maxWidth?: string;
  /** Painel ocupa 100% da viewport (útil para telas de edição amplas). */
  fullViewport?: boolean;
  /**
   * Quando `true` (padrão), o corpo do drawer rola como um bloco único.
   * Quando `false`, o corpo não rola no painel: o conteúdo deve usar flex interno (ex.: abas + área rolável + rodapé fixos).
   */
  scrollBody?: boolean;
  /** Classe de padding horizontal no conteúdo (mobile). */
  mobileContentPaddingClassName?: string;
  /** Classe de padding horizontal no conteúdo (desktop). */
  desktopContentPaddingClassName?: string;
};

export function DrawerSheet({
  open,
  onClose,
  title,
  children,
  maxWidth = "sm:max-w-3xl",
  fullViewport = false,
  scrollBody = true,
  mobileContentPaddingClassName = "px-2 sm:px-3",
  desktopContentPaddingClassName = "px-3",
}: DrawerSheetProps) {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const header = (
    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700 lg:px-6">
      <h2
        id="drawer-sheet-title"
        className="text-lg font-semibold text-slate-900 dark:text-slate-100"
      >
        {title}
      </h2>
      <button
        type="button"
        onClick={onClose}
        className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] dark:hover:bg-slate-800 dark:hover:text-slate-200"
        aria-label="Fechar"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );

  const content = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            role="presentation"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[55] bg-black/20 backdrop-blur-[2px] dark:bg-black/45 dark:backdrop-blur-sm lg:bg-black/25 lg:dark:bg-black/50"
            onClick={onClose}
          />
          {/* Mobile: sheet from bottom */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-sheet-title"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className={`fixed z-[60] flex flex-col border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 lg:hidden ${
              fullViewport
                ? "inset-0 h-[100dvh] max-h-[100dvh] rounded-none border-0"
                : "inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl border-t"
            }`}
          >
            {header}
            <div className={`flex min-h-0 flex-1 flex-col overflow-hidden overflow-x-hidden ${mobileContentPaddingClassName}`}>
              <div
                className={
                  scrollBody
                    ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain"
                    : "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden overflow-x-hidden"
                }
              >
                {children}
              </div>
            </div>
          </motion.div>
          {/* Desktop: drawer from right */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-sheet-title"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className={`fixed right-0 top-0 z-[60] hidden h-full w-full flex-col border-l border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 lg:flex ${
              fullViewport ? "max-w-none" : maxWidth
            }`}
          >
            {header}
            <div className={`flex min-h-0 flex-1 flex-col overflow-hidden overflow-x-hidden ${desktopContentPaddingClassName}`}>
              <div
                className={
                  scrollBody
                    ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain"
                    : "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden overflow-x-hidden"
                }
              >
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
