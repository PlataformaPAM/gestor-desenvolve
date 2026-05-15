import type { ModuloPermissao } from "@/lib/configuracoes/types";
import { prisma } from "@/lib/prisma";
import { PORTAL_CLIENTE_PERFIL_MODULOS } from "@/lib/portal/cliente-perfil-modulos";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { resolvePortalContext } from "@/lib/server/portal-access";

const PREFIX = "PORTAL_CLIENTE";
const ALLOWED_MODULES = PORTAL_CLIENTE_PERFIL_MODULOS;

function encodeName(clienteId: string, nome: string): string {
  return `${PREFIX}:${clienteId}:${nome.trim()}`;
}

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

export async function GET(req: Request) {
  const ctx = await resolvePortalContext(req);
  if (!ctx) return fail("FORBIDDEN", "Acesso ao portal do cliente não autorizado.", 403);
  const clienteId = ctx.clienteIds[0];
  const rows = await prisma.perfilAcesso.findMany({
    where: { nome: { startsWith: `${PREFIX}:${clienteId}:` } },
    include: { permissoes: true },
    orderBy: { nome: "asc" },
  });
  const perfis = rows.map((p) => {
    const permissoes = defaultPermissoes();
    for (const pp of p.permissoes) {
      const mod = pp.modulo as ModuloPermissao;
      if (ALLOWED_MODULES.includes(mod)) permissoes[mod] = pp.permitido;
    }
    return {
      id: p.id,
      nome: decodeName(p.nome),
      descricao: p.descricao ?? undefined,
      permissoes,
    };
  });
  return ok({ perfis, data: { perfis } });
}

export async function POST(req: Request) {
  const ctx = await resolvePortalContext(req);
  if (!ctx) return fail("FORBIDDEN", "Acesso ao portal do cliente não autorizado.", 403);
  if (!ctx.isAdminCliente) return fail("FORBIDDEN", "Apenas administrador pode criar perfis.", 403);
  const parsed = await parseJsonSafe<{ perfil?: { nome: string; descricao?: string; permissoes?: Partial<Record<ModuloPermissao, boolean>> } }>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const perfil = parsed.value.perfil;
  if (!perfil?.nome?.trim()) return fail("BAD_REQUEST", "Nome do perfil é obrigatório.", 400);
  const nomePersistido = encodeName(ctx.clienteIds[0], perfil.nome);
  const permissoes = defaultPermissoes();
  for (const mod of ALLOWED_MODULES) {
    permissoes[mod] = perfil.permissoes?.[mod] === true;
  }
  const created = await prisma.perfilAcesso.create({
    data: {
      nome: nomePersistido,
      descricao: perfil.descricao ?? null,
      permissoes: {
        create: ALLOWED_MODULES.map((modulo) => ({ modulo: modulo as never, permitido: permissoes[modulo] })),
      },
    },
    include: { permissoes: true },
  });
  return ok({
    perfil: {
      id: created.id,
      nome: decodeName(created.nome),
      descricao: created.descricao ?? undefined,
      permissoes,
    },
  }, 201);
}
