import { useState, type ReactNode } from "react";
import { Filter, Search } from "lucide-react";

interface ListPageLayoutProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  children: ReactNode;
}

export default function ListPageLayout({
  title,
  description,
  actions,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters,
  children,
}: ListPageLayoutProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const hasFilters = Boolean(filters);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-gray-100 tracking-tight">{title}</h1>
          {description ? (
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>

      {onSearchChange ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchValue ?? ""}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder ?? "Search..."}
              className="h-[38px] w-full pl-10 pr-20 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-gray-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            {hasFilters ? (
              <button
                type="button"
                onClick={() => setIsFiltersOpen((current) => !current)}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-[30px] items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filters</span>
              </button>
            ) : null}
          </div>
          {hasFilters && isFiltersOpen ? (
            <div className="flex flex-wrap items-center gap-2.5">{filters}</div>
          ) : null}
        </div>
      ) : (
        hasFilters ? (
          <div>
            <button
              type="button"
              onClick={() => setIsFiltersOpen((current) => !current)}
              className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200 transition-colors"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
            </button>
            {isFiltersOpen ? (
              <div className="mt-3 flex flex-wrap items-center gap-2.5">{filters}</div>
            ) : null}
          </div>
        ) : null
      )}

      {children}
    </div>
  );
}
