"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { Tarefa, UsuarioTarefa } from "@/lib/tarefas/types";
import { PrioridadeBadge } from "@/components/tarefas/prioridade-badge";
import clsx from "clsx";

type PassarBastaoDrawerProps = {
  tarefa: Tarefa | null;
  usuarios: Map<string, UsuarioTarefa>;
  currentUserId: string;
  onPassarBastao: (tarefa: Tarefa) => void;
};

function getFilaResponsaveis(tarefa: Tarefa): UsuarioTarefa[] {
  return [tarefa.responsavel, ...(tarefa.colaboradores ?? [])];
}

function getResponsavelAtual(tarefa: Tarefa): UsuarioTarefa | null {
  if (tarefa.status === "concluido") return null;
  return tarefa.responsavel;
}

function getProximoResponsavel(tarefa: Tarefa): UsuarioTarefa | null {
  if (tarefa.status === "concluido") return null;
  return (tarefa.colaboradores ?? [])[0] ?? null;
}

function Avatar({ usuario }: { usuario: UsuarioTarefa }) {
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#6D28D9]/10 text-sm font-semibold text-[#6D28D9]"
      title={usuario.nome}
    >
      {usuario.nome.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function PassarBastaoDrawer({
  tarefa,
  usuarios,
  currentUserId,
  onPassarBastao,
}: PassarBastaoDrawerProps) {
  if (!tarefa) return null;

  const responsavelAtual = getResponsavelAtual(tarefa);
  const proximo = getProximoResponsavel(tarefa);
  const filaResponsaveis = getFilaResponsaveis(tarefa);
  const concluida = tarefa.status === "concluido";
  const souResponsavel = responsavelAtual?.id === currentUserId;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{tarefa.titulo}</h3>
          {tarefa.descricao && (
            <p className="mt-1 text-sm text-slate-600">{tarefa.descricao}</p>
          )}
          <PrioridadeBadge prioridade={tarefa.prioridade} variant="pill" className="mt-2" />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Ordem da passagem de bastão
          </p>
          <ul className="mt-2 space-y-2">
            {filaResponsaveis.map((u, i) => {
              const isCurrent = i === 0 && !concluida;
              const isDone = concluida || i > 0;
              return (
                <li
                  key={`${u.id}-${i}`}
                  className={clsx(
                    "flex items-center gap-3 rounded-lg px-3 py-2",
                    isCurrent && "bg-[#6D28D9]/10",
                    isDone && "opacity-75"
                  )}
                >
                  <Avatar usuario={u} />
                  <span className="text-sm font-medium text-slate-900">{u.nome}</span>
                  {isCurrent && (
                    <span className="ml-auto text-xs font-medium text-[#6D28D9]">
                      Responsável atual
                    </span>
                  )}
                  {isDone && (
                    <span className="ml-auto inline-flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Concluído
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {concluida && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
            <p className="text-sm font-medium text-emerald-800">
              Esta tarefa foi concluída por todos os responsáveis.
            </p>
          </div>
        )}
      </div>

      {!concluida && souResponsavel && (
        <div className="shrink-0 border-t border-slate-200 p-4 lg:p-6">
          <button
            type="button"
            onClick={() => onPassarBastao(tarefa)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700"
          >
            <CheckCircle2 className="h-5 w-5" />
            Marquei minha parte e passo ao próximo
            {proximo && (
              <>
                {" "}
                <ArrowRight className="h-4 w-4" /> {proximo.nome}
              </>
            )}
          </button>
          {!proximo && (
            <p className="mt-2 text-center text-xs text-slate-500">
              Você é o último da fila. Ao clicar, a tarefa será marcada como concluída.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
