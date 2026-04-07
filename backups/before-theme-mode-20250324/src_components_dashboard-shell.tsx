"use client";

import { ReactNode, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import {
  LayoutDashboard,
  Handshake,
  Wallet,
  Users,
  LifeBuoy,
  CheckCircle2,
  ListTodo,
  UserCog,
  Settings,
  ChevronLeft,
  ChevronRight,
  Home,
  Search,
  Bell,
  Menu,
  LogOut,
  User,
  Package,
} from "lucide-react";
import { GlobalHeader } from "./global-header";
import type { ModuloPermissao } from "@/lib/configuracoes/types";
import { useAuth } from "@/contexts/auth-context";
import { DrawerLeft } from "@/components/ui/drawer-left";
import { Dialog } from "@/components/ui/dialog";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ProfileDrawer } from "./profile-drawer";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  modulo?: ModuloPermissao;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Central", href: "/", icon: LayoutDashboard },
  { label: "Comercial", href: "/comercial", icon: Handshake, modulo: "comercial" },
  { label: "Financeiro", href: "/financeiro", icon: Wallet, modulo: "financeiro" },
  { label: "Clientes", href: "/clientes", icon: Users, modulo: "clientes" },
  { label: "Soluções", href: "/solucoes", icon: Package, modulo: "posVenda" },
  { label: "Helpdesk", href: "/helpdesk", icon: LifeBuoy, modulo: "helpdesk" },
  { label: "Pós-venda", href: "/pos-venda", icon: CheckCircle2, modulo: "posVenda" },
  { label: "Tarefas Internas", href: "/tarefas", icon: ListTodo, modulo: "tarefas" },
  { label: "RH e Parceiros", href: "/rh", icon: UserCog, modulo: "rh" },
];

function filterNavByPerfil(
  items: NavItem[],
  permissoes: Partial<Record<ModuloPermissao, boolean>>
): NavItem[] {
  if (!permissoes || Object.keys(permissoes).length === 0) return items;
  return items.filter((item) => !item.modulo || permissoes[item.modulo] === true);
}

