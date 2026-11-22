"use client";

import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/theme-context";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export function ThemeToggle({
  className,
  size = "sm",
  showLabel = false,
}: ThemeToggleProps) {
  const { isDark, toggleTheme, mounted } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      className={cn(
        "relative inline-flex items-center justify-center rounded-lg border transition-colors cursor-pointer",
        size === "sm" ? "h-9 px-2.5 text-xs gap-1.5" : "h-10 px-3 text-sm gap-2",
        // Light mode styling
        "bg-white border-[#CBD5E1] text-[#334155] hover:bg-[#F1F5F9] hover:text-[#0F172A]",
        // Dark mode styling
        "dark:bg-[#161F30] dark:border-[#2D3748] dark:text-[#CBD5E1] dark:hover:bg-[#1E293B] dark:hover:text-[#F8FAFC]",
        className
      )}
    >
      {!mounted ? (
        <Sun className={cn(size === "sm" ? "w-4 h-4" : "w-4.5 h-4.5", "text-[#64748B]")} />
      ) : isDark ? (
        <Sun className={cn(size === "sm" ? "w-4 h-4" : "w-4.5 h-4.5", "text-[#F59E0B] transition-transform rotate-0 hover:rotate-45 duration-300")} />
      ) : (
        <Moon className={cn(size === "sm" ? "w-4 h-4" : "w-4.5 h-4.5", "text-[#0B4EA2] transition-transform rotate-0 hover:-rotate-12 duration-300")} />
      )}

      {showLabel && (
        <span className="font-semibold text-xs">
          {!mounted ? "Theme" : isDark ? "Light" : "Dark"}
        </span>
      )}
    </button>
  );
}

