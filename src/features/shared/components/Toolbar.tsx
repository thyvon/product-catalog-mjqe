import { useState } from "react";
import { Search, SlidersHorizontal, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ToolbarProps {
  /** Page title */
  title: string;
  /** Subtitle / record count text */
  description?: string;
  /** Badge count displayed next to the title */
  totalCount?: number;
  /** Action buttons rendered top-right (Refresh, Export, Add, …) */
  actions?: React.ReactNode;
  /** Controlled search input value */
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** Filter controls (dropdowns) inside the collapsible filter panel */
  filters?: React.ReactNode;
  /** Second row inside the filter panel — date ranges, secondary filters */
  subFilters?: React.ReactNode;
  /** Controls pinned to the far-right of the search row (e.g. view-mode toggle) */
  filterEnd?: React.ReactNode;
  /** Number of active filters — shown as a badge on the Filters button */
  activeFilterCount?: number;
}

/**
 * Standard toolbar for every list page.
 *
 * Layout:
 *   Row 1  — [Title + count badge]               [actions]
 *   Row 2  — [🔍 Search] [Filters ▼] [filterEnd]
 *   Panel  — collapsible: [filters row] [subFilters row]
 */
export default function Toolbar({
  title,
  description,
  totalCount,
  actions,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search…",
  filters,
  subFilters,
  filterEnd,
  activeFilterCount,
}: ToolbarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const hasFilters = Boolean(filters || subFilters);

  return (
    <div className="space-y-3">
      {/* ── Row 1: title + actions ── */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold truncate">{title}</h1>
            {totalCount !== undefined && (
              <Badge variant="secondary" className="shrink-0 font-mono text-xs">
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

      {/* ── Row 2: search | filter toggle | filterEnd ── */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative w-64 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Filter toggle button — only shown when filters exist */}
        {hasFilters && (
          <Button
            variant={filterOpen ? "default" : "outline"}
            onClick={() => setFilterOpen((o) => !o)}
            className="gap-1.5"
          >
            <SlidersHorizontal className="size-4" />
            Filters
            {activeFilterCount !== undefined && activeFilterCount > 0 && (
              <Badge variant={filterOpen ? "secondary" : "default"} className="ml-0.5 h-4 min-w-4 px-1 font-mono text-[10px]">
                {activeFilterCount}
              </Badge>
            )}
            <ChevronDown className={`size-3.5 transition-transform duration-200 ${filterOpen ? "rotate-180" : ""}`} />
          </Button>
        )}

        {/* Right-pinned slot (view toggle, etc.) */}
        {filterEnd && (
          <div className="ml-auto flex shrink-0 items-center gap-2">{filterEnd}</div>
        )}
      </div>

      {/* ── Collapsible filter panel — all fields on one inline row ── */}
      {hasFilters && filterOpen && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
          {filters}
          {subFilters && (
            <>
              {filters && <span className="h-5 w-px bg-border shrink-0" />}
              {subFilters}
            </>
          )}
        </div>
      )}
    </div>
  );
}
