/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Eye, Edit3, Trash2, Layers, CheckCircle2, AlertTriangle, Archive, Scale, Copy, Check } from "lucide-react";
import { Product } from "../types";
import { motion } from "motion/react";

interface ProductGalleryViewProps {
  products: Product[];
  isAdmin: boolean;
  onView: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
}

// Fallback high-quality images based on category
const getFallbackImage = (category: string) => {
  switch (category) {
    case "Electronics":
      return "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80";
    case "Home & Lifestyle":
      return "https://images.unsplash.com/photo-1507512140264-ac60c121b4ae?w=800&auto=format&fit=crop&q=80";
    case "Outdoor & Travel":
      return "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80";
    case "Office Tools":
      return "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&auto=format&fit=crop&q=80";
    default:
      return "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80";
  }
};

export default function ProductGalleryView({
  products,
  isAdmin,
  onView,
  onEdit,
  onDelete,
 }: ProductGalleryViewProps) {
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => {
      setCopiedCode(null);
    }, 2000);
  };

  return (
    <div id="product-gallery-grid" className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 sm:gap-4">
      {products.map((product) => {
        const imageUrl = product.imageUrl || getFallbackImage(product.category); 
        
        return (
          <motion.div
            key={product.id}
            id={`gallery-item-${product.id}`}
            layout
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.35 }}
            onClick={() => onView(product)}
            className={`group bg-white rounded-2xl overflow-hidden border border-slate-100/80 hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.06)] hover:border-slate-200/90 transition-all duration-305 flex flex-col h-full cursor-pointer relative ${
              product.status === "Inactive" ? "opacity-90 border-dashed border-amber-200" : ""
            } ${
              product.status === "Discontinued" ? "bg-rose-50/10 border-rose-100/60" : ""
            }`}
          >
            {/* Visual Header Image Container */}
            <div className="relative aspect-square w-full overflow-hidden bg-slate-50">
              {/* Product Photo */}
              <img
                src={imageUrl}
                alt={product.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                onError={(e) => {
                  // Fallback if URL is broken
                  const target = e.target as HTMLImageElement;
                  target.src = getFallbackImage(product.category);
                }}
              />

              {/* Status and Category Overlay Badges */}
              <div className="absolute top-2.5 inset-x-2.5 flex justify-between items-start z-10 pointer-events-none">
                <span className="px-2 py-0.5 text-[8px] font-bold bg-slate-900/85 backdrop-blur-md text-white rounded-md tracking-wider uppercase border border-white/10 shadow-sm pointer-events-auto">
                  {product.category}
                </span>

                {product.status === "Active" ? (
                  <span className="px-1.5 py-0.5 text-[8px] font-extrabold bg-emerald-500 text-white rounded-md tracking-wide uppercase shadow-md flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Active
                  </span>
                ) : product.status === "Inactive" ? (
                  <span className="px-1.5 py-0.5 text-[8px] font-extrabold bg-amber-500 text-white rounded-md tracking-wide uppercase shadow-md flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" /> Inactive
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 text-[8px] font-extrabold bg-rose-500 text-white rounded-md tracking-wide uppercase shadow-md flex items-center gap-1">
                    <Archive className="w-2.5 h-2.5" /> Discontinued
                  </span>
                )}
              </div>

              {/* Float action elements overlay for admins on card hover */}
              {isAdmin && (
                <div className="absolute top-10 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 bg-white/95 backdrop-blur-md p-1 rounded-lg shadow-sm border border-slate-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(product);
                    }}
                    title="Modify Specification"
                    className="p-1 hover:bg-slate-100 text-slate-700 hover:text-indigo-600 rounded-md transition-all cursor-pointer flex items-center justify-center"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(product.id);
                    }}
                    title="Delete SKU"
                    className="p-1 hover:bg-rose-55 hover:bg-rose-50 text-slate-705 text-slate-700 hover:text-rose-650 rounded-md transition-all cursor-pointer flex items-center justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Bottom fade scrim */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent pointer-events-none" />

              {/* Dynamic code & UoM badge overlay */}
              <div className="absolute bottom-2.5 inset-x-2.5 flex justify-between items-end z-10 text-white">
                <div>
                  <span className="text-[7px] text-slate-300 font-mono tracking-widest block uppercase font-black">PRODUCT CODE</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-black font-mono tracking-wider text-white">
                      {product.productCode}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(product.productCode);
                      }}
                      type="button"
                      title="Copy Product Code"
                      className="p-1 text-slate-300 hover:text-white hover:bg-white/10 rounded-md transition-all cursor-pointer inline-flex items-center justify-center shrink-0 z-10"
                    >
                      {copiedCode === product.productCode ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="px-1.5 py-0.5 bg-white/95 backdrop-blur-md text-slate-900 rounded-md font-black text-[8px] font-mono shadow-sm border border-white/20">
                  UoM: {product.uom || "Pcs"}
                </div>
              </div>
            </div>

            {/* Product description content info */}
            <div className="p-3 flex-1 flex flex-col justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1 text-[8px] text-slate-400 font-mono font-bold uppercase tracking-widest">
                  <Layers className="w-2.5 h-2.5 text-indigo-500" />
                  <span>{product.subCategory || "General"}</span>
                </div>

                <h3
                  id={`product-title-${product.id}`}
                  className="text-xs font-extrabold text-slate-800 transition-colors font-sans leading-snug line-clamp-2"
                >
                  {product.name}
                </h3>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
