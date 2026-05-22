"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, useMotionTemplate, useMotionValue, animate } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Sparkles,
  Zap,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import clsx from "clsx";
import { formatDateDMY } from "@/lib/format/dates";
import {
  canViewResourceClient,
  isFullAccessSession,
} from "@/lib/configuracoes/permission-client";
import { getFinanceiroDefaultHref } from "@/lib/financeiro/financeiro-nav";

const ADMIN_DEFAULT_KPIS: Array<{
  id: string;
  label: string;
  value: number;
  trend: number;
  trendLabel: string;
}> = [
  { id: "receita", label: "A receber (aberto)", value: 0, trend: 0, trendLabel: "base real" },
  { id: "pagar", label: "A pagar (aberto)", value: 0, trend: 0, trendLabel: "base real" },
  { id: "pipeline", label: "Oportunidades ativas", value: 0, trend: 0, trendLabel: "funil" },
  { id: "risco", label: "Itens de atenção", value: 0, trend: 0, trendLabel: "soma críticos" },
];

const ADMIN_DEFAULT_RADAR = [
  { modulo: "Comercial", valor: 0 },
  { modulo: "Financeiro", valor: 0 },
  { modulo: "Clientes", valor: 0 },
  { modulo: "Suporte", valor: 0 },
  { modulo: "Tarefas", valor: 0 },
  { modulo: "Operação", valor: 0 },
];

const ADMIN_MODULE_TILES: Array<{
  id: string;
  title: string;
  href: string;
  stat: string;
  sub: string;
}> = [
  { id: "comercial", title: "Comercial", href: "/comercial", stat: "Pipeline", sub: "Funil e oportunidades" },
  { id: "financeiro", title: "Financeiro", href: "/financeiro", stat: "Fluxo", sub: "Lançamentos e caixa" },
  { id: "clientes", title: "Clientes", href: "/clientes", stat: "Cadastro", sub: "Base de clientes" },
  { id: "helpdesk", title: "Suporte", href: "/suporte", stat: "Chamados", sub: "Tickets e SLA" },
  { id: "tarefas", title: "Tarefas", href: "/tarefas", stat: "Operação", sub: "Tarefas internas" },
  { id: "pos-venda", title: "Pós-venda", href: "/pos-venda", stat: "Régua", sub: "Ações e health" },
];

const PRIMARY = "#6D28D9";
const CYAN = "#06b6d4";
const MAGENTA = "#e879f9";

type KpiRow = {
  id: string;
  label: string;
  value: string;
  trend: string;
  trendLabel: string;
  positive: boolean;
};

type UpcomingRow = {
  id: string;
  tipo: string;
  titulo: string;
  when: string;
  href: string;
  accent: string;
};

type BootstrapPayload = {
  kpis: Array<{ id: string; label: string; value: number; trend: number; trendLabel: string }>;
  fluxoData: Array<{ semana: string; receita: number; fluxo: number }>;
  statusClientes: Array<{ name: string; value: number; color: string }>;
  atividades: Array<{ id: string; texto: string; tempo: string; cor: string }>;
  pipelineBars?: Array<{ id: string; label: string; count: number }>;
  upcoming?: UpcomingRow[];
  radarModulos?: Array<{ modulo: string; valor: number }>;
  moduleTiles?: ModuleTile[];
};

type ModuleTile = {
  id: string;
  title: string;
  href: string;
  stat: string;
  sub: string;
  cardClass: string;
};

const MODULE_CARD_STYLES: Record<string, string> = {
  comercial:
    "bg-gradient-to-br from-fuchsia-500/15 via-violet-600/10 to-transparent border-fuchsia-400/25 hover:border-fuchsia-400/50 dark:from-fuchsia-950/55 dark:via-violet-950/45 dark:to-slate-900/90 dark:border-fuchsia-500/30 dark:hover:border-fuchsia-400/45",
  financeiro:
    "bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent border-emerald-400/30 hover:border-emerald-400/55 dark:from-emerald-950/50 dark:via-teal-950/40 dark:to-slate-900/90 dark:border-emerald-500/35 dark:hover:border-emerald-400/50",
  clientes:
    "bg-gradient-to-br from-violet-500/15 to-transparent border-violet-400/30 hover:border-violet-400/55 dark:from-violet-950/50 dark:to-slate-900/90 dark:border-violet-500/35 dark:hover:border-violet-400/50",
  helpdesk:
    "bg-gradient-to-br from-sky-500/15 to-transparent border-sky-400/30 hover:border-sky-400/55 dark:from-sky-950/45 dark:to-slate-900/90 dark:border-sky-500/35 dark:hover:border-sky-400/50",
  tarefas:
    "bg-gradient-to-br from-amber-500/15 to-transparent border-amber-400/30 hover:border-amber-400/55 dark:from-amber-950/45 dark:to-slate-900/90 dark:border-amber-500/35 dark:hover:border-amber-400/50",
  "pos-venda":
    "bg-gradient-to-br from-rose-500/12 to-transparent border-rose-400/25 hover:border-rose-400/50 dark:from-rose-950/40 dark:to-slate-900/90 dark:border-rose-500/30 dark:hover:border-rose-400/45",
};

