"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Search, Plus, Bell, User, CheckCircle2, AlertCircle, LifeBuoy, Settings } from "lucide-react";
import { usePageHeader, usePageTitleFromPath } from "@/contexts/page-header-context";
import { GlobalSearch } from "./global-search";
import { DropdownMenu } from "@/components/ui/dropdown-menu";

type ModuloNotificacao = "tarefas" | "financeiro" | "helpdesk" | "sistema";

type Notificacao = {
  id: string;
  modulo: ModuloNotificacao;
  mensagem: string;
  lida: boolean;
};

function IconeModulo({ modulo }: { modulo: ModuloNotificacao }) {
  switch (modulo) {
    case "tarefas":
      return <CheckCircle2 className="h-5 w-5 shrink-0 text-violet-600" />;
    case "financeiro":
      return <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />;
    case "helpdesk":
      return <LifeBuoy className="h-5 w-5 shrink-0 text-slate-600" />;
    default:
      return <AlertCircle className="h-5 w-5 shrink-0 text-slate-500" />;
  }
}

export function GlobalHeader() {
  const pathname = usePathname();
  const { title, setTitle, primaryAction, secondaryAction } = usePageHeader();
  const titleFromPath = usePageTitleFromPath(pathname);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notificacao[]>([]);
  const profileRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.lida).length;

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, lida: true } : n))
    );
    void fetch(`/api/alertas/${id}/read`, { method: "PATCH" });
    setNotificationsOpen(false);
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, lida: true })));
    void fetch("/api/alertas/read-all", { method: "PATCH" });
  };

  useEffect(() => {
    setTitle(titleFromPath);
  }, [pathname, titleFromPath, setTitle]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/alertas/bootstrap", { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as {
          data?: {
            alertas?: Array<{ id: string; modulo: string; titulo: string; descricao: string; lida: boolean }>;
          };
        };
        if (!active) return;
        const alertas = payload?.data?.alertas ?? [];
        setNotifications(
          alertas.map((a) => ({
            id: a.id,
            modulo: (a.modulo as ModuloNotificacao) ?? "sistema",
            mensagem: `${a.titulo}: ${a.descricao}`,
            lida: a.lida,
          }))
        );
      } catch {
        // noop
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleMetaK = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleMetaK);
    return () => document.removeEventListener("keydown", handleMetaK);
  }, []);

  useEffect(() => {
    if (!profileOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileOpen]);

  return (
    <>
      <header className="z-10 flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-3 backdrop-blur-md sm:px-4 lg:px-6">
        <h1 className="min-w-0 truncate text-base font-semibold text-slate-700 sm:text-lg lg:text-xl">
          {title}
        </h1>
        <div className="ml-2 flex shrink-0 items-center gap-1 sm:gap-2">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="rounded-xl p-2 text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9]"
              aria-label="Busca global (Cmd+K)"
            >
              <Search className="h-5 w-5" aria-hidden />
            </button>
            <DropdownMenu
              open={notificationsOpen}
              onClose={() => setNotificationsOpen(false)}
              align="end"
              className="min-w-0 w-[360px] max-w-[calc(100vw-2rem)] p-0"
              anchor={
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((v) => !v)}
                  className="relative rounded-xl p-2 text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9]"
                  aria-label="Notificações"
                  aria-expanded={notificationsOpen}
                >
                  <Bell className="h-5 w-5" aria-hidden />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
              }
            >
            <div className="flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Notificações</h2>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    className="text-xs font-medium text-slate-600 transition-colors hover:text-[#6D28D9]"
                  >
                    Marcar todas como lidas
                  </button>
                )}
              </div>
              <div className="max-h-[320px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-slate-600">
                    Nenhuma notificação.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleMarkAsRead(n.id)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:opacity-90 ${
                        n.lida ? "bg-transparent" : "bg-violet-50/80"
                      }`}
                    >
                      <IconeModulo modulo={n.modulo} />
                      <span className="min-w-0 flex-1 text-sm text-slate-700">
                        {n.mensagem}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <div className="border-t border-slate-200 px-4 py-2">
                <Link
                  href="/alertas"
                  onClick={() => setNotificationsOpen(false)}
                  className="block w-full rounded-xl py-2 text-center text-sm font-medium text-[#6D28D9] transition-colors hover:bg-violet-50"
                >
                  Ver todas
                </Link>
              </div>
            </div>
          </DropdownMenu>
          </div>
          {(secondaryAction || primaryAction) && (
            <>
              {secondaryAction && (
                <button
                  type="button"
                  onClick={secondaryAction.onClick}
                  className="flex shrink-0 items-center justify-center rounded-xl border-2 border-[#6D28D9]/35 bg-violet-50/90 p-2 text-[#6D28D9] shadow-sm transition-colors hover:border-[#6D28D9]/60 hover:bg-violet-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:ring-offset-2 sm:p-2.5"
                  aria-label={secondaryAction.ariaLabel}
                  title={secondaryAction.ariaLabel}
                >
                  <Settings className="h-5 w-5" aria-hidden />
                </button>
              )}
              {primaryAction && (
                <>
                  <span className="mx-1 hidden h-6 w-px shrink-0 border-l border-slate-200 sm:mx-4 sm:block" aria-hidden />
                  <button
                    type="button"
                    onClick={primaryAction.onClick}
                    className="flex items-center gap-1.5 rounded-lg bg-[#6D28D9] px-2 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:ring-offset-2 sm:px-3"
                    aria-label={primaryAction.label}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    <span className="hidden sm:inline">{primaryAction.label}</span>
                  </button>
                </>
              )}
            </>
          )}
          <div className="relative lg:hidden" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((prev) => !prev)}
              className="rounded-xl p-2 text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9]"
              aria-label="Menu do perfil"
              aria-expanded={profileOpen}
            >
              <User className="h-5 w-5" aria-hidden />
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-slate-200 bg-white py-2 shadow-lg">
                <div className="flex items-center gap-3 px-3 py-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#6D28D9] to-violet-700 text-xs font-semibold text-white">
                    U
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      Usuário autenticado
                    </p>
                    <p className="truncate text-xs text-slate-600">
                      CPF • 000.000.000-00
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
