import type { PermissionAction } from "@/lib/configuracoes/permission-catalog";
import { resourceAccessGate, type ResourceAccessGate } from "@/lib/server/rbac-gate";

export const SOLUCOES_CATALOGO_RESOURCE = "solucoes.catalogo";

export async function solucoesAccessGate(
  req: Request,
  action: PermissionAction
): Promise<ResourceAccessGate> {
  return resourceAccessGate(
    req,
    SOLUCOES_CATALOGO_RESOURCE,
    action,
    "Sem permissão para esta ação em Soluções."
  );
}
