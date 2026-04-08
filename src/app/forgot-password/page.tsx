"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setMsg("");
    const v = email.trim();
    if (!v) {
      setErro("Informe seu e-mail.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: v }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) {
        setErro(data?.error?.message || "Não foi possível enviar o e-mail de recuperação.");
        return;
      }
      setMsg("Se o e-mail existir e estiver ativo, enviaremos um link de redefinição.");
      setEmail("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-[70vh] w-full max-w-md items-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Recuperar senha</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Informe seu e-mail para receber o link de redefinição.
        </p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          required
        />
        {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
        {msg && <p className="text-sm text-emerald-600 dark:text-emerald-400">{msg}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
        >
          {loading ? "Enviando..." : "Enviar link"}
        </button>
        <div className="pt-1 text-center">
          <Link href="/login" className="text-sm font-medium text-[#6D28D9] hover:underline">
            Voltar ao login
          </Link>
        </div>
      </form>
    </section>
  );
}
