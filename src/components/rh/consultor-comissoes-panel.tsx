"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  LayoutTemplate,
  Package,
  Pencil,
  Percent,
  PieChart,
  Power,
  Save,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import type { ComissaoBaseCalculo, ComissaoRegra } from "@/lib/comissoes/types";
import { formatPercentPtBr2 } from "@/lib/comissoes/format-percent";
import { formInputClass, formModalCancelButtonClass, formModalSubmitButtonClass } from "@/components/ui/field-patterns";
import { FormLabel } from "@/components/ui/form-fields/form-label";
import { FormDateField } from "@/components/ui/form-fields/form-date-field";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { AlertDialog } from "@/components/ui/alert-dialog";

const inputComIcone = `${formInputClass} pl-10`;

/** Ícones do campo Solução ou categoria */
const ICON_SOL_REGRA_GERAL = "text-violet-600 dark:text-violet-400";
const ICON_SOL_CATEGORIA = "text-amber-600 dark:text-amber-400";
const ICON_SOL_SOLUCAO = "text-sky-600 dark:text-sky-400";

/** Ícones do campo Base de cálculo */
const ICON_BASE_BRUTO = "text-indigo-600 dark:text-indigo-400";
const ICON_BASE_LIQUIDO = "text-teal-600 dark:text-teal-400";

type NovaRegraFormState = {
  solucaoCatalogoId: string;
  categoriaSolucao: string;
  baseCalculo: ComissaoBaseCalculo;
  percentualComissao: string;
  despesaFixa: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  prioridade: string;
  observacoes: string;
};

function createEmptyNovaRegra(): NovaRegraFormState {
  return {
    solucaoCatalogoId: "",
    categoriaSolucao: "",
    baseCalculo: "bruto",
    percentualComissao: "",
    despesaFixa: "",
    vigenciaInicio: new Date().toISOString().slice(0, 10),
    vigenciaFim: "",
    prioridade: "0",
    observacoes: "",
  };
}

