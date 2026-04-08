import { prisma } from "@/lib/prisma";
import { mapColaborador } from "../_shared";
import { fail, ok } from "@/lib/server/api-response";

/** Evita `SELECT *` em colunas que podem não existir no banco até migrar (ex.: contatosFornecedor). */
const colaboradorRhSelectBase = {
  id: true,
  nome: true,
  cargoOuFuncao: true,
  tipoContrato: true,
  status: true,
  tipoPessoa: true,
  email: true,
  telefone: true,
  cpfCnpj: true,
  totalVendasMes: true,
  ultimoAcesso: true,
  createdAt: true,
  updatedAt: true,
  dadosBancarios: true,
  documentos: true,
} as const;

async function loadColaboradoresRh() {
  try {
    return await prisma.colaboradorRH.findMany({
      select: { ...colaboradorRhSelectBase, contatosFornecedor: true },
      orderBy: { nome: "asc" },
    });
  } catch (e) {
    console.warn("[rh/bootstrap] select com contatosFornecedor falhou; repetindo sem o campo.", e);
  }
  try {
    return await prisma.colaboradorRH.findMany({
      select: { ...colaboradorRhSelectBase },
      orderBy: { nome: "asc" },
    });
  } catch (e) {
    console.warn("[rh/bootstrap] select com relações falhou; lista mínima.", e);
  }
  return await prisma.colaboradorRH.findMany({
    select: {
      id: true,
      nome: true,
      cargoOuFuncao: true,
      tipoContrato: true,
      status: true,
      tipoPessoa: true,
      email: true,
      telefone: true,
      cpfCnpj: true,
      totalVendasMes: true,
      ultimoAcesso: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { nome: "asc" },
  });
}

export async function GET() {
  try {
    const [colaboradores, usuarios] = await Promise.all([loadColaboradoresRh(), loadUsuariosRhVinculo()]);

    const mappedColaboradores = colaboradores.map((row) => {
      try {
        return mapColaborador(row as Parameters<typeof mapColaborador>[0]);
      } catch (e) {
        console.error("[rh/bootstrap] mapColaborador", row.id, e);
        return null;
      }
    });
    const lista = mappedColaboradores.filter((x): x is NonNullable<typeof x> => x != null);

    const mappedUsuarios = usuarios.map((u) => ({
      id: u.id,
      cpf: u.cpf,
      email: u.email,
      nomeExibicao: "nomeExibicao" in u ? (u.nomeExibicao ?? undefined) : undefined,
      perfilId: u.perfilId,
    }));
    return ok({
      colaboradores: lista,
      usuarios: mappedUsuarios,
      data: { colaboradores: lista, usuarios: mappedUsuarios },
    });
  } catch (e) {
    console.error("[rh/bootstrap]", e);
    return fail("INTERNAL_ERROR", "Falha ao carregar dados do RH.", 500);
  }
}

async function loadUsuariosRhVinculo() {
  try {
    return await prisma.usuario.findMany({
      select: { id: true, cpf: true, email: true, nomeExibicao: true, perfilId: true },
      orderBy: { createdAt: "desc" },
    });
  } catch (e) {
    console.warn("[rh/bootstrap] usuarios findMany falhou; tentando colunas mínimas.", e);
    return await prisma.usuario.findMany({
      select: { id: true, cpf: true, email: true, perfilId: true },
      orderBy: { createdAt: "desc" },
    });
  }
}

