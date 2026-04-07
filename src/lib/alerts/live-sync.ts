"use client";

export const ALERTS_UPDATED_EVENT = "pam:alerts-updated";

export function emitAlertsUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ALERTS_UPDATED_EVENT));
}

export function subscribeAlertsUpdated(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = () => callback();
  window.addEventListener(ALERTS_UPDATED_EVENT, handler);
  return () => window.removeEventListener(ALERTS_UPDATED_EVENT, handler);
}
