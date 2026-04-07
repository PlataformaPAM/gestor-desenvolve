"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { DashboardShell } from "./dashboard-shell";

/** Envolve com DashboardShell apenas em rotas de dashboard. /login e /acesso-negado renderizam só a página. */
export function ConditionalDashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login" || pathname === "/acesso-negado") return <>{children}</>;
  return <DashboardShell>{children}</DashboardShell>;
}
