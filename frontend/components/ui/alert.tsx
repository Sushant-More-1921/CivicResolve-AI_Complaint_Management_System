import * as React from "react";
import { AlertCircle, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "danger" | "warning" | "success" | "info";
  title?: string;
  children: React.ReactNode;
}

export function Alert({
  variant = "danger",
  title,
  children,
  className,
  ...props
}: AlertProps) {
  const configs = {
    danger: {
      bg: "bg-[#FEF2F2] dark:bg-[#7F1D1D]/20",
      border: "border-[#FECACA] dark:border-[#DC2626]/40",
      text: "text-[#DC2626] dark:text-[#F87171]",
      icon: <AlertCircle className="w-5 h-5 text-[#DC2626] dark:text-[#F87171] shrink-0 mt-0.5" />,
    },
    warning: {
      bg: "bg-[#FFF7E6] dark:bg-[#78350F]/20",
      border: "border-[#FDE68A] dark:border-[#F59E0B]/40",
      text: "text-[#B45309] dark:text-[#FBBF24]",
      icon: <AlertTriangle className="w-5 h-5 text-[#F59E0B] dark:text-[#FBBF24] shrink-0 mt-0.5" />,
    },
    success: {
      bg: "bg-[#ECFDF3] dark:bg-[#064E3B]/20",
      border: "border-[#BBF7D0] dark:border-[#10B981]/40",
      text: "text-[#15803D] dark:text-[#34D399]",
      icon: <CheckCircle2 className="w-5 h-5 text-[#16A34A] dark:text-[#34D399] shrink-0 mt-0.5" />,
    },
    info: {
      bg: "bg-[#EAF2FF] dark:bg-[#1E3A8A]/20",
      border: "border-[#BFDBFE] dark:border-[#3B82F6]/40",
      text: "text-[#0B4EA2] dark:text-[#60A5FA]",
      icon: <Info className="w-5 h-5 text-[#0B4EA2] dark:text-[#60A5FA] shrink-0 mt-0.5" />,
    },
  };

  const style = configs[variant];

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 p-3.5 rounded-lg border text-sm leading-relaxed",
        style.bg,
        style.border,
        style.text,
        className
      )}
      {...props}
    >
      {style.icon}
      <div className="flex-1">
        {title && <h5 className="font-semibold text-sm mb-0.5">{title}</h5>}
        <div className="text-xs sm:text-sm font-normal">{children}</div>
      </div>
    </div>
  );
}
