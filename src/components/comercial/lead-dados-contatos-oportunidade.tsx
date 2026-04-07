"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, User } from "lucide-react";
import { AlertDialog } from "@/components/ui/alert-dialog";
import type { Lead, ContatoOportunidade, PapelContatoOportunidade } from "@/lib/comercial/types";
import type { Contato } from "@/lib/clientes/types";
import { PAPEIS_CONTATO_OPORTUNIDADE } from "@/lib/comercial/constants";

function formatPhoneInput(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.replace(/(\d{0,2})/, "($1");
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .slice(0, 15);
}

type LeadDadosContatosOportunidadeProps = {
  lead: Lead;
  /** Atualiza só o rascunho local (ex.: digitação em campos). */
  onApplyLocal: (updates: Partial<Lead>) => void;
  /** Persiste no servidor (ações discretas: adicionar/remover, checkbox, papéis). */
  onPersistToServer: (updates: Partial<Lead>) => void;
  initialContatoNome?: string;
  initialContatoTelefone?: string;
  initialContatoEmail?: string;
  contatosClienteDisponiveis?: Contato[];
  onCriarContatoNoCliente?: (contato: Contato) => void;
};

const emptyContato = (): ContatoOportunidade => ({
  id: `contato-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  nome: "",
  cargo: "",
  setor: "",
  telefone: "",
  email: "",
  papeis: [],
});

export function LeadDadosContatosOportunidade({
  lead,
  onApplyLocal,
  onPersistToServer,
  initialContatoNome = "",
  initialContatoTelefone = "",
  initialContatoEmail = "",
  contatosClienteDisponiveis = [],
  onCriarContatoNoCliente = () => {},
}: LeadDadosContatosOportunidadeProps) {
  const contatos = lead.contatosOportunidade ?? [];
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [contatoIdParaRemover, setContatoIdParaRemover] = useState<string | null>(null);
  const contatosSelecionadosIds = new Set(contatos.map((c) => c.id));

  const mapClienteContatoToOportunidade = (c: Contato): ContatoOportunidade => ({
    id: c.id,
    nome: c.nome ?? "",
    cargo: c.cargo ?? "",
    setor: c.setor ?? "",
    telefone: c.telefone ?? "",
    email: c.email ?? "",
    papeis: c.papeis ?? [],
  });

  const addContato = () => {
    const novo = {
      ...emptyContato(),
      nome: contatos.length === 0 ? initialContatoNome : "",
      telefone: contatos.length === 0 ? initialContatoTelefone : "",
      email: contatos.length === 0 ? initialContatoEmail : "",
    };
    const next = [...contatos, novo];
    onApplyLocal({ contatosOportunidade: next });
    onPersistToServer({ contatosOportunidade: next });
    setExpandedId(novo.id);
  };

  const updateContato = (id: string, patch: Partial<ContatoOportunidade>) => {
    const atual = contatos.find((c) => c.id === id);
    const merged = atual ? { ...atual, ...patch } : null;
    onApplyLocal({
      contatosOportunidade: contatos.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
    if (merged) {
      const hasAlgumDado =
        !!merged.nome?.trim() || !!merged.email?.trim() || !!merged.telefone?.trim();
      if (hasAlgumDado) {
        onCriarContatoNoCliente({
          id: merged.id,
          nome: merged.nome,
          telefone: merged.telefone,
          email: merged.email,
          setor: merged.setor,
          cargo: merged.cargo,
          papeis: merged.papeis,
        });
      }
    }
  };

  const removeContato = (id: string) => {
    const next = contatos.filter((c) => c.id !== id);
    onApplyLocal({ contatosOportunidade: next });
    onPersistToServer({ contatosOportunidade: next });
    if (expandedId === id) setExpandedId(next[0]?.id ?? null);
  };

  const togglePapel = (contatoId: string, papel: PapelContatoOportunidade) => {
    const c = contatos.find((x) => x.id === contatoId);
    if (!c) return;
    const nextPapeis = c.papeis.includes(papel)
      ? c.papeis.filter((p) => p !== papel)
      : [...c.papeis, papel];
    const nextContatos = contatos.map((x) =>
      x.id === contatoId ? { ...x, papeis: nextPapeis } : x
    );
    onApplyLocal({ contatosOportunidade: nextContatos });
    onPersistToServer({ contatosOportunidade: nextContatos });
  };

  const precisaContato = contatos.length === 0;
  const nomeContatoRemocao =
    contatoIdParaRemover ? contatos.find((c) => c.id === contatoIdParaRemover)?.nome.trim() || "este contato" : "";

  return (
    <>
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <User className="h-4 w-4" />
        Contatos da Oportunidade
      </h4>

      {contatosClienteDisponiveis.length > 0 && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Contatos já cadastrados no cliente
          </p>
          <div className="space-y-2">
            {contatosClienteDisponiveis.map((c) => {
              const checked = contatosSelecionadosIds.has(c.id);
              return (
                <label key={c.id} className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      if (checked) {
                        const next = contatos.filter((x) => x.id !== c.id);
                        onApplyLocal({ contatosOportunidade: next });
                        onPersistToServer({ contatosOportunidade: next });
                        return;
                      }
                      const next = [...contatos, mapClienteContatoToOportunidade(c)];
                      onApplyLocal({ contatosOportunidade: next });
                      onPersistToServer({ contatosOportunidade: next });
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9]"
                  />
                  <span>
                    <span className="font-medium text-slate-800">{c.nome}</span>
                    <span className="block text-xs text-slate-500">
                      {[c.email, c.telefone].filter(Boolean).join(" · ") || "Sem e-mail/telefone"}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {precisaContato && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Pelo menos um contato deve ser cadastrado para avançar de etapa.
        </div>
      )}

      <button
        type="button"
        onClick={addContato}
        className="mb-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <Plus className="h-4 w-4" /> Adicionar Contato
      </button>

      <ul className="space-y-3">
        {contatos.map((c) => {
          const isExpanded = expandedId === c.id;
          return (
            <li
              key={c.id}
              className="rounded-lg border border-slate-200 bg-white shadow-sm"
            >
              <div
                onClick={() => setExpandedId(isExpanded ? null : c.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setExpandedId(isExpanded ? null : c.id);
                  }
                }}
                role="button"
                tabIndex={0}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">
                    {c.nome.trim() || "Novo contato"}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setContatoIdParaRemover(c.id);
                  }}
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remover contato"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {isExpanded && (
                <div className="border-t border-slate-100 p-3 space-y-3">
                  <div>
                    <label className="mb-0.5 block text-xs font-medium text-slate-600">Nome</label>
                    <input
                      type="text"
                      value={c.nome}
                      onChange={(e) => updateContato(c.id, { nome: e.target.value })}
                      placeholder="Nome completo"
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-0.5 block text-xs font-medium text-slate-600">Cargo</label>
                      <input
                        type="text"
                        value={c.cargo ?? ""}
                        onChange={(e) => updateContato(c.id, { cargo: e.target.value })}
                        placeholder="Ex: Diretor"
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-xs font-medium text-slate-600">Setor</label>
                      <input
                        type="text"
                        value={c.setor ?? ""}
                        onChange={(e) => updateContato(c.id, { setor: e.target.value })}
                        placeholder="Ex: Comercial"
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-0.5 block text-xs font-medium text-slate-600">Telefone</label>
                      <input
                        type="text"
                        value={c.telefone}
                        onChange={(e) =>
                          updateContato(c.id, { telefone: formatPhoneInput(e.target.value) })
                        }
                        placeholder="(00) 00000-0000"
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-xs font-medium text-slate-600">E-mail</label>
                      <input
                        type="email"
                        value={c.email}
                        onChange={(e) => updateContato(c.id, { email: e.target.value })}
                        placeholder="email@empresa.com"
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">
                      Papel do Contato (pode marcar mais de um)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {PAPEIS_CONTATO_OPORTUNIDADE.map((opt) => {
                        const checked = c.papeis.includes(opt.value);
                        return (
                          <label
                            key={opt.value}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePapel(c.id, opt.value)}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9]"
                            />
                            {opt.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
    <AlertDialog
      open={!!contatoIdParaRemover}
      onClose={() => setContatoIdParaRemover(null)}
      onConfirm={() => {
        if (contatoIdParaRemover) removeContato(contatoIdParaRemover);
      }}
      title="Remover contato da oportunidade?"
      description={
        contatoIdParaRemover ? (
          <>
            <strong className="text-slate-900 dark:text-slate-100">Esta ação é irreversível:</strong> o contato{" "}
            <strong className="text-slate-900 dark:text-slate-100">{nomeContatoRemocao}</strong> será removido desta
            oportunidade no servidor.
          </>
        ) : null
      }
      cancelLabel="Cancelar"
      confirmLabel="Sim, remover permanentemente"
      destructive
    />
    </>
  );
}
