"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import {
  getFinanceiroRedirectTarget,
  pathnameAllowedInFinanceiro,
} from "@/lib/financeiro/financeiro-nav";

export default function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const redirectTarget = useMemo(() => {
    if (!session.perfilId) return null;
    return getFinanceiroRedirectTarget(pathname, session);
  }, [session, pathname]);

  const mayRender = useMemo(() => {
    if (!session.perfilId) return false;
    return pathnameAllowedInFinanceiro(pathname, session);
  }, [session, pathname]);

  useEffect(() => {
    if (redirectTarget) {
      router.replace(redirectTarget);
    }
  }, [redirectTarget, router]);

  if (!session.perfilId || redirectTarget || !mayRender) {
    return null;
  }

  return <>{children}</>;
}
