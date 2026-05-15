"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Eye, FilePlus2, Pencil, Power, Search } from "lucide-react";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import {
  DocumentoRichEditor,
  type DocumentoRichEditorHandle,
} from "@/components/configuracoes/documento-rich-editor";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Toast } from "@/components/ui/toast";
import { usePageHeader } from "@/contexts/page-header-context";
import { htmlOuParagrafoSimples, htmlTemTextoVisivel } from "@/lib/documentos/html-text";
import {
  VARIAVEIS_DOCUMENTO_MODULOS,
  type ModuloVariaveisDocumento,
  preencherTemplateDocumento,
  valoresPreviewExemplo,
} from "@/lib/documentos/template-vars";
import { ConfiguracoesTopNav } from "@/components/configuracoes/configuracoes-top-nav";
import { montarDocumentoHtmlCompleto } from "@/lib/documentos/documento-html";
import { DadosEmpresaFormSection } from "@/components/configuracoes/dados-empresa-form";
import {
  formInputClass,
  formInputLeadingIconPaddingClass,
  formLabelClass,
  formModalCancelButtonClass,
  formModalSubmitButtonClass,
  formSectionLabelClass,
} from "@/components/ui/field-patterns";
import { AlignLeft, ClipboardList, FileSpreadsheet, FileText, Layers3, ReceiptText, Save, ScrollText, Type, X } from "lucide-react";

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

const TIPO_OPTIONS: SearchableOption[] = [
  {
    value: "proposta_comercial",
    label: TIPO_LABEL.proposta_comercial,
    icon: ({ className }) => <FileText className={`${className ?? ""} !text-violet-600 dark:!text-violet-400`} />,
  },
  {
    value: "oficio",
    label: TIPO_LABEL.oficio,
    icon: ({ className }) => <ScrollText className={`${className ?? ""} !text-sky-600 dark:!text-sky-400`} />,
  },
  {
    value: "prestacao_contas",
    label: TIPO_LABEL.prestacao_contas,
    icon: ({ className }) => <ReceiptText className={`${className ?? ""} !text-amber-600 dark:!text-amber-400`} />,
  },
  {
    value: "relatorio",
    label: TIPO_LABEL.relatorio,
    icon: ({ className }) => <FileSpreadsheet className={`${className ?? ""} !text-emerald-600 dark:!text-emerald-400`} />,
  },
];

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

