"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function RedefinirSenhaTokenPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = decodeURIComponent((params?.token ?? "").trim());
  const [novaSenha, setNovaSenha] = useState("");
  const [confirm, setConfirm] = useState("");
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setOkMsg("");
    if (!token) {
      setErro("Token inválido.");
      return;
    }
    if (novaSenha !== confirm) {
      setErro("A confirmação da senha não confere.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, novaSenha }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) {
        setErro(json?.error?.message || "Não foi possível redefinir a senha.");
        return;
      }
      setOkMsg("Senha redefinida com sucesso. Você já pode fazer login.");
      setNovaSenha("");
      setConfirm("");
      setTimeout(() => router.push("/login"), 1000);
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
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Redefinir senha</h1>
        <input
          type="password"
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          placeholder="Nova senha"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          required
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirmar nova senha"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          required
        />
        {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
        {okMsg && <p className="text-sm text-emerald-600 dark:text-emerald-400">{okMsg}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
        >
          {loading ? "Salvando..." : "Redefinir senha"}
        </button>
      </form>
    </section>
  );
}
