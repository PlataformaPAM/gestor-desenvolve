import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { CONFIG_RESOURCES, configuracoesAccessGate } from "@/lib/server/configuracoes-access";
import {
  getEmpresaDocumentoConfig,
  normalizeEmpresaDocumentoConfig,
  saveEmpresaDocumentoConfig,
  type EmpresaDocumentoConfig,
} from "@/lib/documentos/empresa-config";

type PutBody = { config?: Partial<EmpresaDocumentoConfig> };

export async function GET(req: Request) {
  const gate = await configuracoesAccessGate(req, CONFIG_RESOURCES.dadosEmpresa, "ver");
  if (!gate.ok) return gate.response;

  try {
    const config = await getEmpresaDocumentoConfig();
    return ok({ config });
  } catch {
    return fail("INTERNAL_ERROR", "Não foi possível carregar configuração da empresa.", 500);
  }
}

export async function PUT(req: Request) {
  const gate = await configuracoesAccessGate(req, CONFIG_RESOURCES.dadosEmpresa, "editar");
  if (!gate.ok) return gate.response;

  const body = await parseJsonSafe<PutBody>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  try {
    const current = await getEmpresaDocumentoConfig();
    const merged = normalizeEmpresaDocumentoConfig({ ...current, ...(body.value.config ?? {}) });
    await saveEmpresaDocumentoConfig(merged);
    return ok({ config: merged });
  } catch {
    return fail("INTERNAL_ERROR", "Não foi possível salvar configuração da empresa.", 500);
  }
}
