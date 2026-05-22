"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Blend,
  CheckCircle2,
  CircleSlash2,
  Eye,
  FileCode2,
  Hash,
  ImageUp,
  Link2,
  Pencil,
  Power,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import { ConfiguracoesTopNav } from "@/components/configuracoes/configuracoes-top-nav";
import { DadosEmpresaFormSection } from "@/components/configuracoes/dados-empresa-form";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Toast } from "@/components/ui/toast";
import {
  formAttachmentDropzoneClass,
  formInputClass,
  formLabelClass,
  formModalCancelButtonClass,
  formModalSubmitButtonClass,
  formTextareaClass,
} from "@/components/ui/field-patterns";
import { usePageHeader } from "@/contexts/page-header-context";
import {
  useConfiguracoesResourceRbac,
  useConfiguracoesSectionGuard,
} from "@/hooks/use-rbac-resource";
import { emptyEmpresaDocumentoConfig, type EmpresaDocumentoConfig } from "@/lib/documentos/empresa-config-schema";

type LayoutSlice = Pick<
  EmpresaDocumentoConfig,
  | "layoutModo"
  | "papelTimbradoUrl"
  | "papelTimbradoOpacity"
  | "margemTopMm"
  | "margemRightMm"
  | "margemBottomMm"
  | "margemLeftMm"
  | "headerHeightMm"
  | "footerHeightMm"
  | "cabecalhoPadraoHtml"
  | "rodapePadraoHtml"
>;

type DocumentoTimbre = {
  id: string;
  nome: string;
  url: string;
  createdAt: string;
  ativo: boolean;
  renderConfig: LayoutSlice;
};

type TimbreFormState = {
  id: string | null;
  nome: string;
  ativo: boolean;
  renderConfig: LayoutSlice;
  arquivo: File | null;
  previewUrl: string;
};

const LAYOUT_LABEL: Record<EmpresaDocumentoConfig["layoutModo"], string> = {
  none: "Sem timbrado de fundo",
  background: "Imagem de fundo (página inteira)",
  header_footer: "Cabeçalho e rodapé fixos",
  hybrid: "Híbrido (fundo + faixas)",
};

const IconAtivo = ({ className }: { className?: string }) => <CheckCircle2 className={`${className ?? ""} !text-emerald-600 dark:!text-emerald-400`} />;
const IconInativo = ({ className }: { className?: string }) => <CircleSlash2 className={`${className ?? ""} !text-slate-500 dark:!text-slate-400`} />;
const IconLayoutNone = ({ className }: { className?: string }) => <SlidersHorizontal className={`${className ?? ""} !text-slate-600 dark:!text-slate-300`} />;
const IconLayoutBackground = ({ className }: { className?: string }) => <ImageUp className={`${className ?? ""} !text-sky-600 dark:!text-sky-400`} />;
const IconLayoutHeaderFooter = ({ className }: { className?: string }) => <FileCode2 className={`${className ?? ""} !text-violet-600 dark:!text-violet-400`} />;
const IconLayoutHybrid = ({ className }: { className?: string }) => <Blend className={`${className ?? ""} !text-fuchsia-600 dark:!text-fuchsia-400`} />;

const STATUS_OPTIONS: SearchableOption[] = [
  { value: "ativo", label: "Ativo", icon: IconAtivo },
  { value: "inativo", label: "Inativo", icon: IconInativo },
];

const LAYOUT_OPTIONS: SearchableOption[] = [
  { value: "none", label: LAYOUT_LABEL.none, icon: IconLayoutNone },
  { value: "background", label: LAYOUT_LABEL.background, icon: IconLayoutBackground },
  { value: "header_footer", label: LAYOUT_LABEL.header_footer, icon: IconLayoutHeaderFooter },
  { value: "hybrid", label: LAYOUT_LABEL.hybrid, icon: IconLayoutHybrid },
];

function defaultRenderConfig(papelTimbradoUrl = ""): LayoutSlice {
  return {
    layoutModo: "background",
    papelTimbradoUrl,
    papelTimbradoOpacity: 0,
    margemTopMm: 45,
    margemRightMm: 20,
    margemBottomMm: 32,
    margemLeftMm: 25,
    headerHeightMm: 28,
    footerHeightMm: 28,
    cabecalhoPadraoHtml: "",
    rodapePadraoHtml: "",
  };
}

