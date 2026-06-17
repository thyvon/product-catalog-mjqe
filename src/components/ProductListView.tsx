/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Eye, Edit3, Trash2, Layers, CheckCircle2, AlertTriangle, Archive, HelpCircle, Copy, Check } from "lucide-react";
import { Product } from "../types";
import { motion } from "motion/react";

interface ProductListViewProps {
  products: Product[];
  isAdmin: boolean;
  onView: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
}

const LIST_PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect fill="#f1f5f9" width="400" height="400"/><text x="50%" y="50%" fill="#94a3b8" font-family="monospace" font-size="14" font-weight="bold" text-anchor="middle" dominant-baseline="middle">NO IMAGE</text></svg>`);

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
    setTimeout(() => {
      setCopiedCode(null);
    }, 2000);
  };

  return (
    <div id="product-list-container" className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/70 dark:bg-gray-800/70 border-b border-slate-100/80 dark:border-gray-700 text-slate-400 dark:text-gray-500 font-mono tracking-wider font-bold uppercase">
              <th className="px-6 py-4.5 w-16">Preview</th>
              <th className="px-6 py-4.5 w-48 whitespace-nowrap">Product Code</th>
              <th className="px-6 py-4.5">Product Name</th>
              <th className="px-6 py-4.5 w-24">UoM</th>
              <th className="px-6 py-4.5 w-44">Category / Group</th>
              <th className="px-6 py-4.5 w-32">Status</th>
              <th className="px-6 py-4.5 w-44 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {products.map((product) => {
              const imageUrl = product.imageUrl || LIST_PLACEHOLDER;

              return (
                <motion.tr
                  key={product.id}
                  id={`list-row-${product.id}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                   className={`hover:bg-slate-100/50 dark:hover:bg-gray-800/50 transition-colors duration-150 align-middle ${
                    product.status === "Inactive" ? "bg-amber-50/10" : "even:bg-slate-50/40 dark:even:bg-gray-800/30"
                  } ${
                    product.status === "Discontinued" ? "bg-rose-50/10 dark:bg-rose-900/20" : ""
                  }`}
                >
                  {/* Container Image Column */}
                  <td className="px-6 py-4">
                    <div
                      className="w-16 h-16 shrink-0"
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setPreview({ src: imageUrl, x: rect.right + 12, y: rect.top });
                      }}
                      onMouseLeave={() => setPreview(null)}
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-100 shadow-sm">
                        <img
                          src={imageUrl}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover object-center transition-transform duration-300"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = LIST_PLACEHOLDER;
                          }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Identification Monospace tags */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2.5 py-0.5 bg-slate-900 dark:bg-indigo-700 text-white rounded-lg font-black font-mono tracking-wider text-[11px] inline-block whitespace-nowrap shadow-sm">
                        {product.productCode}
                      </span>
                      <button
                        onClick={() => handleCopy(product.productCode)}
                        type="button"
                        title="Copy Product Code"
                        className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer inline-flex items-center justify-center shrink-0"
                      >
                        {copiedCode === product.productCode ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>

                  {/* Primary text column */}
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <h4
                        onClick={() => onView(product)}
                        className="text-[13px] font-extrabold text-slate-800 dark:text-gray-100 hover:text-indigo-650 dark:hover:text-indigo-400 transition-colors tracking-tight font-sans cursor-pointer whitespace-normal break-words"
                        title="Click to view details"
                      >
                        {product.name}
                      </h4>
                    </div>
                  </td>

                  {/* UoM column next to product name */}
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-0.5 bg-indigo-50/60 dark:bg-indigo-900/40 text-indigo-750 dark:text-indigo-300 font-bold font-mono rounded-lg border border-indigo-100/50 dark:border-indigo-800 text-[10px] uppercase inline-block">
                      {product.uom || "Pcs"}
                    </span>
                  </td>

                  {/* Structural Groups column */}
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <span className="font-bold text-slate-700 dark:text-gray-300 block">
                        {product.category}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-gray-500 font-mono block">
                        {product.subCategory || "General"}
                      </span>
                    </div>
                  </td>

                  {/* Lifecycle representation badge */}
                  <td className="px-6 py-4">
                    {product.status === "Active" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[9.5px] font-extrabold bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-150 uppercase tracking-wider font-mono">
                        Active
                      </span>
                    ) : product.status === "Inactive" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[9.5px] font-extrabold bg-amber-50 text-amber-700 rounded-lg border border-amber-150 uppercase tracking-wider font-mono">
                        Inactive
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[9.5px] font-extrabold bg-rose-50 text-rose-700 rounded-lg border border-rose-150 uppercase tracking-wider font-mono">
                        Discontinued
                      </span>
                    )}
                  </td>

                  {/* Table Control Buttons */}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onView(product)}
                        id={`btn-view-${product.id}`}
                        className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                        title="View Detailed Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {isAdmin && (
                        <>
                          <button
                            onClick={() => onEdit(product)}
                            id={`btn-edit-${product.id}`}
                            className="p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-650 rounded-lg transition-colors cursor-pointer"
                            title="Edit Specifications"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDelete(product.id)}
                            id={`btn-delete-${product.id}`}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            title="Delete Product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {preview && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: preview.x, top: preview.y }}
        >
          <div className="w-60 h-60 rounded-2xl overflow-hidden shadow-2xl border border-white/20 ring-1 ring-slate-900/10 bg-white">
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
