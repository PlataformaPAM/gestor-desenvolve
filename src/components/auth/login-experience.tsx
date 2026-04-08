"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Fingerprint,
  Handshake,
  LayoutDashboard,
  LifeBuoy,
  ListTodo,
  Lock,
  Package,
  UserCog,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

/** Identidade: roxo #6D28D9 + violeta + âmbar/dourado (sem ênfase em azul/ciano) */
const ORBS = [
  { className: "left-[10%] top-[20%] h-72 w-72 bg-[#6D28D9]/35", delay: 0 },
  { className: "right-[5%] top-[40%] h-96 w-96 bg-amber-500/15", delay: 0.4 },
  { className: "bottom-[10%] left-[30%] h-64 w-64 bg-violet-600/28", delay: 0.8 },
];

/** Mesmos ícones da sidebar (`dashboard-shell` NAV_ITEMS), ordem 3×3. */
const LOGIN_MODULE_CARDS = [
  {
    title: "Central de Comandos",
    tagline: "Dashboard",
    icon: LayoutDashboard,
    accent: "from-[#6D28D9]/50 to-violet-900/30",
    borderTint: "border-violet-400/25",
    iconClass: "text-violet-100",
  },
  {
    title: "Comercial",
    tagline: "Pipeline de vendas",
    icon: Handshake,
    accent: "from-fuchsia-600/40 to-violet-950/40",
    borderTint: "border-fuchsia-400/20",
    iconClass: "text-fuchsia-100",
  },
  {
    title: "Financeiro",
    icon: Wallet,
    accent: "from-amber-500/35 to-orange-950/35",
    borderTint: "border-amber-400/25",
    iconClass: "text-amber-100",
  },
  {
    title: "Clientes",
    tagline: "Gestão 360",
    icon: Users,
    accent: "from-violet-400/40 to-fuchsia-950/45",
    borderTint: "border-violet-300/25",
    iconClass: "text-violet-100",
  },
  {
    title: "Soluções",
    tagline: "Playbook",
    icon: Package,
    accent: "from-fuchsia-500/35 to-amber-950/35",
    borderTint: "border-fuchsia-300/22",
    iconClass: "text-fuchsia-100",
  },
  {
    title: "Helpdesk",
    icon: LifeBuoy,
    accent: "from-amber-400/35 to-violet-950/45",
    borderTint: "border-amber-300/28",
    iconClass: "text-amber-100",
  },
  {
    title: "Pós-venda",
    icon: CheckCircle2,
    accent: "from-lime-500/25 to-violet-950/45",
    borderTint: "border-lime-400/18",
    iconClass: "text-lime-100",
  },
  {
    title: "Tarefas Internas",
    icon: ListTodo,
    accent: "from-rose-500/30 to-violet-950/40",
    borderTint: "border-rose-400/20",
    iconClass: "text-rose-100",
  },
  {
    title: "Gestão de Pessoas",
    icon: UserCog,
    accent: "from-indigo-500/40 to-slate-950/50",
    borderTint: "border-indigo-400/22",
    iconClass: "text-indigo-100",
  },
] as const;

