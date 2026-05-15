import type { ModuloPermissao } from "@/lib/configuracoes/types";
import { prisma } from "@/lib/prisma";
import { PORTAL_CLIENTE_PERFIL_MODULOS } from "@/lib/portal/cliente-perfil-modulos";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { resolvePortalContext } from "@/lib/server/portal-access";

const PREFIX = "PORTAL_CLIENTE";
const ALLOWED_MODULES = PORTAL_CLIENTE_PERFIL_MODULOS;

function decodeName(raw: string): string {
  const parts = raw.split(":");
  if (parts.length < 3) return raw;
  return parts.slice(2).join(":");
}

function defaultPermissoes() {
  return {
    comercial: false,
    financeiro: false,
    tarefas: false,
    clientes: false,
    contratos: false,
    helpdesk: true,
    posVenda: false,
    solucoes: false,
    rh: false,
    configuracoes: false,
    relatorios: false,
    configuracoes_construtor_documentos: false,
    configuracoes_logs: false,
    configuracoes_perfis: false,
    configuracoes_usuarios: false,
  } as Record<ModuloPermissao, boolean>;
}

export async function PATCH(req: Request, ctxRoute: { params: Promise<{ id: string }> }) {
  const ctx = await resolvePortalContext(req);
  if (!ctx) return fail("FORBIDDEN", "Acesso ao portal do cliente não autorizado.", 403);
  if (!ctx.isAdminCliente) return fail("FORBIDDEN", "Apenas administrador pode editar perfis.", 403);
  const { id } = await ctxRoute.params;
  const parsed = await parseJsonSafe<{ perfil?: { id: string; nome: string; descricao?: string; permissoes?: Partial<Record<ModuloPermissao, boolean>> } }>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const perfil = parsed.value.perfil;
  if (!perfil || perfil.id !== id) return fail("BAD_REQUEST", "Payload inválido.", 400);

  const row = await prisma.perfilAcesso.findUnique({ where: { id }, select: { nome: true } });
  if (!row) return fail("NOT_FOUND", "Perfil não encontrado.", 404);
  if (!row.nome.startsWith(`${PREFIX}:${ctx.clienteIds[0]}:`)) return fail("FORBIDDEN", "Perfil não pertence ao cliente logado.", 403);

  const permissoes = defaultPermissoes();
  for (const mod of ALLOWED_MODULES) {
    permissoes[mod] = perfil.permissoes?.[mod] === true;
  }

  await prisma.$transaction(async (tx) => {
    await tx.perfilAcesso.update({
      where: { id },
      data: { descricao: perfil.descricao ?? null, nome: `${PREFIX}:${ctx.clienteIds[0]}:${perfil.nome.trim()}` },
    });
    await tx.perfilPermissao.deleteMany({ where: { perfilId: id } });
    await tx.perfilPermissao.createMany({
      data: ALLOWED_MODULES.map((modulo) => ({
        perfilId: id,
        modulo: modulo as never,
        permitido: permissoes[modulo],
      })),
    });
  });

  return ok({
    perfil: {
      id,
      nome: decodeName(`${PREFIX}:${ctx.clienteIds[0]}:${perfil.nome.trim()}`),
      descricao: perfil.descricao ?? undefined,
      permissoes,
    },
  });
}
