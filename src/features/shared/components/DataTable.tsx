import { memo, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
  sortable?: boolean;
  headerClassName?: string;
  cellClassName?: string;
}

interface SortConfig {
  key: string;
  direction: "asc" | "desc";
}

interface PaginationConfig {
  currentPage: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyIcon?: ReactNode;
  emptyMessage?: string;
  emptyAction?: { label: string; onClick: () => void };
  skeletonRows?: number;
  rowKey: (row: T) => string | number;
  rowClassName?: (row: T, index: number) => string;
  containerClassName?: string;
  pagination?: PaginationConfig;
  sort?: SortConfig;
  onSort?: (config: SortConfig) => void;
}

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

function SortIcon({ column, currentSort, onSort }: { column: Column<any>; currentSort?: SortConfig; onSort?: (config: SortConfig) => void }) {
  if (!column.sortable) return null;
  const active = currentSort?.key === column.key;
  const direction = active && currentSort ? currentSort.direction : undefined;
  return (
    <button
      onClick={() => onSort?.({ key: column.key, direction: active && direction === "asc" ? "desc" : "asc" })}
      className="inline-flex items-center gap-1 cursor-pointer hover:text-slate-600 dark:hover:text-gray-300 transition-colors"
    >
      {column.header}
      {!active && <ArrowUpDown className="w-3 h-3 opacity-40" />}
      {direction === "asc" && <ArrowUp className="w-3 h-3" />}
      {direction === "desc" && <ArrowDown className="w-3 h-3" />}
    </button>
  );
}

function PaginationBar({ currentPage, pageSize, total, onPageChange, onPageSizeChange, pageSizeOptions }: PaginationConfig) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1 && !onPageSizeChange) return null;

  const pages: (number | string)[] = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-gray-800 flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-slate-400 dark:text-gray-500 font-mono whitespace-nowrap">{total} item{total !== 1 ? "s" : ""}</span>
        {onPageSizeChange && pageSizeOptions && (
          <select
            value={pageSize}
            onChange={(e) => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
            className="text-[10px] bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg px-2 py-1 text-slate-500 dark:text-gray-400 font-mono focus:outline-none cursor-pointer"
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s}>{s} / page</option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pages.map((page, idx) =>
          page === "..." ? (
            <span key={`ellipsis-${idx}`} className="px-1.5 text-[10px] text-slate-400 font-mono">...</span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page as number)}
              className={`min-w-[28px] h-7 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                page === currentPage
                  ? "bg-slate-900 dark:bg-indigo-600 text-white"
                  : "text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800"
              }`}
            >
              {page}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function DataTableInner<T>({
  columns,
  data,
  loading = false,
  emptyIcon,
  emptyMessage = "No data found.",
  emptyAction,
  skeletonRows = 4,
  rowKey,
  rowClassName,
  containerClassName = "",
  pagination,
  sort,
  onSort,
}: DataTableProps<T>) {
  return (
    <div className={`bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden ${containerClassName}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/30">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest ${alignClass[col.align || "left"]} ${col.headerClassName || ""}`}
                  style={col.width ? { width: col.width } : undefined}
                >
                  <SortIcon column={col} currentSort={sort} onSort={onSort} />
                  {!col.sortable && col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i} className="border-b border-slate-50 dark:border-gray-800/50">
                  {Array.from({ length: columns.length }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-slate-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    {emptyIcon && <span className="text-slate-300 dark:text-gray-600">{emptyIcon}</span>}
                    <p className="text-xs text-slate-400 dark:text-gray-500">{emptyMessage}</p>
                    {emptyAction && (
                      <button
                        onClick={emptyAction.onClick}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 cursor-pointer"
                      >
                        {emptyAction.label}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr
                  key={rowKey(row)}
                  className={`border-b border-slate-50 dark:border-gray-800/50 hover:bg-slate-50/50 dark:hover:bg-gray-800/20 ${rowClassName?.(row, index) || ""}`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-xs ${alignClass[col.align || "left"]} ${col.cellClassName || ""}`}
                    >
                      {col.render ? col.render(row) : (row as any)[col.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pagination && <PaginationBar {...pagination} />}
    </div>
  );
}

export default memo(DataTableInner) as typeof DataTableInner;
