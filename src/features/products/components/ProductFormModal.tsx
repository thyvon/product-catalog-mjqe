import React, { useState, useEffect, useMemo } from "react";
import {
  RefreshCw as Refresh,
  CloudUpload,
  Images as Gallery,
} from "lucide-react";
import { Product, ProductInput } from "@/features/shared/types";
import { useToast } from "@/features/shared/components/Toast";
import BaseModal from "@/features/shared/components/BaseModal";
import SelectField from "@/features/shared/components/SelectField";
import { FormLabel } from "@/features/shared/components/FormLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

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

  const { toast } = useToast();

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
      toast.error("Please fill in Product Code, Name, UoM and Category.");
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
        toast.error(err.message || "An error occurred uploading the image.");
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
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={editingProduct ? "Edit Product" : "New Product"}
      maxHeight="max-h-[92vh]"
      rounded="rounded-3xl"
      backdropBlur="backdrop-blur-md"
      className="flex flex-col overflow-hidden"
    >
      {/* Form Body layout */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* 1. Product Code */}
          <div>
            <FormLabel variant="mono" required>Product Code </FormLabel>
            <Input
              id="input-productCode"
              type="text"
              required
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
              placeholder="e.g. STO-SSD-291"
            />
          </div>

          {/* 2. Status Select option */}
          <div>
            <FormLabel variant="mono" required>Item Status </FormLabel>
            <SelectField
              value={status}
              onChange={(v) => setStatus(v as "Active" | "Inactive")}
              options={[
                { value: "Active", label: "Active" },
                { value: "Inactive", label: "Inactive" },
              ]}
              id="input-status"
            />
          </div>

          {/* 3. Product Title/Name */}
          <div className="sm:col-span-2">
            <FormLabel variant="mono" required>Product Title / Name </FormLabel>
            <Input
              id="input-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Quantum Sonic High Fidelity Speaker"
            />
          </div>

          {/* 4. Category selection */}
          <div>
            <FormLabel variant="mono" required>Category </FormLabel>
            <SelectField
              value={category}
              onChange={setCategory}
              options={mergedCategories.map((cat) => ({ value: cat, label: cat }))}
              id="input-category"
            />
          </div>

          {/* 5. Subcategory */}
          <div>
            <FormLabel variant="mono">Sub Category</FormLabel>
            <Input
              id="input-subCategory"
              type="text"
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
              placeholder="e.g. Audio Tech"
            />
          </div>

          {/* 6. UOM Options */}
          <div>
            <FormLabel variant="mono" required>Unit of Measure (UoM) </FormLabel>
            <SelectField
              value={mergedUoms.includes(uom) ? uom : "__other__"}
              onChange={(v) => { if (v !== "__other__") setUom(v); }}
              options={[
                ...mergedUoms.map((opt) => ({ value: opt, label: opt })),
                { value: "__other__", label: "Other..." },
              ]}
              id="input-uom"
            />
            {!mergedUoms.includes(uom) && (
              <Input
                type="text"
                value={uom}
                onChange={(e) => setUom(e.target.value)}
                placeholder="Type custom UoM..."
              />
            )}
          </div>

          {/* Product Image */}
          <div className="sm:col-span-2 space-y-3">
            <div className="flex items-center gap-4">
              {imageUrl ? (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-border shrink-0 group">
                  <img
                    src={imageUrl}
                    alt="Preview"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      if (imageUrl.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
                      setPendingImageFile(null);
                      setImageUrl("");
                    }}
                    variant="ghost"
                    size="xs"
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-medium"
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center shrink-0">
                  <Gallery className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex-1 p-3 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[80px] ${
                  isDragging
                    ? "border-border bg-muted/30"
                    : "border-border hover:border-border bg-card"
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
                  <Refresh className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <CloudUpload className="w-5 h-5 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground font-medium">Click or drag to upload</span>
                  </>
                )}
              </div>
            </div>

            {uploadError && (
              <div className="p-2.5 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">
                {uploadError}
              </div>
            )}

            <Input
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
            />
          </div>

        </div>

        {/* Actions Footer row */}
        <Separator className="my-4" />
        <div className="pt-5 flex justify-end gap-2.5">
          <Button id="btn-cancel-form" type="button" onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button id="btn-submit-form" type="submit">
            {editingProduct ? "Save Specifications" : "Register Product"}
          </Button>
        </div>

      </form>
    </BaseModal>
  );
}
