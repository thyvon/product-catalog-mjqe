import React, { useState, useEffect, useMemo } from "react";
import {
  XCircle as CloseCircle,
  Sparkles as StarsMinimalistic,
  RefreshCw as Refresh,
  CloudUpload,
  Images as Gallery,
} from "lucide-react";
import { Product, ProductInput } from "../types";
import AlertModal from "./AlertModal";
import { motion, AnimatePresence } from "motion/react";

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (productData: ProductInput | Product) => void;
  editingProduct: Product | null;
  allCategories?: string[];
  allUoms?: string[];
}

const DEFAULT_CATEGORIES = [
  "Electronics",
  "Home & Lifestyle",
  "Wearables",
  "Outdoor & Travel",
  "Automotive",
  "Office Tools",
  "Furniture",
  "Industrial Supplies"
];

const DEFAULT_UOMS = ["Pcs", "Box", "Set", "Kg", "Pack", "Doz", "Roll", "Bag"];

export default function ProductFormModal({
  isOpen,
  onClose,
  onSubmit,
  editingProduct,
  allCategories = [],
  allUoms = [],
}: ProductFormModalProps) {
  const mergedCategories = useMemo(() => {
    const set = new Set([...DEFAULT_CATEGORIES, ...allCategories]);
    return Array.from(set);
  }, [allCategories]);

  const mergedUoms = useMemo(() => {
    const set = new Set([...DEFAULT_UOMS, ...allUoms]);
    return Array.from(set);
  }, [allUoms]);
  // Core state fields
  const [productCode, setProductCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [uom, setUom] = useState(DEFAULT_UOMS[0]);
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [subCategory, setSubCategory] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");
  
  // Optional values helpers
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);

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

    // Clean up previous blob URL
    if (imageUrl.startsWith("blob:")) {
      URL.revokeObjectURL(imageUrl);
    }

    setUploadError("");
    setPendingImageFile(file);
    setImageUrl(URL.createObjectURL(file));
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
      setUom(editingProduct.uom || DEFAULT_UOMS[0]);
      setCategory(editingProduct.category || DEFAULT_CATEGORIES[0]);
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
      setUom(DEFAULT_UOMS[0]);
      setCategory(DEFAULT_CATEGORIES[0]);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productCode || !name || !uom || !category) {
      setAlertMessage("Please fill in Product Code, Name, UoM and Category.");
      setIsAlertOpen(true);
      return;
    }

    let finalImageUrl = imageUrl;

    if (pendingImageFile) {
      setIsUploading(true);
      setUploadError("");
      try {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read file content."));
          reader.readAsDataURL(pendingImageFile);
        });

        const response = await fetch("/api/products/upload-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: base64Data,
            filename: pendingImageFile.name
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to upload image.");
        }

        finalImageUrl = data.imageUrl;
        setImageUrl(finalImageUrl);
        setPendingImageFile(null);
      } catch (err: any) {
        setAlertMessage(err.message || "An error occurred uploading the image.");
        setIsAlertOpen(true);
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    const payload: ProductInput = {
      productCode: productCode.toUpperCase().trim(),
      name: name.trim(),
      description: "Standard physical specifications list entry.",
      uom: uom.trim(),
      category: category.trim(),
      subCategory: subCategory.trim() || "General",
      status,
      imageUrl: finalImageUrl.trim() || undefined,
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
          className="relative bg-white dark:bg-gray-900 w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl border border-slate-100 dark:border-gray-800 flex flex-col z-10 max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-100 dark:border-gray-800 flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-800 dark:text-gray-100 font-sans">
              {editingProduct ? "Edit Product" : "New Product"}
            </h2>
            <button
              id="btn-close-form"
              onClick={onClose}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-gray-800 text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-200 rounded-full cursor-pointer transition-colors"
            >
              <CloseCircle className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body layout */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* 1. Product Code */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">
                  Product Code <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-productCode"
                  type="text"
                  required
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  placeholder="e.g. STO-SSD-291"
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-gray-700 rounded-xl focus:border-indigo-500 text-slate-805 dark:text-gray-200 font-mono text-xs uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 dark:bg-gray-800"
                />
              </div>

              {/* 2. Status Select option */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">
                  Item Status <span className="text-rose-500">*</span>
                </label>
                <select
                  id="input-status"
                  value={status}
                  onChange={(e: any) => setStatus(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-gray-700 rounded-xl focus:border-indigo-500 text-slate-800 dark:text-gray-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 dark:bg-gray-800"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>

                </select>
              </div>

              {/* 3. Product Title/Name */}
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-mono font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">
                  Product Title / Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Quantum Sonic High Fidelity Speaker"
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-gray-700 rounded-xl focus:border-indigo-500 text-slate-800 dark:text-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 dark:bg-gray-800"
                />
              </div>

              {/* 4. Category selection */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">
                  Category <span className="text-rose-500">*</span>
                </label>
                <select
                  id="input-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-gray-700 rounded-xl focus:border-indigo-500 text-slate-850 dark:text-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 dark:bg-gray-800"
                >
                  {mergedCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Subcategory */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">
                  Sub Category
                </label>
                <input
                  id="input-subCategory"
                  type="text"
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  placeholder="e.g. Audio Tech"
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-gray-700 rounded-xl focus:border-indigo-500 text-slate-800 dark:text-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 dark:bg-gray-800"
                />
              </div>

              {/* 6. UOM Options */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">
                  Unit of Measure (UoM) <span className="text-rose-500">*</span>
                </label>
                <select
                  id="input-uom"
                  value={mergedUoms.includes(uom) ? uom : "other"}
                  onChange={(e) => setUom(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-gray-700 rounded-xl focus:border-indigo-500 text-xs dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 dark:bg-gray-800"
                >
                  {mergedUoms.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                  <option value="other">Other...</option>
                </select>
                {!mergedUoms.includes(uom) && (
                  <input
                    type="text"
                    value={uom}
                    onChange={(e) => setUom(e.target.value)}
                    placeholder="Type custom UoM..."
                    className="w-full mt-2 px-3.5 py-2 border border-slate-200 dark:border-gray-700 rounded-xl focus:border-indigo-500 text-xs dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 dark:bg-gray-800"
                  />
                )}
              </div>

              {/* Product Image */}
              <div className="sm:col-span-2 space-y-3">
                <div className="flex items-center gap-4">
                  {imageUrl ? (
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-gray-700 shrink-0 group">
                      <img
                        src={imageUrl}
                        alt="Preview"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (imageUrl.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
                          setPendingImageFile(null);
                          setImageUrl("");
                        }}
                        className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white text-[10px] font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 dark:border-gray-700 flex items-center justify-center shrink-0">
                      <Gallery className="w-6 h-6 text-slate-300 dark:text-gray-600" />
                    </div>
                  )}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`flex-1 p-3 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[80px] ${
                      isDragging
                        ? "border-indigo-500 bg-indigo-50/30 dark:bg-indigo-900/30"
                        : "border-slate-200 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
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
                      <Refresh className="w-5 h-5 animate-spin text-indigo-500" />
                    ) : (
                      <>
                        <CloudUpload className="w-5 h-5 text-slate-400 dark:text-gray-500 mb-1" />
                        <span className="text-[11px] text-slate-500 dark:text-gray-400 font-medium">Click or drag to upload</span>
                      </>
                    )}
                  </div>
                </div>

                {uploadError && (
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-900/30 border border-rose-100 dark:border-rose-800 rounded-xl text-[11px] text-rose-600 dark:text-rose-400">
                    {uploadError}
                  </div>
                )}

                <input
                  id="input-imageUrl"
                  type="text"
                  value={imageUrl}
                  onChange={(e) => {
                    if (pendingImageFile) {
                      if (imageUrl.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
                      setPendingImageFile(null);
                    }
                    setImageUrl(e.target.value);
                  }}
                  placeholder="Or paste an image URL..."
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-gray-700 rounded-xl focus:border-indigo-500 text-xs dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 dark:bg-gray-800"
                />
              </div>

            </div>

            {/* Actions Footer row */}
            <div className="border-t border-slate-100 dark:border-gray-800 pt-5 flex justify-end gap-2.5">
              <button
                id="btn-cancel-form"
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800 text-slate-600 dark:text-gray-400 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-submit-form"
                type="submit"
                className="px-5 py-2 bg-slate-900 dark:bg-indigo-700 hover:bg-indigo-650 dark:hover:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
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
