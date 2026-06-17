import React from "react";
import {
  Eye,
  SquarePen as PenNewSquare,
  Trash2 as TrashBinMinimalistic,
  Layers,
  Archive,
  CheckCircle,
  TriangleAlert as DangerTriangle,
  CircleQuestionMark as QuestionCircle,
} from "lucide-react";
import { Product } from "../types";
import { motion } from "motion/react";

interface ProductCardProps {
  key?: React.Key;
  product: Product;
  isAdmin: boolean;
  onView: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
}

// Category-based ambient gradient presets
const CATEGORY_GRADIENTS: { [key: string]: string } = {
  "Electronics": "from-teal-500 to-indigo-600",
  "Home & Lifestyle": "from-amber-400 to-rose-500",
  "Wearables": "from-purple-500 to-indigo-500",
  "Outdoor & Travel": "from-emerald-400 to-cyan-500",
  "Automotive": "from-blue-600 to-slate-800",
  "Office Tools": "from-fuchsia-500 to-pink-600",
};

export default function ProductCard({
  product,
  isAdmin,
  onView,
  onEdit,
  onDelete,
}: ProductCardProps) {
  // Determine gradient style from product category
  const gradientClass = CATEGORY_GRADIENTS[product.category] || "from-slate-500 to-slate-700";

  return (
    <motion.div
      id={`product-card-${product.id}`}
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      className={`group bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-[0_12px_24px_-4px_rgba(0,0,0,0.04)] hover:border-slate-200 transition-all duration-300 flex flex-col h-full ${
        product.status === "Inactive" ? "opacity-90 border-dashed border-amber-200" : ""
      } ${
        product.status === "Discontinued" ? "bg-rose-50/10 border-rose-100/60" : ""
      }`}
    >
      {/* Upper Color Block / Visual representation */}
      <div className={`relative h-28 bg-gradient-to-br ${gradientClass} overflow-hidden px-4 py-3 flex flex-col justify-between`}>
        {/* Particle circles background */}
        <div className="absolute inset-0 opacity-15 mix-blend-overlay">
          <div className="absolute w-28 h-28 -top-8 -right-8 rounded-full bg-white" />
          <div className="absolute w-16 h-16 bottom-2 left-10 rounded-full bg-white" />
        </div>

        {/* Categories Row */}
        <div className="flex justify-between items-start z-10">
          <span className="px-2.5 py-0.5 text-[9px] font-bold bg-white/15 text-white/90 backdrop-blur-md rounded-md tracking-wider uppercase font-mono border border-white/10">
            {product.category}
          </span>

          {/* Status badge and icon indicators */}
          {product.status === "Active" ? (
            <span className="px-2.5 py-0.5 text-[9px] font-bold bg-emerald-500/90 text-white rounded-md tracking-wider uppercase font-mono shadow-sm flex items-center gap-1">
              <CheckCircle className="w-3 h-3 shrink-0" /> Active
            </span>
          ) : product.status === "Inactive" ? (
            <span className="px-2.5 py-0.5 text-[9px] font-bold bg-amber-500/90 text-white rounded-md tracking-wider uppercase font-mono shadow-sm flex items-center gap-1">
              <DangerTriangle className="w-3 h-3 shrink-0" /> Inactive
            </span>
          ) : (
            <span className="px-2.5 py-0.5 text-[9px] font-bold bg-rose-500/90 text-white rounded-md tracking-wider uppercase font-mono shadow-sm flex items-center gap-1">
              <Archive className="w-3 h-3 shrink-0" /> Discontinued
            </span>
          )}
        </div>

        {/* Dynamic code & UoM badge */}
        <div className="flex justify-between items-end z-10">
          <div>
            <span className="text-[10px] text-white/70 font-mono tracking-widest block uppercase font-bold">Product Code</span>
            <span className="text-[13px] font-black text-white font-mono tracking-wider">
              {product.productCode}
            </span>
          </div>

          <div className="px-2 py-0.5 bg-white text-slate-800 rounded-md font-bold text-[10px] font-mono shadow-sm">
            UoM: {product.uom || "Pcs"}
          </div>
        </div>
      </div>

      {/* Main product data info body */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-1.5">
          {/* Sub category & Code tag label */}
          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider">
            <Layers className="w-3 h-3 text-slate-300" />
            <span>{product.subCategory || "General"}</span>
          </div>

          {/* Title */}
          <h4
            id={`product-title-${product.id}`}
            onClick={() => onView(product)}
            className="text-[15px] font-extrabold text-slate-800 hover:text-indigo-650 transition-colors font-sans leading-snug tracking-tight cursor-pointer line-clamp-2"
            title="Click to view full specs"
          >
            {product.name}
          </h4>

          {/* Trimmed description */}
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
            {product.description || "No product catalog description provided."}
          </p>
        </div>

        {/* Operations footer */}
        <div className="border-t border-slate-50 pt-3.5 flex justify-between items-center">
          {/* Inventory info if present */}
          <div className="text-[10px] font-mono text-slate-400 font-semibold uppercase">
            {product.price !== undefined ? (
              <div>
                <span className="text-slate-300 block text-[9px]">Value Estimate</span>
                <span className="text-slate-700 font-bold font-sans text-xs">${product.price.toFixed(2)}</span>
              </div>
            ) : (
              <span>Cataloged Item</span>
            )}
          </div>

          {/* Action pills row */}
          <div className="flex items-center gap-1.5">
            <button
              id={`btn-open-details-${product.id}`}
              onClick={() => onView(product)}
              className="p-1 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
            >
              <Eye className="w-3.5 h-3.5" /> Specs
            </button>

            {isAdmin && (
              <div className="flex items-center gap-1 border-l border-slate-100 pl-1.5">
                <button
                  id={`btn-edit-${product.id}`}
                  onClick={() => onEdit(product)}
                  title="Modify Entry"
                  className="p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-650 rounded-lg transition-colors cursor-pointer"
                >
                  <PenNewSquare className="w-3.5 h-3.5" />
                </button>
                <button
                  id={`btn-delete-${product.id}`}
                  onClick={() => onDelete(product.id)}
                  title="Remove from Catalog"
                  className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                >
                  <TrashBinMinimalistic className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
