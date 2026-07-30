import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  kh?: string;
  children: ReactNode;
  wide?: boolean;
}

export function Field({ label, kh, children, wide = false }: FieldProps) {
  return (
    <label className={wide ? "col-span-1 md:col-span-2" : ""}>
      <span className="text-xs font-medium text-foreground">
        {label}
        {kh && <span className="text-xs font-normal text-muted-foreground"> / {kh}</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}