/** Corrige rótulos com encoding quebrado vindos do catálogo legado (sem alterar tokens). */
function sanitizeVariavelLabel(label: string): string {
  return label
    .replace(/\u00e2\u20ac\u201d/g, "—")
    .replace(/â€"/g, "—")
    .replace(/Â·/g, "·");
}

/**
 * Tokens preenchidos ao exportar relatórios Comercial / Financeiro (lançamentos).
 * Mantidos aqui para documentação na UI sem alterar outros arquivos do sistema.
 */
const MODULOS_VARIAVEIS_RELATORIOS_EXTRA: ModuloVariaveisDocumento[] = [
  {
    id: "relatorios_contexto",
    titulo: "Relatórios · Contexto",
    variaveis: [
      {
        token: "{{relatorio_tipo}}",
        label: "Nome do tipo de relatório (conforme escolha ao gerar o PDF)",
      },
    ],
  },
  {
    id: "relatorios_tabela_comercial",
    titulo: "Relatórios · Comercial (lista de leads)",
    variaveis: [
      { token: "{{resumo_total_leads}}", label: "Quantidade de leads no período" },
      { token: "{{resumo_valor_aberto}}", label: "Soma dos valores em aberto (não fechado/perdido)" },
      { token: "{{resumo_valor_ganhos}}", label: "Soma dos valores ganhos (fechado)" },
      { token: "{{resumo_valor_perdidos}}", label: "Soma dos valores perdidos" },
      { token: "{{resumo_taxa_conversao}}", label: "Taxa de conversão (ganhos vs. ganhos+perdidos)" },
      { token: "{{tabela_leads_html}}", label: "Tabela HTML com os leads do período" },
    ],
  },
  {
    id: "relatorios_tabela_financeiro",
    titulo: "Relatórios · Financeiro (lançamentos)",
    variaveis: [
      { token: "{{resumo_total_lancamentos}}", label: "Quantidade de lançamentos no período" },
      { token: "{{resumo_total_entradas}}", label: "Total de entradas" },
      { token: "{{resumo_total_saidas}}", label: "Total de saídas" },
      { token: "{{resumo_saldo_periodo}}", label: "Saldo do período (entradas − saídas)" },
      { token: "{{resumo_total_atrasado}}", label: "Total em atraso (conforme filtros do relatório)" },
      { token: "{{tabela_lancamentos_html}}", label: "Tabela HTML com lançamentos" },
    ],
  },
];

const TITULO_MODULO_VARIAVEL_OVERRIDES: Partial<Record<string, string>> = {
  comercial: "Oportunidade (lead / CRM)",
  contato: "Papéis de contato na oportunidade",
  financeiro: "Financeiro da proposta",
  usuario_data: "Autoria e data",
  relatorios_prestacao_contas: "Relatórios · Prestação de contas",
  relatorios_operacional: "Relatórios · Operacional (desempenho)",
  relatorios_financeiro: "Relatórios · Financeiro (indicadores)",
  relatorios_comercial: "Relatórios · Comercial (indicadores)",
};

const ORDEM_MODULOS_COLUNA_VARIAVEIS = [
  "empresa",
  "cliente",
  "usuario_data",
  "comercial",
  "solucoes",
  "contato",
  "financeiro",
  "rh",
  "relatorios_contexto",
  "relatorios_prestacao_contas",
  "relatorios_operacional",
  "relatorios_financeiro",
  "relatorios_tabela_financeiro",
  "relatorios_comercial",
  "relatorios_tabela_comercial",
] as const;

function construirCatalogoVariaveisColuna(): ModuloVariaveisDocumento[] {
  const map = new Map<string, ModuloVariaveisDocumento>();

  for (const m of VARIAVEIS_DOCUMENTO_MODULOS) {
    const titulo = TITULO_MODULO_VARIAVEL_OVERRIDES[m.id] ?? m.titulo;
    map.set(m.id, {
      ...m,
      titulo,
      variaveis: m.variaveis.map((v) => ({
        ...v,
        label: sanitizeVariavelLabel(v.label),
      })),
    });
  }
  for (const m of MODULOS_VARIAVEIS_RELATORIOS_EXTRA) {
    map.set(m.id, m);
  }

  const ordered: ModuloVariaveisDocumento[] = [];
  const ordemPrevista = new Set<string>([...ORDEM_MODULOS_COLUNA_VARIAVEIS]);
  for (const id of ORDEM_MODULOS_COLUNA_VARIAVEIS) {
    const mod = map.get(id);
    if (mod) ordered.push(mod);
  }
  for (const [id, mod] of map) {
    if (!ordemPrevista.has(id)) ordered.push(mod);
  }
  return ordered;
}

export default function ConstrutorDocumentosPage() {
  const { setPrimaryAction } = usePageHeader();
  const [modelos, setModelos] = useState<ModeloDocumento[]>([]);
  const [busca, setBusca] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerDadosEmpresaOpen, setDrawerDadosEmpresaOpen] = useState(false);
  const [modeloAtual, setModeloAtual] = useState<ModeloDocumento>(emptyModelo());
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [acaoId, setAcaoId] = useState<string | null>(null);
  const [editorNonce, setEditorNonce] = useState(0);
  const [buscaVariavel, setBuscaVariavel] = useState("");
  const [abaVariaveis, setAbaVariaveis] = useState<string>("empresa");
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

  const catalogoVariaveisColuna = useMemo(() => construirCatalogoVariaveisColuna(), []);

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
      showPlusIcon: true,
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
  const timbreOptions = useMemo<SearchableOption[]>(
    () => [
      {
        value: "",
        label: "(Nenhum / usa padrão global)",
        icon: ({ className }) => <ClipboardList className={`${className ?? ""} !text-slate-500 dark:!text-slate-400`} />,
      },
      ...timbres
        .filter((t) => t.ativo !== false)
        .map((t) => ({
          value: t.id,
          label: t.nome,
          icon: ({ className }: { className?: string }) => (
            <ClipboardList className={`${className ?? ""} !text-violet-600 dark:!text-violet-400`} />
          ),
        })),
    ],
    [timbres]
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
  const termoVariavel = buscaVariavel.trim().toLowerCase();
  const modulosComVariaveisFiltradas = useMemo(
    () =>
      catalogoVariaveisColuna.map((mod) => ({
        ...mod,
        variaveis: !termoVariavel
          ? mod.variaveis
          : mod.variaveis.filter((v) =>
              `${v.token} ${v.label}`.toLowerCase().includes(termoVariavel)
            ),
      })).filter((mod) => mod.variaveis.length > 0),
    [catalogoVariaveisColuna, termoVariavel]
  );

  const moduloAtivoFiltrado =
    modulosComVariaveisFiltradas.find((m) => m.id === abaVariaveis) ??
    modulosComVariaveisFiltradas[0] ??
    null;

  useEffect(() => {
    if (modulosComVariaveisFiltradas.length === 0) return;
    const existe = modulosComVariaveisFiltradas.some((m) => m.id === abaVariaveis);
    if (!existe) setAbaVariaveis(modulosComVariaveisFiltradas[0].id);
  }, [modulosComVariaveisFiltradas, abaVariaveis]);

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
              placeholder="Buscar modelos..."
              className={`${formInputClass} h-10 min-w-0 pl-9`}
            />
          </div>
        </div>
        <ConfiguracoesTopNav atalhosDocumentos onOpenDadosEmpresaModal={() => setDrawerDadosEmpresaOpen(true)} />
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
        fullViewport
        maxWidth="sm:max-w-3xl"
        mobileContentPaddingClassName="px-0"
        desktopContentPaddingClassName="px-0"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-stretch">
            <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
              <div className="space-y-4">
                <div className="relative">
                  <div className="flex flex-col gap-3 lg:pr-[232px]">
                    <div className="space-y-1">
                      <label className={formLabelClass}>Nome do modelo</label>
                      <div className="relative">
                        <Type className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={modeloAtual.nome}
                          onChange={(e) => setModeloAtual((p) => ({ ...p, nome: e.target.value }))}
                          className={`${formInputClass} pl-9`}
                          placeholder="Ex.: Proposta Comercial 2026"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className={formLabelClass}>Tipo</label>
                      <SearchableSelect
                        options={TIPO_OPTIONS}
                        value={modeloAtual.tipo}
                        onChange={(value) => setModeloAtual((p) => ({ ...p, tipo: value as TipoDocumento }))}
                        placeholder="Selecione o tipo"
                        searchPlaceholder="Buscar tipo..."
                        searchable={false}
                        leadingIcon={Layers3}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={formLabelClass}>Papel timbrado deste modelo</label>
                      <SearchableSelect
                        options={timbreOptions}
                        value={modeloAtual.timbreId ?? ""}
                        onChange={(value) => {
                          const timbre = timbres.find((t) => t.id === value);
                          setModeloAtual((p) => ({ ...p, timbreId: value, timbreUrl: timbre?.url ?? "" }));
                        }}
                        placeholder="Selecione o papel timbrado"
                        searchPlaceholder="Buscar papel timbrado..."
                        searchable={false}
                        leadingIcon={ClipboardList}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-1 lg:absolute lg:inset-y-0 lg:right-0 lg:mt-0 lg:min-h-0 lg:w-[220px]">
                    <label className={formLabelClass}>Papel timbrado</label>
                    <div className="flex min-h-[7rem] flex-1 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-600 dark:bg-slate-800/50 lg:min-h-0">
                      {timbreSelecionado ? (
                        <img
                          src={timbreSelecionado.url}
                          alt={timbreSelecionado.nome}
                          className="max-h-full max-w-full rounded object-contain"
                        />
                      ) : (
                        <div className="flex min-h-[5rem] items-center justify-center text-xs text-slate-500 dark:text-slate-400 lg:min-h-0">
                          Prévia do timbrado
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className={formLabelClass}>Descrição</label>
                  <div className="relative">
                    <AlignLeft className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={modeloAtual.descricao}
                      onChange={(e) => setModeloAtual((p) => ({ ...p, descricao: e.target.value }))}
                      className={`${formInputClass} pl-9`}
                      placeholder="Ex.: Modelo usado para propostas de novos clientes"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className={formLabelClass}>Assunto (texto simples)</label>
                  <div className="relative">
                    <Type className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={assuntoInputRef}
                      type="text"
                      value={modeloAtual.assunto}
                      onChange={(e) => setModeloAtual((p) => ({ ...p, assunto: e.target.value }))}
                      onFocus={() => {
                        campoVariavelAlvoRef.current = "assunto";
                      }}
                      className={`${formInputClass} pl-9`}
                      placeholder="Ex.: Proposta - {{cliente.nome}}"
                    />
                  </div>
                </div>

                <div>
                  <label className={formLabelClass}>Cabeçalho (fixo - logo, endereço, contatos)</label>
                  <DocumentoRichEditor
                    key={`cab-${editorResetKey}`}
                    ref={refCabecalho}
                    initialHtml={modeloAtual.cabecalhoHtml}
                    placeholder="Ex.: dados da empresa, telefone, e-mail institucional..."
                    minHeightClassName="min-h-[150px]"
                    contentLeadingIcon={AlignLeft}
                    onFocus={() => {
                      campoVariavelAlvoRef.current = "cabecalho";
                    }}
                    onChange={(html) => setModeloAtual((p) => ({ ...p, cabecalhoHtml: html }))}
                  />
                </div>

                <div>
                  <label className={formLabelClass}>Corpo do documento</label>
                  <DocumentoRichEditor
                    key={`corpo-${editorResetKey}`}
                    ref={refCorpo}
                    initialHtml={modeloAtual.corpo}
                    placeholder="Texto principal da proposta, ofício, etc."
                    minHeightClassName="min-h-[150px]"
                    contentLeadingIcon={AlignLeft}
                    onFocus={() => {
                      campoVariavelAlvoRef.current = "corpo";
                    }}
                    onChange={(html) => setModeloAtual((p) => ({ ...p, corpo: html }))}
                  />
                </div>

                <div>
                  <label className={formLabelClass}>Rodapé (fixo - avisos legais, CNPJ, contato)</label>
                  <DocumentoRichEditor
                    key={`rodape-${editorResetKey}`}
                    ref={refRodape}
                    initialHtml={modeloAtual.rodapeHtml}
                    placeholder="Ex.: observações legais, linha de assinatura, dados cadastrais..."
                    minHeightClassName="min-h-[150px]"
                    contentLeadingIcon={AlignLeft}
                    onFocus={() => {
                      campoVariavelAlvoRef.current = "rodape";
                    }}
                    onChange={(html) => setModeloAtual((p) => ({ ...p, rodapeHtml: html }))}
                  />
                </div>
              </div>
            </div>

            <aside className="flex min-h-0 flex-col overflow-hidden border-t border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/50 lg:h-full lg:min-h-0 lg:border-l lg:border-t-0">
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-3 py-4 sm:px-4 lg:px-5">
                <div className="shrink-0 space-y-2">
                  <p className={formSectionLabelClass}>Variáveis do documento</p>
                  <p className="text-sm leading-snug text-slate-500 dark:text-slate-400">
                    Utilize o campo de busca ou clique nos grupos para filtrar, com o cursor na posição do texto onde deseja,
                    clique na variável para inserir.
                  </p>
                  <div className="relative mt-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={buscaVariavel}
                      onChange={(e) => setBuscaVariavel(e.target.value)}
                      placeholder="Buscar variável por nome ou token..."
                      className={`${formInputClass} ${formInputLeadingIconPaddingClass}`}
                    />
                  </div>
                </div>
                {modulosComVariaveisFiltradas.length === 0 ? (
                  <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                    Nenhuma variável encontrada para esta busca.
                  </p>
                ) : (
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                    <p className={`${formSectionLabelClass} mb-2`}>Grupos</p>
                    <div className="grid w-full gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,7.5rem),1fr))]">
                      {modulosComVariaveisFiltradas.map((mod) => (
                        <button
                          key={mod.id}
                          type="button"
                          onClick={() => setAbaVariaveis(mod.id)}
                          className={`flex min-h-[2.25rem] w-full items-center justify-center rounded-lg px-2 py-1.5 text-center text-sm font-medium leading-snug transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                            abaVariaveis === mod.id
                              ? "bg-[#6D28D9] text-white"
                              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                          }`}
                        >
                          <span className="line-clamp-3">{mod.titulo}</span>
                        </button>
                      ))}
                    </div>
                    <p className={`${formSectionLabelClass} mb-2 mt-6`}>Variáveis</p>
                    {!moduloAtivoFiltrado ? null : (
                      <div className="flex flex-col gap-2">
                        {moduloAtivoFiltrado.variaveis.map((v) => (
                          <button
                            key={v.token}
                            type="button"
                            onClick={() => inserirVariavel(v.token)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:bg-violet-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800"
                          >
                            <span className="inline text-sm text-slate-800 dark:text-slate-100">{v.label}</span>
                            <span className="inline break-all font-mono text-xs text-violet-700 dark:text-violet-300">
                              {" "}
                              {v.token}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </aside>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 sm:px-6">
            <button
              type="button"
              onClick={abrirPreviewCompletoEmNovaAba}
              className={formModalCancelButtonClass}
            >
              <span className="inline-flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Visualizar prévia do modelo de documento
              </span>
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDrawerOpen(false)} className={formModalCancelButtonClass}>
                <span className="inline-flex items-center gap-2">
                  <X className="h-4 w-4" />
                  Cancelar
                </span>
              </button>
              <button type="button" disabled={salvando} onClick={salvarModelo} className={formModalSubmitButtonClass}>
                <span className="inline-flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {salvando ? "Salvando..." : "Salvar"}
                </span>
              </button>
            </div>
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



