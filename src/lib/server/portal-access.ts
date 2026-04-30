import { prisma } from "@/lib/prisma";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";

export type PortalContext = {
  userId: string;
  userName: string;
  clienteIds: string[];
  isAdminCliente: boolean;
};

function readSession(req: Request) {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return decodeSession(match?.[1]?.trim());
}

export async function resolvePortalContext(req: Request): Promise<PortalContext | null> {
  const session = readSession(req);
  const perfilId = session?.perfilId?.trim();
  const userId = session?.userId?.trim();
  if (!userId || !perfilId) return null;

  const [usuario, vinculos, perfil] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: userId },
      select: { id: true, nomeExibicao: true, email: true, perfilId: true, ativo: true },
    }),
    prisma.usuarioVinculo.findMany({
      where: { usuarioId: userId, tipo: "cliente" },
      select: { pessoaId: true },
    }),
    prisma.perfilAcesso.findUnique({
      where: { id: perfilId },
      select: { nome: true },
    }),
  ]);

  if (!usuario?.ativo) return null;
  const clienteIds = Array.from(new Set(vinculos.map((v) => v.pessoaId)));
  if (clienteIds.length === 0) return null;
  const perfilNome = (perfil?.nome ?? "").toLowerCase();
  const canManagePortalUsers =
    session?.isAdminCliente === true ||
    session?.permissoes?.configuracoes === true ||
    (perfilNome.includes("cliente") && (perfilNome.includes("admin") || perfilNome.includes("administrador")));

  return {
    userId,
    userName: usuario.nomeExibicao?.trim() || usuario.email,
    clienteIds,
    isAdminCliente: canManagePortalUsers,
  };
}

export function hasClienteAccess(ctx: PortalContext, clienteId: string | null | undefined): boolean {
  if (!clienteId) return false;
  return ctx.clienteIds.includes(clienteId);
}

