import { cookies } from "next/headers";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadSessionPermissions } from "@/lib/server/session-permissions";
import { getFinanceiroRedirectTarget } from "@/lib/financeiro/financeiro-nav";
import type { ClientAuthSession } from "@/lib/configuracoes/permission-client";

export async function resolveFinanceiroAuthSession(): Promise<ClientAuthSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  const session = decodeSession(raw);
  if (!session?.perfilId) return null;

  try {
    const resolved = await loadSessionPermissions(prisma, session.perfilId);
    return {
      isSystemAdmin: resolved.isSystemAdmin,
      perfilNome: resolved.perfilNome,
      permissoes: resolved.permissoes,
      permissoesGranulares: resolved.grants,
    };
  } catch {
    return {
      isSystemAdmin: session.isSystemAdmin,
      perfilNome: session.perfilNome,
      permissoes: session.permissoes,
    };
  }
}

export async function getServerFinanceiroRedirect(pathname: string): Promise<string | null> {
  const auth = await resolveFinanceiroAuthSession();
  if (!auth) return "/login";
  return getFinanceiroRedirectTarget(pathname, auth);
}
