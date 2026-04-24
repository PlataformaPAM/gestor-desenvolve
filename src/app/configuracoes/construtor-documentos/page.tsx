"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Eye, FilePlus2, Pencil, Power, Search } from "lucide-react";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import {
  DocumentoRichEditor,
  type DocumentoRichEditorHandle,
} from "@/components/configuracoes/documento-rich-editor";
import { Toast } from "@/components/ui/toast";
import { usePageHeader } from "@/contexts/page-header-context";
import { htmlOuParagrafoSimples, htmlTemTextoVisivel } from "@/lib/documentos/html-text";
import {
  VARIAVEIS_DOCUMENTO_MODULOS,
  preencherTemplateDocumento,
  valoresPreviewExemplo,
} from "@/lib/documentos/template-vars";
import { ConfiguracoesTopNav } from "@/components/configuracoes/configuracoes-top-nav";
import { montarDocumentoHtmlCompleto } from "@/lib/documentos/documento-html";

type TipoDocumento =
  | "proposta_comercial"
  | "oficio"
  | "prestacao_contas"
  | "relatorio";

type CampoVariavel = "assunto" | "cabecalho" | "corpo" | "rodape";

type EmpresaDocumentoConfig = {
  layoutModo: "none" | "background" | "header_footer" | "hybrid";
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  telefone: string;
  email: string;
  site: string;
  endereco: string;
  logoUrl: string;
  cabecalhoPadraoHtml: string;
  rodapePadraoHtml: string;
  papelTimbradoUrl: string;
  papelTimbradoOpacity: number;
  margemTopMm: number;
  margemRightMm: number;
  margemBottomMm: number;
  margemLeftMm: number;
  headerHeightMm: number;
  footerHeightMm: number;
};

type ModeloDocumento = {
  id: string;
  nome: string;
  tipo: TipoDocumento;
  descricao: string;
  assunto: string;
  logoUrl: string;
  cabecalhoHtml: string;
  corpo: string;
  rodapeHtml: string;
  ativo: boolean;
  versao: number;
  atualizadoEm: string;
  timbreId?: string;
  timbreUrl?: string;
};

type DocumentoTimbre = {
  id: string;
  nome: string;
  url: string;
  createdAt: string;
  ativo?: boolean;
  renderConfig?: Pick<
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
  >;
};

const TIPO_LABEL: Record<TipoDocumento, string> = {
  proposta_comercial: "Proposta Comercial",
  oficio: "Ofício",
  prestacao_contas: "Prestação de Contas",
  relatorio: "Relatório",
};

function emptyModelo(): ModeloDocumento {
  return {
    id: "",
    nome: "",
    tipo: "proposta_comercial",
    descricao: "",
    assunto: "",
    logoUrl: "",
    cabecalhoHtml: "",
    corpo: "<p></p>",
    rodapeHtml: "",
    timbreId: "",
    timbreUrl: "",
    ativo: true,
    versao: 1,
    atualizadoEm: new Date().toISOString(),
  };
}

function normalizarModeloCarregado(m: ModeloDocumento): ModeloDocumento {
  const base = emptyModelo();
  return {
    ...base,
    ...m,
    tipo: m.tipo ?? base.tipo,
    logoUrl: m.logoUrl ?? "",
    cabecalhoHtml: htmlOuParagrafoSimples(m.cabecalhoHtml ?? ""),
    rodapeHtml: htmlOuParagrafoSimples(m.rodapeHtml ?? ""),
    corpo: htmlOuParagrafoSimples(m.corpo ?? ""),
  };
}

function absolutizeAssetUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:")) return value;
  if (typeof window === "undefined") return value;
  return `${window.location.origin}${value.startsWith("/") ? value : `/${value}`}`;
}

