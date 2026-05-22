import type { NextResponse } from "next/server";
import type { SessionPayload } from "@/lib/auth";
import type { Lead } from "@/lib/comercial/types";
import type { PermissionAction } from "@/lib/configuracoes/permission-catalog";
import { authorize } from "@/lib/server/authorize";
import { fail } from "@/lib/server/api-response";
import { getRequestSession, getSessionUserId } from "@/lib/server/request-session";
import { prisma } from "@/lib/prisma";
import { mapLeadFromDb } from "@/app/api/comercial/_shared";
import {
  filterLeadsForResourceScope,
  isLeadVisibleToUser,
  userCanAccessLeadId,
} from "@/lib/server/lead-access";

export { isLeadVisibleToUser } from "@/lib/server/lead-access";

export const COMERCIAL_PIPELINE_RESOURCE = "comercial.pipeline";

const LEAD_INCLUDE = {
  criadoPor: { select: { nomeExibicao: true } },
  atualizadoPor: { select: { nomeExibicao: true } },
  solucoes: { include: { solucaoCatalogo: true } },
  contatos: { include: { papeis: true } },
  checklistItems: true,
  contratoChecklist: true,
  contratoArquivos: true,
  financeiroFluxo: true,
  interactions: { include: { user: true, anexos: true }, orderBy: { date: "asc" as const } },
};

export function filterLeadsForSession(
  leads: Lead[],
  session: SessionPayload,
  userId: string | null | undefined
): Lead[] {
  return filterLeadsForResourceScope(leads, session, userId, COMERCIAL_PIPELINE_RESOURCE);
}

type AccessGateOk = {
  ok: true;
  session: SessionPayload;
  userId: string | null;
};

type AccessGateDenied = {
  ok: false;
  response: NextResponse;
};

export type ComercialAccessGate = AccessGateOk | AccessGateDenied;

export async function comercialAccessGate(
  req: Request,
  action: PermissionAction,
  leadId?: string
): Promise<ComercialAccessGate> {
  const session = await getRequestSession(req);
  if (!session?.perfilId) {
    return { ok: false, response: fail("UNAUTHORIZED", "Sessão inválida.", 401) };
  }

  const auth = authorize(session, COMERCIAL_PIPELINE_RESOURCE, action);
  if (!auth.allowed) {
    return {
      ok: false,
      response: fail("FORBIDDEN", "Sem permissão para esta ação no Comercial.", 403),
    };
  }

  const userId = getSessionUserId(req);

  if (leadId && auth.scope === "vinculados") {
    const row = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
    if (!row) {
      return { ok: false, response: fail("NOT_FOUND", "Lead não encontrado.", 404) };
    }
    const ok = await userCanAccessLeadId(userId, leadId, auth.scope);
    if (!ok) {
      return {
        ok: false,
        response: fail("FORBIDDEN", "Você não tem acesso a este lead.", 403),
      };
    }
  }

  return { ok: true, session, userId };
}
