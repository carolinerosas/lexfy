import { cn } from "@/lib/utils";

export function Card({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div className={cn("min-w-0 max-w-full bg-white rounded-xl border border-gray-200 shadow-sm", className)} onClick={onClick}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("px-4 py-4 border-b border-gray-100 sm:px-6", className)}>{children}</div>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn("text-base font-semibold text-gray-900", className)}>{children}</h3>;
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("px-4 py-4 sm:px-6", className)}>{children}</div>;
}
