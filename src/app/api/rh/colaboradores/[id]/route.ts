import type { ColaboradorParceiro } from "@/lib/rh/types";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mapColaborador } from "../../_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";

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

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await parseJsonSafe<{ colaborador?: ColaboradorParceiro }>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const c = body.value.colaborador;
  if (!c || c.id !== id) return fail("BAD_REQUEST", "Payload inválido.", 400);

  const doc = digitsOnly(c.cpfCnpj);
  if (c.tipo === "fornecedor_parceiro" && doc.length === 14 && c.contatos !== undefined) {
    const temContato = (c.contatos ?? []).some(
      (ct) => (ct.nome?.trim() || ct.email?.trim() || ct.telefone?.trim()) ?? false
    );
    if (!temContato) {
      return fail("BAD_REQUEST", "Fornecedor PJ (CNPJ): informe pelo menos um contato.", 400);
    }
  }

  try {
    const runUpdate = async (persistirContatos: boolean) => {
      await prisma.$transaction(async (tx) => {
        await tx.colaboradorRH.update({
          where: { id },
          data: {
            nome: c.nome,
            cargoOuFuncao: c.cargoOuFuncao,
            tipoContrato: c.tipoContrato,
            status: c.status,
            tipoPessoa: c.tipo,
            email: c.email ?? null,
            telefone: c.telefone ?? null,
            cpfCnpj: c.cpfCnpj ?? null,
            totalVendasMes: c.totalVendasMes ?? null,
            ultimoAcesso: c.ultimoAcesso ? new Date(c.ultimoAcesso) : null,
            ...(persistirContatos && c.contatos !== undefined
              ? {
                  contatosFornecedor:
                    c.tipo === "fornecedor_parceiro" && c.contatos.length
                      ? (c.contatos as unknown as Prisma.InputJsonValue)
                      : Prisma.JsonNull,
                }
              : {}),
          },
        });
        if (c.dadosBancarios) {
          await tx.colaboradorDadosBancarios.upsert({
            where: { colaboradorId: id },
            create: {
              colaboradorId: id,
              banco: c.dadosBancarios.banco ?? null,
              agencia: c.dadosBancarios.agencia ?? null,
              conta: c.dadosBancarios.conta ?? null,
              tipoConta: c.dadosBancarios.tipoConta ?? null,
              pix: c.dadosBancarios.pix ?? null,
            },
            update: {
              banco: c.dadosBancarios.banco ?? null,
              agencia: c.dadosBancarios.agencia ?? null,
              conta: c.dadosBancarios.conta ?? null,
              tipoConta: c.dadosBancarios.tipoConta ?? null,
              pix: c.dadosBancarios.pix ?? null,
            },
          });
        }
        await tx.colaboradorDocumento.deleteMany({ where: { colaboradorId: id } });
        if (c.documentos?.length) {
          await tx.colaboradorDocumento.createMany({
            data: c.documentos.map((d) => ({ colaboradorId: id, nome: d.nome, url: d.url ?? null })),
          });
        }
      });
    };

    try {
      await runUpdate(true);
    } catch (error) {
      if (!(c.contatos !== undefined && isContatosFornecedorColumnError(error))) throw error;
      await runUpdate(false);
    }

    const updated = await prisma.colaboradorRH.findUniqueOrThrow({
      where: { id },
      include: { dadosBancarios: true, documentos: true },
    });

    await writeAuditLog(prisma, {
      acao: "Colaborador atualizado",
      modulo: "rh",
      detalhes: `Colaborador ${updated.nome} (${updated.id})`,
    });
    return ok({ colaborador: mapColaborador(updated) });
  } catch {
    return fail("INTERNAL_ERROR", "Não foi possível salvar o fornecedor. Tente novamente.", 500);
  }
}

