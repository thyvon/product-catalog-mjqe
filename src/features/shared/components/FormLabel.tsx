import type { ReactNode } from "react";

interface FormLabelProps {
  children: ReactNode;
  variant?: "default" | "mono";
  required?: boolean;
  className?: string;
}

export function FormLabel({ children, variant = "default", required, className = "" }: FormLabelProps) {
  const base =
    variant === "mono"
      ? "block text-xs font-mono font-medium text-muted-foreground uppercase tracking-widest"
      : "mb-1 block text-xs font-medium text-muted-foreground";
  return (
    <span className={`${base} ${className}`.trim()}>
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </span>
  );
}
