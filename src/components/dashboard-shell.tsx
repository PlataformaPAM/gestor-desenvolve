"use client";

import { ReactNode, useEffect, useState } from "react";
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
  FileText,
  BarChart3,
  LayoutGrid,
} from "lucide-react";
import { GlobalHeader } from "./global-header";
import type { ModuloPermissao } from "@/lib/configuracoes/types";
import { useAuth } from "@/contexts/auth-context";
import { DrawerLeft } from "@/components/ui/drawer-left";
import { Dialog } from "@/components/ui/dialog";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ProfileDrawer } from "./profile-drawer";
import { subscribeAlertsUpdated } from "@/lib/alerts/live-sync";
import { canViewResourceClient, type ClientAuthSession } from "@/lib/configuracoes/permission-client";
import { getFinanceiroDefaultHref } from "@/lib/financeiro/financeiro-nav";
import { canViewConfiguracoesNav, canViewNavItem } from "@/lib/nav-access";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  modulo?: ModuloPermissao;
  /** Recurso granular (Ver) quando não há `modulo` legado ou para itens especiais. */
  resourceId?: string;
  requireAdminCliente?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Central", href: "/", icon: LayoutDashboard, resourceId: "central.dashboard" },
  { label: "Comercial", href: "/comercial", icon: Handshake, resourceId: "comercial.pipeline" },
  { label: "Financeiro", href: "/financeiro", icon: Wallet, modulo: "financeiro" },
  { label: "Clientes", href: "/clientes", icon: Users, resourceId: "clientes.cadastro" },
  { label: "Contratos", href: "/contratos", icon: FileText, resourceId: "contratos.lista" },
  { label: "Soluções", href: "/solucoes", icon: Package, resourceId: "solucoes.catalogo" },
  { label: "Suporte", href: "/suporte", icon: LifeBuoy, resourceId: "helpdesk.tickets" },
  { label: "Pós-venda", href: "/pos-venda", icon: CheckCircle2, resourceId: "posvenda.tarefas" },
  { label: "Minha Caixa", href: "/alertas", icon: Bell, resourceId: "alertas.caixa" },
  { label: "Tarefas Internas", href: "/tarefas", icon: ListTodo, resourceId: "tarefas.internas" },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3, modulo: "relatorios" },
  { label: "RH e Parceiros", href: "/rh", icon: UserCog, resourceId: "rh.colaboradores" },
];

type BootstrapAlerta = {
  id: string;
  modulo: "tarefas" | "financeiro" | "sistema" | "comercial" | "contratos" | "helpdesk" | "posVenda" | string;
  titulo: string;
  descricao: string;
  lida: boolean;
  prioridade?: "urgente" | "alta" | "normal";
  slaLabel?: string | null;
};

const CLIENT_PORTAL_NAV_ITEMS: NavItem[] = [
  { label: "Portal do Cliente", href: "/portal", icon: LayoutGrid, modulo: "helpdesk" },
  { label: "Suporte", href: "/portal/chamados", icon: LifeBuoy, modulo: "helpdesk" },
  { label: "Usuários", href: "/portal/usuarios", icon: Users, modulo: "configuracoes" },
  { label: "Minha Caixa", href: "/alertas", icon: Bell },
];

