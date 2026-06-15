"use client";

import { useId, useMemo, useState, type MouseEvent } from "react";
import { Eye, FileText, Paperclip, X } from "lucide-react";
import clsx from "clsx";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { formAttachmentFileRowClass } from "@/components/ui/field-patterns";

type ExistingFileItem = string | { name: string; url?: string | null };

type MultiFileAttachmentProps = {
  /** Arquivos já salvos (nomes ou objetos com URL) */
  existingFiles?: ExistingFileItem[];
  /** Lista atualizada ao remover anexos já salvos */
  onExistingFilesChange?: (names: string[]) => void;
  /** Arquivos em memória para visualizar anexos salvos só pelo nome */
  previewFiles?: File[];
  /** Arquivos recém-selecionados (pendentes) */
  newFiles: File[];
  /** Updater do estado local dos pendentes */
  onNewFilesChange: (files: File[] | ((prev: File[]) => File[])) => void;
  /** Oculta zona de upload e botões de remover */
  readOnly?: boolean;
  /** Accept do input (opcional) */
  accept?: string;
};

function fileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function openFilePreview(file?: File, url?: string): void {
  let blobUrl: string | undefined;
  let shouldRevoke = false;

  if (file) {
    blobUrl = URL.createObjectURL(file);
    shouldRevoke = true;
  } else if (url) {
    blobUrl = url;
  }

  if (!blobUrl) return;

  const opened = window.open(blobUrl, "_blank", "noopener,noreferrer");
  if (!opened) {
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  if (shouldRevoke) {
    window.setTimeout(() => URL.revokeObjectURL(blobUrl!), 60_000);
  }
}

function normalizeExisting(item: ExistingFileItem): { name: string; url?: string } {
  if (typeof item === "string") {
    const isUrl = /^https?:\/\//i.test(item);
    return {
      name: isUrl ? decodeURIComponent(item.split("/").pop() || "Anexo") : item,
      url: isUrl ? item : undefined,
    };
  }
  return { name: item.name, url: item.url ?? undefined };
}

export function MultiFileAttachment({
  existingFiles = [],
  onExistingFilesChange,
  previewFiles = [],
  newFiles,
  onNewFilesChange,
  readOnly = false,
  accept = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg",
}: MultiFileAttachmentProps) {
  const reactId = useId();
  const inputId = `file-upload-${reactId}`;
  const [removeNewIndex, setRemoveNewIndex] = useState<number | null>(null);
  const [removeExistingIndex, setRemoveExistingIndex] = useState<number | null>(null);

  const previewByName = useMemo(() => {
    const map = new Map<string, File>();
    for (const file of previewFiles) {
      if (!map.has(file.name)) map.set(file.name, file);
    }
    return map;
  }, [previewFiles]);

  const preparedExistingFiles = useMemo(
    () => existingFiles.map((item) => normalizeExisting(item)),
    [existingFiles]
  );

  const canRemoveExisting = Boolean(onExistingFilesChange) && !readOnly;
  const canAdd = !readOnly;

  const newFilePendingNome =
    removeNewIndex !== null ? newFiles[removeNewIndex]?.name ?? "este arquivo" : "";
  const existingFilePendingNome =
    removeExistingIndex !== null
      ? preparedExistingFiles[removeExistingIndex]?.name ?? "este anexo"
      : "";

  const resolvePreview = (name: string, url?: string): { canPreview: boolean; file?: File; remoteUrl?: string } => {
    if (url) {
      return { canPreview: true, remoteUrl: url };
    }
    const file = previewByName.get(name);
    if (file) {
      return { canPreview: true, file };
    }
    return { canPreview: false };
  };

  const handlePreviewClick = (file?: File, remoteUrl?: string) => (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    openFilePreview(file, remoteUrl);
  };

  const iconButtonClass =
    "inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:pointer-events-none disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100";

  return (
    <div className="space-y-3">
      {canAdd ? (
        <>
          <input
            id={inputId}
            type="file"
            className="hidden"
            multiple
            accept={accept}
            onChange={(e) => {
              const picked = e.target.files ? Array.from(e.target.files) : [];
              if (!picked.length) return;
              onNewFilesChange((current) => {
                const existing = new Set(current.map(fileKey));
                const next = [...current];
                for (const file of picked) {
                  const key = fileKey(file);
                  if (!existing.has(key)) next.push(file);
                }
                return next;
              });
              e.target.value = "";
            }}
          />

          <label
            htmlFor={inputId}
            className="block cursor-pointer rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center transition-colors hover:border-purple-300 hover:bg-purple-50 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-violet-500 dark:hover:bg-violet-950/30"
          >
            <p className="inline-flex items-center justify-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Paperclip className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
              Anexos
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Arraste documentos ou clique para anexar
            </p>
          </label>
        </>
      ) : null}

      {(preparedExistingFiles.length > 0 || newFiles.length > 0) && (
        <ul className="space-y-2">
          {preparedExistingFiles.map((item, i) => {
            const preview = resolvePreview(item.name, item.url);
            return (
              <li key={`existing-${i}-${item.name}`} className={formAttachmentFileRowClass}>
                <span className="inline-flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <FileText className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
                  <span className="truncate" title={item.name}>
                    {item.name}
                  </span>
                </span>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={handlePreviewClick(preview.file, preview.remoteUrl)}
                    disabled={!preview.canPreview}
                    className={iconButtonClass}
                    title={preview.canPreview ? "Visualizar em nova aba" : "Visualização indisponível para este anexo"}
                    aria-label={preview.canPreview ? `Visualizar ${item.name}` : `Visualização indisponível: ${item.name}`}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  {canRemoveExisting ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setRemoveExistingIndex(i);
                      }}
                      className={clsx(iconButtonClass, "hover:text-red-600 dark:hover:text-red-400")}
                      title="Remover anexo"
                      aria-label={`Remover ${item.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}

          {newFiles.map((file, i) => (
            <li
              key={`new-${i}-${fileKey(file)}`}
              className={clsx(
                formAttachmentFileRowClass,
                "border-purple-200 bg-purple-50/60 dark:border-violet-500/35 dark:bg-violet-950/25"
              )}
            >
              <span className="inline-flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-purple-800 dark:text-violet-200">
                <FileText className="h-4 w-4 shrink-0 text-purple-600 dark:text-violet-400" aria-hidden />
                <span className="truncate" title={file.name}>
                  {file.name}
                </span>
              </span>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={handlePreviewClick(file)}
                  className={clsx(iconButtonClass, "text-purple-700 hover:bg-purple-100 dark:text-violet-300 dark:hover:bg-violet-900/40")}
                  title="Visualizar em nova aba"
                  aria-label={`Visualizar ${file.name}`}
                >
                  <Eye className="h-4 w-4" />
                </button>
                {canAdd ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setRemoveNewIndex(i);
                    }}
                    className={clsx(
                      iconButtonClass,
                      "text-purple-700 hover:bg-purple-100 hover:text-red-600 dark:text-violet-300 dark:hover:bg-violet-900/40 dark:hover:text-red-400"
                    )}
                    title="Remover anexo"
                    aria-label={`Remover ${file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={removeNewIndex !== null}
        onClose={() => setRemoveNewIndex(null)}
        onConfirm={() => {
          if (removeNewIndex === null) return;
          const idx = removeNewIndex;
          onNewFilesChange((current) => current.filter((_, i) => i !== idx));
          setRemoveNewIndex(null);
        }}
        title="Remover anexo?"
        description={
          <>
            <strong className="text-slate-900 dark:text-slate-100">Esta ação é irreversível:</strong> o arquivo{" "}
            <strong className="text-slate-900 dark:text-slate-100">{newFilePendingNome}</strong> será retirado da lista
            de pendências e não poderá ser recuperado aqui.
          </>
        }
        cancelLabel="Cancelar"
        confirmLabel="Sim, remover permanentemente"
        destructive
      />

      <AlertDialog
        open={removeExistingIndex !== null}
        onClose={() => setRemoveExistingIndex(null)}
        onConfirm={() => {
          if (removeExistingIndex === null || !onExistingFilesChange) return;
          const idx = removeExistingIndex;
          const next = preparedExistingFiles
            .filter((_, i) => i !== idx)
            .map((item) => item.name);
          onExistingFilesChange(next);
          setRemoveExistingIndex(null);
        }}
        title="Remover anexo?"
        description={
          <>
            <strong className="text-slate-900 dark:text-slate-100">Esta ação é irreversível:</strong> o anexo{" "}
            <strong className="text-slate-900 dark:text-slate-100">{existingFilePendingNome}</strong> será removido da
            tarefa ao salvar.
          </>
        }
        cancelLabel="Cancelar"
        confirmLabel="Sim, remover permanentemente"
        destructive
      />
    </div>
  );
}
