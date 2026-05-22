import type { NextResponse } from "next/server";
import { accessibleLeadIdsAmong, userCanAccessLeadId } from "@/lib/server/lead-access";
import { resourceAccessGate, type ResourceAccessGate } from "@/lib/server/rbac-gate";
import { fail } from "@/lib/server/api-response";
import { prisma } from "@/lib/prisma";
import type { DataScope } from "@/lib/server/authorize";
import type { PermissionAction } from "@/lib/configuracoes/permission-catalog";

export const CONTRATOS_LISTA_RESOURCE = "contratos.lista";

type ContratoRowRef = {
  id: string;
  leadId: string | null;
  criadoPorId?: string | null;
};

export async function contratosAccessGate(
  req: Request,
  action: PermissionAction,
  contratoId?: string
): Promise<ResourceAccessGate> {
  const gate = await resourceAccessGate(
    req,
    CONTRATOS_LISTA_RESOURCE,
    action,
    "Sem permissão para esta ação em Contratos."
  );
  if (!gate.ok) return gate;

  if (contratoId && gate.scope === "vinculados") {
    const c = await prisma.contrato.findUnique({
      where: { id: contratoId },
      select: { id: true, leadId: true, criadoPorId: true },
    });
    if (!c) {
      return { ok: false, response: fail("NOT_FOUND", "Contrato não encontrado.", 404) };
    }
    if (!(await canViewContratoRef(c, gate.userId, gate.scope))) {
      return {
        ok: false,
        response: fail("FORBIDDEN", "Você não tem acesso a este contrato.", 403),
      };
    }
  }

  return gate;
}

export async function canViewContratoRef(
  c: ContratoRowRef,
  userId: string | null,
  scope: DataScope
): Promise<boolean> {
  if (scope === "todos") return true;
  if (c.leadId) {
    return userCanAccessLeadId(userId, c.leadId, scope);
  }
  return !!userId && c.criadoPorId === userId;
}

export async function filterContratosForSession<T extends ContratoRowRef>(
  rows: T[],
  userId: string | null,
  scope: DataScope
): Promise<T[]> {
  if (scope === "todos") return rows;
  const leadIds = rows.map((r) => r.leadId).filter((id): id is string => !!id);
  const allowedLeads = await accessibleLeadIdsAmong(userId, leadIds, scope);
  return rows.filter((c) => {
    if (c.leadId) return allowedLeads.has(c.leadId);
    return !!userId && c.criadoPorId === userId;
  });
}