function isItemActive(pathname: string, href: string, modulo?: ModuloPermissao): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/portal") return pathname === "/portal";
  if (modulo === "financeiro") {
    return pathname === "/financeiro" || pathname.startsWith("/financeiro/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function applyNavHrefs(items: NavItem[], auth: ClientAuthSession): NavItem[] {
  return items.map((item) =>
    item.modulo === "financeiro" ? { ...item, href: getFinanceiroDefaultHref(auth) } : item
  );
}

function filterNavByPerfil(items: NavItem[], auth: ClientAuthSession, isSystemAdmin: boolean): NavItem[] {
  if (isSystemAdmin) return items;
  return items.filter((item) => canViewNavItem(auth, item, isSystemAdmin));
}

function buildNavItems(
  auth: ClientAuthSession,
  isPortalCliente: boolean,
  isAdminCliente: boolean,
  isSystemAdmin: boolean,
  pathname: string
): NavItem[] {
  const permissoes = auth.permissoes ?? {};
  const preferPortalNav = pathname.startsWith("/portal");
  let items: NavItem[];
  if (isPortalCliente || preferPortalNav) {
    const base = CLIENT_PORTAL_NAV_ITEMS.filter((item) => !item.requireAdminCliente || isAdminCliente);
    if (
      preferPortalNav &&
      !isPortalCliente &&
      (permissoes.portal_cliente === true || canViewResourceClient(auth, "portal.acesso"))
    ) {
      items = base;
    } else {
      items = filterNavByPerfil(base, auth, isSystemAdmin);
    }
  } else {
    items = filterNavByPerfil(NAV_ITEMS, auth, isSystemAdmin);
  }
  return applyNavHrefs(items, auth);
}

function DesktopSidebar({
  collapsed,
  onToggleCollapse,
  auth,
  userName,
  userCpf,
  onOpenProfile,
  onLogout,
  unreadByHref,
  isPortalCliente,
  isAdminCliente,
  isSystemAdmin,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  auth: ClientAuthSession;
  userName: string;
  userCpf: string;
  onOpenProfile: () => void;
  onLogout: () => void;
  unreadByHref: Record<string, number>;
  isPortalCliente: boolean;
  isAdminCliente: boolean;
  isSystemAdmin: boolean;
}) {
  const pathname = usePathname();
  const [collapsedMenuOpen, setCollapsedMenuOpen] = useState(false);
  const permissoes = auth.permissoes ?? {};
  const navItems = buildNavItems(auth, isPortalCliente, isAdminCliente, isSystemAdmin, pathname);
  const nomeExibicao = userName || "Usuário";
  const cpfExibicao = userCpf || "—";

  return (
    <aside
      className={clsx(
        "fixed inset-y-0 left-0 z-50 hidden flex-shrink-0 flex-col border-r border-slate-200 bg-white transform transition-all duration-300 ease-in-out dark:border-slate-700 dark:bg-slate-900 lg:flex",
        collapsed ? "w-20 translate-x-0" : "w-64 translate-x-0"
      )}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className="absolute -right-3 top-6 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
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
          "flex h-16 shrink-0 items-center border-b border-slate-200 transition-all duration-300 dark:border-slate-700",
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
            const active = isItemActive(pathname, item.href, item.modulo);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={clsx(
                  "group relative flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                  collapsed ? "justify-center" : "justify-start gap-3",
                  "hover:bg-slate-100 dark:hover:bg-slate-800",
                  active
                    ? "bg-violet-50 text-[#6D28D9] dark:bg-violet-950/50 dark:text-violet-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                )}
              >
                <Icon
                  className={clsx(
                    "shrink-0",
                    collapsed ? "h-6 w-6" : "h-5 w-5",
                    active
                      ? "text-[#6D28D9]"
                      : "text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200"
                  )}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {(unreadByHref[item.href] ?? 0) > 0 &&
                  (collapsed ? (
                    <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500" aria-label="Possui alertas pendentes" />
                  ) : (
                    <span className="ml-auto inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {(unreadByHref[item.href] ?? 0) > 99 ? "99+" : (unreadByHref[item.href] ?? 0)}
                    </span>
                  ))}
              </Link>
            );
          })}
        </div>
      </nav>
      {!isPortalCliente && canViewConfiguracoesNav(auth, isSystemAdmin) && (
        <div className="shrink-0 border-t border-slate-200 px-3 py-2 dark:border-slate-700">
          <Link
            href="/configuracoes"
            title={collapsed ? "Configurações" : undefined}
            className={clsx(
              "group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
              collapsed ? "justify-center" : "justify-start gap-3",
              "hover:bg-slate-100 dark:hover:bg-slate-800",
              pathname.startsWith("/configuracoes")
                ? "bg-violet-50 text-[#6D28D9] dark:bg-violet-950/50 dark:text-violet-300"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            )}
          >
            <Settings
              className={clsx(
                "shrink-0",
                collapsed ? "h-6 w-6" : "h-5 w-5",
                pathname.startsWith("/configuracoes")
                  ? "text-[#6D28D9]"
                  : "text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200"
              )}
            />
            {!collapsed && <span className="truncate">Configurações</span>}
          </Link>
        </div>
      )}
      <div
        className={clsx(
          "relative shrink-0 border-t border-slate-200 p-3 dark:border-slate-700",
          collapsed && "flex justify-center"
        )}
      >
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
            <DropdownMenuItem icon={<LogOut className="h-4 w-4" />} onClick={() => { setCollapsedMenuOpen(false); onLogout(); }} className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50">
              Sair
            </DropdownMenuItem>
          </DropdownMenu>
        ) : (
          <button
            type="button"
            onClick={onOpenProfile}
            className={clsx(
              "flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:ring-offset-1"
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6D28D9] to-violet-700 text-xs font-semibold text-white">
              {nomeExibicao.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{nomeExibicao}</p>
              <p className="truncate text-xs text-slate-600 dark:text-slate-400">CPF • {cpfExibicao}</p>
            </div>
          </button>
        )}
        {/* Botão Logout flutuante: centralizado na vertical em relação à área do usuário */}
        <button
          type="button"
          onClick={onLogout}
          className="absolute -right-3 top-1/2 z-50 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-red-950/50 dark:hover:text-red-400"
          aria-label="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}

function MobileMenuDrawerContent({
  onClose,
  auth,
  unreadByHref,
  isPortalCliente,
  isAdminCliente,
  isSystemAdmin,
}: {
  onClose: () => void;
  auth: ClientAuthSession;
  unreadByHref: Record<string, number>;
  isPortalCliente: boolean;
  isAdminCliente: boolean;
  isSystemAdmin: boolean;
}) {
  const pathname = usePathname();
  const permissoes = auth.permissoes ?? {};
  const navItemsBase = buildNavItems(auth, isPortalCliente, isAdminCliente, isSystemAdmin, pathname);
  const navItems = !isPortalCliente && canViewConfiguracoesNav(auth, isSystemAdmin)
    ? [
        ...navItemsBase,
        {
          label: "Configurações",
          href: "/configuracoes",
          icon: Settings,
          modulo: "configuracoes" as ModuloPermissao,
        },
      ]
    : navItemsBase;

  return (
    <nav className="flex flex-1 flex-col space-y-1 px-3 py-4">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isItemActive(pathname, item.href, item.modulo);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={clsx(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              "hover:bg-slate-100 dark:hover:bg-slate-800",
              active
                ? "bg-violet-50 text-[#6D28D9] dark:bg-violet-950/50 dark:text-violet-300"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            )}
          >
            <Icon
              className={clsx(
                "h-4 w-4",
                active
                  ? "text-[#6D28D9]"
                  : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
              )}
            />
            <span>{item.label}</span>
            {(unreadByHref[item.href] ?? 0) > 0 && (
              <span className="ml-auto inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {(unreadByHref[item.href] ?? 0) > 99 ? "99+" : (unreadByHref[item.href] ?? 0)}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function MobileBottomNav({
  auth,
  unreadByHref,
  isPortalCliente,
  isAdminCliente,
  isSystemAdmin,
}: {
  auth: ClientAuthSession;
  unreadByHref: Record<string, number>;
  isPortalCliente: boolean;
  isAdminCliente: boolean;
  isSystemAdmin: boolean;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState<Array<{ id: string; titulo: string; descricao: string; lida: boolean; prioridade?: "urgente" | "alta" | "normal"; slaLabel?: string | null }>>([]);
  const homeHref = isPortalCliente ? "/portal" : "/";
  const isHome = pathname === homeHref;

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/alertas/bootstrap", { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as { data?: { alertas?: Array<{ id: string; titulo: string; descricao: string; lida: boolean; prioridade?: "urgente" | "alta" | "normal"; slaLabel?: string | null }> } };
        if (!active) return;
        const list = payload?.data?.alertas ?? [];
        list.sort((a, b) => {
          if (a.lida !== b.lida) return a.lida ? 1 : -1;
          const wa = a.prioridade === "urgente" ? 3 : a.prioridade === "alta" ? 2 : 1;
          const wb = b.prioridade === "urgente" ? 3 : b.prioridade === "alta" ? 2 : 1;
          return wb - wa;
        });
        setAlerts(list);
      } catch {
        // noop
      }
    };
    void load();
    const unsubscribe = subscribeAlertsUpdated(() => {
      void load();
    });
    const timer = window.setInterval(() => {
      void load();
    }, 30000);
    return () => {
      active = false;
      unsubscribe();
      window.clearInterval(timer);
    };
  }, []);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-50 flex h-14 items-center justify-between border-t border-slate-200 bg-white/95 px-4 pb-[env(safe-area-inset-bottom)] shadow-md backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95 lg:hidden">
        <Link
          href={homeHref}
          className={clsx(
            "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors",
            isHome ? "text-[#6D28D9]" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          )}
          aria-label={isPortalCliente ? "Portal do Cliente" : "Central de Comandos"}
        >
          <Home className="h-5 w-5" />
          <span
            className={clsx(
              "text-[11px] font-medium",
              isHome ? "text-[#6D28D9]" : "text-slate-600 dark:text-slate-400"
            )}
          >
            {isPortalCliente ? "Portal" : "Central"}
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          aria-label="Buscar"
        >
          <Search className="h-5 w-5" />
          <span className="text-[11px] font-medium">Buscar</span>
        </button>
        <button
          type="button"
          onClick={() => setAlertsOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          aria-label="Alertas"
        >
          <span className="relative">
            <Bell className="h-5 w-5" />
            {(unreadByHref["/alertas"] ?? 0) > 0 && (
              <span className="absolute -right-2 -top-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold text-white">
                {(unreadByHref["/alertas"] ?? 0) > 99 ? "99+" : (unreadByHref["/alertas"] ?? 0)}
              </span>
            )}
          </span>
          <span className="text-[11px] font-medium">Alertas</span>
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
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
        <MobileMenuDrawerContent
          onClose={() => setMenuOpen(false)}
          auth={auth}
          unreadByHref={unreadByHref}
          isPortalCliente={isPortalCliente}
          isAdminCliente={isAdminCliente}
          isSystemAdmin={isSystemAdmin}
        />
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
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            autoFocus
          />
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            Digite para buscar em todo o sistema.
          </p>
        </div>
      </Dialog>

      <DrawerSheet
        open={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        title="Minha Caixa"
      >
        <div className="overflow-y-auto p-4">
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Nenhuma notificação no momento.
            </p>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 12).map((a) => (
                <div
                  key={a.id}
                  className={clsx(
                    "rounded-lg border px-3 py-2",
                    a.lida
                      ? "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                      : "border-violet-200 bg-violet-50 dark:border-violet-700/50 dark:bg-violet-950/40"
                  )}
                >
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{a.titulo}</p>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{a.descricao}</p>
                  <span
                    className={clsx(
                      "mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      (a.prioridade ?? "normal") === "urgente" && "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
                      (a.prioridade ?? "normal") === "alta" && "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
                      (a.prioridade ?? "normal") === "normal" && "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    )}
                  >
                    {a.prioridade ?? "normal"}
                  </span>
                  {a.slaLabel && (
                    <span className="ml-1 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                      {a.slaLabel}
                    </span>
                  )}
                </div>
              ))}
              <Link
                href="/alertas"
                onClick={() => setAlertsOpen(false)}
                className="mt-2 block rounded-lg bg-[#6D28D9] px-3 py-2 text-center text-sm font-medium text-white hover:bg-purple-700"
              >
                Abrir Minha Caixa
              </Link>
            </div>
          )}
        </div>
      </DrawerSheet>
    </>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [unreadByHref, setUnreadByHref] = useState<Record<string, number>>({});
  const { perfilId: rawPerfilId, session } = useAuth();
  const perfilId = rawPerfilId ?? "admin";
  const SIDEBAR_STATE_KEY = "pam.sidebar.collapsed";

  useEffect(() => {
    try {
      setSidebarCollapsed(window.localStorage.getItem(SIDEBAR_STATE_KEY) === "1");
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STATE_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      // noop
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    let active = true;
    const financeiroHref = getFinanceiroDefaultHref(session);
    const moduleToHref: Record<string, string> = {
      tarefas: "/tarefas",
      financeiro: financeiroHref,
      comercial: "/comercial",
      contratos: "/contratos",
      helpdesk: "/suporte",
      posVenda: "/pos-venda",
      sistema: "/alertas",
    };
    const loadUnread = async () => {
      try {
        const [alertRes, finRes] = await Promise.all([
          fetch("/api/alertas/bootstrap", { cache: "no-store" }),
          fetch("/api/financeiro/urgencia-count", { cache: "no-store" }),
        ]);
        if (!alertRes.ok) return;
        const payload = (await alertRes.json()) as { data?: { alertas?: BootstrapAlerta[] } };
        let financeiroCount = 0;
        if (finRes.ok) {
          const finBody = (await finRes.json()) as { data?: { count?: number } };
          financeiroCount = typeof finBody?.data?.count === "number" ? finBody.data.count : 0;
        }
        if (!active) return;
        const rows = payload?.data?.alertas ?? [];
        const next: Record<string, number> = { "/alertas": 0 };
        for (const a of rows) {
          if (a.lida) continue;
          next["/alertas"] = (next["/alertas"] ?? 0) + 1;
          const href = moduleToHref[a.modulo] ?? null;
          if (href) next[href] = (next[href] ?? 0) + 1;
        }
        const finFromAlerts = next[financeiroHref] ?? next["/financeiro"] ?? 0;
        next[financeiroHref] = Math.max(finFromAlerts, financeiroCount);
        setUnreadByHref(next);
      } catch {
        // noop
      }
    };
    void loadUnread();
    const unsubscribe = subscribeAlertsUpdated(() => {
      void loadUnread();
    });
    const timer = window.setInterval(() => {
      void loadUnread();
    }, 30000);
    return () => {
      active = false;
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [session]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="relative min-h-screen w-full bg-slate-50 dark:bg-slate-950">
      <DesktopSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        auth={session}
        userName={session.userName ?? "Usuário"}
        userCpf={session.userCpf ?? "—"}
        onOpenProfile={() => setProfileDrawerOpen(true)}
        onLogout={handleLogout}
        unreadByHref={unreadByHref}
        isPortalCliente={session.isPortalCliente}
        isAdminCliente={session.isAdminCliente}
        isSystemAdmin={session.isSystemAdmin}
      />
      <ProfileDrawer
        open={profileDrawerOpen}
        onClose={() => setProfileDrawerOpen(false)}
        perfilId={perfilId}
      />
      <div
        className={`flex min-h-screen flex-col transition-all duration-300 ease-in-out ${sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"}`}
      >
        <div className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/98">
          <GlobalHeader />
        </div>
        <main className="flex min-h-0 w-full min-w-0 flex-1 overflow-visible px-3 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-6 md:pb-24 lg:p-8 lg:pb-10">
          {children}
        </main>
      </div>
      <MobileBottomNav
        auth={session}
        unreadByHref={unreadByHref}
        isPortalCliente={session.isPortalCliente}
        isAdminCliente={session.isAdminCliente}
        isSystemAdmin={session.isSystemAdmin}
      />
    </div>
  );
}
