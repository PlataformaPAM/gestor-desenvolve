"use client";

import { useCentralPageGuard } from "@/hooks/use-rbac-resource";
import { CommandCenter } from "./command-center";

export function HomeGuard() {
  const podeVerCentral = useCentralPageGuard();
  if (!podeVerCentral) return null;
  return <CommandCenter />;
}
