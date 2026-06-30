import React from "react";
import {
  Eye,
  SquarePen as PenNewSquare,
  Trash2 as TrashBinMinimalistic,
  Layers,
  CheckCircle,
  TriangleAlert as DangerTriangle,
  Copy,
} from "lucide-react";
import { Product } from "../types";
import { motion } from "motion/react";

interface ProductGalleryViewProps {
  products: Product[];
  isAdmin: boolean;
  onView: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
}

const BLANK_PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect fill="#f1f5f9" width="400" height="400"/><text x="50%" y="50%" fill="#94a3b8" font-family="monospace" font-size="14" font-weight="bold" text-anchor="middle" dominant-baseline="middle">NO IMAGE</text></svg>`);

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
    <div id="product-gallery-grid" className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 sm:gap-5">
      {products.map((product) => {
        const imageUrl = product.imageUrl || BLANK_PLACEHOLDER; 
        
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
            className={`group bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-slate-100/80 dark:border-gray-800 hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.3)] hover:border-slate-200/90 dark:hover:border-gray-700 transition-all duration-305 flex flex-col h-full cursor-pointer relative ${
              product.status === "Inactive" ? "opacity-90 border-dashed border-amber-200" : ""
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
                  const target = e.target as HTMLImageElement;
                  target.src = BLANK_PLACEHOLDER;
                }}
              />

              {/* Status Badge */}
              <div className="absolute top-2.5 right-2.5 flex items-start z-10 pointer-events-none">
                {product.status === "Active" ? (
                  <span className="px-1.5 py-0.5 text-[8px] font-extrabold bg-emerald-500 text-white rounded-md tracking-wide uppercase shadow-md flex items-center gap-1">
                    <CheckCircle className="w-2.5 h-2.5" /> Active
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 text-[8px] font-extrabold bg-amber-500 text-white rounded-md tracking-wide uppercase shadow-md flex items-center gap-1">
                    <DangerTriangle className="w-2.5 h-2.5" /> Inactive
                  </span>
                )}
              </div>

              {/* Float action elements overlay for admins on card hover */}
              {isAdmin && (
                <div className="absolute top-10 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md p-1 rounded-lg shadow-sm border border-slate-100 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(product);
                    }}
                    title="Modify Specification"
                    className="p-1 hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md transition-all cursor-pointer flex items-center justify-center"
                  >
                    <PenNewSquare className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(product.id);
                    }}
                    title="Delete SKU"
                    className="p-1 hover:bg-rose-55 hover:bg-rose-50 dark:hover:bg-rose-900/50 text-slate-705 text-slate-700 dark:text-gray-300 hover:text-rose-650 dark:hover:text-rose-400 rounded-md transition-all cursor-pointer flex items-center justify-center"
                  >
                    <TrashBinMinimalistic className="w-3.5 h-3.5" />
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
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="px-1.5 py-0.5 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md text-slate-900 dark:text-gray-100 rounded-md font-black text-[8px] font-mono shadow-sm border border-white/20">
                  UoM: {product.uom || "Pcs"}
                </div>
              </div>
            </div>

            {/* Product description content info */}
            <div className="p-3 flex-1 flex flex-col justify-between">
              <div className="space-y-0.5">
                <h3
                  id={`product-title-${product.id}`}
                  className="text-xs font-extrabold text-slate-800 dark:text-gray-100 transition-colors font-sans leading-snug line-clamp-2"
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
