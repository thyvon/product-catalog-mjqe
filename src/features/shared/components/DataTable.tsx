import { useMemo } from "react";
import {
  type ColumnDef,
  type SortingState,
  type OnChangeFn,
  type RowData,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: "left" | "center" | "right";
    width?: string;
    className?: string;
  }
}

interface PaginationConfig {
  currentPage: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions: number[];
}

interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  loading?: boolean;
  emptyIcon?: React.ReactNode;
  emptyMessage?: string;
  emptyAction?: { label: string; onClick: () => void };
  skeletonRows?: number;
  getRowId?: (row: TData) => string;
  pagination?: PaginationConfig;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  rowClassName?: (row: TData, index: number) => string;
  aggregates?: React.ReactNode;
}

export default function DataTable<TData>({
  columns,
  data,
  loading,
  emptyIcon,
  emptyMessage,
  emptyAction,
  skeletonRows = 5,
  getRowId,
  pagination,
  sorting,
  onSortingChange,
  rowClassName,
  aggregates,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: pagination ? Math.ceil(pagination.total / pagination.pageSize) : -1,
    state: sorting ? { sorting } : {},
    onSortingChange,
    getRowId,
    defaultColumn: {
      cell: ({ getValue }) => (getValue() as string) ?? "—",
    },
  });

  const totalPages = useMemo(
    () => (pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1),
    [pagination]
  );

  const visiblePages = useMemo(() => {
    if (!pagination) return [];
    const cp = pagination.currentPage;
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (cp > 3) pages.push("...");
      const start = Math.max(2, cp - 1);
      const end = Math.min(totalPages - 1, cp + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (cp < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }, [pagination, totalPages]);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border overflow-x-auto">
        <Table className="w-full min-w-max">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta;
                  const canSort = header.column.getCanSort();
                  return (
                    <TableHead
                      key={header.id}
                      className={`whitespace-nowrap${canSort ? " cursor-pointer select-none" : ""}`}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      style={{ textAlign: meta?.align || "left", width: meta?.width }}
                    >
                      <span className="inline-flex items-center">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          header.column.getIsSorted() === "asc" ? (
                            <ArrowUp className="ml-1 size-3" />
                          ) : header.column.getIsSorted() === "desc" ? (
                            <ArrowDown className="ml-1 size-3" />
                          ) : (
                            <ArrowUpDown className="ml-1 size-3 text-muted-foreground/50" />
                          )
                        )}
                      </span>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    {emptyIcon}
                    <p className="text-sm">{emptyMessage || "No data found."}</p>
                    {emptyAction && (
                      <Button variant="outline" size="sm" onClick={emptyAction.onClick}>
                        {emptyAction.label}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row, idx) => (
                <TableRow
                  key={row.id}
                  className={rowClassName?.(row.original, idx)}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta;
                    return (
                      <TableCell
                        key={cell.id}
                        className={meta?.className}
                        style={{ textAlign: meta?.align || "left", width: meta?.width }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {aggregates && (
        <div className="flex items-center gap-4 px-1 text-sm text-muted-foreground">
          {aggregates}
        </div>
      )}

      {pagination && !loading && (
        <div className="flex items-center justify-between gap-4 min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
            <span className="whitespace-nowrap">Rows per page:</span>
            <Select
              value={String(pagination.pageSize)}
              onValueChange={(v) => pagination.onPageSizeChange(Number(v))}
            >
              <SelectTrigger className="h-8 w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pagination.pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="whitespace-nowrap">
              {Math.min((pagination.currentPage - 1) * pagination.pageSize + 1, pagination.total)}
              –{Math.min(pagination.currentPage * pagination.pageSize, pagination.total)} of{" "}
              {pagination.total}
            </span>
          </div>

          <Pagination className="mx-0 w-auto">
            <PaginationContent className="flex-nowrap">
              <PaginationItem>
                <PaginationPrevious
                  onClick={(e) => { e.preventDefault(); pagination.onPageChange(pagination.currentPage - 1); }}
                  className={pagination.currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              {visiblePages.map((page, i) =>
                page === "..." ? (
                  <PaginationItem key={`ellipsis-${i}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={page}>
                    <PaginationLink
                      isActive={page === pagination.currentPage}
                      onClick={(e) => { e.preventDefault(); pagination.onPageChange(page as number); }}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}
              <PaginationItem>
                <PaginationNext
                  onClick={(e) => { e.preventDefault(); pagination.onPageChange(pagination.currentPage + 1); }}
                  className={pagination.currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