export default function ConstrutorDocumentosPage() {
  const { setPrimaryAction } = usePageHeader();
  const [modelos, setModelos] = useState<ModeloDocumento[]>([]);
  const [busca, setBusca] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modeloAtual, setModeloAtual] = useState<ModeloDocumento>(emptyModelo());
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [acaoId, setAcaoId] = useState<string | null>(null);
  const [editorNonce, setEditorNonce] = useState(0);
  const [abaVariaveis, setAbaVariaveis] = useState<string>(VARIAVEIS_DOCUMENTO_MODULOS[0]?.id ?? "empresa");
  const [empresaConfig, setEmpresaConfig] = useState<EmpresaDocumentoConfig>({
    layoutModo: "none",
    razaoSocial: "",
    nomeFantasia: "",
    cnpj: "",
    telefone: "",
    email: "",
    site: "",
    endereco: "",
    logoUrl: "",
    cabecalhoPadraoHtml: "",
    rodapePadraoHtml: "",
    papelTimbradoUrl: "",
    papelTimbradoOpacity: 0.12,
    margemTopMm: 12,
    margemRightMm: 12,
    margemBottomMm: 12,
    margemLeftMm: 12,
    headerHeightMm: 28,
    footerHeightMm: 22,
  });
  const [timbres, setTimbres] = useState<DocumentoTimbre[]>([]);
  const [toast, setToast] = useState<{ visible: boolean; message: string; variant: "success" | "error"; duration: number }>({
    visible: false,
    message: "",
    variant: "success",
    duration: 3000,
  });

  const assuntoInputRef = useRef<HTMLInputElement>(null);
  const refCabecalho = useRef<DocumentoRichEditorHandle>(null);
  const refCorpo = useRef<DocumentoRichEditorHandle>(null);
  const refRodape = useRef<DocumentoRichEditorHandle>(null);
  const campoVariavelAlvoRef = useRef<CampoVariavel>("corpo");

  const editorResetKey = modeloAtual.id ? modeloAtual.id : `novo-${editorNonce}`;

  const showToast = useCallback((message: string, variant: "success" | "error" = "success") => {
    const duration = variant === "error" ? 7000 : 3000;
    setToast({ visible: false, message: "", variant, duration });
    window.requestAnimationFrame(() => {
      setToast({ visible: true, message, variant, duration });
    });
  }, []);

  const inserirVariavel = useCallback((token: string) => {
    const alvo = campoVariavelAlvoRef.current;
    if (alvo === "assunto" && assuntoInputRef.current) {
      const el = assuntoInputRef.current;
      const start = el.selectionStart ?? modeloAtual.assunto.length;
      const end = el.selectionEnd ?? start;
      const v = modeloAtual.assunto;
      const next = `${v.slice(0, start)}${token}${v.slice(end)}`;
      setModeloAtual((p) => ({ ...p, assunto: next }));
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
      return;
    }
    if (alvo === "cabecalho") refCabecalho.current?.insertVariable(token);
    else if (alvo === "rodape") refRodape.current?.insertVariable(token);
    else refCorpo.current?.insertVariable(token);
  }, [modeloAtual.assunto]);

  const inserirLogoNoCabecalho = useCallback(() => {
    const url = modeloAtual.logoUrl?.trim();
    if (!url) {
      showToast("Informe a URL da logo ao lado para poder inseri-la no cabeçalho.", "error");
      return;
    }
    campoVariavelAlvoRef.current = "cabecalho";
    refCabecalho.current?.focusEditor();
    refCabecalho.current?.insertImageFromUrl(url);
  }, [modeloAtual.logoUrl, showToast]);

  const carregarTimbres = useCallback(async () => {
    try {
      const res = await fetch("/api/configuracoes/documentos-timbres", { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: { timbres?: DocumentoTimbre[] };
      };
      if (!res.ok || !json.success || !Array.isArray(json.data?.timbres)) {
        setTimbres([]);
        return;
      }
      setTimbres(json.data.timbres);
    } catch {
      setTimbres([]);
    }
  }, []);

  const carregarModelos = useCallback(async () => {
    setCarregandoLista(true);
    setErroLista(null);
    try {
      const res = await fetch("/api/configuracoes/documentos-modelos", { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: { modelos?: ModeloDocumento[] };
        error?: { message?: string };
      };
      if (!res.ok || !json.success || !Array.isArray(json.data?.modelos)) {
        setModelos([]);
        setErroLista(
          json.error?.message ??
            "Não foi possível carregar os modelos. Se o banco ainda não tem a tabela, aplique a migração e atualize a página."
        );
        return;
      }
      setModelos(json.data.modelos.map((m) => normalizarModeloCarregado(m)));
    } catch {
      setModelos([]);
      setErroLista("Falha de rede ao carregar os modelos.");
    } finally {
      setCarregandoLista(false);
    }
  }, []);

  useEffect(() => {
    void carregarModelos();
  }, [carregarModelos]);
  useEffect(() => {
    void carregarTimbres();
  }, [carregarTimbres]);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch('/api/configuracoes/documentos-empresa', { cache: 'no-store' });
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          data?: { config?: EmpresaDocumentoConfig };
        };
        if (!active || !res.ok || !json.success || !json.data?.config) return;
        setEmpresaConfig((prev) => ({ ...prev, ...json.data?.config }));
      } catch {
        // noop
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setPrimaryAction({
      label: "Novo Modelo",
      onClick: () => {
        setEditorNonce((n) => n + 1);
        setModeloAtual(emptyModelo());
        campoVariavelAlvoRef.current = "corpo";
        setDrawerOpen(true);
      },
    });
    return () => setPrimaryAction(null);
  }, [setPrimaryAction]);

  const modelosFiltrados = useMemo(() => {
    const term = busca.trim().toLowerCase();
    if (!term) return modelos;
    return modelos.filter((m) =>
      `${m.nome} ${m.descricao} ${m.assunto} ${TIPO_LABEL[m.tipo]}`.toLowerCase().includes(term)
    );
  }, [modelos, busca]);

  const salvarModelo = useCallback(() => {
    void (async () => {
      if (!modeloAtual.nome.trim()) {
        showToast("Informe o nome do modelo.", "error");
        return;
      }
      if (!htmlTemTextoVisivel(modeloAtual.corpo)) {
        showToast("O corpo do documento precisa ter algum texto.", "error");
        return;
      }
      setSalvando(true);
      try {
        const payload = {
          nome: modeloAtual.nome,
          tipo: modeloAtual.tipo,
          descricao: modeloAtual.descricao,
          assunto: modeloAtual.assunto,
          logoUrl: modeloAtual.logoUrl,
          cabecalhoHtml: modeloAtual.cabecalhoHtml,
          corpo: modeloAtual.corpo,
          rodapeHtml: modeloAtual.rodapeHtml,
          timbreId: (modeloAtual.timbreId ?? "").trim(),
          ativo: modeloAtual.ativo,
        };
        if (modeloAtual.id) {
          const res = await fetch(`/api/configuracoes/documentos-modelos/${encodeURIComponent(modeloAtual.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ modelo: payload }),
          });
          const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
          if (!res.ok || !json.success) {
            showToast(json.error?.message ?? "Não foi possível salvar o modelo.", "error");
            return;
          }
          showToast("Modelo salvo com sucesso.", "success");
        } else {
          const res = await fetch("/api/configuracoes/documentos-modelos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ modelo: payload }),
          });
          const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
          if (!res.ok || !json.success) {
            showToast(json.error?.message ?? "Não foi possível criar o modelo.", "error");
            return;
          }
          showToast("Modelo criado com sucesso.", "success");
        }
        setDrawerOpen(false);
        await carregarModelos();
      } finally {
        setSalvando(false);
      }
    })();
  }, [carregarModelos, modeloAtual, showToast]);

  const toggleAtivo = useCallback((id: string) => {
    void (async () => {
      const m = modelos.find((x) => x.id === id);
      if (!m) return;
      const nextAtivo = !m.ativo;
      setModelos((prev) => prev.map((x) => (x.id === id ? { ...x, ativo: nextAtivo } : x)));
      setAcaoId(id);
      try {
        const res = await fetch(`/api/configuracoes/documentos-modelos/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelo: { ativo: nextAtivo } }),
        });
        const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
        if (!res.ok || !json.success) {
          setModelos((prev) => prev.map((x) => (x.id === id ? { ...x, ativo: m.ativo } : x)));
          showToast(json.error?.message ?? "Não foi possível atualizar o status.", "error");
          return;
        }
        showToast(nextAtivo ? "Modelo ativado com sucesso." : "Modelo desativado com sucesso.", "success");
        await carregarModelos();
      } finally {
        setAcaoId(null);
      }
    })();
  }, [carregarModelos, modelos, showToast]);

  const duplicarModelo = useCallback((m: ModeloDocumento) => {
    void (async () => {
      setAcaoId(m.id);
      try {
        const res = await fetch(`/api/configuracoes/documentos-modelos/${encodeURIComponent(m.id)}/duplicar`, {
          method: "POST",
        });
        const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
        if (!res.ok || !json.success) {
          showToast(json.error?.message ?? "Não foi possível duplicar o modelo.", "error");
          return;
        }
        showToast("Modelo duplicado com sucesso.", "success");
        await carregarModelos();
      } finally {
        setAcaoId(null);
      }
    })();
  }, [carregarModelos, showToast]);


  const timbreSelecionado = useMemo(
    () => timbres.find((t) => t.id === (modeloAtual.timbreId ?? "").trim()) ?? null,
    [timbres, modeloAtual.timbreId]
  );
  const previewValues = useMemo(() => valoresPreviewExemplo(new Date(), empresaConfig), [empresaConfig]);
  const abrirPreviewCompletoEmNovaAba = useCallback(() => {
    void (async () => {
      const opened = window.open("about:blank", "_blank");
      if (!opened) {
        showToast("Não foi possível abrir a nova aba do preview. Verifique o bloqueador de pop-up.", "error");
        return;
      }

      const timbreUrlBruta = timbreSelecionado?.url?.trim() || modeloAtual.timbreUrl?.trim() || "";
      const urlAbsoluta = absolutizeAssetUrl(timbreUrlBruta);
      let fetchStatus = "não executado";
      let timbreDataUrl = "";
      if (urlAbsoluta) {
        try {
          const resp = await fetch(urlAbsoluta, { cache: "no-store" });
          fetchStatus = String(resp.status);
          if (resp.ok) {
            const blob = await resp.blob();
            timbreDataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onerror = () => reject(new Error("Falha ao converter timbrado para data URL."));
              reader.onload = () => resolve(String(reader.result || ""));
              reader.readAsDataURL(blob);
            });
          }
        } catch (err) {
          // Mantém fallback para URL normal.
          fetchStatus = `erro: ${err instanceof Error ? err.message : "desconhecido"}`;
        }
      }

      const timbreUrlFinal = timbreDataUrl || urlAbsoluta;
      const timbreRenderConfigRaw = timbreSelecionado?.renderConfig
        ? {
            ...timbreSelecionado.renderConfig,
            papelTimbradoUrl: absolutizeAssetUrl(timbreSelecionado.renderConfig.papelTimbradoUrl ?? ""),
          }
        : undefined;
      const timbreRenderConfig = timbreRenderConfigRaw
        ? {
            ...timbreRenderConfigRaw,
            layoutModo:
              timbreUrlFinal && timbreRenderConfigRaw.layoutModo === "header_footer"
                ? "hybrid"
                : timbreUrlFinal && timbreRenderConfigRaw.layoutModo === "none"
                  ? "background"
                  : timbreRenderConfigRaw.layoutModo,
            papelTimbradoOpacity: Math.max(0.22, timbreRenderConfigRaw.papelTimbradoOpacity ?? 0.22),
            papelTimbradoUrl: timbreDataUrl || timbreRenderConfigRaw.papelTimbradoUrl || timbreUrlFinal,
          }
        : timbreUrlFinal
          ? {
              layoutModo: "background" as const,
              papelTimbradoUrl: timbreUrlFinal,
              papelTimbradoOpacity: Math.max(0.22, empresaConfig.papelTimbradoOpacity ?? 0.22),
              margemTopMm: empresaConfig.margemTopMm,
              margemRightMm: empresaConfig.margemRightMm,
              margemBottomMm: empresaConfig.margemBottomMm,
              margemLeftMm: empresaConfig.margemLeftMm,
              headerHeightMm: empresaConfig.headerHeightMm,
              footerHeightMm: empresaConfig.footerHeightMm,
            }
          : undefined;

      const snapshot = {
        assunto: preencherTemplateDocumento(modeloAtual.assunto || "(sem assunto)", previewValues),
        cabecalhoHtml: preencherTemplateDocumento(modeloAtual.cabecalhoHtml || "", previewValues),
        corpoHtml: preencherTemplateDocumento(modeloAtual.corpo || "", previewValues),
        rodapeHtml: preencherTemplateDocumento(modeloAtual.rodapeHtml || "", previewValues),
        timbreUrl: timbreUrlFinal,
        renderConfig: timbreRenderConfig,
      };
      const htmlFinal = montarDocumentoHtmlCompleto({
        title: snapshot.assunto || "Preview do documento",
        modeloNome: modeloAtual.nome?.trim() || "Modelo em edição",
        snapshot,
        geradoEmIso: new Date().toISOString(),
        renderConfig: empresaConfig,
      });
      const htmlComBase = htmlFinal
        .replace("<head>", `<head><base href="${window.location.origin}/" />`);
      opened.document.open();
      opened.document.write(htmlComBase);
      opened.document.close();
    })();
  }, [empresaConfig, modeloAtual, previewValues, showToast, timbreSelecionado]);
  const moduloAtivo = VARIAVEIS_DOCUMENTO_MODULOS.find((x) => x.id === abaVariaveis) ?? VARIAVEIS_DOCUMENTO_MODULOS[0];

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
              placeholder="Buscar modelos..."
              className="h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </div>
        <ConfiguracoesTopNav atalhosDocumentos />
      </div>

      {erroLista ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <p>{erroLista}</p>
          <button
            type="button"
            onClick={() => void carregarModelos()}
            className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-600 dark:bg-slate-900 dark:text-amber-100 dark:hover:bg-slate-800"
          >
            Tentar novamente
          </button>
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
            Se você acabou de atualizar o sistema, rode a migração SQL dos campos de cabeçalho/rodapé no Postgres
            (colunas <code className="font-mono">logoUrl</code>, <code className="font-mono">cabecalhoHtml</code>,{" "}
            <code className="font-mono">rodapeHtml</code>) e recarregue esta página.
          </p>
        </div>
      ) : null}


      {carregandoLista && modelos.length === 0 && !erroLista ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Carregando modelos...</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modelosFiltrados.map((m) => (
          <article key={m.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{m.nome}</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{TIPO_LABEL[m.tipo]}</p>
              </div>
              <span className={`rounded-lg border px-2 py-1 text-xs font-semibold ${m.ativo ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700"}`}>
                {m.ativo ? "Ativo" : "Inativo"}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{m.descricao || "Sem descrição."}</p>
            <p className="mt-2 text-xs text-slate-500">
              Atualizado em {new Date(m.atualizadoEm).toLocaleString("pt-BR")} · v{m.versao}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={acaoId === m.id}
                onClick={() => {
                  setModeloAtual(normalizarModeloCarregado(m));
                  campoVariavelAlvoRef.current = "corpo";
                  setDrawerOpen(true);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
              <button
                type="button"
                disabled={acaoId === m.id}
                onClick={() => duplicarModelo(m)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Copy className="h-3.5 w-3.5" /> Duplicar
              </button>
              <button
                type="button"
                disabled={acaoId === m.id}
                onClick={() => toggleAtivo(m.id)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Power className="h-3.5 w-3.5" /> {m.ativo ? "Desativar" : "Ativar"}
              </button>
            </div>
          </article>
        ))}
      </div>

      {!carregandoLista && !erroLista && modelos.length > 0 && modelosFiltrados.length === 0 && busca.trim() ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400">
          Nenhum modelo corresponde à busca.
        </div>
      ) : null}
      {!carregandoLista && !erroLista && modelos.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400">
          Nenhum modelo cadastrado.
        </div>
      )}

      <DrawerSheet
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={modeloAtual.id ? "Editar modelo de documento" : "Novo modelo de documento"}
        maxWidth="sm:max-w-5xl"
      >
        <div className="space-y-4 p-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Nome do modelo</label>
              <input
                type="text"
                value={modeloAtual.nome}
                onChange={(e) => setModeloAtual((p) => ({ ...p, nome: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Tipo</label>
              <select
                value={modeloAtual.tipo}
                onChange={(e) => setModeloAtual((p) => ({ ...p, tipo: e.target.value as TipoDocumento }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {Object.entries(TIPO_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Papel timbrado deste modelo
              </label>
              <select
                value={modeloAtual.timbreId ?? ""}
                onChange={(e) => {
                  const nextId = e.target.value;
                  const timbre = timbres.find((t) => t.id === nextId);
                  setModeloAtual((p) => ({ ...p, timbreId: nextId, timbreUrl: timbre?.url ?? "" }));
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">(Nenhum / usa padrão global)</option>
                {timbres.filter((t) => t.ativo !== false).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-600 dark:bg-slate-800/50">
              {timbreSelecionado ? (
                <img src={timbreSelecionado.url} alt={timbreSelecionado.nome} className="h-24 w-full rounded object-contain" />
              ) : (
                <div className="flex h-24 items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                  Prévia do timbrado
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Descrição</label>
            <input
              type="text"
              value={modeloAtual.descricao}
              onChange={(e) => setModeloAtual((p) => ({ ...p, descricao: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Assunto (texto simples)</label>
            <input
              ref={assuntoInputRef}
              type="text"
              value={modeloAtual.assunto}
              onChange={(e) => setModeloAtual((p) => ({ ...p, assunto: e.target.value }))}
              onFocus={() => {
                campoVariavelAlvoRef.current = "assunto";
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="Ex.: Proposta - {{cliente.nome}}"
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-800/40">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Logo (URL pública)</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Use o botão para inserir a imagem na posição do cursor no cabeçalho. Você também pode colocar imagens pela barra do editor (ícone de imagem).
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                type="url"
                value={modeloAtual.logoUrl}
                onChange={(e) => setModeloAtual((p) => ({ ...p, logoUrl: e.target.value }))}
                placeholder="https://..."
                className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={inserirLogoNoCabecalho}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Inserir logo no cabeçalho
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Cabeçalho (fixo - logo, endereço, contatos)
            </label>
            <DocumentoRichEditor
              key={`cab-${editorResetKey}`}
              ref={refCabecalho}
              initialHtml={modeloAtual.cabecalhoHtml}
              placeholder="Ex.: dados da empresa, telefone, e-mail institucional..."
              minHeightClassName="min-h-[120px]"
              onFocus={() => {
                campoVariavelAlvoRef.current = "cabecalho";
              }}
              onChange={(html) => setModeloAtual((p) => ({ ...p, cabecalhoHtml: html }))}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_min(320px,100%)]">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Corpo do documento
              </label>
              <DocumentoRichEditor
                key={`corpo-${editorResetKey}`}
                ref={refCorpo}
                initialHtml={modeloAtual.corpo}
                placeholder="Texto principal da proposta, ofício, etc."
                minHeightClassName="min-h-[260px]"
                onFocus={() => {
                  campoVariavelAlvoRef.current = "corpo";
                }}
                onChange={(html) => setModeloAtual((p) => ({ ...p, corpo: html }))}
              />
            </div>

            <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/50">
              <div className="border-b border-slate-200 dark:border-slate-600">
                <div className="flex max-h-[220px] flex-wrap gap-1 overflow-y-auto p-2">
                  {VARIAVEIS_DOCUMENTO_MODULOS.map((mod) => (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => setAbaVariaveis(mod.id)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                        abaVariaveis === mod.id
                          ? "bg-[#6D28D9] text-white"
                          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-600 dark:hover:bg-slate-800"
                      }`}
                    >
                      {mod.titulo}
                    </button>
                  ))}
                </div>
              </div>
              <div className="max-h-[320px] overflow-y-auto p-2">
                <p className="mb-2 text-[11px] text-slate-500 dark:text-slate-400">
                  Clique na variável para inserir na posição do cursor no último campo em que você clicou (assunto,
                  cabeçalho, corpo ou rodapé). Campos de texto rico: clique dentro do editor antes de escolher a
                  variável.
                </p>
                <div className="flex flex-col gap-1.5">
                  {moduloAtivo?.variaveis.map((v) => (
                    <button
                      key={v.token}
                      type="button"
                      onClick={() => inserirVariavel(v.token)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-xs text-slate-800 hover:bg-violet-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                      <span className="font-mono text-[11px] text-violet-700 dark:text-violet-300">{v.token}</span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">{v.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Rodapé (fixo - avisos legais, CNPJ, contato)
            </label>
            <DocumentoRichEditor
              key={`rodape-${editorResetKey}`}
              ref={refRodape}
              initialHtml={modeloAtual.rodapeHtml}
              placeholder="Ex.: observações legais, linha de assinatura, dados cadastrais..."
              minHeightClassName="min-h-[120px]"
              onFocus={() => {
                campoVariavelAlvoRef.current = "rodape";
              }}
              onChange={(html) => setModeloAtual((p) => ({ ...p, rodapeHtml: html }))}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-600">
            <button
              type="button"
              onClick={abrirPreviewCompletoEmNovaAba}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Eye className="h-4 w-4" />
              Visualizar documento completo
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={salvarModelo}
                className="inline-flex items-center gap-2 rounded-lg bg-[#6D28D9] px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
              >
                <FilePlus2 className="h-4 w-4" />
                {salvando ? "Salvando..." : "Salvar modelo"}
              </button>
            </div>
          </div>
        </div>
      </DrawerSheet>

      <Toast
        visible={toast.visible}
        message={toast.message}
        variant={toast.variant}
        duration={toast.duration}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </section>
  );
}



