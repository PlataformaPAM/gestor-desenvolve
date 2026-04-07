"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import {
  Folder,
  FolderPlus,
  FileText,
  Image as ImageIcon,
  FileType,
  FileUp,
  FolderUp,
  MoreVertical,
  Download,
  Share2,
  Trash2,
  Edit3,
  ChevronRight,
} from "lucide-react";
import { usePageHeader } from "@/contexts/page-header-context";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { VisualizadorArquivo, getTipoPreview } from "./visualizador-arquivo";

/** Item do drive (preparação para Google Drive API). */
export type DriveItem = {
  id: string;
  nome: string;
  tipo: "pasta" | "arquivo";
  extensao?: string;
  parentId: string | null;
  tamanho?: number;
  modificadoEm?: string;
  /** Dono do arquivo (ex.: "Eu", "equipe@...") */
  proprietario?: string;
  /** URL para preview (imagem ou PDF). */
  url?: string;
  /** URL miniatura para Acesso Rápido */
  thumbnail?: string;
};

const INITIAL_FILES: DriveItem[] = [{ id: "root", nome: "Meu Drive", tipo: "pasta", parentId: null, proprietario: "Eu" }];

function formatTamanho(bytes?: number): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatData(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Ícones por tipo: PDF vermelho, Imagens vermelho/laranja, Planilhas verde, Documentos azul, Pastas cinza escuro */
function IconeItem({ item }: { item: DriveItem }) {
  if (item.tipo === "pasta") {
    return <Folder className="h-8 w-8 text-slate-600" />;
  }
  const ext = (item.extensao ?? "").toLowerCase();
  if (ext === "pdf") return <FileType className="h-8 w-8 text-red-600" />;
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext))
    return <ImageIcon className="h-8 w-8 text-orange-500" />;
  if (["xlsx", "xls", "ods"].includes(ext))
    return <FileText className="h-8 w-8 text-green-600" />;
  if (["docx", "doc", "pptx", "ppt"].includes(ext))
    return <FileText className="h-8 w-8 text-blue-600" />;
  return <FileText className="h-8 w-8 text-slate-500" />;
}

