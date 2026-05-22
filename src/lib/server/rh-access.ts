import type { PermissionAction } from "@/lib/configuracoes/permission-catalog";
import { authorize, type DataScope } from "@/lib/server/authorize";
import type { SessionPayload } from "@/lib/auth";
import { fail } from "@/lib/server/api-response";
import { prisma } from "@/lib/prisma";
import { resourceAccessGate, type ResourceAccessGate } from "@/lib/server/rbac-gate";

export const RH_COLABORADORES_RESOURCE = "rh.colaboradores";

/** Escopo vinculados: apenas o colaborador vinculado ao usuário logado (consultor/parceiro). */
export async function accessibleColaboradorIdsForUser(
  userId: string | null,
  scope: DataScope
): Promise<Set<string> | "all"> {
  if (scope === "todos") return "all";
  if (!userId) return new Set();

  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { vinculacaoPessoaId: true, vinculacaoTipo: true },
  });
  if (!usuario?.vinculacaoPessoaId || usuario.vinculacaoTipo !== "rh") {
    return new Set();
  }
  return new Set([usuario.vinculacaoPessoaId]);
}

export async function userCanAccessColaboradorId(
  userId: string | null,
  colaboradorId: string,
  scope: DataScope
): Promise<boolean> {
  if (scope === "todos") return true;
  const allowed = await accessibleColaboradorIdsForUser(userId, scope);
  if (allowed === "all") return true;
  return allowed.has(colaboradorId);
}

export async function filterColaboradoresForSession<T extends { id: string }>(
  rows: T[],
  userId: string | null,
  scope: DataScope
): Promise<T[]> {
  if (scope === "todos") return rows;
  const allowed = await accessibleColaboradorIdsForUser(userId, scope);
  if (allowed === "all") return rows;
  return rows.filter((r) => allowed.has(r.id));
}

export async function rhColaboradoresAccessGate(
  req: Request,
  action: PermissionAction,
  colaboradorId?: string
): Promise<ResourceAccessGate> {
  const gate = await resourceAccessGate(
    req,
    RH_COLABORADORES_RESOURCE,
    action,
    "Sem permissão para esta ação em RH e Parceiros."
  );
  if (!gate.ok) return gate;

  if (colaboradorId && gate.scope === "vinculados") {
    const row = await prisma.colaboradorRH.findUnique({
      where: { id: colaboradorId },
      select: { id: true },
    });
    if (!row) {
      return { ok: false, response: fail("NOT_FOUND", "Colaborador não encontrado.", 404) };
    }
    const ok = await userCanAccessColaboradorId(gate.userId, colaboradorId, gate.scope);
    if (!ok) {
      return {
        ok: false,
        response: fail("FORBIDDEN", "Você não tem acesso a este colaborador.", 403),
      };
    }
  }

  return gate;
}

export function getRhViewScope(session: SessionPayload) {
  return authorize(session, RH_COLABORADORES_RESOURCE, "ver");
}
