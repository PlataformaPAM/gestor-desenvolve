"use client";

import type { ReactElement } from "react";
import clsx from "clsx";

type HintTooltipProps = {
  content: string;
  children: ReactElement;
  /** Onde o balão aparece em relação ao gatilho */
  placement?: "bottom" | "top";
  className?: string;
};

export function HintTooltip({
  content,
  children,
  placement = "bottom",
  className,
}: HintTooltipProps) {
  const isTop = placement === "top";

  return (
    <span className={clsx("group/hint relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={clsx(
          "pointer-events-none absolute left-1/2 z-[120] w-max max-w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2",
          isTop ? "bottom-[calc(100%+0.5rem)]" : "top-[calc(100%+0.5rem)]",
          "rounded-xl border border-violet-200/80 bg-white/95 px-3 py-2.5 text-left text-xs font-normal leading-relaxed text-slate-600 shadow-xl backdrop-blur-sm",
          "ring-1 ring-slate-900/5",
          "opacity-0 invisible scale-[0.98] transition-all duration-150 ease-out",
          "group-hover/hint:opacity-100 group-hover/hint:visible group-hover/hint:scale-100",
          "group-focus-within/hint:opacity-100 group-focus-within/hint:visible group-focus-within/hint:scale-100",
          "dark:border-violet-500/35 dark:bg-slate-900/95 dark:text-slate-300 dark:ring-slate-100/10"
        )}
      >
        <span
          aria-hidden
          className={clsx(
            "absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border border-violet-200/80 bg-white/95 dark:border-violet-500/35 dark:bg-slate-900/95",
            isTop
              ? "bottom-0 translate-y-1/2 border-t-0 border-l-0"
              : "top-0 -translate-y-1/2 border-b-0 border-r-0"
          )}
        />
        <span className="relative z-[1] block">{content}</span>
      </span>
    </span>
  );
}
