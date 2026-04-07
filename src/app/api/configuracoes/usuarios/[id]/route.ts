import type { UsuarioSistema } from "@/lib/configuracoes/types";
import { prisma } from "@/lib/prisma";
import { mapUsuario } from "../../_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await parseJsonSafe<{ usuario?: UsuarioSistema }>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const u = body.value.usuario;
  if (!u || u.id !== id) {
    return fail("BAD_REQUEST", "Payload inválido.", 400);
  }

  const cpfUsuario = u.cpf.replace(/\D/g, "");
  const isCpf = (doc?: string | null) => (doc ?? "").replace(/\D/g, "").length === 11;
  const vinculos = (u.vinculos?.length ? u.vinculos : u.vinculacao ? [u.vinculacao] : []).filter(
    (v): v is { tipo: "rh" | "cliente"; id: string } => Boolean(v?.tipo && v?.id)
  );
  for (const vinculo of vinculos) {
    if (vinculo.tipo === "rh") {
      const pessoa = await prisma.colaboradorRH.findUnique({
        where: { id: vinculo.id },
        select: { cpfCnpj: true },
      });
      if (!pessoa?.cpfCnpj) {
        return fail("BAD_REQUEST", "Pessoa vinculada sem CPF/CNPJ.", 400);
      }
      if (isCpf(pessoa.cpfCnpj) && pessoa.cpfCnpj.replace(/\D/g, "") !== cpfUsuario) {
        return fail("BAD_REQUEST", "Para vínculos com CPF, o CPF do usuário deve ser idêntico.", 400);
      }
    }
    if (vinculo.tipo === "cliente") {
      const cliente = await prisma.cliente.findUnique({
        where: { id: vinculo.id },
        select: { cpfCnpj: true },
      });
      if (!cliente?.cpfCnpj) {
        return fail("BAD_REQUEST", "Cliente vinculado sem CPF/CNPJ.", 400);
      }
      if (isCpf(cliente.cpfCnpj) && cliente.cpfCnpj.replace(/\D/g, "") !== cpfUsuario) {
        return fail("BAD_REQUEST", "Para vínculos com CPF, o CPF do usuário deve ser idêntico.", 400);
      }
    }
  }

  let updated = null as Awaited<ReturnType<typeof prisma.usuario.update>> | null;
  try {
    updated = await prisma.usuario.update({
      where: { id },
      data: {
        cpf: cpfUsuario,
        email: u.email.trim(),
        nomeExibicao: u.nomeExibicao ?? null,
        perfilId: u.perfilId,
        ativo: u.ativo,
        vinculacaoTipo: vinculos[0]?.tipo ?? null,
        vinculacaoPessoaId: vinculos[0]?.id ?? null,
        vinculos: {
          deleteMany: {},
          createMany: {
            data: vinculos.map((v) => ({ tipo: v.tipo, pessoaId: v.id })),
          },
        },
        atualizadoEmSistema: new Date(),
      },
    });
  } catch {
    updated = await prisma.usuario.update({
      where: { id },
      data: {
        cpf: cpfUsuario,
        email: u.email.trim(),
        nomeExibicao: u.nomeExibicao ?? null,
        perfilId: u.perfilId,
        ativo: u.ativo,
        vinculacaoTipo: vinculos[0]?.tipo ?? null,
        vinculacaoPessoaId: vinculos[0]?.id ?? null,
        atualizadoEmSistema: new Date(),
      },
    });
  }
  await writeAuditLog(prisma, {
    usuarioId: updated.id,
    acao: "Usuário atualizado",
    modulo: "configuracoes",
    detalhes: `Usuário ${updated.nomeExibicao ?? updated.email}`,
  });
  const updatedWithVinculos = await prisma.usuario.findUnique({
    where: { id: updated.id },
    include: { vinculos: true },
  });
  return ok({ usuario: mapUsuario(updatedWithVinculos ?? updated) });
}

