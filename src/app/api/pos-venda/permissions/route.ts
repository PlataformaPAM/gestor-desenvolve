import { fail, ok } from "@/lib/server/api-response";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const session = decodeSession(match?.[1]?.trim());
  if (!session?.perfilId) return fail("UNAUTHORIZED", "Sessão inválida.", 401);

  const perfil = await prisma.perfilAcesso.findUnique({
    where: { id: session.perfilId },
    select: { nome: true },
  });
  const nome = (perfil?.nome || "").toLowerCase();
  const isAdmin = nome.includes("admin");
  return ok({ isAdmin });
}
