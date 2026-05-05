"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UserCog, Users } from "lucide-react";
import type { Lead, LeadOwnershipSnapshot } from "@/lib/comercial/types";
import { getLeadOwnership } from "@/lib/comercial/ownership";
import { SearchableMultiSelect, SearchableSelect } from "@/components/ui/searchable-select";

const labelClass = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

type Membro = { id: string; nome: string };

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

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="lead-responsavel-principal" className={labelClass}>
            Responsável Principal
          </label>
          <SearchableSelect
            options={listaResponsaveisPrincipal.map((r) => ({
              value: r.id,
              label: r.id === usuarioAtual.id ? `${r.nome} (você)` : r.nome,
              icon: UserCog,
            }))}
            value={responsavelPrincipal.id}
            onChange={(id) => {
              const r = listaResponsaveisPrincipal.find((m) => m.id === id);
              if (!r) return;
              const previous = snapshotFromState(responsavelPrincipal, colaboradores);
              const colsFiltrados = colaboradores.filter((c) => c.id !== r.id);
              setColaboradores(colsFiltrados);
              setResponsavelPrincipal(r);
              const next = snapshotFromState(r, colsFiltrados);
              pushOwnership(previous, next);
            }}
            placeholder="Selecione o responsável..."
            searchPlaceholder="Buscar responsável..."
            leadingIcon={UserCog}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ao criar um novo lead, o usuário logado é o padrão. Altere para transferir a responsabilidade.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={labelClass.replace("mb-1 ", "")}>Colaboradores</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Outros membros da equipe que atuam na oportunidade em conjunto.
          </p>
          <SearchableMultiSelect
            options={colaboradoresDisponiveis.map((m) => ({ value: m.id, label: m.nome, icon: Users }))}
            values={colaboradores.map((c) => c.id)}
            onChange={(ids) => {
              const previous = snapshotFromState(responsavelPrincipal, colaboradores);
              const allMap = new Map(
                membrosEquipe
                  .filter((m) => m.id !== responsavelPrincipal.id)
                  .map((m) => [m.id, m] as const)
              );
              const nextCols = ids.map((id) => allMap.get(id)).filter(Boolean) as Membro[];
              setColaboradores(nextCols);
              pushOwnership(previous, snapshotFromState(responsavelPrincipal, nextCols));
            }}
            placeholder="Selecionar colaboradores..."
            searchPlaceholder="Buscar colaborador..."
            selectedLabel="Selecionados"
            leadingIcon={Users}
          />
        </div>
      </div>
    </>
  );
}
