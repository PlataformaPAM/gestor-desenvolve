import type { ColaboradorParceiro } from "@/lib/rh/types";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mapColaborador } from "../_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import {
  failCadastroEfetivadoMigrationPending,
  isCadastroEfetivadoMissingInDatabase,
} from "@/lib/server/rh-colaborador-db-errors";
import { writeAuditLog } from "@/lib/server/audit-log";
import { rhColaboradoresAccessGate } from "@/lib/server/rh-access";
import { RH_CONSULTOR_PRE_CADASTRO_CARGO } from "@/lib/rh/pre-cadastro-consultor";

function digitsOnly(v: string | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

function isContatosFornecedorColumnError(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "");
  if (msg.includes("Unknown argument `contatosFornecedor`")) return true;
  if (msg.includes("Unknown field `contatosFornecedor`")) return true;
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2021" && error.code !== "P2022") return false;
  return msg.includes("contatosFornecedor");
}

function isTipoContratoEnumError(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return (
    msg.includes("tipocontrato") &&
    (msg.includes("invalid input value for enum") || msg.includes("provided value"))
  );
}

export async function POST(req: Request) {
  const gate = await rhColaboradoresAccessGate(req, "criar");
  if (!gate.ok) return gate.response;

  const body = await parseJsonSafe<{ colaborador?: ColaboradorParceiro; preCadastroConsultor?: boolean }>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const c = body.value.colaborador;
  const preCadastroConsultor = body.value.preCadastroConsultor === true;

  if (preCadastroConsultor) {
    if (!c || c.tipo !== "vendedor_externo") {
      return fail("BAD_REQUEST", "Pré-cadastro inválido: use tipo consultor (vendedor_externo).", 400);
    }
    if (!c.nome?.trim() || !c.tipoContrato) {
      return fail("BAD_REQUEST", "Informe nome e tipo de contrato para o pré-cadastro.", 400);
    }
    try {
      const dataPre = {
        id: c.id || undefined,
        nome: c.nome.trim(),
        cargoOuFuncao: RH_CONSULTOR_PRE_CADASTRO_CARGO,
        tipoContrato: c.tipoContrato,
        status: "ativo" as const,
        tipoPessoa: "vendedor_externo" as const,
        cadastroEfetivado: false,
        email: null,
        telefone: null,
        cpfCnpj: null,
        totalVendasMes: null,
        ultimoAcesso: null,
        contatosFornecedor: Prisma.JsonNull,
      };
      const include = { dadosBancarios: true, documentos: true };
      let created;
      try {
        created = await prisma.colaboradorRH.create({ data: dataPre, include });
      } catch (error) {
        if (isCadastroEfetivadoMissingInDatabase(error)) {
          return failCadastroEfetivadoMigrationPending();
        }
        if (isContatosFornecedorColumnError(error)) {
          const { contatosFornecedor: _, ...semContatos } = dataPre;
          created = await prisma.colaboradorRH.create({ data: semContatos, include });
        } else {
          throw error;
        }
      }
      await writeAuditLog(prisma, {
        acao: "Consultor pré-cadastrado",
        modulo: "rh",
        detalhes: `Pré-cadastro ${created.nome} (${created.id})`,
      });
      return ok({ colaborador: mapColaborador(created) }, 201);
    } catch (error) {
      if (isCadastroEfetivadoMissingInDatabase(error)) {
        return failCadastroEfetivadoMigrationPending();
      }
      if (isTipoContratoEnumError(error)) {
        return fail(
          "BAD_REQUEST",
          "Tipo de contrato indisponível no banco atual. Atualize as migrations e tente novamente.",
          400
        );
      }
      console.error("[rh/colaboradores POST pre]", error);
      return fail("INTERNAL_ERROR", "Não foi possível salvar o pré-cadastro. Tente novamente.", 500);
    }
  }

  if (!c?.nome?.trim() || !c?.cargoOuFuncao?.trim()) {
    return fail("BAD_REQUEST", "Payload inválido.", 400);
  }

  const doc = digitsOnly(c.cpfCnpj);
  const b2bComContatosCnpj =
    (c.tipo === "fornecedor_parceiro" || c.tipo === "vendedor_externo") && doc.length === 14;
  if (b2bComContatosCnpj) {
    const contatos = c.contatos ?? [];
    const temContato = contatos.some(
      (ct) => (ct.nome?.trim() || ct.email?.trim() || ct.telefone?.trim()) ?? false
    );
    if (!temContato) {
      return fail("BAD_REQUEST", "Pessoa jurídica (CNPJ): informe pelo menos um contato.", 400);
    }
  }

  try {
    const baseData = {
      id: c.id || undefined,
      nome: c.nome.trim(),
      cargoOuFuncao: c.cargoOuFuncao.trim(),
      tipoContrato: c.tipoContrato,
      status: c.status,
      tipoPessoa: c.tipo,
      cadastroEfetivado: true,
      email: c.email ?? null,
      telefone: c.telefone ?? null,
      cpfCnpj: c.cpfCnpj ?? null,
      totalVendasMes: c.totalVendasMes ?? null,
      ultimoAcesso: c.ultimoAcesso ? new Date(c.ultimoAcesso) : null,
      dadosBancarios: c.dadosBancarios
        ? {
            create: {
              banco: c.dadosBancarios.banco ?? null,
              agencia: c.dadosBancarios.agencia ?? null,
              conta: c.dadosBancarios.conta ?? null,
              tipoConta: c.dadosBancarios.tipoConta ?? null,
              pix: c.dadosBancarios.pix ?? null,
            },
          }
        : undefined,
      documentos: c.documentos?.length
        ? {
            create: c.documentos.map((d) => ({ nome: d.nome, url: d.url ?? null })),
          }
        : undefined,
    };

    const include = { dadosBancarios: true, documentos: true };
    const dataComContatos = {
      ...baseData,
      ...(c.tipo === "fornecedor_parceiro" || c.tipo === "vendedor_externo"
        ? {
            contatosFornecedor: c.contatos?.length
              ? (c.contatos as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          }
        : {}),
    };

    let created;
    try {
      created = await prisma.colaboradorRH.create({ data: dataComContatos, include });
    } catch (error) {
      if (isCadastroEfetivadoMissingInDatabase(error)) {
        return failCadastroEfetivadoMigrationPending();
      }
      if (
        (c.tipo === "fornecedor_parceiro" || c.tipo === "vendedor_externo") &&
        isContatosFornecedorColumnError(error)
      ) {
        created = await prisma.colaboradorRH.create({ data: baseData, include });
      } else {
        throw error;
      }
    }

    await writeAuditLog(prisma, {
      acao: "Colaborador criado",
      modulo: "rh",
      detalhes: `Colaborador ${created.nome} (${created.id})`,
    });
    return ok({ colaborador: mapColaborador(created) }, 201);
  } catch (error) {
    if (isCadastroEfetivadoMissingInDatabase(error)) {
      return failCadastroEfetivadoMigrationPending();
    }
    if (isTipoContratoEnumError(error)) {
      return fail(
        "BAD_REQUEST",
        "Tipo de contrato indisponível no banco atual. Atualize as migrations e tente novamente.",
        400
      );
    }
    return fail("INTERNAL_ERROR", "Não foi possível salvar a pessoa. Tente novamente.", 500);
  }
}
