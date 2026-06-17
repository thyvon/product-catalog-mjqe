/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { X, Sparkles, Loader2, Check, DollarSign, Layers, Hash, BookOpen, UploadCloud, Image } from "lucide-react";
import { Product, ProductInput } from "../types";
import AlertModal from "./AlertModal";
import { motion, AnimatePresence } from "motion/react";

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (productData: ProductInput | Product) => void;
  editingProduct: Product | null;
}

const CATEGORIES = [
  "Electronics",
  "Home & Lifestyle",
  "Wearables",
  "Outdoor & Travel",
  "Automotive",
  "Office Tools",
  "Furniture",
  "Industrial Supplies"
];

const UOM_OPTIONS = ["Pcs", "Box", "Set", "Kg", "Pack", "Doz", "Roll", "Bag"];

export default function ProductFormModal({
  isOpen,
  onClose,
  onSubmit,
  editingProduct,
}: ProductFormModalProps) {
  // Core state fields
  const [productCode, setProductCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [uom, setUom] = useState(UOM_OPTIONS[0]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subCategory, setSubCategory] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive" | "Discontinued">("Active");
  
  // Optional values helpers
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  // Product Image Upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // Alert state
  const [alertMessage, setAlertMessage] = useState("");
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  // Core handler to process image files from drag/drop or clicks
  const processImageFile = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Please provide a valid image file (PNG, JPG, JPEG, WEBP, or SVG).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Image size must be smaller than 10MB.");
      return;
    }

    setIsUploading(true);
    setUploadError("");

    const reader = new FileReader();
    reader.onerror = () => {
      setUploadError("Failed to convert file content to stream format.");
      setIsUploading(false);
    };

    reader.onload = async (event) => {
      try {
        const base64Data = event.target?.result as string;

        const response = await fetch("/api/products/upload-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: base64Data,
            filename: file.name
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to upload image file to standard catalog repository.");
        }

        setImageUrl(data.imageUrl);
      } catch (err: any) {
        setUploadError(err.message || "An error occurred during file persistence.");
      } finally {
        setIsUploading(false);
      }
    };

    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files?.length > 0) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processImageFile(e.target.files[0]);
    }
  };

  // AI Assistant settings
  const [aiTone, setAiTone] = useState<"professional" | "minimalist" | "technical" | "playful" | "luxurious">("professional");
  const [aiKeywords, setAiKeywords] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // Sync edit product state
  useEffect(() => {
    if (editingProduct) {
      setProductCode(editingProduct.productCode);
      setName(editingProduct.name);
      setDescription(editingProduct.description);
      setUom(editingProduct.uom || UOM_OPTIONS[0]);
      setCategory(editingProduct.category || CATEGORIES[0]);
      setSubCategory(editingProduct.subCategory || "");
      setStatus(editingProduct.status || "Active");
      setPrice(editingProduct.price !== undefined ? String(editingProduct.price) : "");
      setStock(editingProduct.stock !== undefined ? String(editingProduct.stock) : "");
      setImageUrl(editingProduct.imageUrl || "");
    } else {
      // Create defaults
      // Generate automatic code mock for ease
      setProductCode(`PROD-${Math.floor(100 + Math.random() * 900)}-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`);
      setName("");
      setDescription("");
      setUom(UOM_OPTIONS[0]);
      setCategory(CATEGORIES[0]);
      setSubCategory("");
      setStatus("Active");
      setPrice("");
      setStock("");
      setImageUrl("");
    }
    setAiError("");
  }, [editingProduct, isOpen]);

  // AI assistant catalog autofiller triggers
  const handleTriggerAICopywriter = async () => {
    if (!name) {
      setAiError("Please type a product title/name so Gemini has context to write.");
      return;
    }

    setAiLoading(true);
    setAiError("");

    try {
      const response = await fetch("/api/ai/copywrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          subCategory,
          tone: aiTone,
          keywords: aiKeywords ? aiKeywords.split(",").map((s) => s.trim()) : [],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to communicate with AI copywriting servers.");
      }

      if (data.description) setDescription(data.description);
      if (data.uom) setUom(data.uom);
      if (data.category) setCategory(data.category);
      if (data.subCategory) setSubCategory(data.subCategory);

    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "An error occurred generating copywriting attributes.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!productCode || !name || !uom || !category) {
      setAlertMessage("Please fill in Product Code, Name, UoM and Category.");
      setIsAlertOpen(true);
      return;
    }

    const payload: ProductInput = {
      productCode: productCode.toUpperCase().trim(),
      name: name.trim(),
      description: "Standard physical specifications list entry.",
      uom: uom.trim(),
      category: category.trim(),
      subCategory: subCategory.trim() || "General",
      status,
      imageUrl: imageUrl.trim() || undefined,
    };

    if (editingProduct) {
      onSubmit({
        ...payload,
        id: editingProduct.id,
        createdAt: editingProduct.createdAt,
      } as Product);
    } else {
      onSubmit(payload);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        {/* Backdrop overlay */}
        <motion.div
          id="modal-backdrop-form"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md"
        />

        {/* Modal Main Frame */}
        <motion.div
          id="modal-form-container"
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="relative bg-white w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col z-10 max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/40">
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 font-sans">
                {editingProduct ? "Revise Catalog Specifications" : "Register New Catalog Product"}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Configure core product identifiers and image references. All updates sync instantly to the server.
              </p>
            </div>
            <button
              id="btn-close-form"
              onClick={onClose}
              className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-full cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body layout */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* 1. Product Code */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5 text-indigo-505" /> Product Code <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-productCode"
                  type="text"
                  required
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  placeholder="e.g. STO-SSD-291"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 text-slate-805 font-mono text-xs uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
                />
              </div>

              {/* 2. Status Select option */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Item Status <span className="text-rose-500">*</span>
                </label>
                <select
                  id="input-status"
                  value={status}
                  onChange={(e: any) => setStatus(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 text-slate-800 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Discontinued">Discontinued</option>
                </select>
              </div>

              {/* 3. Product Title/Name */}
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Product Title / Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Quantum Sonic High Fidelity Speaker"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
                />
              </div>

              {/* 4. Category selection */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" /> Category <span className="text-rose-500">*</span>
                </label>
                <select
                  id="input-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 text-slate-850 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Subcategory */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Sub Category
                </label>
                <input
                  id="input-subCategory"
                  type="text"
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  placeholder="e.g. Audio Tech"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
                />
              </div>

              {/* 6. UOM Options */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Unit of Measure (UoM) <span className="text-rose-500">*</span>
                </label>
                <select
                  id="input-uom"
                  value={uom}
                  onChange={(e) => setUom(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 text-slate-805 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
                >
                  {UOM_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                  {!UOM_OPTIONS.includes(uom) && <option value={uom}>{uom}</option>}
                </select>
              </div>

              {/* Optional Custom UOM free-text input */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Custom UoM (Optional override)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Set, Bag, Bundle"
                  onChange={(e) => {
                    if (e.target.value.trim()) {
                      setUom(e.target.value.trim());
                    }
                  }}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
                />
              </div>

              {/* Product Image Manager (Upload via Drag & Drop or Paste URL) */}
              <div className="sm:col-span-2 space-y-4">
                <div className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                      Image Aspect Ratio Rule
                    </label>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      The catalog uses a strict <strong className="text-slate-700">1:1 Square Aspect Ratio</strong> for all product listings.
                    </p>
                  </div>
                  <span className="text-[10px] bg-slate-900 text-white font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded-md">
                    Square (1:1)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Image Preview Thumbnail with Chessboard Transparecy Grid Pattern */}
                  <div 
                    className="flex flex-col items-center justify-center border border-slate-200 rounded-2xl relative overflow-hidden group aspect-square w-full max-w-[140px] mx-auto bg-slate-50"
                    style={{ 
                      backgroundImage: "radial-gradient(#e2e8f0 25%, transparent 25%), radial-gradient(#e2e8f0 25%, transparent 25%)",
                      backgroundPosition: "0 0, 4px 4px",
                      backgroundSize: "8px 8px"
                    }}
                  >
                    {imageUrl ? (
                      <>
                        <img
                          src={imageUrl}
                          alt="Product Preview"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-all duration-300 hover:brightness-95 active:scale-95"
                        />
                        <button
                          type="button"
                          onClick={() => setImageUrl("")}
                          className="absolute right-1.5 top-1.5 bg-slate-900/80 hover:bg-rose-600 text-white p-1 rounded-full text-[10px] uppercase font-mono font-bold tracking-wider opacity-0 group-hover:opacity-100 transition-all cursor-pointer shadow-sm z-10"
                        >
                          Clear
                        </button>
                      </>
                    ) : (
                      <div className="text-center p-3 bg-white/80 backdrop-blur-xs rounded-xl border border-slate-100/50 m-2">
                        <Image className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                        <span className="text-[9px] text-slate-400 font-mono font-bold block leading-tight">No Image</span>
                      </div>
                    )}
                  </div>

                  {/* Drag and Drop File Upload Area */}
                  <div className="sm:col-span-2">
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`h-full min-h-[140px] p-4 border-2 border-dashed rounded-2xl flex flex-col justify-center items-center text-center cursor-pointer transition-all ${
                        isDragging
                          ? "border-indigo-500 bg-indigo-50/30 text-indigo-650"
                          : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/30"
                      }`}
                      onClick={() => document.getElementById("product-image-file-input")?.click()}
                    >
                      <input
                        id="product-image-file-input"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      {isUploading ? (
                        <div className="flex flex-col items-center gap-1.5 text-indigo-600">
                          <Loader2 className="w-5 h-5 animate-spin text-indigo-650" />
                          <span className="text-xs font-bold font-mono uppercase tracking-wider animate-pulse">
                            Uploading file...
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <UploadCloud className="w-6 h-6 text-slate-400 animate-bounce" />
                          <p className="text-xs font-bold text-slate-700">Drag & Drop Image or Click to Browse</p>
                          <p className="text-[10px] text-slate-400">Supports PNG, JPG, JPEG, WEBP, SVG (Max 10MB)</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {uploadError && (
                  <div className="p-3 bg-rose-50 border border-rose-100/50 rounded-xl text-[11px] text-rose-650 font-mono">
                    {uploadError}
                  </div>
                )}

                {/* Direct Manual URL Input Fallback */}
                <div className="pt-1">
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">
                    Or specify external direct URL manually:
                  </label>
                  <input
                    id="input-imageUrl"
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="e.g. https://images.unsplash.com/photo-1505740420928-5e560c06d30e"
                    className="w-full px-3.5 py-1.5 border border-slate-200 rounded-xl focus:border-indigo-500 text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 fill-none"
                  />
                </div>
              </div>

            </div>

            {/* Actions Footer row */}
            <div className="border-t border-slate-100 pt-5 flex justify-end gap-2.5">
              <button
                id="btn-cancel-form"
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-submit-form"
                type="submit"
                className="px-5 py-2 bg-slate-900 hover:bg-indigo-650 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
              >
                {editingProduct ? "Save Specifications" : "Register Product"}
              </button>
            </div>

          </form>

          <AlertModal
            isOpen={isAlertOpen}
            message={alertMessage}
            onClose={() => setIsAlertOpen(false)}
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
