import type { DocumentoLayoutModo, EmpresaDocumentoConfig } from "@/lib/documentos/empresa-config";

export type DocumentoSnapshot = {
  assunto: string;
  cabecalhoHtml: string;
  corpoHtml: string;
  rodapeHtml: string;
  timbreUrl?: string;
  renderConfig?: Partial<DocumentoRenderConfig>;
};

type DocumentoRenderConfig = Pick<
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

function cssByLayout(cfg: DocumentoRenderConfig): string {
  const padTop = cfg.margemTopMm + (cfg.layoutModo === "header_footer" || cfg.layoutModo === "hybrid" ? cfg.headerHeightMm : 0);
  const padBottom =
    cfg.margemBottomMm + (cfg.layoutModo === "header_footer" || cfg.layoutModo === "hybrid" ? cfg.footerHeightMm : 0);
  const hasBackground = (cfg.layoutModo === "background" || cfg.layoutModo === "hybrid") && Boolean(cfg.papelTimbradoUrl);

  const backgroundLayer =
    hasBackground
      ? `
    .page-watermark {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 0;
      opacity: ${cfg.papelTimbradoOpacity};
      display: block;
    }
    .page-watermark img {
      width: 100%;
      height: 100%;
      object-fit: fill;
      object-position: center top;
      display: block;
    }`
      : `
    .page-watermark { display: none; }`;

  const headerFooterLayer =
    cfg.layoutModo === "header_footer" || cfg.layoutModo === "hybrid"
      ? `
    .layout-header {
      position: fixed;
      top: ${cfg.margemTopMm}mm;
      left: ${cfg.margemLeftMm}mm;
      right: ${cfg.margemRightMm}mm;
      min-height: ${cfg.headerHeightMm}mm;
      z-index: 2;
    }
    .layout-footer {
      position: fixed;
      bottom: ${cfg.margemBottomMm}mm;
      left: ${cfg.margemLeftMm}mm;
      right: ${cfg.margemRightMm}mm;
      min-height: ${cfg.footerHeightMm}mm;
      z-index: 2;
    }
    .layout-header img, .layout-footer img { max-height: 80px; width: auto; }`
      : `
    .layout-header, .layout-footer { display: none; }`;

  return `
    @page {
      size: A4 portrait;
      margin: 0;
    }
    .doc-pages {
      width: 210mm;
      margin: 0 auto;
    }
    .page {
      width: 210mm;
      max-width: 210mm;
      height: 297mm;
      margin: 0 auto 8px;
      position: relative;
      z-index: 0;
      overflow: hidden;
      box-sizing: border-box;
      break-after: page;
      page-break-after: always;
      background: #fff;
      box-shadow: 0 0 0 1px #d1d5db;
    }
    .page:last-child {
      break-after: auto;
      page-break-after: auto;
    }
    .page-content {
      position: absolute;
      top: ${padTop}mm;
      right: ${cfg.margemRightMm}mm;
      bottom: calc(${padBottom}mm + 7mm);
      left: ${cfg.margemLeftMm}mm;
      z-index: 1;
      overflow: hidden;
    }
    .doc-generated-note {
      position: absolute;
      left: ${cfg.margemLeftMm}mm;
      right: ${cfg.margemRightMm}mm;
      bottom: calc(${cfg.margemBottomMm}mm + 3.5mm);
      z-index: 2;
      display: none;
      font-size: 12px;
      color: #64748b;
      font-style: italic;
      line-height: 1.2;
    }
    ${backgroundLayer}
    ${headerFooterLayer}
  `;
}

function baseCss(cfg: DocumentoRenderConfig): string {
  return `
    :root { color-scheme: light; }
    body { margin: 0; font-family: Arial, sans-serif; color: #0f172a; background: #e5e7eb; }
    .assunto { margin: 0 0 18px; font-size: 18px; font-weight: 700; }
    .bloco { margin-bottom: 16px; }
    .bloco img { max-height: 110px; width: auto; }
    .bloco p { margin: 0 0 8px; }
    .bloco ul, .bloco ol { margin: 0 0 8px 22px; }
    .bloco hr { margin: 14px 0; border: 0; border-top: 1px solid #cbd5e1; }
    .footer { margin-top: 18px; padding-top: 12px; border-top: 1px solid #e2e8f0; color: #334155; }
    ${cssByLayout(cfg)}
    @media screen {
      body { padding: 8px 0; }
    }
    @media print {
      html, body { width: 210mm; background: #fff; }
      body { padding: 0; }
      .doc-pages { margin: 0; width: 210mm; }
      .page {
        width: 210mm;
        max-width: 210mm;
        height: 297mm;
        margin: 0;
        box-shadow: none;
      }
      .page-watermark {
        position: absolute;
        inset: 0;
      }
    }
  `;
}

