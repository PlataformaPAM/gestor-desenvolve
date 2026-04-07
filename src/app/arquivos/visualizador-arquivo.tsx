"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download } from "lucide-react";

type VisualizadorArquivoProps = {
  open: boolean;
  onClose: () => void;
  nome: string;
  url: string;
  tipo: "imagem" | "pdf" | "outro";
};

const EXT_IMAGEM = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
const EXT_PDF = ["pdf"];

export function getTipoPreview(extensao?: string): "imagem" | "pdf" | "outro" {
  const ext = (extensao ?? "").toLowerCase();
  if (EXT_IMAGEM.includes(ext)) return "imagem";
  if (EXT_PDF.includes(ext)) return "pdf";
  return "outro";
}

export function VisualizadorArquivo({
  open,
  onClose,
  nome,
  url,
  tipo,
}: VisualizadorArquivoProps) {
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

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  };

  const content = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
          />
          <div className="fixed inset-4 z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:inset-6">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <h2 className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">
                {nome}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Download className="h-5 w-5" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4 dark:bg-slate-950">
              {tipo === "imagem" && (
                <img
                  src={url}
                  alt={nome}
                  className="mx-auto max-h-full max-w-full object-contain"
                />
              )}
              {tipo === "pdf" && (
                <iframe
                  title={nome}
                  src={url}
                  className="h-full min-h-[80vh] w-full rounded-lg border-0 bg-white"
                />
              )}
              {tipo === "outro" && (
                <div className="flex h-64 items-center justify-center text-slate-500">
                  Visualização não disponível. Use o botão Download.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
