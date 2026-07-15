import React from "react";
import {
  Eye,
  SquarePen as PenNewSquare,
  Trash2 as TrashBinMinimalistic,
  CheckCircle,
  Copy,
} from "lucide-react";
import type { Product } from "@/features/shared/types";
import DataTable from "@/features/shared/components/DataTable";

interface ProductListViewProps {
  products: Product[];
  isAdmin: boolean;
  onView: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
}

const PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect fill="#f1f5f9" width="400" height="400"/><text x="50%" y="50%" fill="#94a3b8" font-family="monospace" font-size="14" font-weight="bold" text-anchor="middle" dominant-baseline="middle">NO IMAGE</text></svg>`);

const statusClass = (s: string) =>
  s === "Active"
    ? "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-150 dark:border-emerald-800"
    : "bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-150 dark:border-amber-800";

export default function ProductListView({
  products,
  isAdmin,
  onView,
  onEdit,
  onDelete,
}: ProductListViewProps) {
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<{ src: string; x: number; y: number } | null>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div id="product-list-container" className="relative">
      <DataTable<Product>
        columns={[
          {
            key: "image",
            header: "Preview",
            width: "64px",
            render: (p) => {
              const imageUrl = p.imageUrl || PLACEHOLDER;
              return (
                <div
                  className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 dark:bg-gray-800 border border-slate-100 dark:border-gray-700 shadow-sm shrink-0"
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
            key: "productCode",
            header: "Product Code",
            width: "192px",
            render: (p) => (
              <div className="flex items-center gap-1.5">
                <span className="px-2.5 py-0.5 bg-slate-900 dark:bg-indigo-700 text-white rounded-lg font-black font-mono tracking-wider text-[11px] whitespace-nowrap shadow-sm">
                  {p.productCode}
                </span>
                <button
                  onClick={() => handleCopy(p.productCode)}
                  type="button"
                  title="Copy Product Code"
                  className="p-1 text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-md transition-all cursor-pointer shrink-0"
                >
                  {copiedCode === p.productCode ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            ),
          },
          {
            key: "name",
            header: "Product Name",
            render: (p) => (
              <span
                onClick={() => onView(p)}
                className="text-[13px] font-extrabold text-slate-800 dark:text-gray-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                title="Click to view details"
              >
                {p.name}
              </span>
            ),
          },
          {
            key: "uom",
            header: "UoM",
            width: "96px",
            render: (p) => (
              <span className="px-2.5 py-0.5 bg-indigo-50/60 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold font-mono rounded-lg border border-indigo-100/50 dark:border-indigo-800 text-[10px] uppercase">
                {p.uom || "Pcs"}
              </span>
            ),
          },
          {
            key: "categoryGroup",
            header: "Category / Group",
            width: "176px",
            render: (p) => (
              <div className="space-y-1">
                <span className="font-bold text-slate-700 dark:text-gray-300 block">{p.category}</span>
                <span className="text-[10px] text-slate-400 dark:text-gray-500 font-mono block">{p.subCategory || "General"}</span>
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            width: "128px",
            render: (p) => (
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[9.5px] font-extrabold rounded-lg border uppercase tracking-wider font-mono ${statusClass(p.status)}`}>
                {p.status}
              </span>
            ),
          },
          {
            key: "actions",
            header: "Actions",
            align: "right",
            width: "176px",
            render: (p) => (
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => onView(p)}
                  className="p-1.5 hover:bg-slate-50 dark:hover:bg-gray-800 text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-200 rounded-lg transition-colors cursor-pointer"
                  title="View Detailed Details"
                >
                  <Eye className="w-4 h-4" />
                </button>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => onEdit(p)}
                      className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors cursor-pointer"
                      title="Edit Specifications"
                    >
                      <PenNewSquare className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(p.id)}
                      className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-400 dark:text-gray-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                      title="Delete Product"
                    >
                      <TrashBinMinimalistic className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            ),
          },
        ]}
        data={products}
        rowKey={(p) => p.id}
        rowClassName={(_, i) =>
          i % 2 === 0 ? "" : "even:bg-slate-50/40 dark:even:bg-gray-800/30"
        }
      />

      {preview && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: preview.x, top: preview.y }}
        >
          <div className="w-60 h-60 rounded-2xl overflow-hidden shadow-2xl border border-white/20 ring-1 ring-slate-900/10 dark:ring-slate-100/10 bg-white dark:bg-gray-800">
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
