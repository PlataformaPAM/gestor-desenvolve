import type { PermissionAction } from "@/lib/configuracoes/permission-catalog";
import { resourceAccessGate, type ResourceAccessGate } from "@/lib/server/rbac-gate";
import { authorize } from "@/lib/server/authorize";
import type { RelatorioAccessContext } from "@/lib/server/relatorio-scope";

export const RELATORIOS_COMERCIAL_RESOURCE = "relatorios.comercial";
export const RELATORIOS_FINANCEIRO_RESOURCE = "relatorios.financeiro";
export const RELATORIOS_OPERACIONAL_RESOURCE = "relatorios.operacional";
export const RELATORIOS_SAUDE_EMPRESA_RESOURCE = "relatorios.saude_empresa";
export const RELATORIOS_PRESTACAO_CONTAS_RESOURCE = "relatorios.prestacao_contas";

export type RelatoriosResourceId =
  | typeof RELATORIOS_COMERCIAL_RESOURCE
  | typeof RELATORIOS_FINANCEIRO_RESOURCE
  | typeof RELATORIOS_OPERACIONAL_RESOURCE
  | typeof RELATORIOS_SAUDE_EMPRESA_RESOURCE
  | typeof RELATORIOS_PRESTACAO_CONTAS_RESOURCE;

const MESSAGES: Record<string, string> = {
  [RELATORIOS_COMERCIAL_RESOURCE]: "Sem permissão para relatórios comerciais.",
  [RELATORIOS_FINANCEIRO_RESOURCE]: "Sem permissão para relatórios financeiros.",
  [RELATORIOS_OPERACIONAL_RESOURCE]: "Sem permissão para relatórios operacionais.",
  [RELATORIOS_SAUDE_EMPRESA_RESOURCE]: "Sem permissão para o relatório de saúde da empresa.",
  [RELATORIOS_PRESTACAO_CONTAS_RESOURCE]: "Sem permissão para prestação de contas.",
};

export async function relatoriosAccessGate(
  req: Request,
  resourceId: RelatoriosResourceId,
  action: PermissionAction = "ver"
): Promise<ResourceAccessGate> {
  return resourceAccessGate(
    req,
    resourceId,
    action,
    MESSAGES[resourceId] ?? "Sem permissão para este relatório."
  );
}

export function relatorioAccessFromGate(
  gate: Extract<ResourceAccessGate, { ok: true }>,
  resourceId: RelatoriosResourceId
): RelatorioAccessContext {
  return {
    session: gate.session,
    userId: gate.userId,
    scope: gate.scope,
    resourceId,
  };
}

/** Escopo do recurso informado (útil quando o gate é de outro módulo de relatório). */
export function relatorioAccessForResource(
  gate: Extract<ResourceAccessGate, { ok: true }>,
  resourceId: RelatoriosResourceId
): RelatorioAccessContext {
  const view = authorize(gate.session, resourceId, "ver");
  return {
    session: gate.session,
    userId: gate.userId,
    scope: view.scope,
    resourceId,
  };
}
