"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { FileText, X } from "lucide-react";
import clsx from "clsx";
import { AlertDialog } from "@/components/ui/alert-dialog";

type MultiFileAttachmentProps = {
  /** Arquivos já salvos (após salvar) */
  existingFiles?: Array<string | { name: string; url: string }>;
  /** Arquivos recém-selecionados (pendentes) */
  newFiles: File[];
  /** Updater do estado local dos pendentes */
  onNewFilesChange: (files: File[]) => void;
  /** Accept do input (opcional) */
  accept?: string;
};

export function MultiFileAttachment({
  existingFiles = [],
  newFiles,
  onNewFilesChange,
  accept = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg",
}: MultiFileAttachmentProps) {
  const reactId = useId();
  const inputId = `file-upload-${reactId}`;
  const [removeFileIndex, setRemoveFileIndex] = useState<number | null>(null);
  const preparedNewFiles = useMemo(
    () =>
      newFiles.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    [newFiles]
  );

  useEffect(() => {
    return () => {
      preparedNewFiles.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [preparedNewFiles]);

  const preparedExistingFiles = useMemo(
    () =>
      existingFiles.map((item) => {
        if (typeof item === "string") {
          const isUrl = /^https?:\/\//i.test(item);
          return {
            name: isUrl ? decodeURIComponent(item.split("/").pop() || "Anexo") : item,
            url: isUrl ? item : undefined,
          };
        }
        return { name: item.name, url: item.url };
      }),
    [existingFiles]
  );

  const filePendingNome =
    removeFileIndex !== null ? newFiles[removeFileIndex]?.name ?? "este arquivo" : "";

  return (
    <div className="space-y-3">
      <input
        id={inputId}
        type="file"
        className="hidden"
        multiple
        accept={accept}
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          if (!files.length) return;
          onNewFilesChange([...newFiles, ...files]);
          e.target.value = "";
        }}
      />

      <label
        htmlFor={inputId}
        className="block cursor-pointer rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center transition-colors hover:border-purple-300 hover:bg-purple-50 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-violet-500 dark:hover:bg-violet-950/30"
      >
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Anexos</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Arraste documentos ou clique para anexar
        </p>
      </label>

      <div className="flex flex-wrap gap-2">
        {preparedExistingFiles.map((item, i) => {
          if (!item.url) {
            return (
              <div
                key={`existing-${i}-${item.name}`}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium",
                  "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                )}
                title="Anexo sem URL de visualização"
              >
                <FileText className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span className="max-w-[220px] truncate">{item.name}</span>
              </div>
            );
          }
          return (
            <a
              key={`existing-${i}-${item.name}`}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className={clsx(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium",
                "cursor-pointer border-slate-200 bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              )}
              title="Visualizar"
            >
              <FileText className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span className="max-w-[220px] truncate">{item.name}</span>
            </a>
          );
        })}

        {preparedNewFiles.map(({ file, url }, i) => (
          <a
            key={`new-${i}-${file.name}-${file.size}-${file.lastModified}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={clsx(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium",
              "cursor-pointer border-purple-200 bg-purple-100 text-purple-700 transition-colors hover:bg-purple-200 dark:border-violet-500/40 dark:bg-violet-950/50 dark:text-violet-300 dark:hover:bg-violet-900/40"
            )}
            title="Visualizar (antes de salvar)"
          >
            <FileText className="h-4 w-4 text-purple-600 dark:text-violet-400" />
            <span className="max-w-[200px] truncate">{file.name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setRemoveFileIndex(i);
              }}
              className="ml-1 inline-flex rounded p-0.5 text-purple-700 hover:bg-purple-200 dark:text-violet-300 dark:hover:bg-violet-900/50"
              aria-label="Remover arquivo"
              title="Remover"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </a>
        ))}
      </div>

      <AlertDialog
        open={removeFileIndex !== null}
        onClose={() => setRemoveFileIndex(null)}
        onConfirm={() => {
          if (removeFileIndex === null) return;
          const idx = removeFileIndex;
          onNewFilesChange(newFiles.filter((_, i) => i !== idx));
        }}
        title="Remover anexo?"
        description={
          <>
            <strong className="text-slate-900 dark:text-slate-100">Esta ação é irreversível:</strong> o arquivo{" "}
            <strong className="text-slate-900 dark:text-slate-100">{filePendingNome}</strong> será retirado da lista de
            pendências e não poderá ser recuperado aqui.
          </>
        }
        cancelLabel="Cancelar"
        confirmLabel="Sim, remover permanentemente"
        destructive
      />
    </div>
  );
}
