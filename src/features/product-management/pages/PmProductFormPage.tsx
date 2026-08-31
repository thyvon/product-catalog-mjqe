import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ImagePlus, Loader2, Plus, Save, Search, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PageContent from "@/features/shared/components/PageContent";
import { Field } from "@/features/shared/components/Field";
import { FormLabel } from "@/features/shared/components/FormLabel";
import SelectField from "@/features/shared/components/SelectField";
import TextField from "@/features/shared/components/TextField";
import MultiSelectCombobox from "@/features/shared/components/MultiSelectCombobox";
import { useToast } from "@/features/shared/components/Toast";
import PmSimpleFormModal, { type SimpleEntity } from "@/features/product-management/components/PmSimpleFormModal";
import PmVariationTemplateModal from "@/features/product-management/components/PmVariationTemplateModal";
import { PmStatusBadge } from "@/features/product-management/components/PmShared";
import {
  pmBrands,
  pmCategories,
  pmProduct,
  pmProductGroups,
  pmProducts,
  pmSaveProduct,
  pmSaveVariant,
  pmDeleteVariant,
  pmUoms,
  pmVariationTemplates,
  pmSaveVariationTemplate,
} from "@/features/product-management/api";
import type {
  PMBrand,
  PMCategory,
  PMProduct,
  PMProductGroup,
  PMUom,
  PMVariant,
  PMVariationTemplate,
  PMVariationTemplateValue,
} from "@/features/shared/types";

type ProductType = "single" | "variation";

const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: "variation", label: "Variation" },
  { value: "single", label: "Single Product" },
];

const toProductType = (t?: string): ProductType => (t === "variation" ? "variation" : "single");

const autoCode = (name: string): string => {
  const letters = (name.match(/[a-z0-9]/gi) || []).join("").slice(0, 6).toUpperCase() || "PRD";
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ123456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `${letters}-${suffix}`;
};

interface VariantRow {
  uid: string;
  values: Record<string, string>; // templateId -> valueId
  sku: string;
  remark: string;
  baseUom: string;
  subUom: string;
  basePurchase: string;
  subPurchase: string;
  imageUrl: string;
}