export function montarDocumentoHtmlCompleto(params: {
  title: string;
  modeloNome: string;
  snapshot: DocumentoSnapshot;
  geradoEmIso: string;
  autoPrint?: boolean;
  renderConfig?: Partial<DocumentoRenderConfig>;
}): string {
  const { title, modeloNome, snapshot, geradoEmIso, autoPrint = false } = params;
  const snapshotTimbreUrl = snapshot.timbreUrl?.trim() || "";
  const configuredLayout = (params.renderConfig?.layoutModo as DocumentoLayoutModo | undefined) ?? "none";
  // Se o modelo trouxe timbrado próprio, aplica fundo mesmo com layout global "none".
  const effectiveLayoutModo: DocumentoLayoutModo =
    configuredLayout === "none" && snapshotTimbreUrl ? "background" : configuredLayout;
  const cfg: DocumentoRenderConfig = {
    layoutModo: effectiveLayoutModo,
    papelTimbradoUrl: snapshotTimbreUrl || params.renderConfig?.papelTimbradoUrl?.trim() || "",
    papelTimbradoOpacity: params.renderConfig?.papelTimbradoOpacity ?? 0.12,
    margemTopMm: params.renderConfig?.margemTopMm ?? 12,
    margemRightMm: params.renderConfig?.margemRightMm ?? 12,
    margemBottomMm: params.renderConfig?.margemBottomMm ?? 12,
    margemLeftMm: params.renderConfig?.margemLeftMm ?? 12,
    headerHeightMm: params.renderConfig?.headerHeightMm ?? 28,
    footerHeightMm: params.renderConfig?.footerHeightMm ?? 22,
  };
  const snapshotCfg = params.snapshot.renderConfig ?? {};
  if (snapshotCfg && typeof snapshotCfg === "object") {
    const snapshotLayout = (snapshotCfg.layoutModo as DocumentoLayoutModo | undefined) ?? cfg.layoutModo;
    // Se há timbrado no snapshot, evita perder o fundo por layout "none" vindo de config antiga.
    cfg.layoutModo = snapshot.timbreUrl?.trim() && snapshotLayout === "none" ? "background" : snapshotLayout;
    cfg.papelTimbradoUrl = snapshotCfg.papelTimbradoUrl?.trim() || cfg.papelTimbradoUrl;
    cfg.papelTimbradoOpacity = snapshotCfg.papelTimbradoOpacity ?? cfg.papelTimbradoOpacity;
    cfg.margemTopMm = snapshotCfg.margemTopMm ?? cfg.margemTopMm;
    cfg.margemRightMm = snapshotCfg.margemRightMm ?? cfg.margemRightMm;
    cfg.margemBottomMm = snapshotCfg.margemBottomMm ?? cfg.margemBottomMm;
    cfg.margemLeftMm = snapshotCfg.margemLeftMm ?? cfg.margemLeftMm;
    cfg.headerHeightMm = snapshotCfg.headerHeightMm ?? cfg.headerHeightMm;
    cfg.footerHeightMm = snapshotCfg.footerHeightMm ?? cfg.footerHeightMm;
  }

  const data = new Date(geradoEmIso);
  const carimbo = Number.isNaN(data.getTime()) ? geradoEmIso : data.toLocaleString("pt-BR");
  const printScript = autoPrint
    ? `<script>window.addEventListener("load",()=>{setTimeout(()=>window.print(),120);});</script>`
    : "";
  const timbreImgTag =
    (cfg.layoutModo === "background" || cfg.layoutModo === "hybrid") && cfg.papelTimbradoUrl
      ? `<img src="${cfg.papelTimbradoUrl.replace(/"/g, '\\"')}" alt="" />`
      : ``;
  const headerHtml =
    cfg.layoutModo === "header_footer" || cfg.layoutModo === "hybrid"
      ? `<header class="layout-header">${snapshot.cabecalhoHtml || ""}</header>`
      : "";
  const footerHtml =
    cfg.layoutModo === "header_footer" || cfg.layoutModo === "hybrid"
      ? `<footer class="layout-footer">${snapshot.rodapeHtml || ""}</footer>`
      : "";
  const sourceHtml = `
    <h1 class="assunto">${snapshot.assunto || "(sem assunto)"}</h1>
    ${cfg.layoutModo === "header_footer" || cfg.layoutModo === "hybrid" ? "" : snapshot.cabecalhoHtml ? `<section class="bloco">${snapshot.cabecalhoHtml}</section>` : ""}
    <section class="bloco">${snapshot.corpoHtml || "<p>(sem conteúdo)</p>"}</section>
    ${cfg.layoutModo === "header_footer" || cfg.layoutModo === "hybrid" ? "" : snapshot.rodapeHtml ? `<section class="bloco footer">${snapshot.rodapeHtml}</section>` : ""}`;
  const generatedNoteText = `Documento gerado pelo sistema Gestor Desenvolve - Sistema Integrado de Gestão em ${carimbo}.`;
  const paginateScript = `
  <script>
    (function () {
      function runPagination() {
        const root = document.getElementById("doc-pages");
        const source = document.getElementById("doc-flow-source");
        const template = document.getElementById("doc-page-template");
        if (!root || !source || !template) return;

        function createPage() {
          const fragment = template.content.cloneNode(true);
          root.appendChild(fragment);
          const page = root.lastElementChild;
          if (!page) return null;
          const content = page.querySelector(".page-content");
          if (!content) return null;
          return { page: page, content: content };
        }

        function fits(pageRef) {
          return pageRef.content.scrollHeight <= pageRef.content.clientHeight + 1;
        }

        function appendOrMove(pageRef, node) {
          pageRef.content.appendChild(node);
          if (fits(pageRef)) return pageRef;
          pageRef.content.removeChild(node);
          const nextPage = createPage();
          if (!nextPage) return pageRef;
          nextPage.content.appendChild(node);
          if (fits(nextPage)) return nextPage;

          // Evita corte quando um bloco grande estoura a página:
          // divide containers (section/div) em partes menores.
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node;
            const tag = el.tagName;
            if ((tag === "SECTION" || tag === "DIV") && el.children.length > 1) {
              nextPage.content.removeChild(el);
              let cursor = pageRef;
              const children = Array.from(el.children).map((c) => c.cloneNode(true));
              for (const child of children) {
                const part = el.cloneNode(false);
                part.appendChild(child);
                cursor = appendOrMove(cursor, part);
              }
              return cursor;
            }
          }

          return nextPage;
        }

        try {
          const rawNodes = Array.from(source.childNodes).map((n) => n.cloneNode(true));
          const sourceNodes = [];
          for (const n of rawNodes) {
            if (n.nodeType === Node.ELEMENT_NODE && n.tagName === "SECTION" && n.children.length > 1) {
              const chunks = Array.from(n.children).map((child) => {
                const part = n.cloneNode(false);
                part.appendChild(child.cloneNode(true));
                return part;
              });
              sourceNodes.push(...chunks);
            } else {
              sourceNodes.push(n);
            }
          }
          root.innerHTML = "";
          let current = createPage();
          if (!current) return;
          for (const node of sourceNodes) {
            current = appendOrMove(current, node);
          }
        const pages = Array.from(root.querySelectorAll(".page"));
        if (pages.length) {
          const lastPage = pages[pages.length - 1];
          const note = lastPage.querySelector(".doc-generated-note");
          if (note) note.style.display = "block";
        }
          if (!root.children.length) {
            const fallback = createPage();
            if (fallback) fallback.content.innerHTML = source.innerHTML;
          }
        } catch (_) {
          root.innerHTML = "";
          const fallback = createPage();
        if (fallback) {
          fallback.content.innerHTML = source.innerHTML;
          const note = fallback.page.querySelector(".doc-generated-note");
          if (note) note.style.display = "block";
        }
        }
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", runPagination, { once: true });
      } else {
        runPagination();
      }
    })();
  </script>`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
  <style>${baseCss(cfg)}</style>
  ${paginateScript}
  ${printScript}
</head>
<body>
  <template id="doc-page-template">
    <main class="page">
      <div class="page-watermark" aria-hidden="true">${timbreImgTag}</div>
      ${headerHtml}
      ${footerHtml}
      <div class="page-content"></div>
      <div class="doc-generated-note">${generatedNoteText}</div>
    </main>
  </template>
  <div id="doc-flow-source" style="display:none">${sourceHtml}</div>
  <div id="doc-pages" class="doc-pages"></div>
</body>
</html>`;
}
