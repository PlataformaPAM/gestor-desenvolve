"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Users, Handshake, CheckCircle2 } from "lucide-react";
import { globalSearch, flattenResults, type GroupedSearchResults, type SearchResultItem } from "@/lib/global-search";
import { useAuth } from "@/contexts/auth-context";

const PRIMARY = "#6D28D9";

type GlobalSearchProps = {
  open: boolean;
  onClose: () => void;
};

const MODULE_GROUP_LABELS: Record<keyof GroupedSearchResults, string> = {
  clientes: "Clientes",
  comercial: "Comercial",
  tarefas: "Tarefas",
};

const MODULE_ICONS = {
  clientes: Users,
  comercial: Handshake,
  tarefas: CheckCircle2,
};

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const router = useRouter();
  const { session } = useAuth();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const authSession = useMemo(
    () => ({
      isSystemAdmin: session.isSystemAdmin,
      perfilNome: session.perfilNome,
      permissoes: session.permissoes,
      permissoesGranulares: session.permissoesGranulares,
    }),
    [
      session.isSystemAdmin,
      session.perfilNome,
      session.permissoes,
      session.permissoesGranulares,
    ]
  );

  const grouped = useMemo(
    () => globalSearch(query, authSession),
    [query, authSession]
  );
  const flatResults = useMemo(() => flattenResults(grouped), [grouped]);
  const totalCount = flatResults.length;

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i < totalCount - 1 ? i + 1 : i));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i > 0 ? i - 1 : 0));
        return;
      }
      if (e.key === "Enter" && totalCount > 0 && flatResults[selectedIndex]) {
        e.preventDefault();
        const item = flatResults[selectedIndex];
        router.push(item.href);
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose, totalCount, selectedIndex, flatResults, router]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (selectedIndex >= totalCount && totalCount > 0) {
      setSelectedIndex(totalCount - 1);
    }
    if (totalCount > 0 && selectedIndex < 0) setSelectedIndex(0);
  }, [totalCount, selectedIndex]);

  const scrollSelectedIntoView = useCallback((index: number) => {
    const el = listRef.current?.querySelector(`[data-index="${index}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollSelectedIntoView(selectedIndex);
  }, [selectedIndex, scrollSelectedIntoView]);

  const handleSelect = useCallback(
    (item: SearchResultItem) => {
      router.push(item.href);
      onClose();
    },
    [router, onClose]
  );

  let flatIndex = 0;

  const content = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/25 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Busca global"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-[12%] z-[60] w-full max-w-xl -translate-x-1/2 rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-700">
              <Search className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Buscar clientes, leads, tarefas... (Cmd+K)"
                className="flex-1 bg-transparent py-2 text-slate-900 placeholder-slate-400 outline-none dark:text-slate-100 dark:placeholder-slate-500"
                autoFocus
              />
              <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 sm:inline-block">
                ESC
              </kbd>
            </div>
            <div
              ref={listRef}
              className="max-h-[min(60vh,400px)] overflow-y-auto p-2"
            >
              {totalCount === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  {query.trim()
                    ? "Nenhum resultado para esta busca."
                    : "Digite para buscar em todo o sistema."}
                </div>
              ) : (
                <>
                  {(Object.keys(MODULE_GROUP_LABELS) as (keyof GroupedSearchResults)[]).map(
                    (mod) => {
                      const items = grouped[mod];
                      if (!items.length) return null;
                      const GroupIcon = MODULE_ICONS[mod];
                      return (
                        <div key={mod} className="mb-3 last:mb-0">
                          <div className="mb-1 flex items-center gap-2 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            <GroupIcon className="h-3.5 w-3.5" />
                            {MODULE_GROUP_LABELS[mod]}
                          </div>
                          <div className="space-y-0.5">
                            {items.map((item) => {
                              const currentIndex = flatIndex++;
                              const isSelected = currentIndex === selectedIndex;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  data-index={currentIndex}
                                  onClick={() => handleSelect(item)}
                                  onMouseEnter={() => setSelectedIndex(currentIndex)}
                                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                                    isSelected
                                      ? "bg-opacity-15 text-slate-900 dark:text-slate-100"
                                      : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                                  }`}
                                  style={
                                    isSelected
                                      ? { backgroundColor: `${PRIMARY}20` }
                                      : undefined
                                  }
                                >
                                  <GroupIcon className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
                                  <span className="min-w-0 flex-1 truncate">
                                    {item.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                  )}
                </>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-3 py-2 dark:border-slate-700">
              <span className="text-xs text-slate-400 dark:text-slate-500">
                ↑↓ navegar · Enter selecionar
              </span>
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
                Fechar
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
