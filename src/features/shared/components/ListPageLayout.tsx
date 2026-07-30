import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ListPageLayoutProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** Inline filter controls rendered next to the search bar */
  filters?: React.ReactNode;
  /** Show a count badge next to the title */
  totalCount?: number;
  className?: string;
}

export default function ListPageLayout({
  title,
  description,
  actions,
  children,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters,
  totalCount,
}: ListPageLayoutProps) {
  return (
    <div className="space-y-4">
      {/* Title row — wraps on small screens so actions never overflow */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold truncate">{title}</h1>
            {totalCount !== undefined && (
              <Badge variant="secondary" className="font-mono text-xs shrink-0">
                {totalCount}
              </Badge>
            )}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>

      {/* Search + filter bar — always wraps cleanly */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full min-w-[180px] sm:w-auto sm:flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8"
          />
        </div>
        {filters && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{filters}</div>
        )}
      </div>

      <Separator />

      {children}
    </div>
  );
}
