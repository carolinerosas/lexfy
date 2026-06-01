import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "neutral";
  className?: string;
}

const variants = {
  default: "bg-slate-700 text-white",
  success: "bg-slate-700 text-white",
  warning: "bg-gray-200 text-gray-800",
  danger: "bg-red-100 text-red-700",
  info: "bg-gray-100 text-gray-700",
  neutral: "bg-gray-100 text-gray-600",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
