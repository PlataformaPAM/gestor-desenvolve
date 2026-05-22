import {
  accessibleLeadIdsAmong,
  canAccessLeadIdFromSet,
  userCanAccessLeadId,
} from "@/lib/server/lead-access";
import { fail } from "@/lib/server/api-response";
import { resourceAccessGate, type ResourceAccessGate } from "@/lib/server/rbac-gate";
import {
  resolveMembroParaConsultorRh,
  type ConsultorRhComissao,
} from "@/lib/server/comissoes-ownership-resolve";
import { prisma } from "@/lib/prisma";
import type { DataScope } from "@/lib/server/authorize";
import type { PermissionAction } from "@/lib/configuracoes/permission-catalog";

export const FINANCEIRO_LANCAMENTOS_RESOURCE = "financeiro.lancamentos";
export const FINANCEIRO_COMISSOES_RESOURCE = "financeiro.comissoes";
export const FINANCEIRO_APROVACOES_RESOURCE = "financeiro.aprovacoes";
export const FINANCEIRO_EXTRATO_RESOURCE = "financeiro.extrato";
export const FINANCEIRO_VENDA_DIRETA_RESOURCE = "financeiro.venda_direta";

export async function financeiroAccessGate(
  req: Request,
  resourceId: string,
  action: PermissionAction,
  opts?: { leadId?: string }
): Promise<ResourceAccessGate> {
  const gate = await resourceAccessGate(
    req,
    resourceId,
    action,
    "Sem permissão para esta ação no Financeiro."
  );
  if (!gate.ok) return gate;

  if (opts?.leadId && gate.scope === "vinculados") {
    const ok = await userCanAccessLeadId(gate.userId, opts.leadId, gate.scope);
    if (!ok) {
      return {
        ok: false,
        response: fail("FORBIDDEN", "Você não tem acesso a este lead.", 403),
      };
    }
  }

  return gate;
}

/** Comissões: escopo sempre restrito ao consultor RH do usuário logado. */
export async function resolveConsultorRhForUsuario(
  userId: string | null | undefined
): Promise<ConsultorRhComissao | null> {
  if (!userId) return null;
  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: {
      id: true,
      nomeExibicao: true,
      ativo: true,
    },
  });
  if (!usuario?.ativo) return null;
  return resolveMembroParaConsultorRh(prisma, {
    id: usuario.id,
    nome: usuario.nomeExibicao?.trim() || "Usuário",
  });
}

export function filterComissoesConsultorId(
  consultorIdFilter: string | undefined,
  ownConsultorId: string | null
): string | undefined {
  if (!ownConsultorId) return "__none__";
  if (!consultorIdFilter) return ownConsultorId;
  return consultorIdFilter === ownConsultorId ? ownConsultorId : "__none__";
}

type LancamentoRef = { leadIdOrigem?: string | null };

export async function filterLancamentosForSession<T extends LancamentoRef>(
  rows: T[],
  userId: string | null,
  scope: DataScope
): Promise<T[]> {
  if (scope === "todos") return rows;
  const leadIds = rows.map((r) => r.leadIdOrigem).filter((id): id is string => !!id);
  const allowed = await accessibleLeadIdsAmong(userId, leadIds, scope);
  return rows.filter((l) => {
    if (!l.leadIdOrigem) return false;
    return canAccessLeadIdFromSet(l.leadIdOrigem, allowed, scope);
  });
}

type LeadRef = { id: string };

export async function filterLeadsForFinanceiro<T extends LeadRef>(
  rows: T[],
  userId: string | null,
  scope: DataScope
): Promise<T[]> {
  if (scope === "todos") return rows;
  const ids = rows.map((r) => r.id);
  const allowed = await accessibleLeadIdsAmong(userId, ids, scope);
  return rows.filter((r) => allowed.has(r.id));
}

export async function assertLancamentoLeadAccess(
  userId: string | null,
  leadIdOrigem: string | null | undefined,
  scope: DataScope
): Promise<boolean> {
  if (scope === "todos") return true;
  if (!leadIdOrigem) return false;
  return userCanAccessLeadId(userId, leadIdOrigem, scope);
}

export async function assertComissaoIdsAllowed(
  ids: string[],
  ownConsultorId: string | null,
  scope: DataScope
): Promise<boolean> {
  if (scope === "todos") return true;
  if (!ownConsultorId || ids.length === 0) return false;
  const count = await prisma.comissaoEvento.count({
    where: { id: { in: ids }, consultorId: ownConsultorId },
  });
  return count === ids.length;
}
