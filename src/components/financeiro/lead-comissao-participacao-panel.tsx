"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Loader2, Save } from "lucide-react";
import {
  formInputCompactClass,
  formModalSubmitButtonClass,
  formSectionLabelClass,
} from "@/components/ui/field-patterns";

const formHelperTextClass =
  "mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400";

type EquipeRow = {
  usuarioOuMembroId: string;
  nomeComercial: string;
  consultorId: string | null;
  consultorNomeRh: string | null;
  resolvido: boolean;
};

type EscopoRow = {
  leadSolucaoId: string | null;
  nome: string;
  somaPercentuais: number;
  participacoes: Array<{ consultorId: string; consultorNome: string; percentual: number }>;
};

type EquipeVendaPayload = {
  leadId: string;
  equipe: EquipeRow[];
  consultoresDistintos: number;
  escopos: EscopoRow[];
};

const SUM_EPS = 0.02;

function solKey(id: string | null): string {
  return id ?? "__geral__";
}

function parseNum(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function format2FromCents(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** `totalCents` em centésimos de ponto percentual (10000 = 100,00%). */
function distributeCents(totalCents: number, slots: number): number[] {
  if (slots <= 0) return [];
  const t = Math.max(0, Math.round(totalCents));
  const base = Math.floor(t / slots);
  const rem = t - base * slots;
  const out: number[] = [];
  for (let i = 0; i < slots; i += 1) {
    out.push(base + (i < rem ? 1 : 0));
  }
  return out;
}

function equalColumnStrings(consultorIds: string[]): Record<string, string> {
  const parts = distributeCents(10000, consultorIds.length);
  const col: Record<string, string> = {};
  consultorIds.forEach((id, i) => {
    col[id] = format2FromCents(parts[i]!);
  });
  return col;
}

function columnSumPct(col: Record<string, string> | undefined, consultorIds: string[]): number {
  if (!col) return 0;
  let s = 0;
  for (const id of consultorIds) {
    const v = parseNum(col[id] ?? "");
    if (v != null) s += v;
  }
  return s;
}

/** Valores iniciais: só pré-preenche quando já existe participação persistida com soma ≈ 100%; senão células vazias + placeholder de exemplo. */
function buildInitialGridValues(escopos: EscopoRow[], consultorIds: string[]): Record<string, Record<string, string>> {
  const grid: Record<string, Record<string, string>> = {};
  const emptyCol = (): Record<string, string> => Object.fromEntries(consultorIds.map((id) => [id, ""]));

  for (const esc of escopos) {
    const k = solKey(esc.leadSolucaoId);
    if (esc.participacoes.length) {
      const col: Record<string, string> = {};
      for (const id of consultorIds) {
        const row = esc.participacoes.find((p) => p.consultorId === id);
        col[id] = row ? format2FromCents(Math.round(row.percentual * 100)) : "";
      }
      const sumPct = columnSumPct(col, consultorIds);
      if (Math.abs(sumPct - 100) <= 0.15) {
        const sumCents = consultorIds.reduce((acc, id) => acc + Math.round((parseNum(col[id] ?? "") ?? 0) * 100), 0);
        if (consultorIds.length && sumCents !== 10000) {
          const last = consultorIds[consultorIds.length - 1]!;
          const lastCents = Math.round((parseNum(col[last] ?? "") ?? 0) * 100) + (10000 - sumCents);
          col[last] = format2FromCents(Math.max(0, lastCents));
        }
        grid[k] = col;
      } else {
        grid[k] = emptyCol();
      }
    } else {
      grid[k] = emptyCol();
    }
  }
  return grid;
}

export function LeadComissaoParticipacaoPanel({
  leadId,
  onGravado,
  onBloqueioSalvarLancamentoChange,
  embedded,
}: {
  leadId: string;
  onGravado?: () => void;
  /** Quando o painel exige ajuste de % (ou cadastro RH), o formulário de lançamento pode bloquear Salvar. */
  onBloqueioSalvarLancamentoChange?: (bloqueado: boolean, motivo?: string) => void;
  /** Remove borda inferior de “faixa fixa” do drawer; use dentro de aba com padding externo. */
  embedded?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EquipeVendaPayload | null>(null);
  /** solKey -> consultorId -> valor exibido */
  const [grid, setGrid] = useState<Record<string, Record<string, string>>>({});

  const bloqueioCbRef = useRef(onBloqueioSalvarLancamentoChange);
  useEffect(() => {
    bloqueioCbRef.current = onBloqueioSalvarLancamentoChange;
  }, [onBloqueioSalvarLancamentoChange]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/comissoes/equipe-venda?leadId=${encodeURIComponent(leadId)}`, { cache: "no-store" });
      const json = (await res.json()) as { success?: boolean; data?: EquipeVendaPayload; error?: { message?: string } };
      if (!res.ok || !json.success || !json.data) {
        setError(json.error?.message ?? "Não foi possível carregar a equipe da venda.");
        setData(null);
        setGrid({});
        return;
      }
      setData(json.data);
    } catch {
      setError("Falha de rede ao carregar envolvidos.");
      setData(null);
      setGrid({});
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const consultoresResolvidos = useMemo(() => {
    const m = new Map<string, string>();
    if (!data) return [];
    for (const e of data.equipe) {
      if (e.consultorId && e.consultorNomeRh) m.set(e.consultorId, e.consultorNomeRh);
    }
    return [...m.entries()].map(([id, nome]) => ({ id, nome }));
  }, [data]);

  const consultorIds = useMemo(() => consultoresResolvidos.map((c) => c.id), [consultoresResolvidos]);

  const multiplosMembros = (data?.equipe.length ?? 0) > 1;
  const mostrarMatriz = multiplosMembros && consultorIds.length > 1;

  useEffect(() => {
    if (!data || !mostrarMatriz) return;
    setGrid(buildInitialGridValues(data.escopos, consultorIds));
  }, [data, mostrarMatriz, consultorIds]);

  /** Sugestão numérica só para `placeholder` (não entra no value). */
  const placeholdersGrid = useMemo(() => {
    if (!data || !mostrarMatriz) return {} as Record<string, Record<string, string>>;
    const out: Record<string, Record<string, string>> = {};
    for (const esc of data.escopos) {
      const k = solKey(esc.leadSolucaoId);
      out[k] = equalColumnStrings(consultorIds);
    }
    return out;
  }, [data, mostrarMatriz, consultorIds]);

  const totaisPorEscopo = useMemo(() => {
    if (!data) return [];
    return data.escopos.map((esc) => {
      const k = solKey(esc.leadSolucaoId);
      const sum = columnSumPct(grid[k], consultorIds);
      const delta = sum - 100;
      return { key: k, nome: esc.nome, sum, delta };
    });
  }, [data, grid, consultorIds]);

  const todasColunasOk = useMemo(
    () => totaisPorEscopo.length > 0 && totaisPorEscopo.every((t) => Math.abs(t.delta) <= SUM_EPS),
    [totaisPorEscopo]
  );

  useEffect(() => {
    const fn = bloqueioCbRef.current;
    if (!fn) return;
    if (loading) {
      fn(true, "Carregando participações de comissão…");
      return;
    }
    if (!data) {
      fn(false);
      return;
    }
    if (!multiplosMembros) {
      fn(false);
      return;
    }
    if (!mostrarMatriz) {
      fn(
        true,
        "Há mais de uma pessoa na equipe de venda, mas o RH não reconhece todos para comissão. Ajuste vínculos em Configurações → Usuários ou cadastros no RH antes de salvar."
      );
      return;
    }
    if (!todasColunasOk) {
      fn(true);
      return;
    }
    fn(false);
  }, [loading, data, multiplosMembros, mostrarMatriz, todasColunasOk]);

  const gravar = async () => {
    if (!data || !mostrarMatriz) return;
    if (!todasColunasOk) {
      setError("A soma em cada coluna deve ser 100%.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      for (const esc of data.escopos) {
        const k = solKey(esc.leadSolucaoId);
        const col = grid[k];
        if (!col) continue;
        const itens = consultorIds.map((id) => ({
          consultorId: id,
          percentualParticipacao: parseNum(col[id] ?? "") ?? 0,
        }));
        const res = await fetch("/api/comissoes/participacoes/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadId: data.leadId,
            leadSolucaoId: esc.leadSolucaoId,
            replicarTodasSolucoes: false,
            itens,
          }),
        });
        const json = (await res.json()) as { success?: boolean; error?: { message?: string } };
        if (!res.ok || !json.success) {
          setError(json.error?.message ?? "Não foi possível gravar as participações.");
          return;
        }
      }
      await carregar();
      onGravado?.();
    } catch {
      setError("Falha de rede ao gravar.");
    } finally {
      setSaving(false);
    }
  };

  const onCellChange = (solK: string, consultorId: string, raw: string) => {
    setGrid((prev) => {
      const prevCol = prev[solK] ?? {};
      return { ...prev, [solK]: { ...prevCol, [consultorId]: raw } };
    });
  };

  const edgeWrap = embedded ? "" : "shrink-0 border-b border-slate-200 dark:border-slate-700";
  const edgePad = embedded ? "" : "lg:px-6";

  if (loading) {
    return (
      <div
        className={clsx(
          "flex items-center gap-2 py-3 text-sm text-slate-600 dark:text-slate-400",
          embedded ? "" : "px-4 lg:px-6",
          edgeWrap,
          edgePad
        )}
      >
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        Carregando envolvidos…
      </div>
    );
  }

  if (!data) {
    return error ? (
      <div
        className={clsx(
          "rounded-xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-900 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-100",
          edgeWrap,
          edgePad
        )}
      >
        {error}
      </div>
    ) : null;
  }

  if (!multiplosMembros) {
    const unico = data.equipe[0];
    return (
      <div
        className={clsx(
          "space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-600 dark:bg-slate-900",
          edgeWrap,
          edgePad
        )}
      >
        <h3 className={formSectionLabelClass}>Envolvidos na venda</h3>
        {data.equipe.length === 0 ? (
          <p className={formHelperTextClass}>
            Nenhum responsável foi registrado na equipe comercial deste lead. Ao dar baixa no caixa, a comissão seguirá
            as regras cadastradas no RH para o consultor vinculado ao recebimento.
          </p>
        ) : (
          <>
            <p className="leading-relaxed text-slate-700 dark:text-slate-200">
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {unico?.nomeComercial ?? "Envolvido"}
              </span>
              {unico?.consultorNomeRh ? (
                <>
                  {" "}
                  — consultor no RH: <span className="font-medium">{unico.consultorNomeRh}</span>
                </>
              ) : unico?.resolvido === false ? (
                <span className="mt-1 block text-amber-800 dark:text-amber-200">
                  Cadastro no RH ainda não reconhecido para comissão. Ajuste o vínculo em Configurações → Usuários.
                </span>
              ) : null}
            </p>
            <p className={formHelperTextClass}>
              Com apenas um envolvido na venda, a participação é integral (100%). Não é necessário dividir percentuais
              entre consultores.
            </p>
            {data.escopos.length > 0 ? (
              <ul className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-700">
                {data.escopos.map((esc) => {
                  const pctLabel =
                    esc.participacoes.length > 0
                      ? esc.participacoes
                          .map(
                            (p) =>
                              `${p.consultorNome}: ${p.percentual.toFixed(2).replace(".", ",")}%`
                          )
                          .join(" · ")
                      : "100% (implícito)";
                  return (
                    <li key={solKey(esc.leadSolucaoId)} className="text-slate-700 dark:text-slate-200">
                      <span className="font-medium text-slate-900 dark:text-slate-100">{esc.nome}</span>
                      <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{pctLabel}</span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </>
        )}
      </div>
    );
  }

  if (!mostrarMatriz) {
    return (
      <div
        className={clsx(
          "space-y-2 rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950 dark:border-amber-500/35 dark:bg-amber-950/40 dark:text-amber-100",
          edgeWrap,
          edgePad
        )}
      >
        <p className={formSectionLabelClass}>Envolvidos na venda</p>
        <p className="leading-relaxed text-slate-700 dark:text-slate-200">
          Há mais de uma pessoa na equipe do lead, mas só um cadastro no RH foi reconhecido para comissão. Ajuste
          vínculos em Configurações → Usuários (RH) ou cadastros no RH até todos aparecerem aqui para definir percentuais.
        </p>
      </div>
    );
  }

  const nSol = data.escopos.length;
  const nCons = consultoresResolvidos.length;
  const gridTemplateColumns = `max-content repeat(${nSol}, minmax(5rem, 1fr))`;
  const totalRow = 2 + nCons;
  const stickyCorner =
    "sticky left-0 z-[1] border-r border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900";
  const stickyCornerTotal =
    "sticky left-0 z-[1] border-r border-slate-200 bg-slate-50/95 dark:border-slate-600 dark:bg-slate-800/95";

  return (
    <div
      className={clsx(
        "min-w-0 w-full",
        embedded ? "space-y-4" : clsx("space-y-2 bg-slate-50/90 px-4 py-3 dark:bg-slate-900/50", edgeWrap, edgePad)
      )}
    >
      <div className="space-y-2">
        <h3 className={formSectionLabelClass}>Envolvidos na venda</h3>
        <p className={formHelperTextClass}>
          Defina, por solução, quanto da comissão cabe a cada consultor. A soma em cada coluna deve ser 100%.
        </p>
      </div>

      <div className="min-w-0 overflow-x-auto">
        <div
          className="grid w-full min-w-0 overflow-hidden rounded-lg border border-slate-200 text-left text-sm dark:border-slate-600"
          style={{ gridTemplateColumns }}
        >
          <div
            className={clsx(
              stickyCorner,
              "border-b border-slate-200 px-3 py-2.5 font-medium text-slate-800 dark:border-slate-600 dark:text-slate-100"
            )}
            style={{ gridRow: 1, gridColumn: 1 }}
          >
            <span className="whitespace-nowrap">Consultores</span>
          </div>
          {data.escopos.map((esc, s) => (
            <div
              key={`h-${solKey(esc.leadSolucaoId)}`}
              className="min-w-0 border-b border-slate-200 px-1.5 py-2 text-center text-xs font-medium leading-snug text-slate-800 dark:border-slate-600 dark:text-slate-100"
              style={{ gridRow: 1, gridColumn: s + 2 }}
            >
              <span className="line-clamp-3 break-words" title={esc.nome}>
                {esc.nome}
              </span>
            </div>
          ))}

          {consultoresResolvidos.map((c, r) => (
            <div
              key={`nome-${c.id}`}
              className={clsx(
                stickyCorner,
                "border-b border-slate-200 px-3 py-2.5 text-slate-800 dark:border-slate-600"
              )}
              style={{ gridRow: r + 2, gridColumn: 1 }}
            >
              <span className="block whitespace-nowrap font-medium" title={c.nome}>
                {c.nome}
              </span>
            </div>
          ))}

          {data.escopos.flatMap((esc, s) => {
            const k = solKey(esc.leadSolucaoId);
            return consultoresResolvidos.map((c, r) => {
              const cell = grid[k]?.[c.id] ?? "";
              const ph = placeholdersGrid[k]?.[c.id];
              return (
                <div
                  key={`${k}-${c.id}`}
                  className="min-w-0 border-b border-slate-200 bg-white p-2 dark:border-slate-600 dark:bg-slate-900"
                  style={{ gridRow: r + 2, gridColumn: s + 2 }}
                >
                  <div className="relative w-full min-w-0">
                    <label className="sr-only" htmlFor={`pct-${k}-${c.id}`}>
                      Percentual {c.nome} — {esc.nome}
                    </label>
                    <input
                      id={`pct-${k}-${c.id}`}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder={ph ? `Ex.: ${ph}` : "Ex.: 33,33"}
                      className={clsx(
                        formInputCompactClass,
                        "w-full min-w-0 px-2 pr-7 text-center text-sm tabular-nums"
                      )}
                      value={cell}
                      onChange={(e) => onCellChange(k, c.id, e.target.value)}
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500 dark:text-slate-400">
                      %
                    </span>
                  </div>
                </div>
              );
            });
          })}

          <div
            className={clsx(
              stickyCornerTotal,
              "border-t border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
            )}
            style={{ gridRow: totalRow, gridColumn: 1 }}
          >
            Total
          </div>
          {totaisPorEscopo.map((t, s) => {
            const ok = Math.abs(t.delta) <= SUM_EPS;
            return (
              <div
                key={`tot-${t.key}`}
                className="min-w-0 border-t border-slate-200 bg-slate-50/90 px-1.5 py-2.5 text-center dark:border-slate-600 dark:bg-slate-800/50"
                style={{ gridRow: totalRow, gridColumn: s + 2 }}
              >
                <span
                  className={clsx(
                    "inline-flex w-full min-w-0 items-center justify-center gap-1 font-medium tabular-nums",
                    ok ? "text-emerald-700 dark:text-emerald-400" : "text-amber-800 dark:text-amber-300"
                  )}
                >
                  {ok ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                  )}
                  <span className="min-w-0 text-xs sm:text-sm">
                    {t.sum.toFixed(2).replace(".", ",")}%
                    {ok ? "" : ` (${t.delta > 0 ? "+" : ""}${t.delta.toFixed(2).replace(".", ",")})`}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving || !todasColunasOk}
          onClick={() => void gravar()}
          className={formModalSubmitButtonClass}
        >
          {saving ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              Gravando…
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Save className="h-4 w-4 shrink-0" />
              Gravar percentuais
            </span>
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/90 px-3 py-2 text-sm text-rose-900 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-100">
          {error}
        </div>
      )}
    </div>
  );
}
