"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Pencil, Power, Search, Trash2 } from "lucide-react";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import { ConfiguracoesTopNav } from "@/components/configuracoes/configuracoes-top-nav";
import { Toast } from "@/components/ui/toast";
import { usePageHeader } from "@/contexts/page-header-context";
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

function defaultRenderConfig(papelTimbradoUrl = ""): LayoutSlice {
  const base = emptyEmpresaDocumentoConfig();
  return {
    layoutModo: "background",
    papelTimbradoUrl,
    papelTimbradoOpacity: base.papelTimbradoOpacity,
    margemTopMm: base.margemTopMm,
    margemRightMm: base.margemRightMm,
    margemBottomMm: base.margemBottomMm,
    margemLeftMm: base.margemLeftMm,
    headerHeightMm: base.headerHeightMm,
    footerHeightMm: base.footerHeightMm,
    cabecalhoPadraoHtml: base.cabecalhoPadraoHtml,
    rodapePadraoHtml: base.rodapePadraoHtml,
  };
}

export default function PapeisTimbradosPage() {
  const { setPrimaryAction } = usePageHeader();
  const [timbres, setTimbres] = useState<DocumentoTimbre[]>([]);
  const [busca, setBusca] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
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
    setPrimaryAction({
      label: "Novo Timbrado",
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
  }, [setPrimaryAction]);

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
      <div className="flex w-full min-w-0 flex-wrap items-center gap-3">
        <div className="flex min-w-0 w-full flex-col gap-2 sm:w-auto sm:max-w-lg sm:flex-row sm:items-center">
          <div className="relative min-w-0 w-full sm:w-[520px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar timbrados..."
              className="h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </div>
        <ConfiguracoesTopNav atalhosDocumentos returnHref="/configuracoes/construtor-documentos" returnLabel="Voltar ao Construtor" />
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
              <button type="button" onClick={() => abrirEdicao(t)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
              <a href={t.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                <Eye className="h-3.5 w-3.5" /> Prévia
              </a>
              <button type="button" disabled={savingId === t.id} onClick={() => toggleAtivo(t)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                <Power className="h-3.5 w-3.5" /> {t.ativo ? "Desativar" : "Ativar"}
              </button>
              <button type="button" disabled={removingId === t.id} onClick={() => remover(t.id)} className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-700 dark:text-rose-300 dark:hover:bg-rose-950/30">
                <Trash2 className="h-3.5 w-3.5" /> {removingId === t.id ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </article>
        ))}
      </div>

      {!timbres.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400">Nenhum papel timbrado cadastrado.</div>}
      {!!timbres.length && !timbresFiltrados.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400">Nenhum timbrado corresponde à busca.</div>}

      <DrawerSheet open={drawerOpen} onClose={() => setDrawerOpen(false)} title={form.id ? "Editar timbrado" : "Novo timbrado"} maxWidth="sm:max-w-4xl">
        <div className="min-h-0 flex-1 overflow-y-auto space-y-4 p-1 pr-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Nome do timbrado
              <input value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
            </label>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Status do timbrado
              <select value={form.ativo ? "ativo" : "inativo"} onChange={(e) => setForm((p) => ({ ...p, ativo: e.target.value === "ativo" }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </label>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-800/40">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Arquivo do timbrado</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">PNG, JPG ou WEBP até 8MB.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
                {form.arquivo ? "Trocar arquivo" : form.id ? "Selecionar novo arquivo" : "Selecionar arquivo"}
              </button>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (!f) return;
                const blobUrl = URL.createObjectURL(f);
                setForm((p) => ({ ...p, arquivo: f, previewUrl: blobUrl, renderConfig: { ...p.renderConfig, papelTimbradoUrl: p.renderConfig.papelTimbradoUrl || blobUrl } }));
                e.currentTarget.value = "";
              }} />
            </div>
            {form.previewUrl ? <img src={form.previewUrl} alt="Prévia timbrado" className="mt-3 h-28 w-full rounded border border-slate-200 bg-white object-contain p-2 dark:border-slate-600 dark:bg-slate-900" /> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Modo de layout
              <select value={form.renderConfig.layoutModo} onChange={(e) => setForm((p) => ({ ...p, renderConfig: { ...p.renderConfig, layoutModo: e.target.value as EmpresaDocumentoConfig["layoutModo"] } }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                {(Object.keys(LAYOUT_LABEL) as EmpresaDocumentoConfig["layoutModo"][]).map((k) => <option key={k} value={k}>{LAYOUT_LABEL[k]}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              URL do timbrado
              <input value={form.renderConfig.papelTimbradoUrl} onChange={(e) => setForm((p) => ({ ...p, renderConfig: { ...p.renderConfig, papelTimbradoUrl: e.target.value } }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
            </label>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Opacidade ({Math.round(form.renderConfig.papelTimbradoOpacity * 100)}%)</label>
            <input type="range" min={0} max={100} value={Math.round(form.renderConfig.papelTimbradoOpacity * 100)} onChange={(e) => setForm((p) => ({ ...p, renderConfig: { ...p.renderConfig, papelTimbradoOpacity: Number(e.target.value) / 100 } }))} className="mt-1 block w-full" />
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {([["margemTopMm", "Margem superior"],["margemRightMm", "Margem direita"],["margemBottomMm", "Margem inferior"],["margemLeftMm", "Margem esquerda"],["headerHeightMm", "Altura cabeçalho"],["footerHeightMm", "Altura rodapé"]] as const).map(([key, label]) => (
              <label key={key} className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {label} (mm)
                <input type="number" value={form.renderConfig[key]} onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  setForm((p) => ({ ...p, renderConfig: { ...p.renderConfig, [key]: n } }));
                }} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
              </label>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Cabeçalho HTML padrão
              <textarea rows={3} value={form.renderConfig.cabecalhoPadraoHtml} onChange={(e) => setForm((p) => ({ ...p, renderConfig: { ...p.renderConfig, cabecalhoPadraoHtml: e.target.value } }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
            </label>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Rodapé HTML padrão
              <textarea rows={3} value={form.renderConfig.rodapePadraoHtml} onChange={(e) => setForm((p) => ({ ...p, renderConfig: { ...p.renderConfig, rodapePadraoHtml: e.target.value } }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-600">
            <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Cancelar</button>
            <button type="button" disabled={savingId !== null} onClick={salvarFormulario} className="rounded-lg bg-[#6D28D9] px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60">{savingId ? "Salvando..." : "Salvar timbrado"}</button>
          </div>
        </div>
      </DrawerSheet>

      <Toast visible={toast.visible} message={toast.message} variant={toast.variant} duration={toast.variant === "error" ? 7000 : 3000} onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))} />
    </section>
  );
}

