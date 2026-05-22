import type { NextResponse } from "next/server";
import type { SessionPayload } from "@/lib/auth";
import type { PermissionAction } from "@/lib/configuracoes/permission-catalog";
import { authorize, type DataScope } from "@/lib/server/authorize";
import { fail } from "@/lib/server/api-response";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/server/audit-log";
import { getRequestSession, getSessionUserId } from "@/lib/server/request-session";

type AccessGateOk = {
  ok: true;
  session: SessionPayload;
  userId: string | null;
  scope: DataScope;
};

type AccessGateDenied = {
  ok: false;
  response: NextResponse;
};

export type ResourceAccessGate = AccessGateOk | AccessGateDenied;

export async function resourceAccessGate(
  req: Request,
  resourceId: string,
  action: PermissionAction,
  forbiddenMessage = "Sem permissão para esta ação."
): Promise<ResourceAccessGate> {
  const session = await getRequestSession(req);
  if (!session?.perfilId) {
    return { ok: false, response: fail("UNAUTHORIZED", "Sessão inválida.", 401) };
  }

  const auth = authorize(session, resourceId, action);
  if (!auth.allowed) {
    void logRbacDenial(session, resourceId, action, getSessionUserId(req));
    return { ok: false, response: fail("FORBIDDEN", forbiddenMessage, 403) };
  }

  return {
    ok: true,
    session,
    userId: getSessionUserId(req),
    scope: auth.scope,
  };
}

async function logRbacDenial(
  session: SessionPayload,
  resourceId: string,
  action: PermissionAction,
  userId: string | null
): Promise<void> {
  try {
    await writeAuditLog(prisma, {
      usuarioId: userId,
      acao: "RBAC negado",
      modulo: "sistema",
      detalhes: `${action} · ${resourceId} · perfil ${session.perfilNome ?? session.perfilId}`,
    });
  } catch {
    // auditoria não bloqueia resposta 403
  }
}