function formatKpiValue(id: string, raw: number): string {
  if (id === "receita" || id === "pagar") {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(raw);
  }
  return String(Math.round(raw));
}

function parseBootstrap(json: unknown): BootstrapPayload | null {
  if (!json || typeof json !== "object") return null;
  const root = json as { data?: BootstrapPayload & { data?: BootstrapPayload }; success?: boolean };
  const outer = root.data ?? (json as BootstrapPayload);
  if (!outer || typeof outer !== "object") return null;
  const nested = (outer as BootstrapPayload & { data?: BootstrapPayload }).data;
  const d =
    Array.isArray((outer as BootstrapPayload).kpis)
      ? (outer as BootstrapPayload)
      : nested && Array.isArray(nested.kpis)
        ? nested
        : null;
  if (!d || !Array.isArray(d.kpis)) return null;
  return d;
}

function applyBootstrapPayload(
  d: BootstrapPayload,
  fullAccess: boolean,
  session: Parameters<typeof getFinanceiroDefaultHref>[0]
) {
  const kpisRaw = d.kpis.length > 0 || !fullAccess ? d.kpis : ADMIN_DEFAULT_KPIS;
  const kpisRows = kpisRaw.map((k) => ({
    id: k.id,
    label: k.label,
    value: formatKpiValue(k.id, k.value),
    trend: k.trend ? `${k.trend >= 0 ? "+" : ""}${k.trend}%` : "—",
    trendLabel: k.trendLabel,
    positive: k.id !== "risco" ? true : k.value <= 5,
  }));

  const tilesFromApi = (d.moduleTiles ?? []).map((t) => ({
    ...t,
    cardClass: MODULE_CARD_STYLES[t.id] ?? MODULE_CARD_STYLES.clientes,
  }));
  const finHref = getFinanceiroDefaultHref(session);
  const moduleTilesResolved =
    fullAccess && tilesFromApi.length === 0
      ? ADMIN_MODULE_TILES.map((t) => ({
          ...t,
          href: t.id === "financeiro" ? finHref : t.href,
          cardClass: MODULE_CARD_STYLES[t.id] ?? MODULE_CARD_STYLES.clientes,
        }))
      : tilesFromApi;

  const radarResolved =
    (d.radarModulos?.length ?? 0) > 0
      ? (d.radarModulos ?? [])
      : fullAccess
        ? ADMIN_DEFAULT_RADAR
        : [];

  return {
    kpisRows,
    fluxoData: Array.isArray(d.fluxoData) ? d.fluxoData : [],
    statusClientes: d.statusClientes ?? [],
    atividades: (d.atividades || []).map((a) => ({
      ...a,
      tempo: formatDateDMY(a.tempo),
    })),
    pipelineBars: d.pipelineBars ?? [],
    upcoming: d.upcoming ?? [],
    radarModulos: radarResolved,
    moduleTiles: moduleTilesResolved,
  };
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 380, damping: 28 },
  },
};

function LiveClock() {
  const [t, setT] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setT(new Date());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const hora =
    t !== null
      ? t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      : "—";
  const data =
    t !== null
      ? t.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })
      : "—";
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <motion.p
        animate={{ opacity: [0.85, 1, 0.85], scale: [1, 1.03, 1] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        className="tabular-nums text-xl font-bold tracking-wide text-violet-700 dark:text-violet-300 sm:text-2xl"
      >
        {hora}
      </motion.p>
      <p className="mt-1 text-xs capitalize text-slate-500 dark:text-slate-400">{data}</p>
    </div>
  );
}