function isoLocalDateInput(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function numToDecimalInputPtBr2(n: number): string {
  const x = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(x);
}

type ConsultorComissoesPanelProps = {
  consultorId: string;
};

function encCat(cat: string) {
  return `cat:${encodeURIComponent(cat)}`;
}

function parseAlvoSolucaoCategoria(v: string): { solucaoCatalogoId: string; categoriaSolucao: string } {
  if (v === "__geral__" || !v) return { solucaoCatalogoId: "", categoriaSolucao: "" };
  if (v.startsWith("sol:")) return { solucaoCatalogoId: v.slice(4), categoriaSolucao: "" };
  if (v.startsWith("cat:")) return { solucaoCatalogoId: "", categoriaSolucao: decodeURIComponent(v.slice(4)) };
  return { solucaoCatalogoId: "", categoriaSolucao: "" };
}

function valorAlvoFromRegra(solucaoCatalogoId: string, categoriaSolucao: string): string {
  const c = categoriaSolucao.trim();
  if (solucaoCatalogoId) return `sol:${solucaoCatalogoId}`;
  if (c) return encCat(c);
  return "__geral__";
}

export function ConsultorComissoesPanel({ consultorId }: ConsultorComissoesPanelProps) {
  const [regras, setRegras] = useState<ComissaoRegra[]>([]);
  const [loadingRegras, setLoadingRegras] = useState(false);
  const [salvandoRegra, setSalvandoRegra] = useState(false);
  const [regraErro, setRegraErro] = useState<string | null>(null);
  const [solucoes, setSolucoes] = useState<Array<{ id: string; nome: string; categoria?: string | null }>>([]);
  const [novaRegra, setNovaRegra] = useState<NovaRegraFormState>(createEmptyNovaRegra);
  const [editingRegraId, setEditingRegraId] = useState<string | null>(null);
  const [excluindoRegraId, setExcluindoRegraId] = useState<string | null>(null);
  const [alternandoRegraId, setAlternandoRegraId] = useState<string | null>(null);

  const regrasOrdenadas = useMemo(() => {
    return [...regras].sort((a, b) => {
      if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
      return new Date(b.vigenciaInicio).getTime() - new Date(a.vigenciaInicio).getTime();
    });
  }, [regras]);

  const opcoesSolucaoOuCategoria = useMemo((): SearchableOption[] => {
    const out: SearchableOption[] = [
      {
        value: "__geral__",
        label: "Regra geral (todas as soluções)",
        subtitle: "Sem filtro por solução ou categoria",
        icon: LayoutTemplate,
        iconClassName: ICON_SOL_REGRA_GERAL,
      },
    ];
    const cats = new Set<string>();
    for (const s of solucoes) {
      const c = (s.categoria ?? "").trim();
      if (c) cats.add(c);
    }
    const sortedCats = [...cats].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
    for (const cat of sortedCats) {
      out.push({
        value: encCat(cat),
        label: `Categoria: ${cat}`,
        subtitle: "Regra vale para todas as soluções com esta categoria no cadastro",
        icon: Tag,
        iconClassName: ICON_SOL_CATEGORIA,
      });
    }
    const sortedSol = [...solucoes].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
    );
    for (const s of sortedSol) {
      const cat = (s.categoria ?? "").trim();
      out.push({
        value: `sol:${s.id}`,
        label: `Solução: ${s.nome}`,
        subtitle: cat ? `Categoria: ${cat}` : "Sem categoria no cadastro da solução",
        icon: Package,
        iconClassName: ICON_SOL_SOLUCAO,
      });
    }
    return out;
  }, [solucoes]);

  const alvoSolCatValue = useMemo(
    () => valorAlvoFromRegra(novaRegra.solucaoCatalogoId, novaRegra.categoriaSolucao),
    [novaRegra.solucaoCatalogoId, novaRegra.categoriaSolucao]
  );

  const onAlvoSolCatChange = useCallback((v: string) => {
    const parsed = parseAlvoSolucaoCategoria(v);
    setNovaRegra((prev) => ({
      ...prev,
      solucaoCatalogoId: parsed.solucaoCatalogoId,
      categoriaSolucao: parsed.categoriaSolucao,
    }));
  }, []);

  const baseCalculoOptions = useMemo<SearchableOption[]>(
    () => [
      {
        value: "bruto",
        label: "Bruto",
        subtitle: "Comissão sobre valor total da venda.",
        icon: Circle,
        iconClassName: ICON_BASE_BRUTO,
      },
      {
        value: "liquido",
        label: "Líquido",
        subtitle: "Comissão com desconto da Despesa Fixa.",
        icon: PieChart,
        iconClassName: ICON_BASE_LIQUIDO,
      },
    ],
    []
  );

  const formComissaoRef = useRef<HTMLDivElement>(null);
  const [regraParaExcluir, setRegraParaExcluir] = useState<ComissaoRegra | null>(null);

  useEffect(() => {
    if (!consultorId) {
      setRegras([]);
      setSolucoes([]);
      setLoadingRegras(false);
      setRegraErro(null);
      setEditingRegraId(null);
      setNovaRegra(createEmptyNovaRegra());
      setRegraParaExcluir(null);
      return;
    }
    setEditingRegraId(null);
    setNovaRegra(createEmptyNovaRegra());
    setRegraParaExcluir(null);
    let active = true;
    setLoadingRegras(true);
    setRegraErro(null);
    void (async () => {
      try {
        const [resRegras, resCatalogo] = await Promise.all([
          fetch(`/api/rh/comissoes/regras?consultorId=${consultorId}`, { cache: "no-store" }),
          fetch("/api/comissoes/catalogo", { cache: "no-store" }),
        ]);
        const regrasJson = (await resRegras.json()) as { data?: { regras?: ComissaoRegra[] } };
        const catalogoJson = (await resCatalogo.json()) as {
          data?: { solucoes?: Array<{ id: string; nome: string; categoria?: string | null }> };
        };
        if (!active) return;
        setRegras(regrasJson?.data?.regras ?? []);
        setSolucoes(catalogoJson?.data?.solucoes ?? []);
      } catch {
        if (!active) return;
        setRegraErro("Não foi possível carregar as regras de comissão.");
      } finally {
        if (active) setLoadingRegras(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [consultorId]);

  const cancelarEdicao = useCallback(() => {
    setEditingRegraId(null);
    setNovaRegra(createEmptyNovaRegra());
    setRegraErro(null);
  }, []);

  const iniciarEdicao = useCallback((r: ComissaoRegra) => {
    setEditingRegraId(r.id);
    setRegraErro(null);
    setNovaRegra({
      solucaoCatalogoId: r.solucaoCatalogoId ?? "",
      categoriaSolucao: r.categoriaSolucao ?? "",
      baseCalculo: r.baseCalculo,
      percentualComissao: numToDecimalInputPtBr2(r.percentualComissao),
      despesaFixa:
        r.baseCalculo === "liquido" && r.despesaFixa != null ? numToDecimalInputPtBr2(r.despesaFixa) : "",
      vigenciaInicio: isoLocalDateInput(r.vigenciaInicio),
      vigenciaFim: r.vigenciaFim ? isoLocalDateInput(r.vigenciaFim) : "",
      prioridade: String(r.prioridade ?? 0),
      observacoes: r.observacoes ?? "",
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        formComissaoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }, []);

  const salvarRegra = async () => {
    if (!consultorId) return;
    if (!novaRegra.percentualComissao.trim()) {
      setRegraErro("Informe o percentual de comissão.");
      return;
    }
    const pct = Number(novaRegra.percentualComissao.replace(",", "."));
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setRegraErro("Percentual de comissão deve ficar entre 0 e 100.");
      return;
    }
    let despesaPayload: number | null = null;
    if (novaRegra.baseCalculo === "liquido") {
      if (novaRegra.despesaFixa.trim()) {
        const d = Number(novaRegra.despesaFixa.replace(",", "."));
        if (!Number.isFinite(d) || d < 0 || d > 100) {
          setRegraErro("Despesa fixa (%) deve ficar entre 0 e 100.");
          return;
        }
        despesaPayload = d;
      }
    }

    setSalvandoRegra(true);
    setRegraErro(null);
    const idEdicao = editingRegraId;
    const isAtualizacao = Boolean(idEdicao);
    try {
      if (idEdicao) {
        const res = await fetch(`/api/rh/comissoes/regras/${idEdicao}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            regra: {
              solucaoCatalogoId: novaRegra.solucaoCatalogoId || null,
              categoriaSolucao: novaRegra.categoriaSolucao.trim() || null,
              baseCalculo: novaRegra.baseCalculo,
              percentualComissao: pct,
              despesaFixa: novaRegra.baseCalculo === "liquido" ? despesaPayload : null,
              vigenciaInicio: new Date(`${novaRegra.vigenciaInicio}T00:00:00`).toISOString(),
              vigenciaFim: novaRegra.vigenciaFim
                ? new Date(`${novaRegra.vigenciaFim}T23:59:59`).toISOString()
                : null,
              prioridade: Number(novaRegra.prioridade || "0"),
            },
          }),
        });
        const json = (await res.json()) as { data?: { regra?: ComissaoRegra }; error?: { message?: string } };
        if (!res.ok || !json?.data?.regra) {
          setRegraErro(json?.error?.message ?? "Não foi possível atualizar a regra.");
          return;
        }
        setRegras((prev) => prev.map((row) => (row.id === idEdicao ? json.data!.regra! : row)));
        cancelarEdicao();
        return;
      }

      const res = await fetch("/api/rh/comissoes/regras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regra: {
            consultorId,
            solucaoCatalogoId: novaRegra.solucaoCatalogoId || undefined,
            categoriaSolucao: novaRegra.categoriaSolucao || undefined,
            baseCalculo: novaRegra.baseCalculo,
            percentualComissao: pct,
            despesaFixa: despesaPayload,
            vigenciaInicio: new Date(`${novaRegra.vigenciaInicio}T00:00:00`).toISOString(),
            vigenciaFim: novaRegra.vigenciaFim
              ? new Date(`${novaRegra.vigenciaFim}T23:59:59`).toISOString()
              : null,
            prioridade: Number(novaRegra.prioridade || "0"),
            observacoes: novaRegra.observacoes || undefined,
          },
        }),
      });
      const json = (await res.json()) as { data?: { regra?: ComissaoRegra }; error?: { message?: string } };
      if (!res.ok || !json?.data?.regra) {
        setRegraErro(json?.error?.message ?? "Não foi possível salvar a regra.");
        return;
      }
      setRegras((prev) => [json.data!.regra!, ...prev]);
      setNovaRegra(createEmptyNovaRegra());
    } catch {
      setRegraErro(isAtualizacao ? "Não foi possível atualizar a regra." : "Não foi possível salvar a regra.");
    } finally {
      setSalvandoRegra(false);
    }
  };

  const alternarRegra = async (id: string, ativo: boolean) => {
    setAlternandoRegraId(id);
    setRegraErro(null);
    try {
      const res = await fetch(`/api/rh/comissoes/regras/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regra: { ativo } }),
      });
      const json = (await res.json()) as { data?: { regra?: ComissaoRegra }; error?: { message?: string } };
      if (!res.ok || !json?.data?.regra) {
        setRegraErro(json?.error?.message ?? "Não foi possível alterar o status da regra.");
        return;
      }
      setRegras((prev) => prev.map((r) => (r.id === id ? json.data!.regra! : r)));
    } catch {
      setRegraErro("Não foi possível alterar o status da regra.");
    } finally {
      setAlternandoRegraId(null);
    }
  };

  const tituloRegra = (r: ComissaoRegra) =>
    r.solucaoNome ? `Solução: ${r.solucaoNome}` : r.categoriaSolucao ? `Categoria: ${r.categoriaSolucao}` : "Regra geral";

  const solicitarExclusaoRegra = (r: ComissaoRegra) => {
    if (salvandoRegra || excluindoRegraId !== null || alternandoRegraId !== null) return;
    setRegraParaExcluir(r);
  };

  const executarExclusaoRegra = async (r: ComissaoRegra) => {
    const estavaEditandoEsta = editingRegraId === r.id;
    setExcluindoRegraId(r.id);
    setRegraErro(null);
    try {
      const res = await fetch(`/api/rh/comissoes/regras/${r.id}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setRegraErro(json?.error?.message ?? "Não foi possível excluir a regra.");
        return;
      }
      setRegras((prev) => prev.filter((row) => row.id !== r.id));
      if (estavaEditandoEsta) cancelarEdicao();
    } catch {
      setRegraErro("Não foi possível excluir a regra.");
    } finally {
      setExcluindoRegraId(null);
    }
  };

  const resumoRegra = (r: ComissaoRegra) => {
    const baseLabel = r.baseCalculo === "liquido" ? "líquida" : "bruta";
    const partes = [
      `Comissão ${formatPercentPtBr2(r.percentualComissao)}`,
      `base ${baseLabel}`,
    ];
    if (r.baseCalculo === "liquido" && r.despesaFixa != null) {
      partes.push(`despesa ${formatPercentPtBr2(r.despesaFixa)}`);
    }
    partes.push(
      `vigência ${new Date(r.vigenciaInicio).toLocaleDateString("pt-BR")}${
        r.vigenciaFim ? ` — ${new Date(r.vigenciaFim).toLocaleDateString("pt-BR")}` : ""
      }`
    );
    return partes.join(" · ");
  };

  return (
    <div className="space-y-8 text-sm text-slate-700 dark:text-slate-200">
      <div ref={formComissaoRef} className="scroll-mt-6 space-y-4">
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {editingRegraId ? "Editar regra" : "Nova regra"}
          </p>
          {editingRegraId ? (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Ajuste os campos e salve para atualizar o cadastro.
            </p>
          ) : null}
        </div>
        {regraErro ? <p className="text-xs text-red-600 dark:text-red-400">{regraErro}</p> : null}

        <div>
          <FormLabel>Solução ou categoria</FormLabel>
          <div className="mt-1">
            <SearchableSelect
              options={opcoesSolucaoOuCategoria}
              value={alvoSolCatValue}
              onChange={onAlvoSolCatChange}
              placeholder="Solução ou categoria (digite para filtrar)…"
              searchPlaceholder="Filtrar por nome de solução ou categoria…"
              emptyLabel="Nenhuma solução ou categoria encontrada."
              leadingIcon={Package}
              leadingIconClassName={ICON_SOL_SOLUCAO}
            />
          </div>
        </div>

        <div
          className={`grid grid-cols-1 gap-4 ${novaRegra.baseCalculo === "liquido" ? "md:grid-cols-3" : "md:grid-cols-2"}`}
        >
          <div>
            <FormLabel>Base de cálculo</FormLabel>
            <div className="mt-1">
              <SearchableSelect
                options={baseCalculoOptions}
                value={novaRegra.baseCalculo}
                onChange={(v) =>
                  setNovaRegra((prev) => ({
                    ...prev,
                    baseCalculo: v as ComissaoBaseCalculo,
                    despesaFixa: v === "bruto" ? "" : prev.despesaFixa,
                  }))
                }
                placeholder="Selecione…"
                searchable={false}
                leadingIcon={novaRegra.baseCalculo === "liquido" ? PieChart : Circle}
                leadingIconClassName={
                  novaRegra.baseCalculo === "liquido" ? ICON_BASE_LIQUIDO : ICON_BASE_BRUTO
                }
              />
            </div>
          </div>
          {novaRegra.baseCalculo === "liquido" ? (
            <div>
              <FormLabel>Despesa fixa (%)</FormLabel>
              <div className="relative mt-1">
                <Percent className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="rh-com-despesa-pct-input"
                  aria-label="Despesa fixa em percentual"
                  value={novaRegra.despesaFixa}
                  onChange={(e) => setNovaRegra((prev) => ({ ...prev, despesaFixa: e.target.value }))}
                  className={inputComIcone}
                  placeholder="Ex.: 5,00"
                  inputMode="decimal"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Percentual descontado do valor bruto antes de aplicar a comissão.
              </p>
            </div>
          ) : null}
          <div>
            <FormLabel required>Percentual de comissão</FormLabel>
            <div className="relative mt-1">
              <Percent className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="rh-com-pct-comissao"
                value={novaRegra.percentualComissao}
                onChange={(e) => setNovaRegra((prev) => ({ ...prev, percentualComissao: e.target.value }))}
                className={inputComIcone}
                placeholder="Ex.: 10,00"
                inputMode="decimal"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormDateField
            id="rh-com-vig-ini"
            label="Início vigência"
            required
            value={novaRegra.vigenciaInicio}
            onChange={(v) => setNovaRegra((prev) => ({ ...prev, vigenciaInicio: v }))}
          />
          <FormDateField
            id="rh-com-vig-fim"
            label="Fim vigência"
            value={novaRegra.vigenciaFim}
            onChange={(v) => setNovaRegra((prev) => ({ ...prev, vigenciaFim: v }))}
            placeholder="Opcional"
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
          {editingRegraId ? (
            <button type="button" onClick={cancelarEdicao} className={formModalCancelButtonClass}>
              <span className="inline-flex items-center gap-2">
                <X className="h-4 w-4 shrink-0" aria-hidden />
                Cancelar edição
              </span>
            </button>
          ) : null}
          <button
            type="button"
            disabled={salvandoRegra}
            onClick={() => void salvarRegra()}
            className={`${formModalSubmitButtonClass} inline-flex items-center justify-center gap-2`}
          >
            <Save className="h-4 w-4 shrink-0" aria-hidden />
            {salvandoRegra ? "Salvando…" : editingRegraId ? "Salvar alterações" : "Salvar regra"}
          </button>
        </div>
      </div>

      <div className="space-y-3 border-t border-slate-200 pt-8 dark:border-slate-700">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Regras cadastradas</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Ativas são consideradas no recebimento pago; inativas ficam no histórico até você excluir ou reativar.
          </p>
        </div>
        {loadingRegras ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Carregando regras…</p>
        ) : regrasOrdenadas.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma regra cadastrada.</p>
        ) : (
          <ul className="space-y-3">
            {regrasOrdenadas.map((r) => {
              const acoesBloqueadas =
                salvandoRegra || excluindoRegraId !== null || alternandoRegraId !== null;
              const estaExcluindo = excluindoRegraId === r.id;
              const estaAlternando = alternandoRegraId === r.id;
              const editandoEsta = editingRegraId === r.id;
              return (
                <li
                  key={r.id}
                  className={`rounded-xl border border-slate-200/90 bg-slate-50 px-4 py-3.5 shadow-sm transition-shadow dark:border-slate-700 dark:bg-slate-800/70 ${
                    editandoEsta ? "ring-2 ring-[#6D28D9]/35 dark:ring-violet-400/30" : ""
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{tituloRegra(r)}</p>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                            r.ativo
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                              : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                          }`}
                        >
                          {r.ativo ? "Ativa" : "Inativa"}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {resumoRegra(r)}
                      </p>
                    </div>
                    <div className="ml-auto flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        disabled={acoesBloqueadas}
                        onClick={() => iniciarEdicao(r)}
                        className="inline-flex rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9]/30 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        title="Editar regra"
                        aria-label="Editar regra"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={acoesBloqueadas || estaAlternando}
                        onClick={() => void alternarRegra(r.id, !r.ativo)}
                        className={`inline-flex rounded-lg p-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9]/30 disabled:cursor-not-allowed disabled:opacity-40 ${
                          r.ativo
                            ? "text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300"
                        }`}
                        title={r.ativo ? "Desativar regra" : "Ativar regra"}
                        aria-label={r.ativo ? "Desativar regra" : "Ativar regra"}
                      >
                        <Power className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={acoesBloqueadas || estaExcluindo}
                        onClick={() => solicitarExclusaoRegra(r)}
                        className="inline-flex rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                        title="Excluir regra"
                        aria-label="Excluir regra"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AlertDialog
        open={!!regraParaExcluir}
        onClose={() => setRegraParaExcluir(null)}
        onConfirm={() => {
          const alvo = regraParaExcluir;
          if (alvo) void executarExclusaoRegra(alvo);
        }}
        title="Excluir regra de comissão?"
        description={
          regraParaExcluir ? (
            <div className="space-y-3">
              <p>
                Esta ação é <strong className="text-slate-900 dark:text-slate-100">irreversível</strong>: a regra
                deixa de existir no cadastro e não pode ser recuperada.
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                Regra:{" "}
                <strong className="text-slate-900 dark:text-slate-100">{tituloRegra(regraParaExcluir)}</strong>
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                Eventos de comissão já gerados podem ficar sem vínculo com esta regra.
              </p>
            </div>
          ) : null
        }
        cancelLabel="Cancelar"
        confirmLabel="Sim, excluir permanentemente"
        destructive
      />
    </div>
  );
}
