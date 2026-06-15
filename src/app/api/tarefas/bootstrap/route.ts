import { prisma } from "@/lib/prisma";
import { mapTarefaFromDb } from "../_shared";
import { ok } from "@/lib/server/api-response";
import { filterTarefasForSession, tarefasAccessGate } from "@/lib/server/tarefas-access";
import { loadUsuariosAtivosParaVinculo } from "@/lib/server/usuarios-ativos";
import { loadTarefasSafe } from "@/lib/server/tarefas-bootstrap";

export async function GET(req: Request) {
  const gate = await tarefasAccessGate(req, "ver");
  if (!gate.ok) return gate.response;
  const [mappedUsuarios, tarefas, solucoesRows] = await Promise.all([
    loadUsuariosAtivosParaVinculo(),
    loadTarefasSafe(),
    prisma.solucaoCatalogo
      .findMany({
        where: { ativa: true },
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      })
      .catch(() => []),
  ]);
  const solucoes = solucoesRows.map((s) => ({ id: s.id, nome: s.nome }));
  const mappedTarefas = filterTarefasForSession(
    tarefas
      .map((t) => {
        try {
          return mapTarefaFromDb(t as Parameters<typeof mapTarefaFromDb>[0]);
        } catch (e) {
          console.warn("[tarefas/bootstrap] falha ao mapear tarefa; item ignorado.", e);
          return null;
        }
      })
      .filter((t): t is NonNullable<typeof t> => t != null),
    gate.session,
    gate.userId
  );
  return ok({
    usuarios: mappedUsuarios,
    tarefas: mappedTarefas,
    solucoes,
    data: { usuarios: mappedUsuarios, tarefas: mappedTarefas, solucoes },
  });
}
