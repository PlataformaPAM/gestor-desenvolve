import { prisma } from "@/lib/prisma";
import { mapColaborador } from "../_shared";
import { ok } from "@/lib/server/api-response";

export async function GET() {
  const [colaboradores, usuarios] = await Promise.all([
    prisma.colaboradorRH.findMany({
      include: { dadosBancarios: true, documentos: true },
      orderBy: { nome: "asc" },
    }),
    prisma.usuario.findMany({
      select: { id: true, cpf: true, email: true, nomeExibicao: true, perfilId: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const mappedColaboradores = colaboradores.map(mapColaborador);
  const mappedUsuarios = usuarios.map((u) => ({
    id: u.id,
    cpf: u.cpf,
    email: u.email,
    nomeExibicao: u.nomeExibicao ?? undefined,
    perfilId: u.perfilId,
  }));
  return ok({
    colaboradores: mappedColaboradores,
    usuarios: mappedUsuarios,
    data: { colaboradores: mappedColaboradores, usuarios: mappedUsuarios },
  });
}