export function LoginExperience() {
  const router = useRouter();
  const { syncFromCookie } = useAuth();
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot" | "reset">("login");
  const [emailRecuperacao, setEmailRecuperacao] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmNovaSenha, setConfirmNovaSenha] = useState("");
  const [resetToken, setResetToken] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const modeParam = (url.searchParams.get("mode") || "").toLowerCase();
    const tokenParam = (url.searchParams.get("token") || "").trim();
    if (modeParam === "forgot") setMode("forgot");
    if (modeParam === "reset" || tokenParam) {
      setMode("reset");
      if (tokenParam) setResetToken(tokenParam);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf, senha }),
      });
      const data = (await res.json()) as {
        success: boolean;
        data?: { perfilId?: string };
        error?: { message?: string };
      };
      if (!res.ok || !data.success || !data.data?.perfilId) {
        setErro(data.error?.message || "CPF ou senha incorretos. Tente novamente.");
        setLoading(false);
        return;
      }
      await syncFromCookie();
      router.push("/");
      router.refresh();
    } catch {
      setErro("Falha ao autenticar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailRecuperacao.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) {
        setErro(data?.error?.message || "Não foi possível enviar o e-mail de recuperação.");
        return;
      }
      setErro("Se o e-mail existir e estiver ativo, enviaremos um link de redefinição.");
      setMode("login");
      setEmailRecuperacao("");
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    if (!resetToken.trim()) {
      setErro("Token inválido.");
      return;
    }
    if (novaSenha !== confirmNovaSenha) {
      setErro("A confirmação da senha não confere.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken.trim(), novaSenha }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) {
        setErro(data?.error?.message || "Não foi possível redefinir a senha.");
        return;
      }
      setErro("Senha redefinida com sucesso. Faça login com a nova senha.");
      setMode("login");
      setNovaSenha("");
      setConfirmNovaSenha("");
      setResetToken("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-[100dvh] max-h-[100dvh] min-h-0 w-full overflow-hidden bg-slate-950 text-white">
      <div className="login-auth-grid pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden />

      <div className="relative z-10 grid h-full min-h-0 max-h-[100dvh] w-full grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
        {/* Painel imersivo — encaixa no viewport sem rolagem */}
        <div className="relative hidden h-full min-h-0 flex-col overflow-hidden border-r border-white/10 bg-gradient-to-br from-slate-950 via-violet-950/40 to-slate-950 px-5 py-5 xl:px-7 xl:py-6 lg:flex">
          {ORBS.map((o, i) => (
            <motion.div
              key={i}
              className={`pointer-events-none absolute rounded-full blur-3xl ${o.className}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: 1,
                scale: [1, 1.08, 1],
                x: [0, i % 2 ? 12 : -10, 0],
                y: [0, i % 2 ? -8 : 10, 0],
              }}
              transition={{ duration: 14 + i * 2, repeat: Infinity, ease: "easeInOut", delay: o.delay }}
            />
          ))}

          <div className="relative flex min-h-0 flex-1 flex-col items-center justify-between">
            <div className="relative flex w-full shrink-0 flex-col items-center text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-white/5 py-1 pl-3.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-100/95 backdrop-blur-md xl:text-xs lg:gap-3.5 lg:rounded-2xl lg:border-violet-300/35 lg:bg-white/[0.09] lg:py-2.5 lg:pl-6 lg:pr-3.5 lg:text-[11px] lg:tracking-[0.14em] lg:shadow-lg lg:shadow-violet-950/25"
              >
                <span className="lg:text-sm lg:font-bold">Gestor Desenvolve</span>
                <Fingerprint
                  className="h-3.5 w-3.5 shrink-0 text-amber-300/90 xl:h-4 xl:w-4 lg:h-5 lg:w-5 lg:text-amber-200"
                  aria-hidden
                />
              </motion.div>
              <motion.h1
                className="mx-auto mt-4 max-w-xl text-3xl font-extrabold leading-[1.15] tracking-tight drop-shadow-[0_0_28px_rgba(109,40,217,0.35)] sm:text-4xl xl:mt-5 xl:text-[2.35rem] xl:leading-[1.12]"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, duration: 0.55 }}
              >
                <span className="bg-gradient-to-r from-violet-100 via-fuchsia-100 to-amber-100/95 bg-clip-text text-transparent">
                  Sistema de Gestão Integrada
                </span>
              </motion.h1>
              <motion.p
                className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400 sm:text-[0.95rem] xl:mt-4 xl:text-base xl:leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.5 }}
              >
                Um ecossistema All-in-One de Gestão Empresarial, que une CRM, ERP e Operações em uma única
                plataforma.
              </motion.p>
            </div>

            <div className="relative mt-3 w-full max-w-xl shrink-0 xl:mt-4">
              <div className="mx-auto grid w-full max-w-xl grid-cols-3 gap-2 sm:gap-2.5">
                {LOGIN_MODULE_CARDS.map((mod, i) => {
                  const Icon = mod.icon;
                  return (
                    <motion.div
                      key={mod.title}
                      initial={{ opacity: 0, y: 10, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        delay: 0.35 + i * 0.04,
                        type: "spring",
                        stiffness: 400,
                        damping: 24,
                      }}
                      whileHover={{
                        y: -2,
                        scale: 1.02,
                        transition: { type: "spring", stiffness: 450, damping: 20 },
                      }}
                      className="group relative flex min-h-[4.75rem] w-full min-w-0 flex-row items-center gap-2.5 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 shadow-md shadow-black/15 backdrop-blur-md transition-colors duration-300 hover:border-white/25 sm:min-h-[5rem] sm:gap-3 sm:px-3 sm:py-2.5 xl:rounded-2xl"
                    >
                      <motion.div
                        className={`pointer-events-none absolute inset-0 rounded-xl border ${mod.borderTint} opacity-0 transition-opacity duration-300 group-hover:opacity-100 xl:rounded-2xl`}
                        aria-hidden
                      />
                      <motion.div
                        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 blur-lg transition-opacity duration-500 group-hover:opacity-100 xl:rounded-2xl"
                        style={{
                          background: `linear-gradient(135deg, rgba(109,40,217,0.18), rgba(245,158,11,0.1))`,
                        }}
                        aria-hidden
                      />
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br ${mod.accent} shadow-inner shadow-black/20`}
                      >
                        <Icon className={`h-[18px] w-[18px] ${mod.iconClass}`} aria-hidden />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-center">
                        <p className="line-clamp-2 text-xs font-medium leading-snug text-slate-200/95 sm:text-[13px]">
                          {mod.title}
                        </p>
                        {"tagline" in mod ? (
                          <div className="mt-1 min-h-[1.25rem] sm:min-h-[1.375rem]">
                            <p className="line-clamp-1 text-[11px] font-normal leading-snug text-slate-500 sm:text-xs">
                              {mod.tagline}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <motion.p
              className="relative mt-4 w-full shrink-0 text-center text-[10px] text-slate-500 xl:mt-5 xl:text-xs"
              animate={{ opacity: [0.65, 1, 0.65] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              © Desenvolve Tecnologia, Consultoria e Capacitação
            </motion.p>
          </div>
        </div>

        {/* Formulário */}
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-slate-950 px-5 py-5 lg:bg-gradient-to-br lg:from-white lg:via-slate-50 lg:to-violet-100/40 dark:lg:from-slate-950 dark:lg:via-slate-900 dark:lg:to-violet-950/35 xl:px-7 xl:py-6">
          <motion.div
            className="pointer-events-none absolute inset-0 lg:hidden"
            aria-hidden
            initial={false}
            animate={{
              background: [
                "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(109,40,217,0.18), transparent)",
                "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(245,158,11,0.1), transparent)",
                "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(109,40,217,0.18), transparent)",
              ],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="relative flex min-h-0 w-full max-h-full max-w-[420px] flex-col justify-center"
              >
            {/* Logo sempre visível; chip Gestor + digital só no mobile (< lg) */}
            <div className="mb-4 flex w-full flex-col items-center gap-3 sm:mb-5 sm:gap-3.5 lg:mb-5">
              <img
                src="/desenvolve_logo-o.png"
                alt="Gestor Desenvolve"
                className="h-6 w-auto brightness-0 invert sm:h-7 lg:h-8 lg:brightness-100 lg:invert-0 dark:lg:brightness-0 dark:lg:invert"
              />
              <div className="inline-flex items-center gap-2.5 rounded-2xl border border-violet-400/30 bg-white/5 px-3.5 py-2 backdrop-blur-sm sm:gap-3 sm:px-4 sm:py-2.5 lg:hidden">
                <span className="text-base font-bold tracking-tight text-white sm:text-lg">
                  Gestor Desenvolve
                </span>
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/40 bg-gradient-to-br from-[#6D28D9]/45 to-violet-950/60 shadow-md shadow-violet-900/35 sm:h-11 sm:w-11"
                  aria-hidden
                >
                  <Fingerprint className="h-6 w-6 text-amber-200" />
                </div>
              </div>
            </div>

            <motion.form
              onSubmit={
                mode === "login"
                  ? (e) => void handleSubmit(e)
                  : mode === "forgot"
                    ? (e) => void handleForgotSubmit(e)
                    : (e) => void handleResetSubmit(e)
              }
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-violet-950/50 backdrop-blur-xl sm:p-8 lg:border-slate-200/80 lg:bg-white/90 lg:shadow-xl lg:shadow-slate-900/10 dark:lg:border-slate-700/90 dark:lg:bg-slate-900/95 dark:lg:shadow-black/40"
              animate={erro ? { x: [0, -10, 10, -8, 8, 0] } : { x: 0 }}
              transition={{ duration: 0.45 }}
            >
              <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-gradient-to-br from-[#6D28D9]/25 to-amber-400/15 blur-2xl" />

              <div className="relative space-y-3 sm:space-y-5">
                <div className="space-y-1.5 border-b border-white/10 pb-3 text-center sm:space-y-2 sm:pb-5 lg:border-slate-200/80 dark:lg:border-slate-600/80">
                  <h2 className="text-lg font-bold text-white sm:text-xl lg:text-2xl lg:text-slate-900 dark:lg:text-slate-100">
                    {mode === "login" ? "Acesso seguro" : mode === "forgot" ? "Recuperar senha" : "Redefinir senha"}
                  </h2>
                  <p className="text-xs text-slate-400 sm:text-sm lg:text-slate-600 dark:lg:text-slate-400">
                    {mode === "login"
                      ? "Use seu CPF e senha corporativos"
                      : mode === "forgot"
                        ? "Informe seu e-mail para receber o link"
                        : "Defina sua nova senha"}
                  </p>
                </div>
                {mode === "login" && (
                <div>
                  <label htmlFor="login-cpf" className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400 lg:text-slate-600 dark:lg:text-slate-400">
                    CPF
                  </label>
                  <motion.input
                    id="login-cpf"
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    required
                    whileFocus={{ scale: 1.01 }}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-white placeholder:text-slate-500 focus:border-violet-400/60 focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/35 lg:border-slate-200 lg:bg-white lg:text-slate-900 lg:focus:border-[#6D28D9] lg:focus:ring-[#6D28D9]/20 dark:lg:border-slate-600 dark:lg:bg-slate-800/90 dark:lg:text-slate-100 dark:lg:placeholder:text-slate-500"
                  />
                </div>
                )}

                {mode === "login" && (
                <div>
                  <label htmlFor="login-senha" className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400 lg:text-slate-600 dark:lg:text-slate-400">
                    <Lock className="h-3.5 w-3.5" />
                    Senha
                  </label>
                  <div className="relative">
                    <motion.input
                      id="login-senha"
                      type={showPassword ? "text" : "password"}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="••••••••"
                      whileFocus={{ scale: 1.01 }}
                      className="w-full rounded-xl border border-white/10 bg-white/5 py-3.5 pl-4 pr-12 text-white placeholder:text-slate-500 focus:border-violet-400/60 focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/35 lg:border-slate-200 lg:bg-white lg:text-slate-900 lg:focus:border-[#6D28D9] lg:focus:ring-[#6D28D9]/20 dark:lg:border-slate-600 dark:lg:bg-slate-800/90 dark:lg:text-slate-100 dark:lg:placeholder:text-slate-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white lg:hover:bg-slate-100 lg:hover:text-slate-700 dark:lg:hover:bg-slate-700 dark:lg:hover:text-slate-200"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="cursor-pointer text-xs font-semibold text-violet-300 hover:text-violet-200 lg:text-[#6D28D9] lg:hover:text-violet-800 dark:lg:text-violet-300 dark:lg:hover:text-violet-200"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                </div>
                )}

                {mode === "forgot" && (
                  <div className="space-y-3">
                    <input
                      type="email"
                      value={emailRecuperacao}
                      onChange={(e) => setEmailRecuperacao(e.target.value)}
                      placeholder="seu@email.com"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-white placeholder:text-slate-500 focus:border-violet-400/60 focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/35 lg:border-slate-200 lg:bg-white lg:text-slate-900 lg:focus:border-[#6D28D9] lg:focus:ring-[#6D28D9]/20 dark:lg:border-slate-600 dark:lg:bg-slate-800/90 dark:lg:text-slate-100 dark:lg:placeholder:text-slate-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setMode("login")}
                      className="text-xs font-semibold text-violet-300 hover:text-violet-200 lg:text-[#6D28D9] lg:hover:text-violet-800"
                    >
                      Voltar ao login
                    </button>
                  </div>
                )}

                {mode === "reset" && (
                  <div className="space-y-3">
                    {!resetToken && (
                      <input
                        type="text"
                        value={resetToken}
                        onChange={(e) => setResetToken(e.target.value)}
                        placeholder="Token de recuperação"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-white placeholder:text-slate-500 focus:border-violet-400/60 focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/35 lg:border-slate-200 lg:bg-white lg:text-slate-900 lg:focus:border-[#6D28D9] lg:focus:ring-[#6D28D9]/20 dark:lg:border-slate-600 dark:lg:bg-slate-800/90 dark:lg:text-slate-100 dark:lg:placeholder:text-slate-500"
                        required
                      />
                    )}
                    <input
                      type="password"
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      placeholder="Nova senha"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-white placeholder:text-slate-500 focus:border-violet-400/60 focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/35 lg:border-slate-200 lg:bg-white lg:text-slate-900 lg:focus:border-[#6D28D9] lg:focus:ring-[#6D28D9]/20 dark:lg:border-slate-600 dark:lg:bg-slate-800/90 dark:lg:text-slate-100 dark:lg:placeholder:text-slate-500"
                      required
                    />
                    <input
                      type="password"
                      value={confirmNovaSenha}
                      onChange={(e) => setConfirmNovaSenha(e.target.value)}
                      placeholder="Confirmar nova senha"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-white placeholder:text-slate-500 focus:border-violet-400/60 focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/35 lg:border-slate-200 lg:bg-white lg:text-slate-900 lg:focus:border-[#6D28D9] lg:focus:ring-[#6D28D9]/20 dark:lg:border-slate-600 dark:lg:bg-slate-800/90 dark:lg:text-slate-100 dark:lg:placeholder:text-slate-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setMode("login")}
                      className="text-xs font-semibold text-violet-300 hover:text-violet-200 lg:text-[#6D28D9] lg:hover:text-violet-800"
                    >
                      Voltar ao login
                    </button>
                  </div>
                )}

                <AnimatePresence>
                  {erro && (
                    <motion.p
                      role="alert"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-200 lg:text-red-700 dark:lg:border-red-500/40 dark:lg:bg-red-950/40 dark:lg:text-red-300"
                    >
                      {erro}
                    </motion.p>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#6D28D9] via-violet-600 to-amber-600 py-3 text-sm font-bold text-white shadow-lg shadow-[#6D28D9]/35 transition-opacity disabled:opacity-60 sm:py-4"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity hover:opacity-100" />
                  <Zap className="relative h-4 w-4" />
                  <span className="relative">
                    {loading
                      ? "Processando..."
                      : mode === "login"
                        ? "Entrar na Central"
                        : mode === "forgot"
                          ? "Enviar link de recuperação"
                          : "Redefinir senha"}
                  </span>
                </motion.button>
              </div>
            </motion.form>
              </motion.div>
            </div>

            <p className="relative mt-4 shrink-0 text-center text-[10px] text-slate-500 dark:lg:text-slate-400 xl:mt-5 xl:text-xs">
              <span className="lg:hidden">© Desenvolve Tecnologia, Consultoria e Capacitação</span>
              <span className="hidden lg:inline">Ambiente criptografado · sessão corporativa</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
