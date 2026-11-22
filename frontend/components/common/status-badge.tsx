"use client";

import React from "react";
import { ComplaintStatus } from "@/types/complaint";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";

interface StatusBadgeProps {
  status: ComplaintStatus;
  className?: string;
  size?: "sm" | "md";
}

/**
 * StatusBadge - Centralized status badge
 * Strict color mappings with full Light and Dark mode contrast
 */
export function StatusBadge({
  status,
  className,
  size = "md",
}: StatusBadgeProps) {
  const { t } = useLanguage();

  const statusConfig: Record<
    ComplaintStatus,
    { label: string; bg: string; text: string; border: string; dot: string }
  > = {
    SUBMITTED: {
      label: t("statusSubmitted", "SUBMITTED"),
      bg: "bg-[#EAF2FF] dark:bg-[#1E3A8A]/30",
      text: "text-[#0B4EA2] dark:text-[#60A5FA]",
      border: "border-[#BFDBFE] dark:border-[#1E40AF]/50",
      dot: "bg-[#0B4EA2] dark:bg-[#60A5FA]",
    },
    UNDER_REVIEW: {
      label: t("statusUnderReview", "UNDER REVIEW"),
      bg: "bg-[#F3E8FF] dark:bg-[#4C1D95]/30",
      text: "text-[#5B21B6] dark:text-[#C084FC]",
      border: "border-[#DDD6FE] dark:border-[#581C87]",
      dot: "bg-[#5B21B6] dark:bg-[#C084FC]",
    },
    VALIDATING: {
      label: t("statusUnderReview", "VALIDATING"),
      bg: "bg-[#F3E8FF] dark:bg-[#4C1D95]/30",
      text: "text-[#5B21B6] dark:text-[#C084FC]",
      border: "border-[#DDD6FE] dark:border-[#581C87]",
      dot: "bg-[#5B21B6] dark:bg-[#C084FC]",
    },
    ASSIGNED: {
      label: t("statusAssigned", "ASSIGNED"),
      bg: "bg-[#EAF2FF] dark:bg-[#1E3A8A]/30",
      text: "text-[#0B4EA2] dark:text-[#60A5FA]",
      border: "border-[#BFDBFE] dark:border-[#1E40AF]/50",
      dot: "bg-[#0B4EA2] dark:bg-[#60A5FA]",
    },
    IN_PROGRESS: {
      label: t("statusInProgress", "IN PROGRESS"),
      bg: "bg-[#FFF7E6] dark:bg-[#78350F]/30",
      text: "text-[#B45309] dark:text-[#FBBF24]",
      border: "border-[#FDE68A] dark:border-[#92400E]",
      dot: "bg-[#F59E0B] dark:bg-[#FBBF24]",
    },
    RESOLVED: {
      label: t("statusResolved", "RESOLVED"),
      bg: "bg-[#ECFDF3] dark:bg-[#064E3B]/30",
      text: "text-[#15803D] dark:text-[#4ADE80]",
      border: "border-[#BBF7D0] dark:border-[#065F46]",
      dot: "bg-[#16A34A] dark:bg-[#4ADE80]",
    },
    CITIZEN_VERIFICATION: {
      label: t("statusResolved", "CITIZEN VERIFY"),
      bg: "bg-[#ECFEFF] dark:bg-[#134E4A]/30",
      text: "text-[#0F766E] dark:text-[#2DD4BF]",
      border: "border-[#99F6E4] dark:border-[#115E59]",
      dot: "bg-[#0F766E] dark:bg-[#2DD4BF]",
    },
    CLOSED: {
      label: t("statusClosed", "CLOSED"),
      bg: "bg-[#ECFDF3] dark:bg-[#064E3B]/30",
      text: "text-[#15803D] dark:text-[#4ADE80]",
      border: "border-[#BBF7D0] dark:border-[#065F46]",
      dot: "bg-[#16A34A] dark:bg-[#4ADE80]",
    },
    REOPENED: {
      label: t("statusInProgress", "REOPENED"),
      bg: "bg-[#FFF7E6] dark:bg-[#78350F]/30",
      text: "text-[#B45309] dark:text-[#FBBF24]",
      border: "border-[#FDE68A] dark:border-[#92400E]",
      dot: "bg-[#F59E0B] dark:bg-[#FBBF24]",
    },
    REJECTED: {
      label: t("statusRejected", "REJECTED"),
      bg: "bg-[#FEF2F2] dark:bg-[#7F1D1D]/30",
      text: "text-[#DC2626] dark:text-[#F87171]",
      border: "border-[#FECACA] dark:border-[#991B1B]",
      dot: "bg-[#DC2626] dark:bg-[#F87171]",
    },
    ESCALATED: {
      label: t("statusOverdue", "ESCALATED"),
      bg: "bg-[#FEF2F2] dark:bg-[#7F1D1D]/30",
      text: "text-[#DC2626] dark:text-[#F87171]",
      border: "border-[#FECACA] dark:border-[#991B1B]",
      dot: "bg-[#DC2626] dark:bg-[#F87171]",
    },
  };

  const config = statusConfig[status] || statusConfig.SUBMITTED;

  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-[10px] gap-1"
      : "px-2.5 py-1 text-xs gap-1.5 font-bold";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border tracking-wider uppercase select-none transition-colors",
        config.bg,
        config.text,
        config.border,
        sizeClasses,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.dot)} />
      <span>{config.label}</span>
    </span>
  );
}
