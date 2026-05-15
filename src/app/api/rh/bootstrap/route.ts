import { Prisma } from "@prisma/client";
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
  cadastroEfetivado: true,
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

/** Mesmo conjunto de campos, sem `cadastroEfetivado` (BD antes da migration RH consultor). */
const colaboradorRhSelectLegacy = {
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

function minimalScalarSelect(includeCadastroEfetivado: boolean) {
  return {
    id: true,
    nome: true,
    cargoOuFuncao: true,
    tipoContrato: true,
    status: true,
    tipoPessoa: true,
    ...(includeCadastroEfetivado ? { cadastroEfetivado: true as const } : {}),
    email: true,
    telefone: true,
    cpfCnpj: true,
    totalVendasMes: true,
    ultimoAcesso: true,
    createdAt: true,
    updatedAt: true,
  } as const;
}

function isMissingColumnError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022";
}

/**
 * Carrega colaboradores; se a coluna `cadastroEfetivado` ainda não existir no banco,
 * repete sem ela (mapColaborador assume efetivado = true).
 */
async function loadColaboradoresRhOnce(includeCadastroEfetivado: boolean) {
  const base = includeCadastroEfetivado ? colaboradorRhSelectBase : colaboradorRhSelectLegacy;
  const minimal = minimalScalarSelect(includeCadastroEfetivado);
  try {
    return await prisma.colaboradorRH.findMany({
      select: { ...base, contatosFornecedor: true },
      orderBy: { nome: "asc" },
    });
  } catch (e) {
    console.warn("[rh/bootstrap] select com contatosFornecedor falhou; repetindo sem o campo.", e);
  }
  try {
    return await prisma.colaboradorRH.findMany({
      select: { ...base },
      orderBy: { nome: "asc" },
    });
  } catch (e) {
    console.warn("[rh/bootstrap] select com relações falhou; lista mínima.", e);
  }
  return prisma.colaboradorRH.findMany({
    select: { ...minimal },
    orderBy: { nome: "asc" },
  });
}

async function loadColaboradoresRh() {
  try {
    return await loadColaboradoresRhOnce(true);
  } catch (e) {
    if (isMissingColumnError(e)) {
      console.warn(
        "[rh/bootstrap] possível coluna inexistente (ex.: cadastroEfetivado); repetindo select legado.",
        e
      );
      return loadColaboradoresRhOnce(false);
    }
    throw e;
  }
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

