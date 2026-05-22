import type { SessionPayload } from "@/lib/auth";
import type { PermissionAction } from "@/lib/configuracoes/permission-catalog";
import { authorize, type DataScope } from "@/lib/server/authorize";
import { fail } from "@/lib/server/api-response";
import { accessibleLeadIdsAmong } from "@/lib/server/lead-access";
import { prisma } from "@/lib/prisma";
import { resourceAccessGate, type ResourceAccessGate } from "@/lib/server/rbac-gate";

export const CLIENTES_CADASTRO_RESOURCE = "clientes.cadastro";

type ClienteRowRef = {
  id: string;
  criadoPorId?: string | null;
};

/** IDs de clientes visíveis no escopo vinculados (leads do usuário + criados por ele). */
export async function accessibleClienteIdsForUser(
  userId: string | null,
  scope: DataScope
): Promise<Set<string> | "all"> {
  if (scope === "todos") return "all";
  if (!userId) return new Set();

  const ids = new Set<string>();

  const criados = await prisma.cliente.findMany({
    where: { criadoPorId: userId },
    select: { id: true },
  });
  criados.forEach((c) => ids.add(c.id));

  const leadsComCliente = await prisma.lead.findMany({
    where: { clienteId: { not: null } },
    select: { id: true, clienteId: true },
  });
  const leadIds = leadsComCliente.map((l) => l.id);
  const allowedLeads = await accessibleLeadIdsAmong(userId, leadIds, scope);
  for (const l of leadsComCliente) {
    if (l.clienteId && allowedLeads.has(l.id)) ids.add(l.clienteId);
  }

  return ids;
}

export async function userCanAccessClienteId(
  userId: string | null,
  clienteId: string,
  scope: DataScope
): Promise<boolean> {
  if (scope === "todos") return true;
  const allowed = await accessibleClienteIdsForUser(userId, scope);
  if (allowed === "all") return true;
  return allowed.has(clienteId);
}

export async function filterClientesForSession<T extends ClienteRowRef>(
  rows: T[],
  userId: string | null,
  scope: DataScope
): Promise<T[]> {
  if (scope === "todos") return rows;
  const allowed = await accessibleClienteIdsForUser(userId, scope);
  if (allowed === "all") return rows;
  return rows.filter((c) => allowed.has(c.id));
}

export async function clientesAccessGate(
  req: Request,
  action: PermissionAction,
  clienteId?: string
): Promise<ResourceAccessGate> {
  const gate = await resourceAccessGate(
    req,
    CLIENTES_CADASTRO_RESOURCE,
    action,
    "Sem permissão para esta ação em Clientes."
  );
  if (!gate.ok) return gate;

  if (clienteId && gate.scope === "vinculados") {
    const row = await prisma.cliente.findUnique({
      where: { id: clienteId },
      select: { id: true, criadoPorId: true },
    });
    if (!row) {
      return { ok: false, response: fail("NOT_FOUND", "Cliente não encontrado.", 404) };
    }
    const ok = await userCanAccessClienteId(gate.userId, clienteId, gate.scope);
    if (!ok) {
      return {
        ok: false,
        response: fail("FORBIDDEN", "Você não tem acesso a este cliente.", 403),
      };
    }
  }

  return gate;
}

export function filterClientesForResourceScope<T extends ClienteRowRef>(
  rows: T[],
  session: SessionPayload,
  userId: string | null | undefined,
  resourceId: string = CLIENTES_CADASTRO_RESOURCE
): Promise<T[]> {
  const view = authorize(session, resourceId, "ver");
  if (!view.allowed) return Promise.resolve([]);
  return filterClientesForSession(rows, userId ?? null, view.scope);
}