export default function ArquivosPage() {
  const { setPrimaryAction } = usePageHeader();
  const [files, setFiles] = useState<DriveItem[]>(() => INITIAL_FILES);
  const [pathIds, setPathIds] = useState<string[]>(["root"]);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [isNovoMenuOpen, setIsNovoMenuOpen] = useState(false);
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [nomeNovaPasta, setNomeNovaPasta] = useState("");
  const [previewItem, setPreviewItem] = useState<DriveItem | null>(null);
  const [acessosRecentes, setAcessosRecentes] = useState<string[]>([]);
  const [itemToDelete, setItemToDelete] = useState<DriveItem | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputArquivoRef = useRef<HTMLInputElement>(null);
  const inputPastaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPrimaryAction({
      label: "Novo",
      onClick: () => setIsNovoMenuOpen(true),
    });
    return () => setPrimaryAction(null);
  }, [setPrimaryAction]);

  useEffect(() => {
    if (!menuOpenId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenuOpenId(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpenId]);

  const onDrop = useMemo(
    () => (accepted: File[]) => {
      accepted.forEach((file) => {
        const currentId = pathIds[pathIds.length - 1];
        const url = file.type.startsWith("image/") || file.type === "application/pdf"
          ? URL.createObjectURL(file)
          : undefined;
        setFiles((prev) => [
          ...prev,
          {
            id: `f-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            nome: file.name,
            tipo: "arquivo",
            parentId: currentId,
            extensao: file.name.split(".").pop() ?? "",
            tamanho: file.size,
            modificadoEm: new Date().toISOString(),
            proprietario: "Eu",
            url: url ?? undefined,
            thumbnail: file.type.startsWith("image/") ? url : undefined,
          },
        ]);
      });
    },
    [pathIds]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
  });

  const currentId = pathIds[pathIds.length - 1];
  const itensNaPasta = useMemo(() => {
    return files.filter((f) => f.parentId === currentId);
  }, [files, currentId]);

  const breadcrumb = useMemo(() => {
    return pathIds.map((id) => {
      const item = files.find((f) => f.id === id);
      return { id, nome: item?.nome ?? id };
    });
  }, [pathIds, files]);

  const itensAcessoRapido = useMemo(() => {
    return acessosRecentes
      .map((id) => files.find((f) => f.id === id))
      .filter((f): f is DriveItem => !!f && f.tipo === "arquivo");
  }, [files, acessosRecentes]);

  const navegarPara = (id: string) => {
    const idx = pathIds.indexOf(id);
    if (idx >= 0) setPathIds(pathIds.slice(0, idx + 1));
    else setPathIds([...pathIds, id]);
  };

  const handleAcao = (itemId: string, acao: string) => {
    setMenuOpenId(null);
    if (acao === "Excluir") {
      const item = files.find((f) => f.id === itemId) ?? null;
      setItemToDelete(item);
    }
  };

  const handleClickArquivo = (item: DriveItem) => {
    if (item.tipo !== "arquivo") return;
    setAcessosRecentes((prev) => [item.id, ...prev.filter((id) => id !== item.id)].slice(0, 8));
    setPreviewItem(item);
  };

  const handleNovaPasta = () => {
    setIsNovoMenuOpen(false);
    setNomeNovaPasta("");
    setIsNewFolderModalOpen(true);
  };

  const handleCriarPasta = () => {
    const currentId = pathIds[pathIds.length - 1];
    const nome = nomeNovaPasta.trim() || "Nova pasta";
    setFiles((prev) => [
      ...prev,
      {
        id: `p-${Date.now()}`,
        nome,
        tipo: "pasta",
        parentId: currentId,
        modificadoEm: new Date().toISOString(),
        proprietario: "Eu",
      },
    ]);
    setNomeNovaPasta("");
    setIsNewFolderModalOpen(false);
  };

  const handleUploadArquivo = () => {
    setIsNovoMenuOpen(false);
    inputArquivoRef.current?.click();
  };

  const handleUploadPasta = () => {
    setIsNovoMenuOpen(false);
    inputPastaRef.current?.click();
  };

  const onFilesSelected = (e: React.ChangeEvent<HTMLInputElement>, isFolder: boolean) => {
    const files = e.target.files;
    if (!files?.length) return;
    const currentId = pathIds[pathIds.length - 1];
    Array.from(files).forEach((file) => {
      const url =
        file.type.startsWith("image/") || file.type === "application/pdf"
          ? URL.createObjectURL(file)
          : undefined;
      setFiles((prev) => [
        ...prev,
        {
          id: `f-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          nome: file.name,
          tipo: "arquivo",
          parentId: currentId,
          extensao: file.name.split(".").pop() ?? "",
          tamanho: file.size,
          modificadoEm: new Date().toISOString(),
          proprietario: "Eu",
          url: url ?? undefined,
          thumbnail: file.type.startsWith("image/") ? url : undefined,
        },
      ]);
    });
    e.target.value = "";
  };

  return (
    <section className="space-y-6" {...getRootProps()}>
      <input {...getInputProps()} />
      <input
        ref={inputArquivoRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => onFilesSelected(e, false)}
      />
      <input
        ref={inputPastaRef}
        type="file"
        multiple
        className="hidden"
        {...({ webkitdirectory: true } as React.InputHTMLAttributes<HTMLInputElement>)}
        onChange={(e) => onFilesSelected(e, true)}
      />

      {/* Overlay drag & drop */}
      {isDragActive && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-blue-500/20 backdrop-blur-sm dark:bg-blue-950/30">
          <p className="rounded-xl bg-white/95 px-8 py-4 text-lg font-medium text-slate-800 shadow-lg dark:bg-slate-900/95 dark:text-slate-100">
            Solte os arquivos para fazer upload instantâneo
          </p>
        </div>
      )}

      {/* Breadcrumb — botão Novo fica no header da página (barra superior) */}
      <nav className="flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900">
        {breadcrumb.map((b, i) => (
          <span key={b.id} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-4 w-4 text-slate-400" />}
            <button
              type="button"
              onClick={() => navegarPara(b.id)}
              className="font-medium text-slate-700 hover:text-[#6D28D9] dark:text-slate-300 dark:hover:text-violet-400"
            >
              {b.nome}
            </button>
          </span>
        ))}
      </nav>

      {/* Acesso Rápido — cards com miniaturas */}
      {itensAcessoRapido.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Acesso Rápido</h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {itensAcessoRapido.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleClickArquivo(item)}
                className="flex shrink-0 flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
              >
                <div className="flex h-24 w-28 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <IconeItem item={item} />
                  )}
                </div>
                <span className="max-w-[120px] truncate text-center text-xs font-medium text-slate-700 dark:text-slate-300">
                  {item.nome}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pills de filtro */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Tipo
        </button>
        <button
          type="button"
          className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Pessoas
        </button>
        <button
          type="button"
          className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Modificado
        </button>
      </div>

      {/* Tabela: Nome, Proprietário, Última modificação, Tamanho */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Nome
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 md:table-cell">
                  Proprietário
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 sm:table-cell">
                  Última modificação
                </th>
                <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 lg:table-cell">
                  Tamanho
                </th>
                <th className="w-12 px-2 py-3" aria-label="Ações" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {itensNaPasta.map((item) => (
                <tr key={item.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/80">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        item.tipo === "pasta" && item.id !== "root"
                          ? navegarPara(item.id)
                          : item.tipo === "arquivo"
                            ? handleClickArquivo(item)
                            : undefined
                      }
                      className="flex items-center gap-3 text-left"
                    >
                      <IconeItem item={item} />
                      <span className="font-medium text-slate-900 dark:text-slate-100">{item.nome}</span>
                    </button>
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-slate-500 dark:text-slate-400 md:table-cell">
                    {item.proprietario ?? "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-slate-500 dark:text-slate-400 sm:table-cell">
                    {formatData(item.modificadoEm)}
                  </td>
                  <td className="hidden px-4 py-3 text-right text-sm text-slate-500 dark:text-slate-400 lg:table-cell">
                    {item.tipo === "arquivo" ? formatTamanho(item.tamanho) : "—"}
                  </td>
                  <td className="relative px-2 py-3 text-right">
                    <div
                      className="relative inline-block"
                      ref={menuOpenId === item.id ? menuRef : undefined}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === item.id ? null : item.id);
                        }}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                        aria-label="Ações"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {menuOpenId === item.id && (
                        <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900">
                          <button
                            type="button"
                            onClick={() => handleAcao(item.id, "Renomear")}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <Edit3 className="h-4 w-4" />
                            Renomear
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAcao(item.id, "Fazer Download")}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <Download className="h-4 w-4" />
                            Fazer Download
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAcao(item.id, "Compartilhar")}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <Share2 className="h-4 w-4" />
                            Compartilhar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAcao(item.id, "Excluir")}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {itensNaPasta.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            Esta pasta está vazia.
          </div>
        )}
      </div>

      {/* Visualizador full-screen */}
      {previewItem && previewItem.tipo === "arquivo" && (
        <VisualizadorArquivo
          open={!!previewItem}
          onClose={() => setPreviewItem(null)}
          nome={previewItem.nome}
          url={previewItem.url || previewItem.thumbnail || ""}
          tipo={getTipoPreview(previewItem.extensao)}
        />
      )}

      <AlertDialog
        open={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => {
          if (!itemToDelete) return;
          setFiles((prev) => prev.filter((f) => f.id !== itemToDelete.id));
          setItemToDelete(null);
        }}
        title={`Excluir ${itemToDelete?.tipo === "pasta" ? "pasta" : "arquivo"}?`}
        description={
          itemToDelete ? (
            <>
              <strong className="text-slate-900 dark:text-slate-100">Esta ação é irreversível.</strong>{" "}
              <strong className="text-slate-900 dark:text-slate-100">{itemToDelete.nome}</strong> será removido
              permanentemente e não poderá ser recuperado.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Sim, excluir permanentemente"
        destructive
      />

      {/* Sheet "Novo" — opções (aberto pelo botão do header) */}
      <DrawerSheet
        open={isNovoMenuOpen}
        onClose={() => setIsNovoMenuOpen(false)}
        title="Novo"
        maxWidth="sm:max-w-3xl"
      >
        <div className="space-y-1 overflow-y-auto p-6">
          <button
            type="button"
            onClick={handleNovaPasta}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FolderPlus className="h-5 w-5 text-slate-500" />
            Nova pasta
          </button>
          <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
          <button
            type="button"
            onClick={handleUploadArquivo}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FileUp className="h-5 w-5 text-slate-500" />
            Upload de arquivo
          </button>
          <button
            type="button"
            onClick={handleUploadPasta}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FolderUp className="h-5 w-5 text-slate-500" />
            Upload de pasta
          </button>
        </div>
      </DrawerSheet>

      {/* Sheet Nova pasta — Nome da pasta + Cancelar / Criar */}
      <DrawerSheet
        open={isNewFolderModalOpen}
        onClose={() => {
          setIsNewFolderModalOpen(false);
          setNomeNovaPasta("");
        }}
        title="Nova pasta"
        maxWidth="sm:max-w-3xl"
      >
        <div className="overflow-y-auto p-6">
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Nome da pasta
          </label>
          <input
            type="text"
            value={nomeNovaPasta}
            onChange={(e) => setNomeNovaPasta(e.target.value)}
            placeholder="Ex.: Documentos 2025"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            onKeyDown={(e) => e.key === "Enter" && handleCriarPasta()}
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsNewFolderModalOpen(false);
                setNomeNovaPasta("");
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCriarPasta}
              className="rounded-lg bg-[#6D28D9] px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
            >
              Criar
            </button>
          </div>
        </div>
      </DrawerSheet>
    </section>
  );
}
