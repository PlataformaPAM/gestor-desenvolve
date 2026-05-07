"use client";

import { useEffect, useMemo, useState } from "react";
import { FileDown, FileText, Trash2, Wallet, Circle, RefreshCw, ListOrdered } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { SearchableOption } from "@/components/ui/searchable-select";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import { Toast } from "@/components/ui/toast";
import { montarDocumentoHtmlCompleto } from "@/lib/documentos/documento-html";
import {
  comercialInputClass,
  comercialInputCompactClass,
  comercialLabelClass,
  FormDateField,
} from "./field-styles";
import type {
  Lead,
  LeadInteraction,
  LeadRecorrenciaPagamento,
  LeadSolucaoRef,
} from "@/lib/comercial/types";
import type { Cliente } from "@/lib/clientes/types";
import { useAuth } from "@/contexts/auth-context";

type LeadDetailPropostaProps = {
  lead: Lead;
  onUpdateLead: (
    updates: Partial<Lead>,
    opts?: { skipSuccessToast?: boolean; allowWhileFinanceiroLocked?: boolean }
  ) => void;
  onGerarPdfSuccess: () => void;
  /** Para listar contatos do cliente vinculado (envio por e-mail / WhatsApp). */
  clientes?: Cliente[];
};
type CatalogSolucao = {
  id: string;
  nome: string;
  valorVenda: number;
  logoUrl?: string;
  recorrencia: LeadRecorrenciaPagamento;
  parcelasPadrao: number;
};

const REC_COMERCIAL_LABEL: Record<LeadRecorrenciaPagamento, string> = {
  mensal: "Mensal",
  unica: "Única",
  parcelado: "Parcelado",
};

const TIPO_MODELO_DOC_LABEL: Record<string, string> = {
  proposta_comercial: "Proposta",
  oficio: "Ofício",
  prestacao_contas: "Prestação de contas",
  relatorio: "Relatório",
};

const PAGAMENTO_NEGOCIACAO_OPTIONS: SearchableOption[] = [
  {
    value: "mensal",
    label: "Mensal",
    icon: ({ className }) => <RefreshCw className={`!text-blue-500 ${className ?? ""}`} />,
  },
  {
    value: "unica",
    label: "Única",
    icon: ({ className }) => <Circle className={`!text-emerald-500 ${className ?? ""}`} />,
  },
  {
    value: "parcelado",
    label: "Parcelado",
    icon: ({ className }) => <ListOrdered className={`!text-violet-500 ${className ?? ""}`} />,
  },
];

const PREVIEW_DOC_CLASS =
  "max-w-none text-sm text-slate-800 dark:text-slate-100 [&_a]:text-[#6D28D9] [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_hr]:my-4 [&_img]:max-h-28 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-1 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6";

type ModeloDocumentoLista = { id: string; nome: string; tipo: string; ativo: boolean };
type PreviewRenderConfig = {
  layoutModo?: "none" | "background" | "header_footer" | "hybrid";
  papelTimbradoUrl?: string;
  papelTimbradoOpacity?: number;
  margemTopMm?: number;
  margemRightMm?: number;
  margemBottomMm?: number;
  margemLeftMm?: number;
  headerHeightMm?: number;
  footerHeightMm?: number;
} | null;

type DocumentoPreviewPayload = {
  assunto: string;
  cabecalhoHtml: string;
  corpoHtml: string;
  rodapeHtml: string;
  timbreUrl?: string;
  renderConfig?: PreviewRenderConfig;
};

type DocumentoGeradoListaItem = {
  id: string;
  date: string;
  modelo: { id: string; nome: string; tipo: string; versao: number | null };
  assunto: string;
};

