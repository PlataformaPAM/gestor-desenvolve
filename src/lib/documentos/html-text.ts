/**
 * Conteúdo legado sem tags vira um único parágrafo para o editor rico.
 */
export function htmlOuParagrafoSimples(raw: string): string {
  const t = raw?.trim() ?? "";
  if (!t) return "<p></p>";
  if (t.includes("<")) return raw;
  const esc = t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return "<p>" + esc + "</p>";
}

/** Verifica se há texto visível (ignora tags e &nbsp;). */
export function htmlTemTextoVisivel(html: string): boolean {
  if (!html?.trim()) return false;
  const t = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > 0;
}