export default function PapeisTimbradosPage() {
  useConfiguracoesSectionGuard("configuracoes.papeis_timbrados");
  const rbac = useConfiguracoesResourceRbac("configuracoes.papeis_timbrados");
  const { setPrimaryAction } = usePageHeader();
  const [timbres, setTimbres] = useState<DocumentoTimbre[]>([]);
  const [busca, setBusca] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerDadosEmpresaOpen, setDrawerDadosEmpresaOpen] = useState(false);
  const [form, setForm] = useState<TimbreFormState>({
    id: null,
    nome: "",
    ativo: true,
    renderConfig: defaultRenderConfig(""),
    arquivo: null,
    previewUrl: "",
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; variant: "success" | "error" }>({
    visible: false,
    message: "",
    variant: "success",
  });

  const showToast = (message: string, variant: "success" | "error" = "success") => {
    setToast({ visible: false, message: "", variant });
    window.requestAnimationFrame(() => setToast({ visible: true, message, variant }));
  };

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/configuracoes/documentos-timbres", { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: { timbres?: DocumentoTimbre[] };
      };
      if (!res.ok || !json.success || !Array.isArray(json.data?.timbres)) return setTimbres([]);
      setTimbres(json.data.timbres);
    } catch {
      setTimbres([]);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!rbac.podeCriar) {
      setPrimaryAction(null);
      return () => setPrimaryAction(null);
    }
    setPrimaryAction({
      label: "Novo Timbrado",
      showPlusIcon: true,
      onClick: () => {
        setForm({
          id: null,
          nome: "",
          ativo: true,
          renderConfig: defaultRenderConfig(""),
          arquivo: null,
          previewUrl: "",
        });
        setDrawerOpen(true);
      },
    });
    return () => setPrimaryAction(null);
  }, [setPrimaryAction, rbac.podeCriar]);

  useEffect(() => {
    return () => {
      if (form.previewUrl.startsWith("blob:")) URL.revokeObjectURL(form.previewUrl);
    };
  }, [form.previewUrl]);

  const abrirEdicao = (t: DocumentoTimbre) => {
    setForm({
      id: t.id,
      nome: t.nome,
      ativo: t.ativo,
      renderConfig: { ...t.renderConfig },
      arquivo: null,
      previewUrl: t.url,
    });
    setDrawerOpen(true);
  };

  const salvarFormulario = () => {
    void (async () => {
      const nome = form.nome.trim();
      if (!nome) return showToast("Informe o nome do timbrado.", "error");
      if (!form.id && !form.arquivo) return showToast("Selecione o arquivo do timbrado.", "error");
      setSavingId(form.id ?? "__new__");
      try {
        let res: Response;
        if (!form.id) {
          const fd = new FormData();
          fd.append("arquivo", form.arquivo as File);
          fd.append("nome", nome);
          fd.append("ativo", String(form.ativo));
          fd.append("renderConfig", JSON.stringify(form.renderConfig));
          res = await fetch("/api/configuracoes/documentos-timbres", { method: "POST", body: fd });
        } else if (form.arquivo) {
          const fd = new FormData();
          fd.append("arquivo", form.arquivo);
          fd.append("nome", nome);
          fd.append("ativo", String(form.ativo));
          fd.append("renderConfig", JSON.stringify(form.renderConfig));
          res = await fetch(`/api/configuracoes/documentos-timbres/${encodeURIComponent(form.id)}`, {
            method: "PATCH",
            body: fd,
          });
        } else {
          res = await fetch(`/api/configuracoes/documentos-timbres/${encodeURIComponent(form.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome, ativo: form.ativo, renderConfig: form.renderConfig }),
          });
        }

        const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
        if (!res.ok || !json.success) return showToast(json.error?.message ?? "Não foi possível salvar.", "error");

        setDrawerOpen(false);
        showToast(`Timbrado ${form.id ? "atualizado" : "criado"} com sucesso.`, "success");
        await carregar();
      } finally {
        setSavingId(null);
      }
    })();
  };

  const toggleAtivo = (timbre: DocumentoTimbre) => {
    void (async () => {
      setSavingId(timbre.id);
      try {
        const res = await fetch(`/api/configuracoes/documentos-timbres/${encodeURIComponent(timbre.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ativo: !timbre.ativo }),
        });
        const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
        if (!res.ok || !json.success) return showToast(json.error?.message ?? "Não foi possível atualizar o status.", "error");
        await carregar();
      } finally {
        setSavingId(null);
      }
    })();
  };

  const remover = (id: string) => {
    void (async () => {
      setRemovingId(id);
      try {
        const res = await fetch(`/api/configuracoes/documentos-timbres/${encodeURIComponent(id)}`, { method: "DELETE" });
        const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
        if (!res.ok || !json.success) return showToast(json.error?.message ?? "Não foi possível excluir o timbrado.", "error");
        await carregar();
      } finally {
        setRemovingId(null);
      }
    })();
  };

  const timbresFiltrados = useMemo(() => {
    const term = busca.trim().toLowerCase();
    if (!term) return timbres;
    return timbres.filter((t) => t.nome.toLowerCase().includes(term));
  }, [timbres, busca]);

  return (
    <section className="w-full min-w-0 space-y-4">
      <div className="sticky top-0 z-10 flex w-full min-w-0 flex-wrap items-center gap-3 rounded-xl border border-slate-200/90 bg-white/90 px-3 py-3 shadow-sm backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/90">
        <div className="flex min-w-0 w-full flex-col gap-2 sm:w-auto sm:max-w-lg sm:flex-row sm:items-center">
          <div className="relative min-w-0 w-full sm:w-[520px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar timbrados..."
              className={`${formInputClass} h-10 min-w-0 pl-9`}
            />
          </div>
        </div>
        <ConfiguracoesTopNav
          atalhosDocumentos
          onOpenDadosEmpresaModal={() => setDrawerDadosEmpresaOpen(true)}
          returnHref="/configuracoes/construtor-documentos"
          returnLabel="Voltar ao Construtor"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {timbresFiltrados.map((t) => (
          <article key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{t.nome}</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Papel Timbrado</p>
              </div>
              <span className={`rounded-lg border px-2 py-1 text-xs font-semibold ${t.ativo ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700"}`}>
                {t.ativo ? "Ativo" : "Inativo"}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">Atualizado em {new Date(t.createdAt).toLocaleString("pt-BR")}</p>
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-600 dark:bg-slate-800/50">
              <img src={t.url} alt={t.nome} className="h-24 w-full rounded object-contain" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {rbac.podeEditar ? (
                <button type="button" onClick={() => abrirEdicao(t)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </button>
              ) : null}
              <a href={t.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                <Eye className="h-3.5 w-3.5" /> Prévia
              </a>
              {rbac.podeEditar ? (
                <button type="button" disabled={savingId === t.id} onClick={() => toggleAtivo(t)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                  <Power className="h-3.5 w-3.5" /> {t.ativo ? "Desativar" : "Ativar"}
                </button>
              ) : null}
              {rbac.podeExcluir ? (
                <button type="button" disabled={removingId === t.id} onClick={() => remover(t.id)} className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-700 dark:text-rose-300 dark:hover:bg-rose-950/30">
                  <Trash2 className="h-3.5 w-3.5" /> {removingId === t.id ? "Excluindo..." : "Excluir"}
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {!timbres.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400">Nenhum papel timbrado cadastrado.</div>}
      {!!timbres.length && !timbresFiltrados.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400">Nenhum timbrado corresponde à busca.</div>}

      <DrawerSheet
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={form.id ? "Editar timbrado" : "Novo timbrado"}
        maxWidth="sm:max-w-3xl"
        mobileContentPaddingClassName="px-0"
        desktopContentPaddingClassName="px-0"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className={formLabelClass}>Nome do timbrado</label>
                  <div className="relative">
                    <Type className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={form.nome}
                      onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                      className={`${formInputClass} pl-9`}
                      placeholder="Ex.: Timbrado institucional"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className={formLabelClass}>Status do timbrado</label>
                  <SearchableSelect
                    options={STATUS_OPTIONS}
                    value={form.ativo ? "ativo" : "inativo"}
                    onChange={(value) => setForm((p) => ({ ...p, ativo: value === "ativo" }))}
                    placeholder="Selecione o status"
                    searchPlaceholder="Buscar status..."
                    searchable={false}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className={formLabelClass}>Arquivo do timbrado</label>
                {form.previewUrl ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={formAttachmentDropzoneClass}
                    >
                      <ImageUp className="h-5 w-5" />
                      <span>
                        {form.arquivo ? "Trocar arquivo selecionado" : "Selecionar novo arquivo"}
                        <span className="block text-xs text-slate-500 dark:text-slate-400">PNG, JPG ou WEBP até 8MB.</span>
                      </span>
                    </button>
                    <div className="relative">
                      <img
                        src={form.previewUrl}
                        alt="Prévia timbrado"
                        className="h-28 w-full rounded-xl border border-slate-200 bg-white object-contain p-2 dark:border-slate-600 dark:bg-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            arquivo: null,
                            previewUrl: "",
                            renderConfig: { ...p.renderConfig, papelTimbradoUrl: "" },
                          }))
                        }
                        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-300"
                        aria-label="Excluir imagem do timbrado"
                        title="Excluir imagem"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={formAttachmentDropzoneClass}
                  >
                    <ImageUp className="h-5 w-5" />
                    <span>
                      {form.arquivo ? "Trocar arquivo selecionado" : form.id ? "Selecionar novo arquivo" : "Selecionar arquivo"}
                      <span className="block text-xs text-slate-500 dark:text-slate-400">PNG, JPG ou WEBP até 8MB.</span>
                    </span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (!f) return;
                    const blobUrl = URL.createObjectURL(f);
                    setForm((p) => ({
                      ...p,
                      arquivo: f,
                      previewUrl: blobUrl,
                      renderConfig: { ...p.renderConfig, papelTimbradoUrl: p.renderConfig.papelTimbradoUrl || blobUrl },
                    }));
                    e.currentTarget.value = "";
                  }}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className={formLabelClass}>Modo de layout</label>
                  <SearchableSelect
                    options={LAYOUT_OPTIONS}
                    value={form.renderConfig.layoutModo}
                    onChange={(value) =>
                      setForm((p) => ({
                        ...p,
                        renderConfig: { ...p.renderConfig, layoutModo: value as EmpresaDocumentoConfig["layoutModo"] },
                      }))
                    }
                    placeholder="Selecione o modo"
                    searchPlaceholder="Buscar modo..."
                    searchable={false}
                  />
                </div>
                <div className="space-y-1">
                  <label className={formLabelClass}>URL do timbrado</label>
                  <div className="relative">
                    <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={form.renderConfig.papelTimbradoUrl}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, renderConfig: { ...p.renderConfig, papelTimbradoUrl: e.target.value } }))
                      }
                      className={`${formInputClass} pl-9`}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className={formLabelClass}>Opacidade ({Math.round(form.renderConfig.papelTimbradoOpacity * 100)}%)</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(form.renderConfig.papelTimbradoOpacity * 100)}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      renderConfig: { ...p.renderConfig, papelTimbradoOpacity: Number(e.target.value) / 100 },
                    }))
                  }
                  className="mt-1 block w-full"
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <p className="sm:col-span-2 lg:col-span-3 text-xs text-slate-600 dark:text-slate-300">
                  Todos os campos abaixo utilizam milímetros (mm).
                </p>
                {(
                  [
                    ["margemTopMm", "Margem superior"],
                    ["margemRightMm", "Margem direita"],
                    ["margemBottomMm", "Margem inferior"],
                    ["margemLeftMm", "Margem esquerda"],
                    ["headerHeightMm", "Altura cabeçalho"],
                    ["footerHeightMm", "Altura rodapé"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <label className={formLabelClass}>{label}</label>
                    <div className="relative">
                      <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number"
                        value={form.renderConfig[key]}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (!Number.isFinite(n)) return;
                          setForm((p) => ({ ...p, renderConfig: { ...p.renderConfig, [key]: n } }));
                        }}
                        className={`${formInputClass} pl-9`}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className={formLabelClass}>Cabeçalho HTML padrão</label>
                  <div className="relative">
                    <FileCode2 className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <textarea
                      rows={3}
                      value={form.renderConfig.cabecalhoPadraoHtml}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, renderConfig: { ...p.renderConfig, cabecalhoPadraoHtml: e.target.value } }))
                      }
                      className={`${formTextareaClass} pl-9 font-mono text-xs`}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className={formLabelClass}>Rodapé HTML padrão</label>
                  <div className="relative">
                    <FileCode2 className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <textarea
                      rows={3}
                      value={form.renderConfig.rodapePadraoHtml}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, renderConfig: { ...p.renderConfig, rodapePadraoHtml: e.target.value } }))
                      }
                      className={`${formTextareaClass} pl-9 font-mono text-xs`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:justify-end sm:gap-3 sm:px-6">
            <button type="button" onClick={() => setDrawerOpen(false)} className={formModalCancelButtonClass}>
              <span className="inline-flex items-center gap-2">
                <X className="h-4 w-4 shrink-0" aria-hidden />
                Cancelar
              </span>
            </button>
            {(form.id ? rbac.podeEditar : rbac.podeCriar) ? (
              <button type="button" disabled={savingId !== null} onClick={salvarFormulario} className={formModalSubmitButtonClass}>
                <span className="inline-flex items-center gap-2">
                  <Save className="h-4 w-4 shrink-0" aria-hidden />
                  {savingId ? "Salvando..." : "Salvar"}
                </span>
              </button>
            ) : null}
          </div>
        </div>
      </DrawerSheet>

      <DrawerSheet
        open={drawerDadosEmpresaOpen}
        onClose={() => setDrawerDadosEmpresaOpen(false)}
        title="Dados da Empresa"
        maxWidth="sm:max-w-3xl"
        mobileContentPaddingClassName="px-0"
        desktopContentPaddingClassName="px-0"
      >
        <DadosEmpresaFormSection
          compact
          withFixedFooter
          onCancel={() => setDrawerDadosEmpresaOpen(false)}
          onSaved={() => setDrawerDadosEmpresaOpen(false)}
        />
      </DrawerSheet>

      <Toast visible={toast.visible} message={toast.message} variant={toast.variant} duration={toast.variant === "error" ? 7000 : 3000} onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))} />
    </section>
  );
}

