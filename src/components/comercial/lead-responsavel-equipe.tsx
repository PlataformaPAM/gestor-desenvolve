"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UserPlus, Users } from "lucide-react";
import { AlertDialog } from "@/components/ui/alert-dialog";
import type { Lead, LeadOwnershipSnapshot } from "@/lib/comercial/types";
import { getLeadOwnership } from "@/lib/comercial/ownership";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";
const labelClass = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

type Membro = { id: string; nome: string };

type PendingRemove = { kind: "colaborador"; id: string; nome: string };

type LeadResponsavelEquipeProps = {
  usuarioAtual: Membro;
  /** Membros ativos para select / colaboradores (igual ticket: equipe sem o próprio usuário duplicado) */
  membrosEquipe: Membro[];
  /** Trecho do lead para resolver ownership (interações + criador padrão) */
  leadContext: Pick<Lead, "interactions" | "criadoPorId" | "registroCriadoPorNome">;
  onApplyOwnership: (previous: LeadOwnershipSnapshot, next: LeadOwnershipSnapshot) => void;
};

export function LeadResponsavelEquipe({
  usuarioAtual,
  membrosEquipe,
  leadContext,
  onApplyOwnership,
}: LeadResponsavelEquipeProps) {
  const ownership = useMemo(() => getLeadOwnership(leadContext as Lead), [leadContext]);

  const listaResponsaveisPrincipal = useMemo(() => {
    const byId = new Map<string, Membro>();
    [usuarioAtual, ...membrosEquipe].forEach((m) => {
      if (!byId.has(m.id)) byId.set(m.id, m);
    });
    return Array.from(byId.values());
  }, [usuarioAtual, membrosEquipe]);

  const responsavelInicialId =
    ownership.responsavelId ??
    listaResponsaveisPrincipal.find((m) => m.nome === ownership.responsavelNome)?.id ??
    usuarioAtual.id;

  const [responsavelPrincipal, setResponsavelPrincipal] = useState<Membro>(() =>
    listaResponsaveisPrincipal.find((m) => m.id === responsavelInicialId) ?? usuarioAtual
  );
  const [colaboradores, setColaboradores] = useState<Membro[]>(
    () => ownership.colaboradores?.map((c) => ({ id: c.id, nome: c.nome })) ?? []
  );
  const [abertoColaboradores, setAbertoColaboradores] = useState(false);
  const colaboradoresRef = useRef<HTMLDivElement>(null);
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null);

  const prevLeadKeyRef = useRef<string>("");
  useEffect(() => {
    const key = JSON.stringify({
      o: ownership.responsavelId,
      n: ownership.responsavelNome,
      c: (ownership.colaboradores ?? []).map((x) => x.id).sort().join(","),
    });
    if (key === prevLeadKeyRef.current) return;
    prevLeadKeyRef.current = key;
    const rid =
      ownership.responsavelId ??
      listaResponsaveisPrincipal.find((m) => m.nome === ownership.responsavelNome)?.id ??
      usuarioAtual.id;
    setResponsavelPrincipal(listaResponsaveisPrincipal.find((m) => m.id === rid) ?? usuarioAtual);
    setColaboradores((ownership.colaboradores ?? []).map((c) => ({ id: c.id, nome: c.nome })));
  }, [ownership, listaResponsaveisPrincipal, usuarioAtual]);

  useEffect(() => {
    if (!abertoColaboradores) return;
    const handle = (e: MouseEvent) => {
      if (!colaboradoresRef.current?.contains(e.target as Node)) setAbertoColaboradores(false);
    };
    document.addEventListener("click", handle);
    return () => document.removeEventListener("click", handle);
  }, [abertoColaboradores]);

  const colaboradoresDisponiveis = useMemo(
    () =>
      membrosEquipe.filter(
        (m) => m.id !== responsavelPrincipal.id && !colaboradores.some((c) => c.id === m.id)
      ),
    [responsavelPrincipal.id, colaboradores, membrosEquipe]
  );

  const pushOwnership = (previous: LeadOwnershipSnapshot, next: LeadOwnershipSnapshot) => {
    onApplyOwnership(previous, next);
  };

  const snapshotFromState = (principal: Membro, cols: Membro[]): LeadOwnershipSnapshot => ({
    responsavelId: principal.id,
    responsavelNome: principal.nome,
    colaboradores: cols.map((c) => ({ id: c.id, nome: c.nome })),
  });

  const addColaborador = (r: Membro) => {
    const previous = snapshotFromState(responsavelPrincipal, colaboradores);
    const next = snapshotFromState(responsavelPrincipal, [...colaboradores, r]);
    setColaboradores(next.colaboradores!.map((c) => ({ id: c.id, nome: c.nome })));
    pushOwnership(previous, next);
    setAbertoColaboradores(false);
  };

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="lead-responsavel-principal" className={labelClass}>
            Responsável Principal
          </label>
          <select
            id="lead-responsavel-principal"
            value={responsavelPrincipal.id}
            onChange={(e) => {
              const id = e.target.value;
              const r = listaResponsaveisPrincipal.find((m) => m.id === id);
              if (!r) return;
              const previous = snapshotFromState(responsavelPrincipal, colaboradores);
              const colsFiltrados = colaboradores.filter((c) => c.id !== r.id);
              setColaboradores(colsFiltrados);
              setResponsavelPrincipal(r);
              const next = snapshotFromState(r, colsFiltrados);
              pushOwnership(previous, next);
            }}
            className={inputClass}
          >
            {listaResponsaveisPrincipal.map((r, idx) => (
              <option key={`${r.id}-${idx}`} value={r.id}>
                {r.id === usuarioAtual.id ? `${r.nome} (você)` : r.nome}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ao criar um novo lead, o usuário logado é o padrão. Altere para transferir a responsabilidade.
          </p>
        </div>

        <div ref={colaboradoresRef} className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-500" />
            <span className={labelClass.replace("mb-1 ", "")}>Colaboradores</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Outros membros da equipe que atuam na oportunidade em conjunto.
          </p>
          {colaboradores.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {colaboradores.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-2 rounded-full bg-slate-100 py-1.5 pl-3 pr-1.5 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                >
                  <span>{r.nome}</span>
                  <button
                    type="button"
                    onClick={() => setPendingRemove({ kind: "colaborador", id: r.id, nome: r.nome })}
                    className="rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                    aria-label={`Remover ${r.nome}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setAbertoColaboradores((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <UserPlus className="h-4 w-4" />
              Adicionar Colaborador
            </button>
            {abertoColaboradores && colaboradoresDisponiveis.length > 0 && (
              <ul className="absolute left-0 top-full z-10 mt-1 min-w-[180px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900">
                {colaboradoresDisponiveis.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => addColaborador(m)}
                      className="w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-violet-50 dark:text-slate-200 dark:hover:bg-violet-950/40"
                    >
                      {m.nome}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {abertoColaboradores && colaboradoresDisponiveis.length === 0 && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Nenhum colaborador disponível para adicionar.
              </p>
            )}
          </div>
        </div>
      </div>

      <AlertDialog
        open={!!pendingRemove}
        onClose={() => setPendingRemove(null)}
        onConfirm={() => {
          if (!pendingRemove) return;
          const previous = snapshotFromState(responsavelPrincipal, colaboradores);
          const nextCols = colaboradores.filter((c) => c.id !== pendingRemove.id);
          setColaboradores(nextCols);
          pushOwnership(previous, snapshotFromState(responsavelPrincipal, nextCols));
        }}
        title="Remover colaborador?"
        description={
          pendingRemove ? (
            <>
              <strong className="text-slate-900 dark:text-slate-100">{pendingRemove.nome}</strong> deixará de
              figurar como colaborador. Ao salvar o lead, a alteração fica permanente.
            </>
          ) : null
        }
        cancelLabel="Cancelar"
        confirmLabel="Remover"
        destructive
      />
    </>
  );
}
