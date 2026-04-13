/**
 * URL pública da aplicação para links em e-mails (anexos / visualização).
 * Prefira definir NEXT_PUBLIC_APP_URL em produção (ex.: https://app.empresa.com.br).
 */
export function getPublicBaseUrl(req: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const hostDirect = host || req.headers.get("host")?.trim() || "";
  const protoHeader = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = protoHeader || "http";
  if (hostDirect) return `${proto}://${hostDirect}`;
  return "";
}
