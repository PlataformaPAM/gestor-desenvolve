"use client";

import { useEffect, useRef } from "react";

type DropdownMenuProps = {
  open: boolean;
  onClose: () => void;
  anchor: React.ReactNode;
  align?: "start" | "end";
  children: React.ReactNode;
  className?: string;
};

export function DropdownMenu({
  open,
  onClose,
  anchor,
  align = "start",
  children,
  className = "",
}: DropdownMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  return (
    <div className="relative inline-block" ref={ref}>
      {anchor}
      {open && (
        <div
          role="menu"
          className={`absolute z-50 mt-2 min-w-[200px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900 ${align === "end" ? "right-0" : "left-0"} ${className}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownMenuItem({
  children,
  onClick,
  icon,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

export function DropdownMenuSeparator() {
  return <div className="my-1 border-t border-slate-200 dark:border-slate-700" />;
}