function DesktopSidebar({
  collapsed,
  onToggleCollapse,
  perfilId,
  permissoes,
  userName,
  userCpf,
  onOpenProfile,
  onLogout,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  perfilId: string;
  permissoes: Partial<Record<ModuloPermissao, boolean>>;
  userName: string;
  userCpf: string;
  onOpenProfile: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const [collapsedMenuOpen, setCollapsedMenuOpen] = useState(false);
  const navItems = filterNavByPerfil(NAV_ITEMS, permissoes);
  const nomeExibicao = userName || "Usuário";
  const cpfExibicao = userCpf || "—";

  return (
    <aside
      className={clsx(
        "fixed inset-y-0 left-0 z-50 hidden flex-shrink-0 flex-col border-r border-slate-200 bg-white transform transition-all duration-300 ease-in-out lg:flex",
        collapsed ? "w-20 translate-x-0" : "w-64 translate-x-0"
      )}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className="absolute -right-3 top-6 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-100"
        aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>
      <div
        className={clsx(
          "flex h-16 shrink-0 items-center border-b border-slate-200 transition-all duration-300",
          collapsed ? "justify-center px-0" : "px-4 pr-6"
        )}
      >
        {collapsed ? (
          <img
            src="/desenvolve_icone-o.png"
            alt="Gestor Desenvolve"
            className="h-8 w-8 object-contain"
          />
        ) : (
          <img
            src="/desenvolve_logo-o.png"
            alt="Gestor Desenvolve"
            className="h-10 w-47 object-contain"
          />
        )}
      </div>
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={clsx(
                  "group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                  collapsed ? "justify-center" : "justify-start gap-3",
                  "hover:bg-slate-100",
                  active
                    ? "bg-violet-50 text-[#6D28D9]"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Icon
                  className={clsx(
                    "shrink-0",
                    collapsed ? "h-6 w-6" : "h-5 w-5",
                    active
                      ? "text-[#6D28D9]"
                      : "text-slate-500 group-hover:text-slate-700"
                  )}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>
      {(Object.keys(permissoes).length === 0 || permissoes.configuracoes === true) && (
        <div className="shrink-0 border-t border-slate-200 px-3 py-2">
          <Link
            href="/configuracoes"
            title={collapsed ? "Configurações" : undefined}
            className={clsx(
              "group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
              collapsed ? "justify-center" : "justify-start gap-3",
              "hover:bg-slate-100",
              pathname.startsWith("/configuracoes")
                ? "bg-violet-50 text-[#6D28D9]"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Settings
              className={clsx(
                "shrink-0",
                collapsed ? "h-6 w-6" : "h-5 w-5",
                pathname.startsWith("/configuracoes")
                  ? "text-[#6D28D9]"
                  : "text-slate-500 group-hover:text-slate-700"
              )}
            />
            {!collapsed && <span className="truncate">Configurações</span>}
          </Link>
        </div>
      )}
      <div className={clsx("relative shrink-0 border-t border-slate-200 p-3", collapsed && "flex justify-center")}>
        {collapsed ? (
          <DropdownMenu
            open={collapsedMenuOpen}
            onClose={() => setCollapsedMenuOpen(false)}
            align="end"
            anchor={
              <button
                type="button"
                onClick={() => setCollapsedMenuOpen((v) => !v)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6D28D9] to-violet-700 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                aria-label="Abrir menu do usuário"
              >
                {nomeExibicao.charAt(0).toUpperCase()}
              </button>
            }
          >
            <DropdownMenuItem icon={<User className="h-4 w-4" />} onClick={() => { setCollapsedMenuOpen(false); onOpenProfile(); }}>
              Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuItem icon={<LogOut className="h-4 w-4" />} onClick={() => { setCollapsedMenuOpen(false); onLogout(); }} className="text-red-600 hover:bg-red-50">
              Sair
            </DropdownMenuItem>
          </DropdownMenu>
        ) : (
          <button
            type="button"
            onClick={onOpenProfile}
            className={clsx(
              "flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-slate-50",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:ring-offset-1"
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6D28D9] to-violet-700 text-xs font-semibold text-white">
              {nomeExibicao.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{nomeExibicao}</p>
              <p className="truncate text-xs text-slate-600">CPF • {cpfExibicao}</p>
            </div>
          </button>
        )}
        {/* Botão Logout flutuante: centralizado na vertical em relação à área do usuário */}
        <button
          type="button"
          onClick={onLogout}
          className="absolute -right-3 top-1/2 z-50 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600"
          aria-label="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}

const MENU_NAV_ITEMS: NavItem[] = [
  ...NAV_ITEMS,
  {
    label: "Configurações",
    href: "/configuracoes",
    icon: Settings,
    modulo: "configuracoes",
  },
];

function MobileMenuDrawerContent({
  onClose,
  perfilId,
  permissoes,
}: {
  onClose: () => void;
  perfilId: string;
  permissoes: Partial<Record<ModuloPermissao, boolean>>;
}) {
  const pathname = usePathname();
  const navItems = filterNavByPerfil(MENU_NAV_ITEMS, permissoes);

  return (
    <nav className="flex flex-1 flex-col space-y-1 px-3 py-4">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={clsx(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              "hover:bg-slate-100",
              active
                ? "bg-violet-50 text-[#6D28D9]"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Icon
              className={clsx(
                "h-4 w-4",
                active ? "text-[#6D28D9]" : "text-slate-400 group-hover:text-slate-600"
              )}
            />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function MobileBottomNav({
  perfilId,
  permissoes,
}: {
  perfilId: string;
  permissoes: Partial<Record<ModuloPermissao, boolean>>;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const isHome = pathname === "/";

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-50 flex h-14 items-center justify-between border-t border-slate-200 bg-white/95 px-4 pb-[env(safe-area-inset-bottom)] shadow-md backdrop-blur-sm lg:hidden">
        <Link
          href="/"
          className={clsx(
            "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors",
            isHome ? "text-[#6D28D9]" : "text-slate-600 hover:text-slate-900"
          )}
          aria-label="Central de Comandos"
        >
          <Home className="h-5 w-5" />
          <span
            className={clsx(
              "text-[11px] font-medium",
              isHome ? "text-[#6D28D9]" : "text-slate-600"
            )}
          >
            Central
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-slate-600 transition-colors hover:text-slate-900"
          aria-label="Buscar"
        >
          <Search className="h-5 w-5" />
          <span className="text-[11px] font-medium">Buscar</span>
        </button>
        <button
          type="button"
          onClick={() => setAlertsOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-slate-600 transition-colors hover:text-slate-900"
          aria-label="Alertas"
        >
          <Bell className="h-5 w-5" />
          <span className="text-[11px] font-medium">Alertas</span>
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-slate-600 transition-colors hover:text-slate-900"
          aria-label="Menu"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[11px] font-medium">Menu</span>
        </button>
      </nav>

      <DrawerLeft
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Menu"
      >
        <MobileMenuDrawerContent onClose={() => setMenuOpen(false)} perfilId={perfilId} permissoes={permissoes} />
      </DrawerLeft>

      <Dialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="Buscar"
        maxWidth="sm:max-w-3xl"
      >
        <div className="px-6 pb-6">
          <input
            type="search"
            placeholder="Buscar páginas, relatórios..."
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20"
            autoFocus
          />
          <p className="mt-3 text-sm text-slate-600">
            Digite para buscar em todo o sistema.
          </p>
        </div>
      </Dialog>

      <DrawerSheet
        open={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        title="Alertas"
      >
        <div className="overflow-y-auto p-4">
          <p className="text-sm text-slate-600">
            Nenhuma notificação no momento.
          </p>
        </div>
      </DrawerSheet>
    </>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const { perfilId: rawPerfilId, session } = useAuth();
  const perfilId = rawPerfilId ?? "admin";

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="relative min-h-screen w-full bg-slate-50">
      <DesktopSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        perfilId={perfilId}
        permissoes={session.permissoes}
        userName={session.userName ?? "Usuário"}
        userCpf={session.userCpf ?? "—"}
        onOpenProfile={() => setProfileDrawerOpen(true)}
        onLogout={handleLogout}
      />
      <ProfileDrawer
        open={profileDrawerOpen}
        onClose={() => setProfileDrawerOpen(false)}
        perfilId={perfilId}
      />
      <div
        className={`flex min-h-screen flex-col transition-all duration-300 ease-in-out ${sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"}`}
      >
        <div className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white">
          <GlobalHeader />
        </div>
        <main className="flex min-h-0 w-full min-w-0 max-w-full flex-1 overflow-y-auto p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-6 md:pb-24 lg:p-8 lg:pb-10">
          {children}
        </main>
      </div>
      <MobileBottomNav perfilId={perfilId} permissoes={session.permissoes} />
    </div>
  );
}
