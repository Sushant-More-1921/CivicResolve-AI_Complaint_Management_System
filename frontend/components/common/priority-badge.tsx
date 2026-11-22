"use client";

import React from "react";
import { ComplaintPriority } from "@/types/complaint";
import { cn } from "@/lib/utils";
import { AlertTriangle, AlertCircle, ArrowUp, ArrowDown } from "lucide-react";
import { useLanguage } from "@/context/language-context";

interface PriorityBadgeProps {
  priority: ComplaintPriority;
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "md";
}

/**
 * PriorityBadge - Centralized priority indicator
 * Strict color mappings with full Light and Dark mode contrast
 * VERY_HIGH / CRITICAL -> Red, HIGH -> Orange, MEDIUM -> Blue, LOW -> Green
 */
export function PriorityBadge({
  priority,
  className,
  showIcon = true,
  size = "md",
}: PriorityBadgeProps) {
  const { t } = useLanguage();

  const configs: Record<
    ComplaintPriority,
    { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
  > = {
    CRITICAL: {
      label: t("priorityCritical", "CRITICAL"),
      bg: "bg-[#FEF2F2] dark:bg-[#7F1D1D]/30",
      text: "text-[#DC2626] dark:text-[#F87171]",
      border: "border-[#FECACA] dark:border-[#991B1B]",
      icon: <AlertCircle className="w-3.5 h-3.5 shrink-0 text-[#DC2626] dark:text-[#F87171]" />,
    },
    VERY_HIGH: {
      label: t("priorityCritical", "CRITICAL"),
      bg: "bg-[#FEF2F2] dark:bg-[#7F1D1D]/30",
      text: "text-[#DC2626] dark:text-[#F87171]",
      border: "border-[#FECACA] dark:border-[#991B1B]",
      icon: <AlertCircle className="w-3.5 h-3.5 shrink-0 text-[#DC2626] dark:text-[#F87171]" />,
    },
    HIGH: {
      label: t("priorityHigh", "HIGH"),
      bg: "bg-[#FFF7E6] dark:bg-[#78350F]/30",
      text: "text-[#B45309] dark:text-[#FBBF24]",
      border: "border-[#FDE68A] dark:border-[#92400E]",
      icon: <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#F59E0B] dark:text-[#FBBF24]" />,
    },
    MEDIUM: {
      label: t("priorityMedium", "MEDIUM"),
      bg: "bg-[#EAF2FF] dark:bg-[#1E3A8A]/30",
      text: "text-[#0B4EA2] dark:text-[#60A5FA]",
      border: "border-[#BFDBFE] dark:border-[#1E40AF]/50",
      icon: <ArrowUp className="w-3.5 h-3.5 shrink-0 text-[#0B4EA2] dark:text-[#60A5FA]" />,
    },
    LOW: {
      label: t("priorityLow", "LOW"),
      bg: "bg-[#ECFDF3] dark:bg-[#064E3B]/30",
      text: "text-[#15803D] dark:text-[#4ADE80]",
      border: "border-[#BBF7D0] dark:border-[#065F46]",
      icon: <ArrowDown className="w-3.5 h-3.5 shrink-0 text-[#16A34A] dark:text-[#4ADE80]" />,
    },
  };

  const current = configs[priority] || configs.MEDIUM;

  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-[10px] gap-1"
      : "px-2.5 py-1 text-xs gap-1.5 font-bold";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border tracking-wider uppercase select-none transition-colors",
        current.bg,
        current.text,
        current.border,
        sizeClasses,
        className
      )}
    >
      {showIcon && current.icon}
      <span>{current.label}</span>
    </span>
  );
}