export default function PmProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEdit = !!id;

  const [loading, setLoading] = useState(true);
  const [productGroups, setProductGroups] = useState<PMProductGroup[]>([]);
  const [brands, setBrands] = useState<PMBrand[]>([]);
  const [uoms, setUoms] = useState<PMUom[]>([]);
  const [categories, setCategories] = useState<PMCategory[]>([]);
  const [templates, setTemplates] = useState<PMVariationTemplate[]>([]);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [nameMatches, setNameMatches] = useState<PMProduct[]>([]);
  const [nameChecking, setNameChecking] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [subCategoryId, setSubCategoryId] = useState("");
  const [productGroupId, setProductGroupId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [uomId, setUomId] = useState("");
  const [subUnitId, setSubUnitId] = useState("");
  const [productType, setProductType] = useState<ProductType>("single");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  const [variants, setVariants] = useState<PMVariant[]>([]);
  const [templateIds, setTemplateIds] = useState<string[]>([]);
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);
  const [saving, setSaving] = useState(false);

  const [quickAdd, setQuickAdd] = useState<SimpleEntity | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [addingRow, setAddingRow] = useState(false);
  const [addingBusy, setAddingBusy] = useState(false);
  const [rowDraft, setRowDraft] = useState<Record<string, { valueId?: string; text?: string }>>({});
  const imageInputRef = useRef<Record<string, HTMLInputElement | null>>({});

  const loadTemplates = async (): Promise<PMVariationTemplate[]> => {
    try {
      const list = await pmVariationTemplates();
      setTemplates(list);
      return list;
    } catch (err: any) {
      toast.error(err.message);
      return [];
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [groups, brandList, uomList, categoryList] = await Promise.all([
          pmProductGroups(),
          pmBrands(),
          pmUoms(),
          pmCategories(),
        ]);
        if (cancelled) return;
        setProductGroups(groups);
        setBrands(brandList);
        setUoms(uomList);
        setCategories(categoryList);
        const tplList = await loadTemplates();
        if (id) {
          const product = await pmProduct(id);
          if (cancelled) return;
          setCode(product.code ?? "");
          setName(product.name ?? "");
          setProductGroupId(product.product_group_id ?? "");
          setBrandId(product.brand_id ?? "");
          setUomId(product.uom_id ?? "");
          setSubUnitId(product.sub_unit_id ?? "");
          setProductType(toProductType(product.product_type));
          setDescription(product.description ?? "");
          setStatus(product.status ?? "Active");
          setVariants(product.variants ?? []);
          setTemplateIds(product.variation_template_ids ?? []);

          // Build matrix rows strictly from saved variants — preserves existing data
          const rows: VariantRow[] = (product.variants ?? []).map((v, i) => {
            const values: Record<string, string> = {};
            for (const vid of v.variation_value_ids ?? []) {
              const t = tplList.find((tt) => (tt.values ?? []).some((x) => x.id === vid));
              if (t) values[t.id] = vid;
            }
            return {
              uid: v.id ?? `row-${i}`,
              values,
              sku: v.sku ?? "",
              remark: v.description ?? "",
              baseUom: product.uom_id ?? "",
              subUom: v.sub_unit_id ?? "",
              basePurchase: v.purchase_price != null ? String(v.purchase_price) : "",
              subPurchase: v.sub_unit_purchase_price != null ? String(v.sub_unit_purchase_price) : "",
              imageUrl: v.image_url ?? "",
            };
          });
          setVariantRows(rows);

          const group = groups.find((g) => g.id === product.product_group_id);
          if (group?.category_id) {
            const cat = categoryList.find((c) => c.id === group.category_id);
            if (cat?.parent_id) {
              setCategoryId(cat.parent_id);
              setSubCategoryId(cat.id);
            } else {
              setCategoryId(cat?.id ?? "");
            }
          }
        }
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, toast]);

  useEffect(() => {
    const q = name.trim();
    if (q.length < 2) {
      setNameMatches([]);
      setNameChecking(false);
      return;
    }
    setNameChecking(true);
    const timer = setTimeout(async () => {
      try {
        const result = await pmProducts({ search: q, pageSize: "5" });
        setNameMatches(result.data.filter((p) => p.id !== id));
      } catch {
        setNameMatches([]);
      } finally {
        setNameChecking(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [name, id]);

  // ── Category cascade ──
  const categoryIds = useMemo(() => new Set(categories.map((c) => c.id)), [categories]);
  const parentCategories = useMemo(
    () =>
      categories.filter(
        (c) => (c.status ?? "Active") !== "Inactive" && (!c.parent_id || !categoryIds.has(c.parent_id))
      ),
    [categories, categoryIds]
  );
  const subCategories = useMemo(
    () => categories.filter((c) => (c.status ?? "Active") !== "Inactive" && c.parent_id === categoryId),
    [categories, categoryId]
  );
  const filteredGroupId = useMemo(() => subCategoryId || categoryId, [subCategoryId, categoryId]);
  const filteredGroups = useMemo(
    () => productGroups.filter((g) => (g.status ?? "Active") !== "Inactive" && g.category_id === filteredGroupId),
    [productGroups, filteredGroupId]
  );

  // Map saved variants by value-combo key so edits survive row updates
  const variantsByKey = useMemo(() => {
    const map = new Map<string, PMVariant>();
    for (const v of variants) {
      const ids = (v.variation_value_ids ?? []).slice().sort();
      map.set(ids.join("|"), v);
    }
    return map;
  }, [variants]);

  // valueId -> display name
  const valueNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of templates) for (const v of t.values ?? []) map.set(v.id, v.name);
    return map;
  }, [templates]);

  const genSku = (prevCount: number): string =>
    `${(code.trim() || "CO").toUpperCase()}-${String(prevCount + 1).padStart(3, "0")}`;

  const rowLabel = (row: VariantRow): string =>
    templateIds
      .map((tid) => valueNames.get(row.values[tid] ?? ""))
      .filter(Boolean)
      .join(", ");

  const updateRow = (uid: string, patch: Partial<VariantRow>) => {
    setVariantRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  };

  const removeRow = (uid: string) => {
    setVariantRows((prev) => prev.filter((r) => r.uid !== uid));
  };

  const uploadImage = async (uid: string, file: File): Promise<string> => {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(file);
    });
    const response = await fetch("/api/products/upload-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64Data, filename: file.name }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to upload image.");
    updateRow(uid, { imageUrl: data.imageUrl });
    return data.imageUrl as string;
  };

  const handleImageFile = (uid: string, file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (PNG, JPG, WEBP).");
      return;
    }
    uploadImage(uid, file).catch((err: any) => toast.error(err.message));
  };

  const clearImage = (uid: string) => {
    updateRow(uid, { imageUrl: "" });
  };

  const addTemplate = (templateId: string) => {
    if (!templateIds.includes(templateId)) setTemplateIds((prev) => [...prev, templateId]);
  };

  const handleTemplatesChange = (next: string[]) => {
    const removed = templateIds.filter((tid) => !next.includes(tid));
    setTemplateIds(next);
    if (removed.length > 0) {
      setVariantRows((prev) =>
        prev.map((r) => {
          const values = { ...r.values };
          for (const tid of removed) delete values[tid];
          return { ...r, values };
        })
      );
    }
  };

  const createValue = async (
    template: PMVariationTemplate,
    name: string
  ): Promise<PMVariationTemplateValue | null> => {
    const raw = name.trim();
    if (!template || !raw) return null;
    const existing = (template.values ?? []).find((v) => v.name.trim().toLowerCase() === raw.toLowerCase());
    if (existing) return existing;
    const values = [...(template.values ?? []).map((v) => ({ id: v.id, name: v.name, sort_order: v.sort_order }))];
    values.push({ name: raw, sort_order: (values.length + 1) * 10 } as any);
    try {
      const saved = await pmSaveVariationTemplate({ name: template.name, status: template.status, values }, template.id);
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? saved : t)));
      return (saved.values ?? []).find((v) => v.name.trim().toLowerCase() === raw.toLowerCase()) ?? null;
    } catch (err: any) {
      toast.error(err.message);
      return null;
    }
  };

  const startAddRow = () => {
    if (templateIds.length === 0) {
      toast.error("Select at least one variation template first.");
      return;
    }
    setAddingRow(true);
    setRowDraft({});
  };

  const commitAddRow = async () => {
    const missing = templateIds.filter((tid) => {
      const d = rowDraft[tid];
      return !(d?.valueId || d?.text?.trim());
    });
    if (missing.length > 0) {
      toast.error("Fill every template column — pick an existing value or type a new one.");
      return;
    }
    setAddingBusy(true);
    try {
      const values: Record<string, string> = {};
      for (const tid of templateIds) {
        const t = templates.find((x) => x.id === tid);
        if (!t) continue;
        const d = rowDraft[tid] ?? {};
        if (d.text?.trim()) {
          const created = await createValue(t, d.text.trim());
          if (!created) throw new Error(`Failed to create "${d.text}".`);
          values[tid] = created.id;
        } else if (d.valueId) {
          values[tid] = d.valueId;
        }
      }
      setVariantRows((prev) => [
        ...prev,
        {
          uid: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          values,
          sku: genSku(prev.length),
          remark: "",
          baseUom: uomId ?? "",
          subUom: "",
          basePurchase: "",
          subPurchase: "",
          imageUrl: "",
        },
      ]);
      setAddingRow(false);
      setRowDraft({});
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAddingBusy(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !productGroupId) {
      toast.error("KH Description and product group are required.");
      return;
    }

    let prepared: VariantRow[];
    if (productType === "variation") {
      if (templateIds.length === 0) {
        toast.error("Select at least one variation template.");
        return;
      }
      if (variantRows.length === 0) {
        toast.error("Add at least one variant row to save.");
        return;
      }
      const seen = new Set<string>();
      for (const r of variantRows) {
        const ids = templateIds.map((tid) => r.values[tid]).filter(Boolean);
        if (ids.length !== templateIds.length) {
          toast.error("Every variant row needs a value for each template.");
          return;
        }
        const key = ids.slice().sort().join("|");
        if (seen.has(key)) {
          toast.error("Two rows have the same variation value combination.");
          return;
        }
        seen.add(key);
      }
      prepared = variantRows;
    } else {
      prepared =
        variantRows.length > 0
          ? variantRows
          : [
              {
                uid: "__single__",
                values: {},
                sku: `${(code.trim() || "CO").toUpperCase()}-001`,
                remark: "",
                baseUom: uomId ?? "",
                subUom: subUnitId ?? "",
                basePurchase: "",
                subPurchase: "",
                imageUrl: "",
              },
            ];
    }

    for (const row of prepared) {
      const subSelected = !!row.subUom;
      const baseHas = row.basePurchase !== "" && !Number.isNaN(Number(row.basePurchase));
      const subHas = row.subPurchase !== "" && !Number.isNaN(Number(row.subPurchase));
      if (subHas && !subSelected) {
        toast.error("Sub UoM purchase price is set but no sub unit is selected for one of the rows.");
        return;
      }
      if (subSelected && !subHas) {
        toast.error("Sub UoM purchase price is required when a sub unit is selected for one of the rows.");
        return;
      }
      if (baseHas && Number(row.basePurchase) < 0) {
        toast.error("Base UoM purchase price cannot be negative for one of the rows.");
        return;
      }
      if (subHas && Number(row.subPurchase) < 0) {
        toast.error("Sub UoM purchase price cannot be negative for one of the rows.");
        return;
      }
      if (baseHas && subHas && Number(row.subPurchase) > Number(row.basePurchase)) {
        toast.error("Sub UoM purchase price cannot be higher than the base UoM purchase price for one of the rows.");
        return;
      }
    }

    const finalCode = code.trim() || autoCode(name.trim());
    if (!code.trim()) setCode(finalCode);
    const q = name.trim().toLowerCase();
    const fresh = await pmProducts({ search: name.trim(), pageSize: "5" });
    const exactMatch = fresh.data.find((p) => p.id !== id && p.name.trim().toLowerCase() === q);
    if (exactMatch) {
      toast.error(
        `A product with this exact description already exists (${exactMatch.code} — ${exactMatch.name}). Edit the existing product instead.`
      );
      return;
    }

    setSaving(true);
    try {
      const saved = await pmSaveProduct(
        {
          code: finalCode,
          name: name.trim(),
          product_group_id: productGroupId,
          brand_id: brandId || null,
          uom_id: uomId || null,
          sub_unit_id: subUnitId || null,
          product_type: productType,
          is_variable: productType === "variation",
          variation_template_ids: productType === "variation" ? templateIds : [],
          description,
          status,
        },
        id
      );
      const productId = id ?? saved.id;

      const savedKeys = new Set<string>();
      for (const row of prepared) {
        const valueIds = templateIds.map((tid) => row.values[tid]).filter(Boolean);
        const key = valueIds.slice().sort().join("|") || "__single__";
        const existing =
          productType === "variation"
            ? variantsByKey.get(key)
            : variants[0];
        const labels = valueIds.map((vid) => valueNames.get(vid)).filter(Boolean).join(", ");
        await pmSaveVariant(
          {
            product_id: productId,
            sku: row.sku.trim(),
            name:
              productType === "variation"
                ? `${name.trim()}${labels ? ` — ${labels}` : ""}`.slice(0, 255)
                : name.trim(),
            description: row.remark.trim(),
            status: "Active",
            ...(productType === "variation" ? { variation_value_ids: valueIds } : {}),
            sub_unit_id: row.subUom || null,
            purchase_price:
              row.basePurchase !== "" && !Number.isNaN(Number(row.basePurchase)) ? Number(row.basePurchase) : null,
            sub_unit_purchase_price:
              row.subPurchase !== "" && !Number.isNaN(Number(row.subPurchase)) ? Number(row.subPurchase) : null,
            image_url: row.imageUrl || null,
          },
          existing?.id
        );
        savedKeys.add(key);
      }
      for (const v of variants) {
        const key = (v.variation_value_ids ?? []).slice().sort().join("|") || "__single__";
        if (!savedKeys.has(key)) await pmDeleteVariant(v.id);
      }

      toast.success(isEdit ? "Product updated." : "Product created.");
      navigate("/product-management");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContent maxWidth="full" className="bg-background">
      <div className="space-y-6">
        {/* ── Page header ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate("/product-management")} aria-label="Back to products">
              <ArrowLeft />
            </Button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{isEdit ? "Edit Product" : "Add Product"}</h1>
              <p className="text-sm text-muted-foreground">
                {isEdit ? "Update the product and its variation matrix." : "Register a new product for the catalog."}
              </p>
            </div>
          </div>
        </div>

        {/* ── Product Basic ── */}
        <Card>
          <CardHeader>
            <CardTitle>Product Form</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.3fr_1fr]">
              {/* Left: description */}
              <div>
                <FormLabel>Product Description</FormLabel>
                <div className="mt-2 space-y-4">
                  <Field label="Product Code" wide>
                    <div className="flex gap-1.5">
                      <div className="flex-1">
                        <TextField
                          value={code}
                          onChange={(e) => setCode(e.target.value.toUpperCase())}
                          placeholder="Auto-generated if blank"
                          className="font-mono"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={() => name.trim() && setCode(autoCode(name.trim()))}
                        disabled={!name.trim()}
                        aria-label="Generate product code from description"
                        title="Generate code from description"
                      >
                        <Sparkles className="size-4" />
                      </Button>
                    </div>
                  </Field>
                  <Field label="KH Description" wide>
                    <Textarea
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Khmer description..."
                      rows={3}
                    />
                    {nameChecking && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Search className="size-3.5" />
                        Checking for existing products...
                      </p>
                    )}
                    {!nameChecking && nameMatches.length > 0 && (
                      <div className="mt-1.5 space-y-1.5 rounded-lg border border-amber-300/60 bg-amber-50/60 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="size-3.5" />
                          {nameMatches.some((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase())
                            ? "A product with this exact description already exists."
                            : "Similar existing products found."}
                        </p>
                        {nameMatches.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-background px-2.5 py-1.5 text-left text-xs hover:bg-muted"
                            onClick={() => navigate(`/product-management/products/${p.id}/edit`)}
                          >
                            <span className="min-w-0 truncate">
                              <span className="font-medium text-foreground">{p.name}</span>
                              <span className="ml-1.5 text-muted-foreground">
                                {p.code} · {p.product_group_name || "No group"}
                              </span>
                            </span>
                            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                              {p.status} · {p.variant_count ?? 0} variant{p.variant_count === 1 ? "" : "s"}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </Field>
                  <Field label="EN Description" wide>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="English description..." />
                  </Field>
                </div>
              </div>

              {/* Right: catalog setup */}
              <div>
                <FormLabel>Catalog Setup</FormLabel>
                <div className="mt-2 space-y-4">
                  <Field label="Product Type">
                    <SelectField
                      value={productType}
                      onChange={(v) => {
                        setProductType(v as ProductType);
                        if (v !== "variation") setTemplateIds([]);
                      }}
                      options={PRODUCT_TYPES}
                    />
                  </Field>
                  <Field label="Category">
                    <div className="flex gap-1.5">
                      <div className="flex-1">
                        <SelectField
                          value={categoryId}
                          onChange={(v) => {
                            setCategoryId(v);
                            setSubCategoryId("");
                            setProductGroupId("");
                          }}
                          placeholder="Select category..."
                          options={parentCategories.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
                        />
                      </div>
                      <Button variant="outline" size="icon" className="shrink-0" onClick={() => setQuickAdd("category")} aria-label="Add category">
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </Field>
                  {categoryId && (
                    <Field label="Sub-Category">
                      <div className="flex gap-1.5">
                        <div className="flex-1">
                          <SelectField
                            value={subCategoryId}
                            onChange={(v) => {
                              setSubCategoryId(v);
                              setProductGroupId("");
                            }}
                            placeholder={subCategories.length ? "Select sub-category..." : "No sub-categories"}
                            disabled={subCategories.length === 0}
                            options={subCategories.map((c) => ({ value: c.id, label: c.name }))}
                          />
                        </div>
                        <Button variant="outline" size="icon" className="shrink-0" onClick={() => setQuickAdd("category")} aria-label="Add sub-category">
                          <Plus className="size-4" />
                        </Button>
                      </div>
                    </Field>
                  )}
                  <Field label="Product Group">
                    <div className="flex gap-1.5">
                      <div className="flex-1">
                        <SelectField
                          value={productGroupId}
                          onChange={setProductGroupId}
                          placeholder={categoryId ? (filteredGroups.length ? "Select product group..." : "No groups in this category") : "Select category first"}
                          disabled={!categoryId}
                          options={filteredGroups.map((g) => ({ value: g.id, label: g.name }))}
                        />
                      </div>
                      <Button variant="outline" size="icon" className="shrink-0" onClick={() => setQuickAdd("product-group")} aria-label="Add product group">
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </Field>
                  <Field label="Brand">
                    <div className="flex gap-1.5">
                      <div className="flex-1">
                        <SelectField
                          value={brandId}
                          onChange={setBrandId}
                          placeholder="None"
                          options={brands.map((b) => ({ value: b.id, label: b.name }))}
                        />
                      </div>
                      <Button variant="outline" size="icon" className="shrink-0" onClick={() => setQuickAdd("brand")} aria-label="Add brand">
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </Field>
                  <Field label="Unit of Measure">
                    <div className="flex gap-1.5">
                      <div className="flex-1">
                        <SelectField
                          value={uomId}
                          onChange={(v) => {
                            setUomId(v);
                            setSubUnitId("");
                          }}
                          placeholder="None"
                          options={uoms.map((u) => ({ value: u.id, label: u.name }))}
                        />
                      </div>
                      <Button variant="outline" size="icon" className="shrink-0" onClick={() => setQuickAdd("uom")} aria-label="Add unit of measure">
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </Field>
                  <Field label="Sub-Unit">
                    <SelectField
                      value={subUnitId}
                      onChange={setSubUnitId}
                      placeholder="None"
                      options={(uoms.find((u) => u.id === uomId)?.sub_units ?? [])
                        .filter((s) => (s.status ?? "Active") !== "Inactive")
                        .map((s) => ({
                          value: s.id ?? "",
                          label: `${s.short_name || s.name}${s.conversion_factor ? ` (×${s.conversion_factor})` : ""}`,
                        }))}
                    />
                  </Field>
                  <Field label="Status">
                    <SelectField
                      value={status}
                      onChange={(v) => setStatus(v as "Active" | "Inactive")}
                      options={[
                        { value: "Active", label: "Active" },
                        { value: "Inactive", label: "Inactive" },
                      ]}
                    />
                  </Field>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Variation Templates ── */}
        {productType === "variation" && (
          <Card>
            <CardHeader>
              <CardTitle>Variation Product</CardTitle>
            </CardHeader>
            <CardContent>
              <FormLabel>Variation Template</FormLabel>
              <div className="mt-2">
                <MultiSelectCombobox
                  options={templates.map((t) => ({
                    id: t.id,
                    label: t.name,
                    meta: String(t.value_count ?? (t.values ?? []).length),
                  }))}
                  value={templateIds}
                  onValueChange={handleTemplatesChange}
                  placeholder="Select templates..."
                  emptyMessage="No templates found."
                  footer={
                    <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setTemplateModalOpen(true)}>
                      <Plus className="size-4" />
                      <span>Create a new template</span>
                    </Button>
                  }
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Values are assigned per row in the Variation Matrix below.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── Variation Matrix ── */}
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle>Variation Matrix</CardTitle>
            <div className="text-sm text-muted-foreground">
              <strong className="font-mono">{variantRows.length}</strong> variants
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader className="bg-muted/60">
                  <TableRow>
                    <TableHead className="w-12">No.</TableHead>
                    {productType === "variation" &&
                      templateIds.map((tid) => (
                        <TableHead key={tid} className="min-w-[130px]">
                          {templates.find((t) => t.id === tid)?.name ?? "Value"}
                        </TableHead>
                      ))}
                    <TableHead className="min-w-[130px]">Item Code (SKU)</TableHead>
                    <TableHead className="w-[320px]">Description</TableHead>
                    <TableHead className="min-w-[110px]">Base UoM</TableHead>
                    <TableHead className="min-w-[110px]">Sub UoM</TableHead>
                    <TableHead className="min-w-[110px]">Base UoM Purchase</TableHead>
                    <TableHead className="min-w-[110px]">Sub UoM Purchase</TableHead>
                    <TableHead className="min-w-[90px]">Status</TableHead>
                    <TableHead className="min-w-[80px]">Image</TableHead>
                    <TableHead className="min-w-[160px]">Remark</TableHead>
                    <TableHead className="min-w-[70px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variantRows.map((row, index) => {
                    const key = row.uid;
                    const label = rowLabel(row);
                    return (
                      <TableRow key={key} className="hover:bg-muted/40">
                        <TableCell className="text-xs text-muted-foreground">{index + 1}</TableCell>
                        {productType === "variation" &&
                          templateIds.map((tid) => {
                            const t = templates.find((x) => x.id === tid);
                            if (!t) return null;
                            return (
                              <TableCell key={tid}>
                                <SelectField
                                  value={row.values[tid] ?? ""}
                                  onChange={(v) => updateRow(key, { values: { ...row.values, [tid]: v } })}
                                  placeholder={`Pick ${t.name.toLowerCase()}...`}
                                  options={(t.values ?? []).map((vv) => ({ value: vv.id, label: vv.name }))}
                                  className="h-8 text-xs"
                                  containerClassName="min-w-28"
                                />
                              </TableCell>
                            );
                          })}
                        <TableCell>
                          <TextField
                            value={row.sku}
                            onChange={(e) => updateRow(key, { sku: e.target.value })}
                            className="h-8 font-mono text-xs"
                          />
                        </TableCell>
                        <TableCell className="whitespace-normal break-words align-top text-xs">
                          {`${name.trim() || "Product"}${label ? ` — ${label}` : ""}`}
                        </TableCell>
                        <TableCell>
                          <SelectField
                            value={row.baseUom}
                            onChange={(v) => updateRow(key, { baseUom: v })}
                            placeholder="—"
                            options={uoms.map((u) => ({ value: u.id, label: u.name }))}
                            className="h-8 text-xs"
                            containerClassName="min-w-28"
                          />
                        </TableCell>
                        <TableCell>
                          <SelectField
                            value={row.subUom}
                            onChange={(v) => updateRow(key, { subUom: v })}
                            placeholder="—"
                            options={(uoms.find((u) => u.id === row.baseUom)?.sub_units ?? [])
                              .filter((s) => (s.status ?? "Active") !== "Inactive")
                              .map((s) => ({
                                value: s.id ?? "",
                                label: `${s.short_name || s.name}${s.conversion_factor ? ` (×${s.conversion_factor})` : ""}`,
                              }))}
                            className="h-8 text-xs"
                            containerClassName="min-w-28"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={row.basePurchase}
                            onChange={(e) => updateRow(key, { basePurchase: e.target.value })}
                            placeholder="0.00"
                            className="h-8 w-28 font-mono text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={row.subPurchase}
                            onChange={(e) => updateRow(key, { subPurchase: e.target.value })}
                            placeholder="0.00"
                            className="h-8 w-28 font-mono text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <PmStatusBadge status="Active" />
                        </TableCell>
                        <TableCell>
                          {row.imageUrl ? (
                            <div className="group relative flex size-9 items-center justify-center overflow-hidden rounded-md border border-border">
                              <img src={row.imageUrl} alt="Variant preview" className="size-full object-cover" />
                              <div className="absolute inset-0 flex items-center justify-center gap-1 bg-background/70 opacity-0 transition-opacity group-hover:opacity-100">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-6"
                                  onClick={() => imageInputRef.current?.[key]?.click()}
                                  aria-label="Replace image"
                                  title="Replace image"
                                >
                                  <ImagePlus className="size-3" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-6 text-destructive"
                                  onClick={() => clearImage(key)}
                                  aria-label="Remove image"
                                  title="Remove image"
                                >
                                  <X className="size-3" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-9 border-dashed"
                              onClick={() => imageInputRef.current?.[key]?.click()}
                              aria-label="Upload image"
                              title="Upload image"
                            >
                              <ImagePlus className="size-4" />
                            </Button>
                          )}
                          <input
                            ref={(el) => {
                              if (!imageInputRef.current) imageInputRef.current = {};
                              imageInputRef.current[key] = el;
                            }}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              handleImageFile(key, e.target.files?.[0]);
                              e.target.value = "";
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.remark}
                            onChange={(e) => updateRow(key, { remark: e.target.value })}
                            placeholder="Remark..."
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {productType === "variation" ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:text-destructive"
                              onClick={() => removeRow(key)}
                              aria-label="Remove row"
                              title="Remove this variant row"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {productType === "variation" && (
              addingRow ? (
                <div className="mt-3 space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <p className="text-sm font-semibold">Add Variant Row</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {templateIds.map((tid) => {
                      const t = templates.find((x) => x.id === tid);
                      if (!t) return null;
                      const d = rowDraft[tid] ?? {};
                      return (
                        <Field key={t.id} label={t.name}>
                          <div className="flex gap-1.5">
                            <div className="flex-1">
                              <SelectField
                                value={d.valueId ?? ""}
                                onChange={(v) => setRowDraft((prev) => ({ ...prev, [tid]: { valueId: v || undefined } }))}
                                placeholder={`Pick ${t.name.toLowerCase()}...`}
                                options={(t.values ?? []).map((vv) => ({ value: vv.id, label: vv.name }))}
                              />
                            </div>
                            <Input
                              value={d.text ?? ""}
                              onChange={(e) => setRowDraft((prev) => ({ ...prev, [tid]: { text: e.target.value } }))}
                              onKeyDown={async (e) => {
                                if (e.key === "Enter" && d.text?.trim()) {
                                  e.preventDefault();
                                  const created = await createValue(t, d.text.trim());
                                  if (created) {
                                    setRowDraft((prev) => ({
                                      ...prev,
                                      [tid]: { valueId: created.id },
                                    }));
                                  }
                                }
                              }}
                              placeholder="Or type new + Enter"
                              className="h-9 w-40 text-xs"
                            />
                          </div>
                        </Field>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Pick an existing value or type a new one — new values are saved into the template.
                    </p>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setAddingRow(false); setRowDraft({}); }} disabled={addingBusy}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={commitAddRow} disabled={addingBusy}>
                        {addingBusy ? <Loader2 className="animate-spin" /> : <Plus />}
                        Add Row
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="mt-3" onClick={startAddRow}>
                  <Plus />
                  Add Variant Row
                </Button>
              )
            )}
          </CardContent>
        </Card>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => navigate("/product-management")} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save />
            <span>{saving ? "Saving..." : "Save Product"}</span>
          </Button>
        </div>
      </div>

      {quickAdd && (
        <PmSimpleFormModal
          entity={quickAdd}
          isOpen={!!quickAdd}
          onClose={() => setQuickAdd(null)}
          editing={null}
          categories={categories}
          onSaved={async (newId?: string) => {
            try {
              if (quickAdd === "category") {
                setCategories(await pmCategories());
                if (newId) setCategoryId(newId);
              } else if (quickAdd === "brand") {
                setBrands(await pmBrands());
                if (newId) setBrandId(newId);
              } else if (quickAdd === "product-group") {
                setProductGroups(await pmProductGroups());
                if (newId) setProductGroupId(newId);
              } else if (quickAdd === "uom") {
                setUoms(await pmUoms());
                if (newId) setUomId(newId);
              }
            } catch (err: any) {
              toast.error(err.message);
            }
          }}
        />
      )}

      <PmVariationTemplateModal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        editing={null}
        onSaved={async () => {
          setTemplateModalOpen(false);
          const list = await pmVariationTemplates();
          setTemplates(list);
          const latest = list[0];
          if (latest) addTemplate(latest.id);
        }}
      />
    </PageContent>
  );
}