function sanitizeTelefoneWhatsapp(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

type DocDestinatario = {
  key: string;
  nome: string;
  email: string;
  telefone: string;
  origemLabel: string;
};

function emailValido(raw: string): boolean {
  const e = raw.trim().toLowerCase();
  return Boolean(e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

/** Contatos do cliente cadastrado + contatos da oportunidade; remove duplicatas por e-mail ou telefone. */
function mergeDocDestinatarios(lead: Lead, clientes: Cliente[] | undefined): DocDestinatario[] {
  const list: DocDestinatario[] = [];
  const seen = new Set<string>();
  const push = (nome: string, email: string, telefone: string, origemLabel: string) => {
    const e = email.trim().toLowerCase();
    const p = sanitizeTelefoneWhatsapp(telefone);
    if (!emailValido(email) && !p) return;
    const dedupe = emailValido(email) ? `e:${e}` : `p:${p}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    list.push({
      key: dedupe,
      nome: nome.trim() || "(sem nome)",
      email: email.trim(),
      telefone: telefone.trim(),
      origemLabel,
    });
  };

  if (lead.clienteId && clientes?.length) {
    const cli = clientes.find((c) => c.id === lead.clienteId);
    for (const ct of cli?.contatos ?? []) {
      push(ct.nome, ct.email, ct.telefone, "Cliente");
    }
  }
  for (const ct of lead.contatosOportunidade ?? []) {
    push(ct.nome, ct.email, ct.telefone, "Oportunidade");
  }

  if (list.length === 0) {
    push(lead.contact?.trim() || lead.name, lead.email ?? "", lead.phone ?? "", "Lead");
  }
  return list;
}

function montarMensagemWhatsappDocumento(params: {
  nomeContato: string;
  leadNome: string;
  clienteNome: string;
  modeloNome: string;
  assunto: string;
  dataIso: string;
  valorTotal: number;
  prazoValidade: string;
  pdfUrl: string;
}): string {
  const dataFmt = new Date(params.dataIso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const valorFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    params.valorTotal || 0
  );
  const saudacao = params.nomeContato.trim()
    ? `Prezado(a) *${params.nomeContato.trim()}*,`
    : "Prezado(a) cliente,";
  return [
    saudacao,
    "",
    "Conforme combinado, segue o *documento comercial em PDF* para sua análise.",
    "Acesse pelo link abaixo (abre no navegador; é possível baixar o arquivo a partir da visualização):",
    "",
    params.pdfUrl,
    "",
    "*Resumo da proposta*",
    `• *Cliente / referência:* ${params.clienteNome || params.leadNome}`,
    `• *Assunto:* ${params.assunto || "(sem assunto)"}`,
    `• *Modelo:* ${params.modeloNome}`,
    `• *Oportunidade:* ${params.leadNome}`,
    `• *Valor total:* ${valorFmt}`,
    `• *Validade:* ${params.prazoValidade}`,
    `• *Emitido em:* ${dataFmt}`,
    "",
    "Qualquer ajuste em condições, prazo ou escopo, estamos à disposição.",
    "",
    "Atenciosamente,",
    "*Equipe comercial*",
  ].join("\n");
}

function createSolucaoLineId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `ls-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function createLogId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Digitação só com números; exibe máscara R$ (centavos) */
function useBrlCentavosInput() {
  const [centavos, setCentavos] = useState<number | null>(null);

  const display =
    centavos == null || centavos === 0
      ? ""
      : (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const onChangeDigits = (raw: string) => {
    const d = raw.replace(/\D/g, "");
    if (d === "") {
      setCentavos(null);
      return;
    }
    setCentavos(parseInt(d, 10));
  };

  const getValorReais = (fallback: number) => {
    if (centavos == null) return fallback;
    return centavos / 100;
  };

  return { display, onChangeDigits, getValorReais, setCentavos };
}

export function LeadDetailProposta({
  lead,
  onUpdateLead,
  onGerarPdfSuccess,
  clientes = [],
}: LeadDetailPropostaProps) {
  const { session } = useAuth();
  const currentUserName = session.userName ?? "Usuário";
  const currentUserId = session.userId ?? null;
  const [catalogoSolucoes, setCatalogoSolucoes] = useState<CatalogSolucao[]>([]);

  const [addingId, setAddingId] = useState<string | null>(null);
  const [condicoesStr, setCondicoesStr] = useState("");
  const [solucaoIdxParaRemover, setSolucaoIdxParaRemover] = useState<number | null>(null);
  const [modelosDocumento, setModelosDocumento] = useState<ModeloDocumentoLista[]>([]);
  const [modeloDocumentoId, setModeloDocumentoId] = useState("");
  const [docPreviewOpen, setDocPreviewOpen] = useState(false);
  const [docPreviewLoading, setDocPreviewLoading] = useState(false);
  const [docGerarLoading, setDocGerarLoading] = useState(false);
  const [docPreview, setDocPreview] = useState<DocumentoPreviewPayload | null>(null);
  const [docsGerados, setDocsGerados] = useState<DocumentoGeradoListaItem[]>([]);
  const [docsGeradosLoading, setDocsGeradosLoading] = useState(false);
  const [enviandoEmailKey, setEnviandoEmailKey] = useState<string | null>(null);
  const [whatsConfirm, setWhatsConfirm] = useState<{
    doc: DocumentoGeradoListaItem;
    dest: DocDestinatario;
  } | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; variant: "success" | "error" }>({
    visible: false,
    message: "",
    variant: "success",
  });

  const selectedCatalog = addingId ? catalogoSolucoes.find((s) => s.id === addingId) : undefined;
  const { display: valorMasked, onChangeDigits, getValorReais, setCentavos } = useBrlCentavosInput();
  const docDestinatarios = useMemo(() => mergeDocDestinatarios(lead, clientes), [lead, clientes]);

  const showToast = (message: string, variant: "success" | "error" = "success") => {
    setToast({ visible: false, message: "", variant });
    window.requestAnimationFrame(() => setToast({ visible: true, message, variant }));
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/solucoes/bootstrap", { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as { data?: { solucoes?: CatalogSolucao[] } };
        if (!active) return;
        setCatalogoSolucoes(payload?.data?.solucoes ?? []);
      } catch {
        // noop
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setDocsGeradosLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/comercial/leads/${encodeURIComponent(lead.id)}/documentos-gerados`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          success?: boolean;
          data?: { documentos?: DocumentoGeradoListaItem[] };
        };
        if (!active || !json.success || !Array.isArray(json.data?.documentos)) return;
        setDocsGerados(json.data.documentos);
      } finally {
        if (active) setDocsGeradosLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [lead.id]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/configuracoes/documentos-modelos", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as {
          success?: boolean;
          data?: { modelos?: ModeloDocumentoLista[] };
        };
        if (!active || !json.success || !Array.isArray(json.data?.modelos)) return;
        setModelosDocumento(json.data.modelos.filter((m) => m.ativo));
      } catch {
        // noop
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (addingId && selectedCatalog) {
      setCentavos(Math.round(selectedCatalog.valorVenda * 100));
      setCondicoesStr("");
    }
  }, [addingId, selectedCatalog, setCentavos]);

  useEffect(() => {
    if (!addingId) {
      setCondicoesStr("");
      setCentavos(null);
    }
  }, [addingId, setCentavos]);

  const solucoesNaOportunidade = useMemo(() => lead.solucoes ?? [], [lead.solucoes]);
  const disponiveis = useMemo(() => {
    const catalogIdsNaProposta = new Set(
      solucoesNaOportunidade.map((s) => s.solucaoCatalogoId).filter(Boolean) as string[]
    );
    return catalogoSolucoes.filter((s) => !catalogIdsNaProposta.has(s.id));
  }, [solucoesNaOportunidade, catalogoSolucoes]);

  const valorTotal = useMemo(() => {
    return solucoesNaOportunidade.reduce((acc, s) => acc + (s.valor ?? 0), 0);
  }, [solucoesNaOportunidade]);

  const solucoesDisponiveisOptions = useMemo<SearchableOption[]>(
    () =>
      disponiveis.map((s) => ({
        value: s.id,
        label: s.nome,
        subtitle: formatCurrency(s.valorVenda),
        icon: FileText,
      })),
    [disponiveis]
  );

  const modeloDocumentoOptions = useMemo<SearchableOption[]>(
    () =>
      modelosDocumento.map((m) => ({
        value: m.id,
        label: `${m.nome} (${TIPO_MODELO_DOC_LABEL[m.tipo] ?? m.tipo})`,
        icon: FileText,
      })),
    [modelosDocumento]
  );

  const addSolucao = (solId: string) => {
    const sol = catalogoSolucoes.find((s) => s.id === solId);
    if (!sol) return;
    const valorNum = getValorReais(sol.valorVenda);
    const logoTrim = sol.logoUrl?.trim();
    const parcelasLinha = sol.recorrencia === "parcelado" ? Math.max(2, sol.parcelasPadrao ?? 12) : null;
    const nova: LeadSolucaoRef = {
      id: createSolucaoLineId(),
      solucaoCatalogoId: sol.id,
      nome: sol.nome,
      ...(logoTrim ? { logoUrl: logoTrim } : {}),
      valor: valorNum,
      condicoesPagamento: condicoesStr.trim() || undefined,
      recorrenciaPagamento: sol.recorrencia,
      parcelas: parcelasLinha,
    };
    const valorFmt = formatCurrency(valorNum);
    const condTxt = condicoesStr.trim() || "—";
    const recTxt = `${REC_COMERCIAL_LABEL[sol.recorrencia]}${sol.recorrencia === "parcelado" ? `, ${parcelasLinha} parcelas` : ""}`;
    const log: LeadInteraction = {
      id: createLogId(),
      date: new Date().toISOString(),
      user: currentUserName,
      type: "sistema",
      action: "UPDATE",
      description: `Solução adicionada: ${nova.nome}. Valor: ${valorFmt}. Pagamento (ref.): ${recTxt}. Condições: ${condTxt}.`,
    };
    onUpdateLead({
      solucoes: [...solucoesNaOportunidade, nova],
      valorTotal: valorTotal + (nova.valor ?? 0),
      interactions: [...(lead.interactions ?? []), log],
    });
    setAddingId(null);
    setCondicoesStr("");
  };

  const patchSolucao = (idx: number, patch: Partial<LeadSolucaoRef>) => {
    const next = solucoesNaOportunidade.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    const novoTotal = next.reduce((acc, s) => acc + (s.valor ?? 0), 0);
    onUpdateLead(
      {
        solucoes: next,
        valorTotal: novoTotal,
      },
      { skipSuccessToast: true }
    );
  };

  const removeSolucao = (idx: number) => {
    const list = solucoesNaOportunidade.slice();
    const removed = list.splice(idx, 1)[0];
    if (!removed) return;
    const novoTotal = list.reduce((acc, s) => acc + (s.valor ?? 0), 0);
    const log: LeadInteraction = {
      id: createLogId(),
      date: new Date().toISOString(),
      user: currentUserName,
      userId: currentUserId,
      type: "sistema",
      action: "UPDATE",
      description: `Solução removida: ${removed.nome}. Valor: ${formatCurrency(removed.valor ?? 0)}.`,
    };
    onUpdateLead({
      solucoes: list,
      valorTotal: novoTotal,
      interactions: [...(lead.interactions ?? []), log],
    });
  };

  const visualizarDocumentoModelo = async () => {
    if (!modeloDocumentoId) {
      showToast("Selecione um modelo de documento.", "error");
      return;
    }
    setDocPreviewLoading(true);
    try {
      const res = await fetch(`/api/comercial/leads/${encodeURIComponent(lead.id)}/documento-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modeloId: modeloDocumentoId }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: {
          preview?: DocumentoPreviewPayload;
          modelo?: { id?: string; nome?: string; tipo?: string };
        };
        error?: { message?: string };
      };
      if (!res.ok || !json.success || !json.data?.preview) {
        showToast(json.error?.message ?? "Não foi possível gerar a visualização.", "error");
        return;
      }
      const opened = window.open("about:blank", "_blank");
      if (!opened) {
        setDocPreview(json.data.preview);
        setDocPreviewOpen(true);
        showToast("Não foi possível abrir nova aba. Exibindo pré-visualização simplificada.", "error");
        return;
      }
      const p = json.data.preview;
      const timbreRaw = p.timbreUrl?.trim() || "";
      const timbreAbs = timbreRaw ? new URL(timbreRaw, window.location.origin).toString() : "";
      const renderConfig = p.renderConfig
        ? {
            ...p.renderConfig,
            papelTimbradoUrl: timbreAbs || p.renderConfig.papelTimbradoUrl || "",
          }
        : undefined;
      const htmlFinal = montarDocumentoHtmlCompleto({
        title: p.assunto || "Preview do documento",
        modeloNome: json.data.modelo?.nome?.trim() || "Modelo selecionado",
        snapshot: {
          assunto: p.assunto,
          cabecalhoHtml: p.cabecalhoHtml,
          corpoHtml: p.corpoHtml,
          rodapeHtml: p.rodapeHtml,
          timbreUrl: timbreAbs,
          renderConfig: renderConfig ?? undefined,
        },
        geradoEmIso: new Date().toISOString(),
        renderConfig: renderConfig ?? undefined,
      });
      const htmlComBase = htmlFinal.replace("<head>", `<head><base href="${window.location.origin}/" />`);
      opened.document.open();
      opened.document.write(htmlComBase);
      opened.document.close();
    } finally {
      setDocPreviewLoading(false);
    }
  };

  const gerarDocumentoModelo = async () => {
    if (!modeloDocumentoId) {
      showToast("Selecione um modelo de documento.", "error");
      return;
    }
    setDocGerarLoading(true);
    try {
      const res = await fetch(`/api/comercial/leads/${encodeURIComponent(lead.id)}/documento-gerado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modeloId: modeloDocumentoId }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: {
          preview?: DocumentoPreviewPayload;
        };
        error?: { message?: string };
      };
      if (!res.ok || !json.success || !json.data?.preview) {
        showToast(json.error?.message ?? "Não foi possível gerar e registrar o documento.", "error");
        return;
      }
      setDocPreview(json.data.preview);
      setDocPreviewOpen(true);
      onGerarPdfSuccess();
      const docsRes = await fetch(`/api/comercial/leads/${encodeURIComponent(lead.id)}/documentos-gerados`, {
        cache: "no-store",
      });
      const docsJson = (await docsRes.json().catch(() => ({}))) as {
        success?: boolean;
        data?: { documentos?: DocumentoGeradoListaItem[] };
      };
      if (docsRes.ok && docsJson.success && Array.isArray(docsJson.data?.documentos)) {
        setDocsGerados(docsJson.data.documentos);
      }
      showToast("Documento gerado e registrado com sucesso.", "success");
    } finally {
      setDocGerarLoading(false);
    }
  };

  const abrirDocumentoPdf = (docId: string) => {
    window.open(
      `/api/comercial/leads/${encodeURIComponent(lead.id)}/documentos-gerados/${encodeURIComponent(docId)}/pdf`,
      "_blank"
    );
  };

  const baixarDocumentoPdf = (docId: string) => {
    window.open(
      `/api/comercial/leads/${encodeURIComponent(lead.id)}/documentos-gerados/${encodeURIComponent(docId)}/pdf?download=1`,
      "_blank"
    );
  };

  const enviarDocumentoPorEmail = async (docId: string, toEmail: string) => {
    const dest = toEmail.trim().toLowerCase();
    if (!emailValido(dest)) {
      showToast("E-mail do contato inválido para envio.", "error");
      return;
    }
    const key = `${docId}|${dest}`;
    setEnviandoEmailKey(key);
    try {
      const res = await fetch(
        `/api/comercial/leads/${encodeURIComponent(lead.id)}/documentos-gerados/${encodeURIComponent(docId)}/enviar-email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toEmail: dest }),
        }
      );
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
      if (!res.ok || !json.success) {
        showToast(json.error?.message ?? "Não foi possível enviar o documento por e-mail.", "error");
        return;
      }
      showToast(
        "E-mail enviado com anexo em PDF. Se o destino for Gmail, verifique também o spam nas primeiras remessas.",
        "success"
      );
    } finally {
      setEnviandoEmailKey(null);
    }
  };

  const confirmarAbrirWhatsapp = () => {
    const ctx = whatsConfirm;
    if (!ctx) return;
    const { doc, dest } = ctx;
    const tel = sanitizeTelefoneWhatsapp(dest.telefone);
    if (!tel) {
      showToast("Este contato não possui telefone válido para WhatsApp.", "error");
      setWhatsConfirm(null);
      return;
    }
    const pdfUrl = `${window.location.origin}/api/comercial/leads/${encodeURIComponent(lead.id)}/documentos-gerados/${encodeURIComponent(doc.id)}/pdf`;
    const clienteNome =
      lead.company?.trim() ||
      lead.entidade?.trim() ||
      lead.contact?.trim() ||
      lead.name?.trim() ||
      "";
    const prazoValidade = lead.previsaoFechamento
      ? new Date(`${lead.previsaoFechamento}T12:00:00`).toLocaleDateString("pt-BR")
      : new Date(new Date(doc.date).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR");
    const mensagem = montarMensagemWhatsappDocumento({
      nomeContato: dest.nome,
      leadNome: lead.name ?? "Lead",
      clienteNome,
      modeloNome: doc.modelo.nome,
      assunto: doc.assunto,
      dataIso: doc.date,
      valorTotal: lead.valorTotal ?? lead.value ?? 0,
      prazoValidade,
      pdfUrl,
    });
    const url = `https://wa.me/${tel}?text=${encodeURIComponent(mensagem)}`;
    const log: LeadInteraction = {
      id: createLogId(),
      date: new Date().toISOString(),
      user: currentUserName,
      userId: currentUserId,
      type: "proposta",
      action: "UPDATE",
      description: `Abertura do WhatsApp para envio do documento "${doc.assunto || doc.modelo.nome}" para ${dest.nome} (${dest.telefone}).`,
      field: "documentoEnvioWhatsapp",
      fieldKey: doc.id,
      newValue: {
        canal: "whatsapp",
        status: "abertura_solicitada",
        toTelefone: dest.telefone,
        docId: doc.id,
        contatoNome: dest.nome,
      },
    };
    onUpdateLead({
      interactions: [...(lead.interactions ?? []), log],
    });
    window.open(url, "_blank");
    showToast("WhatsApp aberto com mensagem e link único do PDF.", "success");
    setWhatsConfirm(null);
  };

  const nomeSolucaoRemocao =
    solucaoIdxParaRemover !== null
      ? solucoesNaOportunidade[solucaoIdxParaRemover]?.nome ?? "esta solução"
      : "";

  const needsPrevisaoFechamento =
    lead.stageId === "proposta" || lead.stageId === "contratacao";

  return (
    <>
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <p className="text-sm text-slate-600">
        Adicione <strong>uma ou mais</strong> soluções; ao escolher no catálogo, o sistema traz valor e forma de
        pagamento sugeridos (mensal, única ou parcelado). Você pode ajustar cada linha na lista abaixo.
      </p>

      {needsPrevisaoFechamento && (
        <div className="space-y-1">
          <FormDateField
            id="lead-previsao-fechamento-proposta"
            label="Previsão de fechamento"
            required
            className="max-w-xs"
            value={lead.previsaoFechamento ?? ""}
            onChange={(v) => {
              const trimmed = v.trim();
              onUpdateLead(
                { previsaoFechamento: trimmed ? trimmed : undefined },
                { skipSuccessToast: true }
              );
            }}
            placeholder="Selecione a data"
          />
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Obrigatória para avançar o funil a partir da proposta.
          </p>
        </div>
      )}

      <div>
        <label className={comercialLabelClass}>Buscar solução para adicionar</label>
        {disponiveis.length === 0 ? (
          <p className="text-sm text-slate-500">Todas as soluções já foram adicionadas.</p>
        ) : (
          <SearchableSelect
            options={solucoesDisponiveisOptions}
            value={addingId ?? ""}
            onChange={(v) => setAddingId(v || null)}
            placeholder="Selecione uma solução..."
            searchPlaceholder="Filtrar solução..."
            emptyLabel="Nenhuma solução disponível."
            leadingIcon={FileText}
          />
        )}
        {addingId && selectedCatalog && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-900">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex w-full min-w-0 items-center gap-2 text-sm font-medium text-slate-800">
                {selectedCatalog.logoUrl?.trim() ? (
                  <img
                    src={selectedCatalog.logoUrl.trim()}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded object-contain"
                  />
                ) : null}
                <span className="min-w-0">{selectedCatalog.nome}</span>
              </div>
              <p className="w-full text-xs text-slate-500">
                Referência do catálogo: {REC_COMERCIAL_LABEL[selectedCatalog.recorrencia]}
                {selectedCatalog.recorrencia === "parcelado"
                  ? ` · ${selectedCatalog.parcelasPadrao ?? 12} parcelas`
                  : ""}
                . Ajustável após incluir na oportunidade.
              </p>
              <div className="min-w-0 flex-1">
                <label className={comercialLabelClass}>Valor (R$) — apenas números</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={valorMasked}
                  onChange={(e) => onChangeDigits(e.target.value)}
                  placeholder={formatCurrency(selectedCatalog.valorVenda)}
                  className={`${comercialInputCompactClass} font-mono tabular-nums`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <label className={comercialLabelClass}>Condições de pagamento *</label>
                <input
                  type="text"
                  value={condicoesStr}
                  onChange={(e) => setCondicoesStr(e.target.value)}
                  placeholder="Ex: 50% à vista, 50% em 30 dias"
                  className={comercialInputCompactClass}
                />
              </div>
              <button
                type="button"
                onClick={() => addSolucao(selectedCatalog.id)}
                disabled={!condicoesStr.trim()}
                className="rounded-lg bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-slate-900"
              >
                Adicionar
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingId(null);
                  setCondicoesStr("");
                }}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Soluções na oportunidade</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Cada linha é um item da proposta; ajuste pagamento e parcelas por solução.
          </p>
        </div>
        {solucoesNaOportunidade.length === 0 ? (
          <p className="py-2 text-sm text-slate-500 dark:text-slate-400">Nenhuma solução adicionada ainda.</p>
        ) : (
          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-600 dark:border-slate-600 dark:bg-slate-900">
            {solucoesNaOportunidade.map((s, idx) => (
              <div key={s.id} className="px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-1 gap-3">
                    {s.logoUrl?.trim() ? (
                      <img
                        src={s.logoUrl.trim()}
                        alt=""
                        className="mt-0.5 h-10 w-10 shrink-0 rounded-lg border border-slate-100 bg-white object-contain dark:border-slate-600"
                      />
                    ) : (
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-[10px] font-medium text-slate-400 dark:border-slate-600 dark:bg-slate-800">
                        —
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug text-slate-900 dark:text-slate-100">{s.nome}</p>
                      {s.valor != null && (
                        <p className="mt-1 text-sm font-medium tabular-nums text-slate-700 dark:text-slate-200">
                          {formatCurrency(s.valor)}
                        </p>
                      )}
                      {s.condicoesPagamento ? (
                        <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                          <span className="font-medium text-slate-500 dark:text-slate-500">Condições: </span>
                          {s.condicoesPagamento}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSolucaoIdxParaRemover(idx)}
                    className="shrink-0 self-start rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                    aria-label="Remover solução"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:mt-3 sm:flex-row sm:items-end">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Pagamento (negociação)
                    </span>
                    <SearchableSelect
                      fullWidth={false}
                      options={PAGAMENTO_NEGOCIACAO_OPTIONS}
                      value={s.recorrenciaPagamento ?? "unica"}
                      onChange={(v) => {
                        const r = v as LeadRecorrenciaPagamento;
                        patchSolucao(idx, {
                          recorrenciaPagamento: r,
                          parcelas: r === "parcelado" ? Math.max(2, s.parcelas ?? 12) : null,
                        });
                      }}
                      placeholder="Selecione…"
                      searchPlaceholder="Buscar…"
                      searchable={false}
                      leadingIcon={Wallet}
                    />
                  </div>
                  {(s.recorrenciaPagamento ?? "unica") === "parcelado" && (
                    <div className="w-full shrink-0 sm:w-[7.5rem]">
                      <label className={comercialLabelClass}>Parcelas</label>
                      <input
                        type="number"
                        min={2}
                        max={60}
                        value={Math.max(2, s.parcelas ?? 12)}
                        onChange={(e) =>
                          patchSolucao(idx, {
                            parcelas: Math.min(60, Math.max(2, parseInt(e.target.value, 10) || 2)),
                          })
                        }
                        className={`${comercialInputCompactClass} w-full`}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {valorTotal > 0 && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-600">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Total da oportunidade
            </span>
            <span className="text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {formatCurrency(valorTotal)}
            </span>
          </div>
        )}
      </div>

      {modelosDocumento.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
            Documento a partir de modelo
          </h3>
          <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
            Usa os dados desta oportunidade e do cliente vinculado (quando houver) para preencher as variáveis do
            modelo criado em Configurações → Construtor de Documentos.
          </p>
          <div className="space-y-3">
            <div className="w-full">
              <label className={comercialLabelClass}>
                Modelo ativo
              </label>
              <SearchableSelect
                options={modeloDocumentoOptions}
                value={modeloDocumentoId}
                onChange={setModeloDocumentoId}
                placeholder="Selecione…"
                searchPlaceholder="Buscar modelo…"
                emptyLabel="Nenhum modelo encontrado."
                leadingIcon={FileText}
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => void visualizarDocumentoModelo()}
                disabled={docPreviewLoading || !modeloDocumentoId}
                className="inline-flex min-h-[2.625rem] min-w-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {docPreviewLoading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0" />
                )}
                <span className="min-w-0">Visualizar prévia</span>
              </button>
              <button
                type="button"
                onClick={() => void gerarDocumentoModelo()}
                disabled={docGerarLoading || !modeloDocumentoId}
                className="inline-flex min-h-[2.625rem] min-w-0 items-center justify-center gap-2 rounded-lg bg-[#6D28D9] px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {docGerarLoading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <FileDown className="h-4 w-4 shrink-0" />
                )}
                <span className="min-w-0">Gerar e registrar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Documentos já gerados</h3>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Use os contatos do cliente e da oportunidade abaixo para escolher o destinatário, envie por WhatsApp com mensagem
          padrão prévia ou por e-mail.
        </p>
        {docDestinatarios.length === 0 && docsGerados.length > 0 ? (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
            Nenhum contato com e-mail ou telefone encontrado. Cadastre contatos no cliente (aba Dados gerais) ou na
            oportunidade.
          </p>
        ) : null}
        {docsGeradosLoading ? (
          <p className="mt-3 text-sm text-slate-500">Carregando documentos…</p>
        ) : docsGerados.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nenhum documento gerado ainda para este lead.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {docsGerados.map((d) => (
              <li key={d.id} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2 dark:border-slate-600/80">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {d.assunto || "(sem assunto)"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {d.modelo.nome} ({TIPO_MODELO_DOC_LABEL[d.modelo.tipo] ?? d.modelo.tipo}) ·{" "}
                      {new Date(d.date).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => abrirDocumentoPdf(d.id)}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                      Abrir PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => baixarDocumentoPdf(d.id)}
                      className="rounded border border-[#6D28D9] bg-white px-2 py-1 text-xs text-[#6D28D9] hover:bg-violet-50 dark:border-violet-500 dark:bg-slate-900 dark:text-violet-300 dark:hover:bg-slate-800"
                    >
                      Baixar PDF
                    </button>
                  </div>
                </div>
                <p className="mb-2 mt-3 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Enviar este documento
                </p>
                <div className="overflow-x-auto rounded border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900">
                  <table className="w-full min-w-[520px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/80">
                        <th className="px-2 py-1.5 font-medium text-slate-600 dark:text-slate-300">Contato</th>
                        <th className="px-2 py-1.5 font-medium text-slate-600 dark:text-slate-300">Origem</th>
                        <th className="px-2 py-1.5 font-medium text-slate-600 dark:text-slate-300">E-mail</th>
                        <th className="px-2 py-1.5 font-medium text-slate-600 dark:text-slate-300">Telefone</th>
                        <th className="px-2 py-1.5 font-medium text-slate-600 dark:text-slate-300">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docDestinatarios.map((ct) => {
                        const emailKey = `${d.id}|${ct.email.trim().toLowerCase()}`;
                        const sending = enviandoEmailKey === emailKey;
                        return (
                          <tr
                            key={`${d.id}-${ct.key}`}
                            className="border-b border-slate-100 last:border-0 dark:border-slate-700/80"
                          >
                            <td className="px-2 py-1.5 font-medium text-slate-800 dark:text-slate-100">{ct.nome}</td>
                            <td className="px-2 py-1.5 text-slate-600 dark:text-slate-400">{ct.origemLabel}</td>
                            <td className="px-2 py-1.5 text-slate-700 dark:text-slate-300">
                              {ct.email.trim() || "—"}
                            </td>
                            <td className="px-2 py-1.5 text-slate-700 dark:text-slate-300">
                              {ct.telefone.trim() || "—"}
                            </td>
                            <td className="px-2 py-1.5">
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  onClick={() => void enviarDocumentoPorEmail(d.id, ct.email)}
                                  disabled={!emailValido(ct.email) || sending}
                                  className="rounded border border-emerald-300 bg-white px-2 py-0.5 text-[11px] text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-200 dark:hover:bg-slate-800"
                                >
                                  {sending ? "Enviando…" : "E-mail"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!sanitizeTelefoneWhatsapp(ct.telefone)) {
                                      showToast("Telefone inválido para WhatsApp neste contato.", "error");
                                      return;
                                    }
                                    setWhatsConfirm({ doc: d, dest: ct });
                                  }}
                                  disabled={!sanitizeTelefoneWhatsapp(ct.telefone)}
                                  className="rounded border border-green-300 bg-white px-2 py-0.5 text-[11px] text-green-800 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-green-800 dark:bg-slate-900 dark:text-green-200 dark:hover:bg-slate-800"
                                >
                                  WhatsApp
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
    <DrawerSheet
      open={docPreviewOpen}
      onClose={() => {
        setDocPreviewOpen(false);
        setDocPreview(null);
      }}
      title="Pré-visualização do documento"
      maxWidth="sm:max-w-3xl"
    >
      {docPreview ? (
        <div className="space-y-4 p-1">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-900">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Assunto</p>
            <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">{docPreview.assunto || "(sem assunto)"}</p>
          </div>
          {docPreview.cabecalhoHtml?.trim() ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-900">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Cabeçalho</p>
              <div
                className={PREVIEW_DOC_CLASS}
                dangerouslySetInnerHTML={{ __html: docPreview.cabecalhoHtml }}
              />
            </div>
          ) : null}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-900">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Corpo</p>
            <div className={PREVIEW_DOC_CLASS} dangerouslySetInnerHTML={{ __html: docPreview.corpoHtml }} />
          </div>
          {docPreview.rodapeHtml?.trim() ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-900">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Rodapé</p>
              <div
                className={PREVIEW_DOC_CLASS}
                dangerouslySetInnerHTML={{ __html: docPreview.rodapeHtml }}
              />
            </div>
          ) : null}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Esta visualização não altera o lead. Após gerar e registrar, o PDF fica disponível na lista abaixo para envio e
            download.
          </p>
        </div>
      ) : null}
    </DrawerSheet>

    <AlertDialog
      open={Boolean(whatsConfirm)}
      onClose={() => setWhatsConfirm(null)}
      onConfirm={() => confirmarAbrirWhatsapp()}
      title="Deseja abrir o WhatsApp para envio?"
      description={
        whatsConfirm ? (
          <>
            O WhatsApp será aberto com uma mensagem comercial e{" "}
            <strong className="text-slate-900 dark:text-slate-100">um único link em PDF</strong> para{" "}
            <strong className="text-slate-900 dark:text-slate-100">{whatsConfirm.dest.nome}</strong>, referente ao
            documento{" "}
            <strong className="text-slate-900 dark:text-slate-100">
              {whatsConfirm.doc.assunto || whatsConfirm.doc.modelo.nome}
            </strong>
            .
          </>
        ) : null
      }
      cancelLabel="Cancelar"
      confirmLabel="Sim, abrir WhatsApp"
    />
    <AlertDialog
      open={solucaoIdxParaRemover !== null}
      onClose={() => setSolucaoIdxParaRemover(null)}
      onConfirm={() => {
        if (solucaoIdxParaRemover !== null) removeSolucao(solucaoIdxParaRemover);
      }}
      title="Remover solução da oportunidade?"
      description={
        solucaoIdxParaRemover !== null ? (
          <>
            <strong className="text-slate-900 dark:text-slate-100">Esta ação é irreversível ao salvar o lead:</strong> a
            solução <strong className="text-slate-900 dark:text-slate-100">{nomeSolucaoRemocao}</strong> e o valor
            associado serão retirados da proposta.
          </>
        ) : null
      }
      cancelLabel="Cancelar"
      confirmLabel="Sim, remover permanentemente"
      destructive
    />
    <Toast
      visible={toast.visible}
      message={toast.message}
      variant={toast.variant}
      duration={toast.variant === "error" ? 7000 : 3000}
      onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
    />
    </>
  );
}
