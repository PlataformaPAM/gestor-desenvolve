export type DocumentoSnapshot = {
  assunto: string;
  cabecalhoHtml: string;
  corpoHtml: string;
  rodapeHtml: string;
};

function baseCss(): string {
  return `
    :root { color-scheme: light; }
    body { margin: 0; font-family: Arial, sans-serif; color: #0f172a; background: #fff; }
    .page { max-width: 900px; margin: 0 auto; padding: 28px 24px; }
    .assunto { margin: 0 0 18px; font-size: 18px; font-weight: 700; }
    .bloco { margin-bottom: 16px; }
    .bloco img { max-height: 110px; width: auto; }
    .bloco p { margin: 0 0 8px; }
    .bloco ul, .bloco ol { margin: 0 0 8px 22px; }
    .bloco hr { margin: 14px 0; border: 0; border-top: 1px solid #cbd5e1; }
    .footer { margin-top: 18px; padding-top: 12px; border-top: 1px solid #e2e8f0; color: #334155; }
    @media print {
      .page { max-width: 100%; padding: 10mm; }
      @page { margin: 10mm; }
    }
  `;
}

export function montarDocumentoHtmlCompleto(params: {
  title: string;
  modeloNome: string;
  snapshot: DocumentoSnapshot;
  geradoEmIso: string;
  autoPrint?: boolean;
}): string {
  const { title, modeloNome, snapshot, geradoEmIso, autoPrint = false } = params;
  const data = new Date(geradoEmIso);
  const carimbo = Number.isNaN(data.getTime()) ? geradoEmIso : data.toLocaleString("pt-BR");
  const printScript = autoPrint
    ? `<script>window.addEventListener("load",()=>{setTimeout(()=>window.print(),120);});</script>`
    : "";
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
  <style>${baseCss()}</style>
  ${printScript}
</head>
<body>
  <main class="page">
    <h1 class="assunto">${snapshot.assunto || "(sem assunto)"}</h1>
    ${snapshot.cabecalhoHtml ? `<section class="bloco">${snapshot.cabecalhoHtml}</section>` : ""}
    <section class="bloco">${snapshot.corpoHtml || "<p>(sem conteúdo)</p>"}</section>
    ${snapshot.rodapeHtml ? `<section class="bloco footer">${snapshot.rodapeHtml}</section>` : ""}
    <p style="margin-top:18px;font-size:12px;color:#64748b;">
      Documento gerado pelo modelo "${modeloNome}" em ${carimbo}.
    </p>
  </main>
</body>
</html>`;
}