function HeroMesh() {
  const mx = useMotionValue(50);
  const my = useMotionValue(50);
  useEffect(() => {
    const c1 = animate(mx, [42, 58, 48, 52, 42], { duration: 18, repeat: Infinity, ease: "easeInOut" });
    const c2 = animate(my, [38, 62, 55, 45, 38], { duration: 22, repeat: Infinity, ease: "easeInOut" });
    return () => {
      c1.stop();
      c2.stop();
    };
  }, [mx, my]);
  const bg = useMotionTemplate`radial-gradient(ellipse 80% 70% at ${mx}% ${my}%, rgba(124,58,237,0.22) 0%, rgba(6,182,212,0.12) 35%, transparent 65%)`;
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
      style={{ background: bg }}
    />
  );
}

export function CommandCenter() {
  const { mode } = useTheme();
  const { session } = useAuth();
  const chartGrid = mode === "dark" ? "#334155" : "#e2e8f0";
  const chartTick = mode === "dark" ? "#94a3b8" : "#64748b";
  const chartTickY = mode === "dark" ? "#64748b" : "#94a3b8";
  const tooltipStyle = useMemo(
    () => ({
      borderRadius: "12px" as const,
      border: mode === "dark" ? "1px solid #475569" : "1px solid #e2e8f0",
      backgroundColor: mode === "dark" ? "#0f172a" : "#ffffff",
      color: mode === "dark" ? "#f1f5f9" : "#0f172a",
      boxShadow:
        mode === "dark"
          ? "0 10px 40px -10px rgba(0,0,0,0.5)"
          : "0 10px 40px -10px rgba(124,58,237,0.25)",
    }),
    [mode]
  );
  const tooltipStyleCyan = useMemo(
    () => ({
      ...tooltipStyle,
      boxShadow:
        mode === "dark"
          ? "0 10px 40px -10px rgba(0,0,0,0.5)"
          : "0 10px 40px -10px rgba(6,182,212,0.2)",
    }),
    [tooltipStyle, mode]
  );
  const nome = session.userName?.split(" ")[0] ?? "líder";

  const dashVis = useMemo(() => {
    if (isFullAccessSession(session)) {
      return {
        comercial: true,
        financeiro: true,
        clientes: true,
        helpdesk: true,
        tarefas: true,
        posVenda: true,
      };
    }
    return {
      comercial: canViewResourceClient(session, "comercial.pipeline"),
      financeiro: canViewResourceClient(session, "financeiro.lancamentos"),
      clientes: canViewResourceClient(session, "clientes.cadastro"),
      helpdesk: canViewResourceClient(session, "helpdesk.tickets"),
      tarefas: canViewResourceClient(session, "tarefas.internas"),
      posVenda: canViewResourceClient(session, "posvenda.tarefas"),
    };
  }, [session]);

  const [kpis, setKpis] = useState<KpiRow[]>([]);
  const [fluxoData, setFluxoData] = useState<Array<{ semana: string; receita: number; fluxo: number }>>([]);
  const [statusClientes, setStatusClientes] = useState<Array<{ name: string; value: number; color: string }>>([]);
  const [atividades, setAtividades] = useState<
    Array<{ id: string; texto: string; tempo: string; cor: string }>
  >([]);
  const [pipelineBars, setPipelineBars] = useState<Array<{ id: string; label: string; count: number }>>([]);
  const [upcoming, setUpcoming] = useState<UpcomingRow[]>([]);
  const [radarModulos, setRadarModulos] = useState<Array<{ modulo: string; valor: number }>>([]);
  const [moduleTiles, setModuleTiles] = useState<ModuleTile[]>([]);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const fullAccess = isFullAccessSession(session);

  useEffect(() => {
    if (!session.perfilId) return;
    let active = true;
    setBootstrapLoading(true);
    setBootstrapError(null);
    void (async () => {
      try {
        const res = await fetch("/api/dashboard/bootstrap", { cache: "no-store" });
        if (!res.ok) {
          if (active) {
            setBootstrapError(
              res.status === 401
                ? "Sessão expirada. Faça login novamente."
                : "Não foi possível carregar os dados da Central."
            );
          }
          return;
        }
        const json = await res.json();
        const d = parseBootstrap(json);
        if (!active || !d) {
          if (active) setBootstrapError("Resposta inválida da Central.");
          return;
        }

        const applied = applyBootstrapPayload(d, fullAccess, session);
        setKpis(applied.kpisRows);
        setFluxoData(applied.fluxoData);
        setStatusClientes(applied.statusClientes);
        setAtividades(applied.atividades);
        setPipelineBars(applied.pipelineBars);
        setUpcoming(applied.upcoming);
        setRadarModulos(applied.radarModulos);
        setModuleTiles(applied.moduleTiles);
      } catch {
        if (active) setBootstrapError("Falha de rede ao carregar a Central.");
      } finally {
        if (active) setBootstrapLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [session, fullAccess]);

  const barColors = useMemo(
    () => ["#a855f7", "#d946ef", "#6366f1", "#8b5cf6", "#22d3ee", "#34d399"],
    []
  );

  const pieTotal = statusClientes.reduce((s, x) => s + x.value, 0);

  return (
    <div className="relative min-h-full w-full pb-4">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />

      <motion.div variants={container} initial="hidden" animate="show" className="relative space-y-8">
        {/* Hero */}
        <motion.section
          variants={item}
          className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/70 p-6 shadow-lg shadow-violet-500/5 backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/75 dark:shadow-violet-900/15 md:p-8"
        >
          <HeroMesh />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-violet-50/90 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:border-violet-500/30 dark:bg-violet-950/50 dark:text-violet-200"
              >
                <Sparkles className="h-3.5 w-3.5 text-fuchsia-500" />
                Central de Comandos
              </motion.div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-4xl">
                Olá,{" "}
                <span className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-600 bg-clip-text text-transparent">
                  {nome}
                </span>
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-300 md:text-base">
                Decisões em tempo real: o que já moveu a operação e o que exige seu próximo passo nos próximos dias.
              </p>
            </div>
            <div className="flex flex-1 items-center justify-center md:justify-end">
              <div className="flex min-h-[120px] min-w-[240px] flex-col items-center justify-center text-center">
                <motion.div
                  animate={{ rotate: [0, 1.5, -1.5, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <CalendarClock className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </motion.div>
                <LiveClock />
              </div>
            </div>
          </div>
        </motion.section>

        {bootstrapError && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            {bootstrapError}
          </p>
        )}

        {bootstrapLoading && kpis.length === 0 && moduleTiles.length === 0 && (
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">Carregando indicadores…</p>
        )}

        {/* KPIs — somente recursos com permissão (API + perfil) */}
        {(kpis.length > 0 || (fullAccess && !bootstrapLoading && !bootstrapError)) && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi, i) => (
            <motion.article
              key={kpi.id}
              variants={item}
              whileHover={{ y: -4, transition: { type: "spring", stiffness: 400, damping: 20 } }}
              className={clsx(
                "group relative overflow-hidden rounded-2xl border p-5 shadow-md backdrop-blur-sm transition-shadow hover:shadow-xl",
                kpi.id === "risco" && !kpi.positive
                  ? "border-amber-300/60 bg-gradient-to-br from-amber-50/90 to-orange-50/50 dark:border-amber-500/40 dark:from-amber-950/45 dark:to-orange-950/35"
                  : "border-white/60 bg-gradient-to-br from-white/95 to-slate-50/80 dark:border-slate-600/70 dark:from-slate-800/95 dark:to-slate-900/90"
              )}
            >
              <div
                className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-40 blur-2xl transition-opacity group-hover:opacity-70"
                style={{
                  background:
                    i % 3 === 0
                      ? "linear-gradient(135deg, #c026d3, #7c3aed)"
                      : i % 3 === 1
                        ? "linear-gradient(135deg, #06b6d4, #2563eb)"
                        : "linear-gradient(135deg, #10b981, #14b8a6)",
                }}
              />
              <p className="relative text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {kpi.label}
              </p>
              <p className="relative mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-100 md:text-3xl">
                {kpi.value}
              </p>
              <div
                className={clsx(
                  "relative mt-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold",
                  kpi.positive
                    ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                    : "bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
                )}
              >
                <Zap className="h-3.5 w-3.5" />
                <span>
                  {kpi.trend} · {kpi.trendLabel}
                </span>
              </div>
            </motion.article>
          ))}
        </section>
        )}

        {/* Pipeline + Radar + Area — só módulos permitidos */}
        {(dashVis.comercial || dashVis.financeiro || radarModulos.length > 0 || fullAccess) && (
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {dashVis.comercial && (
          <motion.article
            variants={item}
            className={clsx(
              "rounded-3xl border border-slate-200/90 bg-white/90 dark:border-slate-700/90 dark:bg-slate-900/80 p-6 shadow-lg backdrop-blur-sm",
              dashVis.financeiro && radarModulos.length > 0
                ? "xl:col-span-5"
                : dashVis.financeiro || radarModulos.length > 0
                  ? "xl:col-span-6"
                  : "xl:col-span-12"
            )}
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Funil em movimento</h2>
              <Link
                href="/comercial"
                className="inline-flex items-center gap-1 text-sm font-semibold text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300"
              >
                Comercial <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="h-72">
              {pipelineBars.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipelineBars} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={MAGENTA} />
                        <stop offset="100%" stopColor={CYAN} />
                      </linearGradient>
                    </defs>
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={88}
                      tick={{ fontSize: 11, fill: chartTick }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: mode === "dark" ? "rgba(124,58,237,0.12)" : "rgba(124,58,237,0.06)" }}
                      contentStyle={tooltipStyle}
                    />
                    <Bar dataKey="count" radius={[0, 8, 8, 0]} animationDuration={900}>
                      {pipelineBars.map((_, idx) => (
                        <Cell key={pipelineBars[idx].id} fill={barColors[idx % barColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-400">
                  Sem oportunidades no funil para exibir o gráfico.
                </div>
              )}
            </div>
          </motion.article>
          )}

          {(radarModulos.length > 0 || fullAccess) && (
          <motion.article
            variants={item}
            className={clsx(
              "rounded-3xl border border-slate-200/90 bg-gradient-to-b from-violet-950/[0.03] to-cyan-950/[0.04] p-5 shadow-lg backdrop-blur-sm dark:border-slate-700/90 dark:from-slate-900/80 dark:to-slate-900/90",
              dashVis.comercial && dashVis.financeiro
                ? "xl:col-span-3"
                : dashVis.comercial || dashVis.financeiro
                  ? "xl:col-span-6"
                  : "xl:col-span-12"
            )}
          >
            <h2 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-100">Pulse dos módulos</h2>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Índice resumido para decisão (0–100)</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarModulos}>
                  <PolarGrid stroke={chartGrid} />
                  <PolarAngleAxis dataKey="modulo" tick={{ fontSize: 10, fill: chartTick }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    name="Pulse"
                    dataKey="valor"
                    stroke={PRIMARY}
                    fill={PRIMARY}
                    fillOpacity={0.35}
                    animationDuration={1000}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </motion.article>
          )}

          {dashVis.financeiro && (
          <motion.article
            variants={item}
            className={clsx(
              "rounded-3xl border border-slate-200/90 bg-white/90 dark:border-slate-700/90 dark:bg-slate-900/80 p-6 shadow-lg backdrop-blur-sm",
              dashVis.comercial && radarModulos.length > 0
                ? "xl:col-span-4"
                : dashVis.comercial || radarModulos.length > 0
                  ? "xl:col-span-6"
                  : "xl:col-span-12"
            )}
          >
            <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">Entradas × movimento</h2>
            <div className="h-72">
              {fluxoData.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-400">
                  Sem lançamentos financeiros para exibir o gráfico.
                </div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={fluxoData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gFlux" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CYAN} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={CYAN} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="semana" tick={{ fontSize: 11, fill: chartTick }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: chartTickY }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                    width={44}
                  />
                  <Tooltip
                    formatter={(v: number, name: string) => [
                      `R$ ${Number(v).toLocaleString("pt-BR")}`,
                      name === "receita" ? "Entradas" : "Referência",
                    ]}
                    contentStyle={tooltipStyleCyan}
                  />
                  <Area type="monotone" dataKey="receita" stroke={PRIMARY} strokeWidth={2} fill="url(#gRec)" />
                  <Area type="monotone" dataKey="fluxo" stroke={CYAN} strokeWidth={2} fill="url(#gFlux)" />
                </AreaChart>
              </ResponsiveContainer>
              )}
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
              {fluxoData.length ? "Últimos lançamentos no eixo temporal (valores em R$)" : "Dados reais do Financeiro"}
            </p>
          </motion.article>
          )}
        </section>
        )}

        {/* Cards de módulos + clientes — admin vê todos os módulos via dashVis */}
        {(moduleTiles.length > 0 || dashVis.clientes || fullAccess) && (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {(moduleTiles.length > 0 || fullAccess) && (
          <motion.div
            variants={item}
            className={clsx("space-y-4", dashVis.clientes ? "lg:col-span-7" : "lg:col-span-12")}
          >
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Módulos — ir direto ao que importa</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(moduleTiles.length > 0
                ? moduleTiles
                : fullAccess
                  ? ADMIN_MODULE_TILES.map((t) => ({
                      ...t,
                      href: t.id === "financeiro" ? getFinanceiroDefaultHref(session) : t.href,
                      cardClass: MODULE_CARD_STYLES[t.id] ?? MODULE_CARD_STYLES.clientes,
                    }))
                  : []
              ).map((m, idx) => (
                <motion.div key={m.id} variants={item} custom={idx}>
                  <Link
                    href={m.href}
                    className={clsx(
                      "group flex flex-col rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
                      m.cardClass ?? MODULE_CARD_STYLES.clientes
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{m.title}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-600 dark:group-hover:text-violet-400" />
                    </div>
                    <p className="mt-2 text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100">{m.stat}</p>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{m.sub}</p>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
          )}

          {dashVis.clientes && (
          <motion.article
            variants={item}
            className={clsx(
              "rounded-3xl border border-slate-200/90 bg-white/90 dark:border-slate-700/90 dark:bg-slate-900/80 p-6 shadow-lg backdrop-blur-sm",
              moduleTiles.length > 0 ? "lg:col-span-5" : "lg:col-span-12"
            )}
          >
            <h2 className="mb-2 text-lg font-bold text-slate-900 dark:text-slate-100">Base de clientes</h2>
            <div className="h-56">
              {pieTotal === 0 ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-400">
                  Nenhum cliente cadastrado ainda — distribuição vazia.
                </div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusClientes}
                    cx="42%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                    animationDuration={900}
                  >
                    {statusClientes.map((e, i) => (
                      <Cell key={`${e.name}-${i}`} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, n: string) => [v, n]} contentStyle={tooltipStyle} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
              )}
            </div>
          </motion.article>
          )}
        </section>
        )}

        {/* Próximos 7 dias + Feed */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <motion.article
            variants={item}
            className="rounded-3xl border border-fuchsia-200/50 bg-gradient-to-br from-fuchsia-50/40 via-white to-cyan-50/30 p-6 shadow-lg dark:border-fuchsia-500/25 dark:from-fuchsia-950/35 dark:via-slate-900 dark:to-cyan-950/25 lg:col-span-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Próximos 7 dias</h2>
              <span className="rounded-full bg-violet-600/10 px-2.5 py-0.5 text-xs font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                {upcoming.length} eventos
              </span>
            </div>
            <ul className="space-y-3">
              {upcoming.length === 0 ? (
                <li className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
                  Nada crítico no horizonte — ótimo momento para planejar.
                </li>
              ) : (
                upcoming.map((u, i) => (
                  <motion.li
                    key={u.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link
                      href={u.href}
                      className="flex gap-3 rounded-xl border border-white/80 bg-white/80 p-3 shadow-sm transition-all hover:border-violet-200 hover:shadow-md dark:border-slate-600/80 dark:bg-slate-800/90 dark:hover:border-violet-500/40 dark:hover:shadow-violet-950/20"
                    >
                      <span
                        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: u.accent }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{u.tipo}</p>
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{u.titulo}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(u.when).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                    </Link>
                  </motion.li>
                ))
              )}
            </ul>
          </motion.article>

          <motion.article
            variants={item}
            className="rounded-3xl border border-slate-200/90 bg-white/90 dark:border-slate-700/90 dark:bg-slate-900/80 p-6 shadow-lg backdrop-blur-sm lg:col-span-7"
          >
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Linha do tempo — auditoria</h2>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              Histórico resumido do painel; detalhes completos permanecem nos módulos.
            </p>
            <ul className="space-y-0">
              {atividades.length === 0 ? (
                <li className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-400">
                  Nenhum evento listado aqui no momento.
                </li>
              ) : (
                atividades.map((ev, idx, arr) => (
                  <motion.li key={ev.id} className="relative flex gap-4 pb-5 last:pb-0">
                    {idx < arr.length - 1 && (
                      <span className="absolute left-[11px] top-6 h-[calc(100%-4px)] w-px bg-gradient-to-b from-violet-200 to-cyan-100 dark:from-violet-800/80 dark:to-cyan-900/60" />
                    )}
                    <span
                      className={clsx(
                        "relative z-10 mt-1.5 h-3 w-3 shrink-0 rounded-full ring-4 ring-white dark:ring-slate-900",
                        ev.cor
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800 dark:text-slate-200">{ev.texto}</p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{ev.tempo}</p>
                    </div>
                  </motion.li>
                ))
              )}
            </ul>
          </motion.article>
        </section>
      </motion.div>
    </div>
  );
}
