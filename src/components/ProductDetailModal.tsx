/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { X, Calendar, Layers, FileText, CheckCircle2, Bookmark, Package, Info, DollarSign } from "lucide-react";
import { Product } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

// Category-based background color helpers
const CATEGORY_BG_BADGES: { [key: string]: string } = {
  "Electronics": "bg-indigo-50 text-indigo-700 border-indigo-100",
  "Home & Lifestyle": "bg-amber-50 text-amber-700 border-amber-100",
  "Wearables": "bg-purple-50 text-purple-700 border-purple-100",
  "Outdoor & Travel": "bg-emerald-50 text-emerald-700 border-emerald-100",
  "Automotive": "bg-blue-50 text-blue-700 border-blue-100",
  "Office Tools": "bg-pink-50 text-pink-700 border-pink-100",
};

export default function ProductDetailModal({
  product,
  isOpen,
  onClose,
}: ProductDetailModalProps) {
  if (!isOpen || !product) return null;

  const badgeStyle = CATEGORY_BG_BADGES[product.category] || "bg-slate-50 text-slate-700 border-slate-100";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          id="modal-backdrop-detail"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md"
        />

        {/* Floating Modal Frame */}
        <motion.div
          id={`modal-detail-${product.id}`}
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="relative bg-white w-full max-w-3xl max-h-[90vh] rounded-3xl overflow-y-auto no-scrollbar shadow-2xl border border-slate-100 flex flex-col z-10 p-6 md:p-8"
        >
          {/* Header Close Trigger */}
          <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-5 shrink-0">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-widest font-mono text-indigo-650 font-bold block">
                Catalog Sheet Spec
              </span>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 font-mono text-xs font-black bg-slate-900 text-white rounded-md tracking-wider">
                  {product.productCode}
                </span>

                {product.status === "Active" ? (
                  <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md uppercase tracking-wider font-mono">
                    Active
                  </span>
                ) : product.status === "Inactive" ? (
                  <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100 rounded-md uppercase tracking-wider font-mono">
                    Inactive
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-100 rounded-md uppercase tracking-wider font-mono">
                    Discontinued
                  </span>
                )}
              </div>
            </div>

            <button
              id="btn-close-detail"
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Grid Layout Body */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start flex-1 overflow-visible">
            {/* Product Image Banner - Left side */}
            {product.imageUrl ? (
              <div className="md:col-span-5 w-full aspect-square rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 shadow-sm relative shrink-0">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center"
                />
              </div>
            ) : (
              <div className="md:col-span-5 w-full aspect-square rounded-2xl bg-slate-50 border border-slate-150 flex flex-col items-center justify-center text-slate-300 p-4 shrink-0">
                <Package className="w-12 h-12 stroke-[1.5]" />
                <span className="text-[10px] font-bold font-mono uppercase tracking-wider mt-2">No Image Provided</span>
              </div>
            )}

            {/* Product Identification Information - Right side */}
            <div className="md:col-span-7 flex flex-col justify-between h-full space-y-5">
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-mono text-slate-400 font-bold block">Product Name</span>
                  <h2 className="text-base md:text-lg font-black text-slate-800 leading-snug tracking-tight font-sans mt-0.5">
                    {product.name}
                  </h2>
                </div>

                {/* Field Meta-grid */}
                <div className="grid grid-cols-2 gap-3.5 bg-slate-50/70 rounded-2xl p-4 border border-slate-100/50">
                  <div>
                    <span className="text-[9px] text-slate-400 font-mono font-bold tracking-wider uppercase block">Category</span>
                    <span className="text-xs font-bold text-slate-800 truncate block mt-0.5">
                      {product.category}
                    </span>
                  </div>
                  
                  <div>
                    <span className="text-[9px] text-slate-400 font-mono font-bold tracking-wider uppercase block">Sub Category</span>
                    <span className="text-xs font-bold text-slate-800 truncate block mt-0.5 font-sans">
                      {product.subCategory || "General"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] text-slate-400 font-mono font-bold tracking-wider uppercase block">UoM</span>
                    <span className="text-xs font-black text-indigo-700 font-mono block mt-0.5">
                      {product.uom || "Pcs"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] text-slate-400 font-mono font-bold tracking-wider uppercase block">Availability</span>
                    <span className={`text-xs font-bold block mt-0.5 ${
                      product.status === "Active" ? "text-emerald-600" : "text-amber-600"
                    }`}>
                      {product.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Timestamps Section */}
              <div className="border-t border-slate-100/80 pt-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-[9px] text-slate-400 font-mono">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-300" /> Created: {new Date(product.createdAt).toLocaleDateString()}
                </span>
                <span>
                  Modified: {new Date(product.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
