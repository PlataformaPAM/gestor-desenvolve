"use client";

import { useEffect, useMemo, useState } from "react";
import { FileDown, Search, Trash2 } from "lucide-react";
import { AlertDialog } from "@/components/ui/alert-dialog";
import type {
  Lead,
  LeadInteraction,
  LeadRecorrenciaPagamento,
  LeadSolucaoRef,
} from "@/lib/comercial/types";
import { useAuth } from "@/contexts/auth-context";

type LeadDetailPropostaProps = {
  lead: Lead;
  onUpdateLead: (
    updates: Partial<Lead>,
    opts?: { skipSuccessToast?: boolean; allowWhileFinanceiroLocked?: boolean }
  ) => void;
  onGerarPdfSuccess: () => void;
};
type CatalogSolucao = {
  id: string;
  nome: string;
  valorVenda: number;
  logoUrl?: string;
  recorrencia: LeadRecorrenciaPagamento;
  parcelasPadrao: number;
};

const REC_COMERCIAL_LABEL: Record<LeadRecorrenciaPagamento, string> = {
  mensal: "Mensal",
  unica: "Única",
  parcelado: "Parcelado",
};

function createSolucaoLineId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `ls-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function createLogId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Digitação só com números; exibe máscara R$ (centavos) */
function useBrlCentavosInput() {
  const [centavos, setCentavos] = useState<number | null>(null);

  const display =
    centavos == null || centavos === 0
      ? ""
      : (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const onChangeDigits = (raw: string) => {
    const d = raw.replace(/\D/g, "");
    if (d === "") {
      setCentavos(null);
      return;
    }
    setCentavos(parseInt(d, 10));
  };

  const getValorReais = (fallback: number) => {
    if (centavos == null) return fallback;
    return centavos / 100;
  };

  return { display, onChangeDigits, getValorReais, setCentavos };
}

export function LeadDetailProposta({
  lead,
  onUpdateLead,
  onGerarPdfSuccess,
}: LeadDetailPropostaProps) {
  const { session } = useAuth();
  const currentUserName = session.userName ?? "Usuário";
  const currentUserId = session.userId ?? null;
  const [catalogoSolucoes, setCatalogoSolucoes] = useState<CatalogSolucao[]>([]);

  const [addingId, setAddingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [condicoesStr, setCondicoesStr] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [solucaoIdxParaRemover, setSolucaoIdxParaRemover] = useState<number | null>(null);

  const selectedCatalog = addingId ? catalogoSolucoes.find((s) => s.id === addingId) : undefined;
  const { display: valorMasked, onChangeDigits, getValorReais, setCentavos } = useBrlCentavosInput();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/solucoes/bootstrap", { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as { data?: { solucoes?: CatalogSolucao[] } };
        if (!active) return;
        setCatalogoSolucoes(payload?.data?.solucoes ?? []);
      } catch {
        // noop
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (addingId && selectedCatalog) {
      setCentavos(Math.round(selectedCatalog.valorVenda * 100));
      setCondicoesStr("");
    }
  }, [addingId, selectedCatalog?.id, setCentavos]);

  useEffect(() => {
    if (!addingId) {
      setCondicoesStr("");
      setCentavos(null);
    }
  }, [addingId, setCentavos]);

  const solucoesNaOportunidade = lead.solucoes ?? [];
  const disponiveis = useMemo(() => {
    const catalogIdsNaProposta = new Set(
      solucoesNaOportunidade.map((s) => s.solucaoCatalogoId).filter(Boolean) as string[]
    );
    return catalogoSolucoes.filter((s) => !catalogIdsNaProposta.has(s.id));
  }, [solucoesNaOportunidade, catalogoSolucoes]);

  const valorTotal = useMemo(() => {
    return solucoesNaOportunidade.reduce((acc, s) => acc + (s.valor ?? 0), 0);
  }, [solucoesNaOportunidade]);

  const filteredDisponiveis = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];
    return disponiveis.filter((s) => s.nome.toLowerCase().includes(term)).slice(0, 8);
  }, [disponiveis, searchTerm]);

  const addSolucao = (solId: string) => {
    const sol = catalogoSolucoes.find((s) => s.id === solId);
    if (!sol) return;
    const valorNum = getValorReais(sol.valorVenda);
    const logoTrim = sol.logoUrl?.trim();
    const parcelasLinha = sol.recorrencia === "parcelado" ? Math.max(2, sol.parcelasPadrao ?? 12) : null;
    const nova: LeadSolucaoRef = {
      id: createSolucaoLineId(),
      solucaoCatalogoId: sol.id,
      nome: sol.nome,
      ...(logoTrim ? { logoUrl: logoTrim } : {}),
      valor: valorNum,
      condicoesPagamento: condicoesStr.trim() || undefined,
      recorrenciaPagamento: sol.recorrencia,
      parcelas: parcelasLinha,
    };
    const valorFmt = formatCurrency(valorNum);
    const condTxt = condicoesStr.trim() || "—";
    const recTxt = `${REC_COMERCIAL_LABEL[sol.recorrencia]}${sol.recorrencia === "parcelado" ? `, ${parcelasLinha} parcelas` : ""}`;
    const log: LeadInteraction = {
      id: createLogId(),
      date: new Date().toISOString(),
      user: currentUserName,
      type: "sistema",
      action: "UPDATE",
      description: `Solução adicionada: ${nova.nome}. Valor: ${valorFmt}. Pagamento (ref.): ${recTxt}. Condições: ${condTxt}.`,
    };
    onUpdateLead({
      solucoes: [...solucoesNaOportunidade, nova],
      valorTotal: valorTotal + (nova.valor ?? 0),
      interactions: [...(lead.interactions ?? []), log],
    });
    setSearchTerm("");
    setAddingId(null);
    setCondicoesStr("");
  };

  const patchSolucao = (idx: number, patch: Partial<LeadSolucaoRef>) => {
    const next = solucoesNaOportunidade.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    const novoTotal = next.reduce((acc, s) => acc + (s.valor ?? 0), 0);
    onUpdateLead(
      {
        solucoes: next,
        valorTotal: novoTotal,
      },
      { skipSuccessToast: true }
    );
  };

  const removeSolucao = (idx: number) => {
    const list = solucoesNaOportunidade.slice();
    const removed = list.splice(idx, 1)[0];
    if (!removed) return;
    const novoTotal = list.reduce((acc, s) => acc + (s.valor ?? 0), 0);
    const log: LeadInteraction = {
      id: createLogId(),
      date: new Date().toISOString(),
      user: currentUserName,
      userId: currentUserId,
      type: "sistema",
      action: "UPDATE",
      description: `Solução removida: ${removed.nome}. Valor: ${formatCurrency(removed.valor ?? 0)}.`,
    };
    onUpdateLead({
      solucoes: list,
      valorTotal: novoTotal,
      interactions: [...(lead.interactions ?? []), log],
    });
  };

  const gerarPdf = async () => {
    setPdfLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    setPdfLoading(false);
    onUpdateLead({ propostaGeradaEm: new Date().toISOString() });
    onGerarPdfSuccess();
  };

  const nomeSolucaoRemocao =
    solucaoIdxParaRemover !== null
      ? solucoesNaOportunidade[solucaoIdxParaRemover]?.nome ?? "esta solução"
      : "";

  const needsPrevisaoFechamento =
    lead.stageId === "proposta" || lead.stageId === "contratacao";

  return (
    <>
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <p className="text-sm text-slate-600">
        Adicione <strong>uma ou mais</strong> soluções; ao escolher no catálogo, o sistema traz valor e forma de
        pagamento sugeridos (mensal, única ou parcelado). Você pode ajustar cada linha na lista abaixo.
      </p>

      {needsPrevisaoFechamento && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-800/40">
          <label
            htmlFor="lead-previsao-fechamento-proposta"
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Previsão de fechamento *
          </label>
          <input
            id="lead-previsao-fechamento-proposta"
            type="date"
            value={lead.previsaoFechamento ?? ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              onUpdateLead(
                { previsaoFechamento: v ? v : undefined },
                { skipSuccessToast: true }
              );
            }}
            className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Obrigatória para avançar o funil a partir da proposta.
          </p>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Buscar solução para adicionar</h3>
        {disponiveis.length === 0 ? (
          <p className="text-sm text-slate-500">Todas as soluções já foram adicionadas.</p>
        ) : (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Digite o nome do produto/serviço..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/15"
            />
            {filteredDisponiveis.length > 0 && !addingId && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                {filteredDisponiveis.map((sol) => (
                  <button
                    key={sol.id}
                    type="button"
                    onClick={() => setAddingId(sol.id)}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100"
                  >
                    <span className="flex min-w-0 items-center gap-2 font-medium text-slate-800">
                      {sol.logoUrl?.trim() ? (
                        <img
                          src={sol.logoUrl.trim()}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded object-contain"
                        />
                      ) : null}
                      <span className="truncate">{sol.nome}</span>
                    </span>
                    <span className="text-slate-500">{formatCurrency(sol.valorVenda)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {addingId && selectedCatalog && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex w-full min-w-0 items-center gap-2 text-sm font-medium text-slate-800">
                {selectedCatalog.logoUrl?.trim() ? (
                  <img
                    src={selectedCatalog.logoUrl.trim()}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded object-contain"
                  />
                ) : null}
                <span className="min-w-0">{selectedCatalog.nome}</span>
              </div>
              <p className="w-full text-xs text-slate-500">
                Referência do catálogo: {REC_COMERCIAL_LABEL[selectedCatalog.recorrencia]}
                {selectedCatalog.recorrencia === "parcelado"
                  ? ` · ${selectedCatalog.parcelasPadrao ?? 12} parcelas`
                  : ""}
                . Ajustável após incluir na oportunidade.
              </p>
              <div className="min-w-0 flex-1">
                <label className="mb-0.5 block text-xs text-slate-600">Valor (R$) — apenas números</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={valorMasked}
                  onChange={(e) => onChangeDigits(e.target.value)}
                  placeholder={formatCurrency(selectedCatalog.valorVenda)}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm tabular-nums"
                />
              </div>
              <div className="min-w-0 flex-1">
                <label className="mb-0.5 block text-xs text-slate-600">Condições de pagamento *</label>
                <input
                  type="text"
                  value={condicoesStr}
                  onChange={(e) => setCondicoesStr(e.target.value)}
                  placeholder="Ex: 50% à vista, 50% em 30 dias"
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => addSolucao(selectedCatalog.id)}
                disabled={!condicoesStr.trim()}
                className="rounded bg-[#6D28D9] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#5B21B6] disabled:opacity-50"
              >
                Adicionar
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingId(null);
                  setCondicoesStr("");
                }}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Soluções na oportunidade</h3>
        {solucoesNaOportunidade.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma solução adicionada ainda.</p>
        ) : (
          <ul className="space-y-2">
            {solucoesNaOportunidade.map((s, idx) => (
              <li
                key={s.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <span className="inline-flex min-w-0 items-center gap-2 font-medium text-slate-800">
                    {s.logoUrl?.trim() ? (
                      <img
                        src={s.logoUrl.trim()}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded object-contain"
                      />
                    ) : null}
                    <span className="truncate">{s.nome}</span>
                  </span>
                  {s.valor != null && (
                    <p className="text-sm text-slate-600">{formatCurrency(s.valor)}</p>
                  )}
                  {s.condicoesPagamento && (
                    <p className="text-xs text-slate-500">{s.condicoesPagamento}</p>
                  )}
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <label className="mb-0.5 block text-[11px] font-medium text-slate-600">Pagamento (negociação)</label>
                      <select
                        value={s.recorrenciaPagamento ?? "unica"}
                        onChange={(e) => {
                          const r = e.target.value as LeadRecorrenciaPagamento;
                          patchSolucao(idx, {
                            recorrenciaPagamento: r,
                            parcelas: r === "parcelado" ? Math.max(2, s.parcelas ?? 12) : null,
                          });
                        }}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      >
                        <option value="mensal">Mensal</option>
                        <option value="unica">Única</option>
                        <option value="parcelado">Parcelado</option>
                      </select>
                    </div>
                    {(s.recorrenciaPagamento ?? "unica") === "parcelado" && (
                      <div>
                        <label className="mb-0.5 block text-[11px] font-medium text-slate-600">Parcelas</label>
                        <input
                          type="number"
                          min={2}
                          max={60}
                          value={Math.max(2, s.parcelas ?? 12)}
                          onChange={(e) =>
                            patchSolucao(idx, {
                              parcelas: Math.min(60, Math.max(2, parseInt(e.target.value, 10) || 2)),
                            })
                          }
                          className="w-20 rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSolucaoIdxParaRemover(idx)}
                  className="shrink-0 self-end rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 sm:self-start"
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {valorTotal > 0 && (
          <p className="mt-2 text-sm font-semibold text-slate-800">
            Valor total: {formatCurrency(valorTotal)}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={gerarPdf}
          disabled={pdfLoading || solucoesNaOportunidade.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-[#6D28D9] px-4 py-2 text-sm font-medium text-white hover:bg-[#5B21B6] disabled:opacity-50"
        >
          {pdfLoading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Gerando PDF...
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4" />
              Gerar Proposta PDF
            </>
          )}
        </button>
      </div>
    </div>
    <AlertDialog
      open={solucaoIdxParaRemover !== null}
      onClose={() => setSolucaoIdxParaRemover(null)}
      onConfirm={() => {
        if (solucaoIdxParaRemover !== null) removeSolucao(solucaoIdxParaRemover);
      }}
      title="Remover solução da oportunidade?"
      description={
        solucaoIdxParaRemover !== null ? (
          <>
            <strong className="text-slate-900 dark:text-slate-100">Esta ação é irreversível ao salvar o lead:</strong> a
            solução <strong className="text-slate-900 dark:text-slate-100">{nomeSolucaoRemocao}</strong> e o valor
            associado serão retirados da proposta.
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
