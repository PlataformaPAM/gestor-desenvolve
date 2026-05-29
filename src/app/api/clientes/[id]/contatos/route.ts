import type { Contato } from "@/lib/clientes/types";
import { prisma } from "@/lib/prisma";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { clientesAccessGate } from "@/lib/server/clientes-access";
import { normalizeContato } from "@/lib/clientes/normalize-cliente";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await clientesAccessGate(req, "editar");
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const parsed = await parseJsonSafe<{ contatos?: Contato[] }>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const contatos = (parsed.value.contatos ?? []).map(normalizeContato);

  const existing = await prisma.cliente.findUnique({ where: { id }, select: { id: true, nome: true } });
  if (!existing) return fail("NOT_FOUND", "Cliente não encontrado.", 404);

  await prisma.$transaction(async (tx) => {
    await tx.clienteContatoPapel.deleteMany({ where: { clienteContato: { clienteId: id } } });
    await tx.clienteContato.deleteMany({ where: { clienteId: id } });

    for (const c of contatos) {
      await tx.clienteContato.create({
        data: {
          id: c.id,
          clienteId: id,
          nome: c.nome,
          email: c.email,
          telefone: c.telefone,
          setor: c.setor ?? null,
          cargo: c.cargo ?? null,
          papeis: { create: (c.papeis ?? []).map((p) => ({ papel: p })) },
        },
      });
    }
  });

  await writeAuditLog(prisma, {
    acao: "Contatos do cliente atualizados",
    modulo: "clientes",
    detalhes: `Cliente ${existing.nome} (${existing.id}) com ${contatos.length} contato(s)`,
  });

  return ok({ updated: true, contatos: contatos.length });
}

