import React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Eye,
  SquarePen as PenNewSquare,
  Trash2 as TrashBinMinimalistic,
  CheckCircle,
  Copy,
} from "lucide-react";
import type { Product } from "@/features/shared/types";
import DataTable from "@/features/shared/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface PaginationConfig {
  currentPage: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions: number[];
}

interface ProductListViewProps {
  products: Product[];
  isAdmin: boolean;
  onView: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
  loading?: boolean;
  pagination?: PaginationConfig;
}

const PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect fill="#f1f5f9" width="400" height="400"/><text x="50%" y="50%" fill="#94a3b8" font-family="monospace" font-size="14" font-weight="bold" text-anchor="middle" dominant-baseline="middle">NO IMAGE</text></svg>`);

export default function ProductListView({
  products,
  isAdmin,
  onView,
  onEdit,
  onDelete,
  loading,
  pagination,
}: ProductListViewProps) {
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<{ src: string; x: number; y: number } | null>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const columns: ColumnDef<Product>[] = [
    {
      id: "image",
      header: "Preview",
      meta: { width: "64px" },
      cell: ({ row }) => {
        const p = row.original;
        const imageUrl = p.imageUrl || PLACEHOLDER;
        return (
          <div
            className="w-10 h-10 rounded-lg overflow-hidden bg-muted border border-border shadow-sm shrink-0"
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setPreview({ src: imageUrl, x: rect.right + 12, y: rect.top });
            }}
            onMouseLeave={() => setPreview(null)}
          >
            <img
              src={imageUrl}
              alt={p.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center"
              onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
            />
          </div>
        );
      },
    },
    {
      accessorKey: "productCode",
      header: "Product Code",
      meta: { width: "192px" },
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex items-center gap-1.5">
            <span className="px-2.5 py-0.5 bg-primary text-primary-foreground rounded-lg font-semibold font-mono tracking-wider text-xs whitespace-nowrap shadow-sm">
              {p.productCode}
            </span>
            <Tooltip>
              <TooltipTrigger render={<Button
                onClick={() => handleCopy(p.productCode)}
                type="button"
                variant="ghost"
                size="icon-xs"
              >
                {copiedCode === p.productCode ? (
                  <CheckCircle className="text-foreground" />
                ) : (
                  <Copy />
                )}
              </Button>} />
              <TooltipContent>Copy Product Code</TooltipContent>
            </Tooltip>
          </div>
        );
      },
    },
    {
      accessorKey: "name",
      header: "Product Name",
      cell: ({ row }) => {
        const p = row.original;
        return (
          <span
            onClick={() => onView(p)}
            className="text-sm font-semibold text-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Click to view details"
          >
            {p.name}
          </span>
        );
      },
    },
    {
      accessorKey: "uom",
      header: "UoM",
      meta: { width: "96px" },
      cell: ({ row }) => (
        <span className="px-2.5 py-0.5 bg-muted text-foreground font-medium font-mono rounded-lg border border-border text-xs uppercase">
          {row.original.uom || "Pcs"}
        </span>
      ),
    },
    {
      id: "categoryGroup",
      header: "Category / Group",
      meta: { width: "176px" },
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="space-y-1">
            <span className="font-medium text-foreground block">{p.category}</span>
            <span className="text-xs text-muted-foreground font-mono block">{p.subCategory || "General"}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      meta: { width: "128px" },
      cell: ({ row }) => (
        <Badge variant={row.original.status === "Active" ? "default" : "secondary"} className="text-xs font-medium uppercase tracking-wider font-mono">
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      meta: { align: "right", width: "176px" },
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            <Tooltip>
              <TooltipTrigger render={<Button onClick={() => onView(p)} variant="ghost" size="icon-xs">
                <Eye />
              </Button>} />
              <TooltipContent>View Detailed Details</TooltipContent>
            </Tooltip>
            {isAdmin && (
              <>
                <Tooltip>
                  <TooltipTrigger render={<Button onClick={() => onEdit(p)} variant="ghost" size="icon-xs">
                    <PenNewSquare />
                  </Button>} />
                  <TooltipContent>Edit Specifications</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger render={<Button onClick={() => onDelete(p.id)} variant="ghost" size="icon-xs">
                    <TrashBinMinimalistic />
                  </Button>} />
                  <TooltipContent>Delete Product</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div id="product-list-container" className="relative">
      <DataTable<Product>
        columns={columns}
        data={products}
        loading={loading}
        skeletonRows={5}
        getRowId={(p) => p.id}
        rowClassName={(_, i) => i % 2 === 0 ? "" : "even:bg-muted/40"}
        pagination={pagination}
      />

      {preview && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: preview.x, top: preview.y }}
        >
          <div className="w-60 h-60 rounded-2xl overflow-hidden shadow-2xl border border-white/20 ring-1 ring-border bg-card">
            <img
              src={preview.src}
              alt="Preview"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}
    </div>
  );
}
