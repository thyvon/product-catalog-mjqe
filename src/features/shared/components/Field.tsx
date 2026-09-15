import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  kh?: string;
  children: ReactNode;
  wide?: boolean;
  horizontal?: boolean;
}

export function Field({ label, kh, children, wide = false, horizontal = false }: FieldProps) {
  if (horizontal) {
    return (
      <label className={`flex items-center gap-3 ${wide ? "col-span-1 md:col-span-2" : ""}`}>
        <span className="shrink-0 w-28 text-xs font-medium text-foreground">
          {kh ? (
            <>
              <span>{kh}</span>
              {label && <span className="text-xs font-normal text-muted-foreground"> / {label}</span>}
            </>
          ) : (
            label
          )}
        </span>
        <div className="flex-1 min-w-0">{children}</div>
      </label>
    );
  }

  return (
    <label className={wide ? "col-span-1 md:col-span-2" : ""}>
      <span className="text-xs font-medium text-foreground">
        {kh ? (
          <>
            <span>{kh}</span>
            {label && <span className="text-xs font-normal text-muted-foreground"> / {label}</span>}
          </>
        ) : (
          label
        )}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}