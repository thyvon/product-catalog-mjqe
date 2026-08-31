import { Router } from "express";
import { Readable } from "node:stream";
import {
  newId,
  coerceBool,
  getCategories,
  getCategoryById,
  upsertCategory,
  deleteCategory,
  hasCategoryChildren,
  hasCategoryGroups,
  getProductGroups,
  getProductGroupById,
  upsertProductGroup,
  deleteProductGroup,
  hasGroupProducts,
  getBrands,
  getBrandById,
  upsertBrand,
  deleteBrand,
  hasBrandProducts,
  getUoms,
  getUomById,
  upsertUom,
  deleteUom,
  hasVariantUoms,
  hasUomProducts,
  getSubUnits,
  getSubUnitById,
  upsertSubUnit,
  deleteSubUnit,
  hasSubUnitProductReferences,
  hasSubUnits,
  hasTemplateProducts,
  hasTemplateValueUsage,
  getProductsPaginated,
  getProductById,
  getProductByCode,
  getProductByName,
  upsertProduct,
  deleteProduct,
  getVariants,
  getVariantById,
  upsertVariant,
  deleteVariant,
  getStandards,
  getStandardById,
  getStandardItems,
  upsertStandard,
  deleteStandard,
  upsertStandardItem,
  deleteStandardItem,
  getVariantUoms,
  getVariantUomById,
  upsertVariantUom,
  deleteVariantUom,
  getVariationTemplates,
  getVariationTemplateById,
  getVariationTemplateValues,
  upsertVariationTemplate,
  upsertVariationTemplateValue,
  deleteVariationTemplate,
  deleteVariationTemplateValues,
  getProductVariationTemplates,
  setProductVariationTemplates,
  getComboItems,
  replaceComboItems,
  getCustomFields,
  getProductCustomFields,
  replaceProductCustomFields,
  getComboCandidateProducts,
} from "../models/productManagement.js";

const router = Router();

const STATUSES = ["Active", "Inactive"];
const PRODUCT_TYPES = ["single", "variation", "service", "combo"];
const UOM_TYPES = ["unit", "weight", "volume", "length", "time", "packaging", "other"];

function num(value: any, fallback: number | null = null): number | null {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function coerceBoolInput(value: any, fallback = false): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  return value !== 0 && value !== "0" && value !== "false";
}

function nowIso(): string {
  return new Date().toISOString();
}

function statusValue(value: any, fallback = "Active"): string {
  return STATUSES.includes(value) ? value : fallback;
}

function cleanText(input: any, field: string, fallback = ""): string {
  return String(input?.[field] ?? fallback).trim();
}

// ─── References (for dropdowns) ───

router.get("/api/pm/refs", async (_req, res) => {
  try {
    const [categories, productGroups, brands, uoms, products, variants, standards] = await Promise.all([
      getCategories(),
      getProductGroups(),
      getBrands(),
      getUoms(),
      getProductsPaginated({ page: 1, pageSize: 0 }),
      getVariants({}),
      getStandards(),
    ]);
    const templates = await getVariationTemplates();
    const variationTemplates: any[] = [];
    for (const t of templates) {
      variationTemplates.push({ ...t, values: await getVariationTemplateValues(t.id) });
    }
    const customFields = await getCustomFields();
    const comboProducts = await getComboCandidateProducts();
    const subUnits = await getSubUnits();
    const subUnitsByUom = new Map<string, any[]>();
    for (const su of subUnits) {
      if (!subUnitsByUom.has(su.parent_uom_id)) subUnitsByUom.set(su.parent_uom_id, []);
      subUnitsByUom.get(su.parent_uom_id)!.push(su);
    }
    res.json({
      categories,
      productGroups,
      brands,
      uoms: uoms.map((u: any) => ({ ...u, sub_units: subUnitsByUom.get(u.id) || [] })),
      products: products.data,
      variants,
      standards,
      variationTemplates,
      customFields,
      comboProducts,
    });
  } catch (err: any) {
    console.error("Error fetching product management refs:", err);
    res.status(500).json({ error: "Failed to fetch references." });
  }
});

// ─── Product form options (dropdowns for the product form) ───

router.get("/api/pm/products/form-options", async (_req, res) => {
  try {
    const [categories, productGroups, brands, uoms, comboProducts, customFields] = await Promise.all([
      getCategories(),
      getProductGroups(),
      getBrands(),
      getUoms(),
      getComboCandidateProducts(),
      getCustomFields(),
    ]);
    const templates = await getVariationTemplates();
    const variationTemplates: any[] = [];
    for (const t of templates) {
      variationTemplates.push({ ...t, values: await getVariationTemplateValues(t.id) });
    }
    const subUnits = await getSubUnits();
    const subUnitsByUom = new Map<string, any[]>();
    for (const su of subUnits) {
      if (!subUnitsByUom.has(su.parent_uom_id)) subUnitsByUom.set(su.parent_uom_id, []);
      subUnitsByUom.get(su.parent_uom_id)!.push(su);
    }
    res.json({
      categories,
      productGroups,
      brands,
      uoms: uoms.map((u: any) => ({ ...u, sub_units: subUnitsByUom.get(u.id) || [] })),
      variationTemplates,
      customFields,
      comboProducts,
    });
  } catch (err: any) {
    console.error("Error fetching product form options:", err);
    res.status(500).json({ error: "Failed to fetch product form options." });
  }
});

// ─── Categories ───

router.get("/api/pm/categories", async (_req, res) => {
  try {
    res.json(await getCategories());
  } catch {
    res.status(500).json({ error: "Failed to fetch categories." });
  }
});

router.post("/api/pm/categories", async (req, res) => {
  try {
    const input = req.body;
    if (!input.code || !input.name) {
      return res.status(400).json({ error: "Code and name are required." });
    }
    const category = {
      id: newId("cat"),
      parent_id: input.parent_id || null,
      code: String(input.code).toUpperCase().trim(),
      name: String(input.name).trim(),
      description: cleanText(input, "description"),
      sort_order: input.sort_order !== undefined ? Math.max(0, parseInt(input.sort_order, 10) || 0) : 0,
      status: statusValue(input.status),
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await upsertCategory(category);
    res.status(201).json(category);
  } catch (err: any) {
    console.error("Error creating category:", err);
    res.status(500).json({ error: "Failed to create category." });
  }
});

router.put("/api/pm/categories/:id", async (req, res) => {
  try {
    const existing = await getCategoryById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Category not found." });
    const input = req.body;
    const updated = {
      ...existing,
      parent_id: input.parent_id !== undefined ? input.parent_id || null : existing.parent_id,
      code: input.code !== undefined ? String(input.code).toUpperCase().trim() : existing.code,
      name: input.name !== undefined ? String(input.name).trim() : existing.name,
      description: input.description !== undefined ? cleanText(input, "description") : existing.description,
      sort_order: input.sort_order !== undefined ? Math.max(0, parseInt(input.sort_order, 10) || 0) : existing.sort_order,
      status: input.status !== undefined ? statusValue(input.status, existing.status) : existing.status,
      updated_at: nowIso(),
    };
    await upsertCategory(updated);
    res.json(updated);
  } catch (err: any) {
    console.error("Error updating category:", err);
    res.status(500).json({ error: "Failed to update category." });
  }
});

router.delete("/api/pm/categories/:id", async (req, res) => {
  try {
    const [children, groups] = await Promise.all([
      hasCategoryChildren(req.params.id),
      hasCategoryGroups(req.params.id),
    ]);
    if (children > 0 || groups > 0) {
      return res.status(409).json({ error: "Cannot delete a category that has child categories or product groups." });
    }
    const deleted = await deleteCategory(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Category not found." });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting category:", err);
    res.status(500).json({ error: "Failed to delete category." });
  }
});

// ─── Product Groups ───

router.get("/api/pm/product-groups", async (_req, res) => {
  try {
    res.json(await getProductGroups());
  } catch {
    res.status(500).json({ error: "Failed to fetch product groups." });
  }
});

router.post("/api/pm/product-groups", async (req, res) => {
  try {
    const input = req.body;
    if (!input.code || !input.name || !input.category_id) {
      return res.status(400).json({ error: "Code, name, and category are required." });
    }
    const group = {
      id: newId("pgrp"),
      category_id: String(input.category_id),
      code: String(input.code).toUpperCase().trim(),
      name: String(input.name).trim(),
      description: cleanText(input, "description"),
      status: statusValue(input.status),
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await upsertProductGroup(group);
    res.status(201).json(group);
  } catch (err: any) {
    console.error("Error creating product group:", err);
    res.status(500).json({ error: "Failed to create product group." });
  }
});

router.put("/api/pm/product-groups/:id", async (req, res) => {
  try {
    const existing = await getProductGroupById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Product group not found." });
    const input = req.body;
    const updated = {
      ...existing,
      category_id: input.category_id !== undefined ? String(input.category_id) : existing.category_id,
      code: input.code !== undefined ? String(input.code).toUpperCase().trim() : existing.code,
      name: input.name !== undefined ? String(input.name).trim() : existing.name,
      description: input.description !== undefined ? cleanText(input, "description") : existing.description,
      status: input.status !== undefined ? statusValue(input.status, existing.status) : existing.status,
      updated_at: nowIso(),
    };
    await upsertProductGroup(updated);
    res.json(updated);
  } catch (err: any) {
    console.error("Error updating product group:", err);
    res.status(500).json({ error: "Failed to update product group." });
  }
});

router.delete("/api/pm/product-groups/:id", async (req, res) => {
  try {
    const count = await hasGroupProducts(req.params.id);
    if (count > 0) {
      return res.status(409).json({ error: "Cannot delete a product group that still has products." });
    }
    const deleted = await deleteProductGroup(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Product group not found." });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting product group:", err);
    res.status(500).json({ error: "Failed to delete product group." });
  }
});

// ─── Brands ───

router.get("/api/pm/brands", async (_req, res) => {
  try {
    res.json(await getBrands());
  } catch {
    res.status(500).json({ error: "Failed to fetch brands." });
  }
});

router.post("/api/pm/brands", async (req, res) => {
  try {
    const input = req.body;
    if (!input.code || !input.name) {
      return res.status(400).json({ error: "Code and name are required." });
    }
    const brand = {
      id: newId("brnd"),
      code: String(input.code).toUpperCase().trim(),
      name: String(input.name).trim(),
      description: cleanText(input, "description"),
      status: statusValue(input.status),
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await upsertBrand(brand);
    res.status(201).json(brand);
  } catch (err: any) {
    console.error("Error creating brand:", err);
    res.status(500).json({ error: "Failed to create brand." });
  }
});

router.put("/api/pm/brands/:id", async (req, res) => {
  try {
    const existing = await getBrandById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Brand not found." });
    const input = req.body;
    const updated = {
      ...existing,
      code: input.code !== undefined ? String(input.code).toUpperCase().trim() : existing.code,
      name: input.name !== undefined ? String(input.name).trim() : existing.name,
      description: input.description !== undefined ? cleanText(input, "description") : existing.description,
      status: input.status !== undefined ? statusValue(input.status, existing.status) : existing.status,
      updated_at: nowIso(),
    };
    await upsertBrand(updated);
    res.json(updated);
  } catch (err: any) {
    console.error("Error updating brand:", err);
    res.status(500).json({ error: "Failed to update brand." });
  }
});

router.delete("/api/pm/brands/:id", async (req, res) => {
  try {
    const count = await hasBrandProducts(req.params.id);
    if (count > 0) {
      return res.status(409).json({ error: "Cannot delete a brand that is assigned to products." });
    }
    const deleted = await deleteBrand(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Brand not found." });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting brand:", err);
    res.status(500).json({ error: "Failed to delete brand." });
  }
});

// ─── UoMs ───

function sanitizeSubUnitFactor(value: any, fallback = 1): number {
  const n = num(value, null);
  if (n === null || n <= 0) return fallback;
  return Math.round(n * 10000) / 10000;
}

async function syncSubUnits(uomId: string, input: any): Promise<void> {
  const list = Array.isArray(input) ? input : [];
  const existing = await getSubUnits(uomId);
  const existingById = new Map(existing.map((s: any) => [s.id, s] as [string, any]));
  const keptIds: string[] = [];

  for (const item of list) {
    const name = String(item.name ?? "").trim();
    const shortName = String(item.short_name ?? "").trim();
    if (!name) continue;
    const id = item.id && existingById.has(String(item.id)) ? String(item.id) : newId("subu");
    await upsertSubUnit({
      id,
      parent_uom_id: uomId,
      name,
      short_name: shortName || name,
      conversion_factor: sanitizeSubUnitFactor(item.conversion_factor),
      status: statusValue(item.status),
      created_at: existingById.has(id) ? existingById.get(id)!.created_at : nowIso(),
      updated_at: nowIso(),
    });
    keptIds.push(id);
  }

  for (const s of existing) {
    if (!keptIds.includes(s.id)) {
      const refs = await hasSubUnitProductReferences(s.id);
      if (refs === 0) await deleteSubUnit(s.id);
    }
  }
}

router.get("/api/pm/uoms", async (_req, res) => {
  try {
    const rows = await getUoms();
    const withSubUnits: any[] = [];
    for (const uom of rows) {
      withSubUnits.push({ ...uom, sub_units: await getSubUnits(uom.id) });
    }
    res.json(withSubUnits);
  } catch {
    res.status(500).json({ error: "Failed to fetch UoMs." });
  }
});

router.post("/api/pm/uoms", async (req, res) => {
  try {
    const input = req.body;
    if (!input.code || !input.name) {
      return res.status(400).json({ error: "Code and name are required." });
    }
    const uom = {
      id: newId("uom"),
      code: String(input.code).toUpperCase().trim(),
      name: String(input.name).trim(),
      type: UOM_TYPES.includes(input.type) ? input.type : "unit",
      decimal_places: input.decimal_places !== undefined ? Math.max(0, parseInt(input.decimal_places, 10) || 0) : 0,
      status: statusValue(input.status),
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await upsertUom(uom);
    await syncSubUnits(uom.id, input.sub_units);
    res.status(201).json({ ...uom, sub_units: await getSubUnits(uom.id) });
  } catch (err: any) {
    console.error("Error creating UoM:", err);
    res.status(500).json({ error: "Failed to create UoM." });
  }
});

router.put("/api/pm/uoms/:id", async (req, res) => {
  try {
    const existing = await getUomById(req.params.id);
    if (!existing) return res.status(404).json({ error: "UoM not found." });
    const input = req.body;
    const updated = {
      ...existing,
      code: input.code !== undefined ? String(input.code).toUpperCase().trim() : existing.code,
      name: input.name !== undefined ? String(input.name).trim() : existing.name,
      type: input.type !== undefined && UOM_TYPES.includes(input.type) ? input.type : existing.type,
      decimal_places: input.decimal_places !== undefined ? Math.max(0, parseInt(input.decimal_places, 10) || 0) : existing.decimal_places,
      status: input.status !== undefined ? statusValue(input.status, existing.status) : existing.status,
      updated_at: nowIso(),
    };
    await upsertUom(updated);
    await syncSubUnits(updated.id, input.sub_units);
    res.json({ ...updated, sub_units: await getSubUnits(updated.id) });
  } catch (err: any) {
    console.error("Error updating UoM:", err);
    res.status(500).json({ error: "Failed to update UoM." });
  }
});

router.delete("/api/pm/uoms/:id", async (req, res) => {
  try {
    const [variantUomCount, productCount, subUnitRefs] = await Promise.all([
      hasVariantUoms(req.params.id),
      hasUomProducts(req.params.id),
      getSubUnits(req.params.id).then((list) => {
        let total = 0;
        return Promise.all(
          list.map((s: any) => hasSubUnitProductReferences(s.id).then((c) => (total += c)))
        ).then(() => total);
      }),
    ]);
    if (variantUomCount > 0 || productCount > 0 || subUnitRefs > 0) {
      return res.status(409).json({
        error:
          "Cannot delete a UoM that is in use by products, variants, or sub-units assigned to products.",
      });
    }
    for (const s of await getSubUnits(req.params.id)) await deleteSubUnit(s.id);
    const deleted = await deleteUom(req.params.id);
    if (!deleted) return res.status(404).json({ error: "UoM not found." });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting UoM:", err);
    res.status(500).json({ error: "Failed to delete UoM." });
  }
});

// ─── Products ───

function buildProductRow(input: any, existing: any = {}): any {
  const productType = PRODUCT_TYPES.includes(input.product_type)
    ? input.product_type
    : (existing.product_type || "single");
  const isVariation = productType === "variation";

  return {
    product_group_id: input.product_group_id !== undefined ? (input.product_group_id || null) : (existing.product_group_id ?? null),
    category_id: input.category_id !== undefined ? (input.category_id || null) : (existing.category_id ?? null),
    brand_id: input.brand_id !== undefined ? (input.brand_id || null) : existing.brand_id,
    uom_id: input.uom_id !== undefined ? (input.uom_id || null) : existing.uom_id,
    sub_unit_id: input.sub_unit_id !== undefined ? (input.sub_unit_id || null) : existing.sub_unit_id,
    code: input.code !== undefined ? String(input.code).toUpperCase().trim() : existing.code,
    name: input.name !== undefined ? String(input.name).trim() : existing.name,
    product_type: productType,
    is_variable: isVariation,
    purchase_price: isVariation ? null : num(input.purchase_price, existing.purchase_price),
    sub_unit_purchase_price: isVariation ? null : num(input.sub_unit_purchase_price, existing.sub_unit_purchase_price),
    image_url: input.image_url !== undefined ? (input.image_url || null) : existing.image_url,
    description: input.description !== undefined ? cleanText(input, "description") : existing.description,
    status: statusValue(input.status, existing.status || "Active"),
    created_at: existing.created_at,
    updated_at: nowIso(),
  };
}

async function syncVariants(productId: string, variations: any[], productCode: string): Promise<any[]> {
  const existing = await getVariants({ productId });
  const existingById = new Map(existing.map((v) => [v.id, v]));
  const list = Array.isArray(variations) ? variations : [];
  const keptIds: string[] = [];

  const maxSkuOf = (rows: any[]) => {
    const prefix = `${(productCode || "VAR").toUpperCase()}-`;
    let max = 0;
    for (const r of rows) {
      const sku = String(r.sku || "");
      if (sku.startsWith(prefix)) {
        const n = parseInt(sku.slice(prefix.length), 10);
        if (!Number.isNaN(n)) max = Math.max(max, n);
      }
    }
    return max;
  };
  let seq = maxSkuOf(existing);

  for (const v of list) {
    const id = v.id && existingById.has(String(v.id)) ? String(v.id) : newId("var");
    let sku = v.sku ? String(v.sku).trim() : "";
    if (!sku) {
      const valuesKey = (v.variation_value_ids ?? []).join("|");
      const prior = [...existingById.values()].find((r) => (r.variation_value_ids ?? []).join("|") === valuesKey);
      if (prior?.sku) {
        sku = String(prior.sku).trim();
      } else {
        seq += 1;
        sku = `${(productCode || "VAR").toUpperCase()}-${String(seq).padStart(3, "0")}`;
      }
    }
    await upsertVariant({
      id,
      product_id: productId,
      sku,
      name: String(v.name || "").trim(),
      description: v.description !== undefined ? String(v.description || "").trim() : "",
      variation_value_ids: Array.isArray(v.variation_value_ids) ? v.variation_value_ids : [],
      sub_unit_id: v.sub_unit_id !== undefined ? (v.sub_unit_id || null) : null,
      purchase_price: num(v.purchase_price),
      sub_unit_purchase_price: num(v.sub_unit_purchase_price),
      image_url: v.image_url !== undefined ? (v.image_url || null) : null,
      is_active: coerceBoolInput(v.is_active, true),
      status: "Active",
      created_at: existingById.has(id) ? existingById.get(id)!.created_at : nowIso(),
      updated_at: nowIso(),
    });
    keptIds.push(id);
  }

  for (const v of existing) {
    if (!keptIds.includes(v.id)) {
      await deleteVariant(v.id);
    }
  }

  return getVariants({ productId });
}

async function validateVariationValues(variations: any[], templateIds: string[]): Promise<string | null> {
  const valueToTemplate = new Map<string, string>();
  for (const templateId of templateIds) {
    const values = await getVariationTemplateValues(templateId);
    for (const val of values) valueToTemplate.set(String(val.id), String(templateId));
  }
  const list = Array.isArray(variations) ? variations : [];
  for (const [index, v] of list.entries()) {
    const ids = (Array.isArray(v.variation_value_ids) ? v.variation_value_ids : []).map(String).filter(Boolean);
    if (ids.length !== templateIds.length) {
      return `Variation #${index + 1} must contain exactly one value for each selected template.`;
    }
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) return `Variation #${index + 1} contains a duplicated value.`;
      seen.add(id);
      if (!valueToTemplate.has(id)) {
        return `Variation #${index + 1} references a variation value that does not exist.`;
      }
    }
  }
  return null;
}

async function subUnitBelongsToUom(subUnitId: any, uomId: any): Promise<boolean> {
  if (!subUnitId) return true;
  if (!uomId) return false;
  const sub = await getSubUnitById(String(subUnitId));
  return !!(sub && String(sub.parent_uom_id) === String(uomId));
}

async function syncDerivedPricing(productId: string, productType: string): Promise<void> {
  // No-op: stock and selling price management removed
}

router.get("/api/pm/products", async (req, res) => {
  try {
    const { page, pageSize, search, groupId, categoryId, assignedCategoryId, brandId, status, type, sort } = req.query;
    const result = await getProductsPaginated({
      page: Math.max(1, Number(page) || 1),
      pageSize: pageSize !== undefined ? Math.max(0, Number(pageSize)) : 20,
      search: String(search || ""),
      groupId: String(groupId || ""),
      categoryId: String(categoryId || ""),
      assignedCategoryId: String(assignedCategoryId || ""),
      brandId: String(brandId || ""),
      status: String(status || ""),
      type: String(type || ""),
      sort: String(sort || "name"),
    });
    res.json(result);
  } catch (err: any) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Failed to fetch products." });
  }
});

router.get("/api/pm/products/:id", async (req, res) => {
  try {
    const product = await getProductById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found." });
    const [variants, templateIds, comboItems, customFields] = await Promise.all([
      getVariants({ productId: req.params.id }),
      getProductVariationTemplates(req.params.id),
      getComboItems(req.params.id),
      getProductCustomFields(req.params.id),
    ]);
    product.variants = variants;
    product.variation_template_ids = templateIds;
    product.combo_items = comboItems;
    product.custom_fields = customFields;
    res.json(product);
  } catch (err: any) {
    console.error("Error fetching product:", err);
    res.status(500).json({ error: "Failed to fetch product." });
  }
});

router.post("/api/pm/products", async (req, res) => {
  try {
    const input = req.body;
    if (!input.name || !input.product_group_id) {
      return res.status(400).json({ error: "Name and product group are required." });
    }
    const name = String(input.name).trim();
    let code = input.code !== undefined ? String(input.code).toUpperCase().trim() : "";
    if (!code) code = autoProductCode(name);
    while (await getProductByCode(code)) {
      code = autoProductCode(name);
    }
    const existingName = await getProductByName(name);
    if (existingName) {
      return res.status(409).json({
        error: `A product with this exact description already exists (${existingName.code} — ${existingName.name}).`,
      });
    }
    const product = {
      id: newId("prod"),
      ...buildProductRow({ ...input, code, name }),
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    if (product.sub_unit_id && !(await subUnitBelongsToUom(product.sub_unit_id, product.uom_id))) {
      return res.status(400).json({ error: "Selected sub unit does not belong to the chosen unit." });
    }

    if (product.product_type === "variation") {
      const templateIds = normalizeTemplateIds(input);
      const valueErr = await validateVariationValues(input.variations, templateIds);
      if (valueErr) return res.status(400).json({ error: valueErr });
      for (const v of Array.isArray(input.variations) ? input.variations : []) {
        if (v.sub_unit_id && !(await subUnitBelongsToUom(v.sub_unit_id, product.uom_id))) {
          return res.status(400).json({ error: "A variation sub unit does not belong to the chosen unit." });
        }
      }
    }

    await upsertProduct(product);

    if (product.product_type === "variation") {
      const templateIds = normalizeTemplateIds(input);
      await setProductVariationTemplates(product.id, templateIds);
      if (Array.isArray(input.variations)) {
        await syncVariants(product.id, input.variations, product.code);
        await syncDerivedPricing(product.id, product.product_type);
      }
    }
    if (product.product_type === "combo") {
      await replaceComboItems(product.id, input.combo_items);
    }
    await replaceProductCustomFields(product.id, input.custom_fields);

    res.status(201).json(await getProductById(product.id));
  } catch (err: any) {
    console.error("Error creating product:", err);
    res.status(500).json({ error: "Failed to create product." });
  }
});

router.put("/api/pm/products/:id", async (req, res) => {
  try {
    const existing = await getProductById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Product not found." });
    const input = req.body;
    let code = input.code !== undefined ? String(input.code).toUpperCase().trim() : existing.code;
    let name = input.name !== undefined ? String(input.name).trim() : existing.name;
    if (!name) {
      return res.status(400).json({ error: "Product name is required." });
    }
    if (!code) code = autoProductCode(name);
    const duplicateCode = await getProductByCode(code);
    if (duplicateCode && duplicateCode.id !== existing.id) {
      return res.status(409).json({ error: `Product code "${code}" already exists.` });
    }
    const duplicateName = await getProductByName(name);
    if (duplicateName && duplicateName.id !== existing.id) {
      return res.status(409).json({
        error: `A product with this exact description already exists (${duplicateName.code} — ${duplicateName.name}). Edit the existing product instead.`,
      });
    }
    const updated = {
      id: existing.id,
      ...buildProductRow({ ...input, code, name }, existing),
      updated_at: nowIso(),
    };

    if (updated.sub_unit_id && !(await subUnitBelongsToUom(updated.sub_unit_id, updated.uom_id))) {
      return res.status(400).json({ error: "Selected sub unit does not belong to the chosen unit." });
    }

    if (updated.product_type === "variation") {
      const templateIds = normalizeTemplateIds(input);
      const valueErr = await validateVariationValues(input.variations, templateIds);
      if (valueErr) return res.status(400).json({ error: valueErr });
      for (const v of Array.isArray(input.variations) ? input.variations : []) {
        if (v.sub_unit_id && !(await subUnitBelongsToUom(v.sub_unit_id, updated.uom_id))) {
          return res.status(400).json({ error: "A variation sub unit does not belong to the chosen unit." });
        }
      }
    }

    await upsertProduct(updated);

    if (updated.product_type === "variation") {
      const templateIds = normalizeTemplateIds(input);
      await setProductVariationTemplates(updated.id, templateIds);
      if (Array.isArray(input.variations)) {
        await syncVariants(updated.id, input.variations, updated.code);
        await syncDerivedPricing(updated.id, updated.product_type);
      }
    } else {
      await setProductVariationTemplates(updated.id, []);
      const variants = await getVariants({ productId: updated.id });
      for (const v of variants) {
        if (updated.product_type === "single" && (v.variation_value_ids ?? []).length === 0) continue;
        await deleteVariant(v.id);
      }
    }
    if (updated.product_type === "combo") {
      await replaceComboItems(updated.id, input.combo_items);
    } else {
      await replaceComboItems(updated.id, []);
    }
    await replaceProductCustomFields(updated.id, input.custom_fields);

    res.json(await getProductById(updated.id));
  } catch (err: any) {
    console.error("Error updating product:", err);
    res.status(500).json({ error: "Failed to update product." });
  }
});

function normalizeTemplateIds(input: any): string[] {
  const ids: unknown[] = Array.isArray(input.variation_template_ids)
    ? input.variation_template_ids
    : input.variation_template_id
      ? [input.variation_template_id]
      : [];
  const result: string[] = [];
  for (const id of ids) {
    const s = String(id).trim();
    if (s && !result.includes(s)) result.push(s);
  }
  return result;
}

router.delete("/api/pm/products/:id", async (req, res) => {
  try {
    const variants = await getVariants({ productId: req.params.id });
    for (const v of variants) {
      await deleteVariant(v.id);
    }
    const deleted = await deleteProduct(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Product not found." });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting product:", err);
    res.status(500).json({ error: "Failed to delete product." });
  }
});

// ─── Merge single products into a variation product ───

router.post("/api/pm/products/merge-variation", async (req, res) => {
  try {
    const body: any = req.body ?? {};
    const parentId = String(body.parentId || "");
    const parent = await getProductById(parentId);
    if (!parent) return res.status(404).json({ error: "Parent product not found." });

    const rawTemplateIds: any[] = Array.isArray(body.templateIds) ? body.templateIds : [];
    const templateIds: string[] = [...new Set(rawTemplateIds.map((t) => String(t)).filter(Boolean))];
    if (templateIds.length === 0) {
      return res.status(400).json({ error: "Select at least one variation template." });
    }

    const rows = Array.isArray(body.assignments) ? body.assignments : [];
    if (rows.length === 0) {
      return res.status(400).json({ error: "At least one product assignment is required." });
    }

    const seenProducts = new Set<string>();
    for (const row of rows) {
      const pid = String(row?.productId || "");
      if (!pid) return res.status(400).json({ error: "Assignment is missing a product." });
      if (seenProducts.has(pid)) return res.status(400).json({ error: "Duplicate product in assignments." });
      seenProducts.add(pid);
    }
    if (!seenProducts.has(parent.id)) {
      return res.status(400).json({ error: "The parent product must also be assigned variation values." });
    }

    // Validate sources exist and are single products
    const sources = new Map<string, any>();
    for (const pid of seenProducts) {
      if (pid === parent.id) continue;
      const p = await getProductById(pid);
      if (!p) return res.status(404).json({ error: `Product ${pid} not found.` });
      if (p.product_type !== "single") {
        return res.status(400).json({ error: `"${p.name}" is not a single product and cannot be merged.` });
      }
      sources.set(pid, p);
    }

    // Load template values for validation + labels
    const valueById = new Map<string, { name: string; templateId: string }>();
    for (const tid of templateIds) {
      const values = await getVariationTemplateValues(tid);
      for (const v of values) valueById.set(String(v.id), { name: String(v.name), templateId: tid });
    }

    // Normalize + validate assignments
    const normalized: { productId: string; valueIds: string[]; label: string }[] = [];
    const seenCombos = new Set<string>();
    const seenSkus = new Set<string>();
    for (const row of rows) {
      const productId = String(row.productId || "");
      const rawValueIds: any[] = Array.isArray(row.valueIds) ? row.valueIds : [];
      const ids: string[] = [...new Set(rawValueIds.map((v) => String(v)).filter(Boolean))];
      const src = productId === parent.id ? parent : sources.get(productId)!;

      if (ids.length !== templateIds.length) {
        return res.status(400).json({ error: `"${src.name}" must have exactly one value per selected template.` });
      }
      let valid = true;
      const usedTemplates = new Set<string>();
      for (const vid of ids) {
        const meta = valueById.get(vid);
        if (!meta || usedTemplates.has(meta.templateId)) {
          valid = false;
          break;
        }
        usedTemplates.add(meta.templateId);
      }
      if (!valid) {
        return res.status(400).json({
          error: `"${src.name}" has an invalid or duplicated value for the selected templates.`,
        });
      }

      const key = ids.slice().sort().join("|");
      if (seenCombos.has(key)) {
        return res.status(400).json({ error: `Two products map to the same variation combination (${ids.map((id) => valueById.get(id)?.name ?? id).join(", ")}).` });
      }
      seenCombos.add(key);

      const existingVariants = await getVariants({ productId });
      const variant = existingVariants.find((v) => !(v.variation_value_ids ?? []).length) || existingVariants[0] || null;
      const sku = String(variant?.sku || "").trim();
      if (!sku) {
        return res.status(400).json({ error: `"${src.name}" has no SKU to merge. Set a SKU first.` });
      }
      if (seenSkus.has(sku.toUpperCase())) {
        return res.status(400).json({ error: `Duplicate SKU "${sku}" among the products being merged.` });
      }
      seenSkus.add(sku.toUpperCase());

      const label = templateIds
        .map((tid) => {
          const vid = ids.find((id) => valueById.get(id)?.templateId === tid);
          return valueById.get(vid ?? "")?.name ?? "";
        })
        .filter(Boolean)
        .join(", ");

      normalized.push({ productId, valueIds: ids, label });
    }

    // Convert parent to variation
    await upsertProduct({
      ...parent,
      product_type: "variation",
      is_variable: true,
      updated_at: nowIso(),
    });
    await setProductVariationTemplates(parent.id, templateIds);

    // Reparent each source's default variant under the parent with stamped values
    const now = nowIso();
    for (const row of normalized) {
      const srcProductId = row.productId === parent.id ? parent.id : row.productId;
      const existingVariants = await getVariants({ productId: srcProductId });
      const variant =
        existingVariants.find((v) => !(v.variation_value_ids ?? []).length) || existingVariants[0] || null;
      await upsertVariant({
        ...(variant ?? {}),
        id: variant?.id ?? newId("var"),
        product_id: parent.id,
        sku: String(variant?.sku || `${parent.code}-${randomCode()}`),
        name: `${parent.name} — ${row.label}`.slice(0, 255),
        variation_value_ids: row.valueIds,
        status: "Active",
        is_active: true,
        created_at: variant?.created_at ?? now,
        updated_at: now,
      });
    }

    // Delete absorbed source products
    for (const row of normalized) {
      if (row.productId === parent.id) continue;
      await deleteProduct(row.productId);
    }

    res.json(await getProductById(parent.id));
  } catch (err: any) {
    console.error("Error merging products into variation:", err);
    res.status(500).json({ error: err.message || "Failed to merge products." });
  }
});

// ─── Products Import ───

function cv(row: any, key: string): string {
  if (!row || typeof row !== "object") return "";
  const lower = String(key).toLowerCase();
  const found = Object.keys(row).find((k) => String(k).toLowerCase() === lower);
  const value = found !== undefined ? row[found] : undefined;
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function cvList(row: any, key: string): string[] {
  return cv(row, key)
    .split(/[|,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function cvBool(value: string, fallback = false): boolean {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return fallback;
  return ["1", "true", "yes", "y", "active", "enabled", "on"].includes(v);
}

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ123456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function autoProductCode(name: string): string {
  const prefix = (name.match(/[a-z0-9]/gi) || []).join("").slice(0, 6).toUpperCase() || "PRD";
  return `${prefix}-${randomCode()}`;
}

const IMPORT_HEADERS = [
  "name",
  "type",
  "sku",
  "unit",
  "sub_unit",
  "product_group",
  "brand",
  "description",
  "status",
  "purchase_price",
  "sub_unit_purchase_price",
];

const VARIATION_IMPORT_HEADERS = [
  ...IMPORT_HEADERS,
  "parent_sku",
  "variation_templates",
  "variation_name",
  "variation_sku",
  "variation_values",
  "variation_is_active",
];

router.get("/api/pm/products/import/template", async (_req, res) => {
  try {
    const exceljsModule: any = await import("exceljs");
  const ExcelJS = exceljsModule.default ?? exceljsModule;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Product Template");
    sheet.addRow(IMPORT_HEADERS);
    sheet.addRow(["Iced Brew Coffee Maker", "single", "PRD-000001", "PCS", "BOX", "G-001", "B-001", "", "Active", "15.00", "144.00"]);
    sheet.addRow(["Thermal Insulated Flask 1L", "single", "PRD-000002", "BOX", "CASE", "G-002", "B-002", "", "Active", "8.00", "96.00"]);
    sheet.columns.forEach((col) => {
      col.width = 24;
    });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="ProductImportTemplate.xlsx"');
    await workbook.xlsx.write(res);
  } catch (err: any) {
    console.error("Error generating product import template:", err);
    res.status(500).json({ error: "Failed to generate template." });
  }
});

router.get("/api/pm/products/import/template/variable", async (_req, res) => {
  try {
    const exceljsModule: any = await import("exceljs");
  const ExcelJS = exceljsModule.default ?? exceljsModule;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Variable Product Template");
    sheet.addRow(VARIATION_IMPORT_HEADERS);
    sheet.addRow(["T-Shirt Cotton Crew", "variation", "TSH-000001", "PCS", "", "G-001", "B-001", "", "Active", "", "", "", "Size|Colour", "Small-Red", "", "Small|Red", "1"]);
    sheet.addRow(["", "", "TSH-000001", "", "", "", "", "", "", "", "", "", "", "", "", "TSH-000001", "", "Medium-Blue", "", "Medium|Blue", "1"]);
    sheet.columns.forEach((col) => {
      col.width = 24;
    });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="VariableProductImportTemplate.xlsx"');
    await workbook.xlsx.write(res);
  } catch (err: any) {
    console.error("Error generating variable product import template:", err);
    res.status(500).json({ error: "Failed to generate template." });
  }
});

async function parseImportWorkbook(fileName: string | undefined, base64: string): Promise<any[]> {
  const exceljsModule: any = await import("exceljs");
  const ExcelJS = exceljsModule.default ?? exceljsModule;
  const buffer = Buffer.from(base64, "base64");
  const workbook = new ExcelJS.Workbook();
  if (fileName && fileName.toLowerCase().endsWith(".csv")) {
    await workbook.csv.read(Readable.from([buffer]));
  } else {
    await workbook.xlsx.load(buffer);
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell: any, col: number) => {
    headers[col - 1] = String(cell?.value ?? "").trim();
  });
  const rows: any[] = [];
  sheet.eachRow((row: any, rowNumber: number) => {
    if (rowNumber === 1) return;
    const record: any = {};
    row.eachCell((cell: any, col: number) => {
      const h = headers[col - 1];
      if (h) record[h] = cell?.value ?? "";
    });
    if (Object.keys(record).some((k) => String(record[k] ?? "").trim() !== "")) rows.push(record);
  });
  return rows;
}

function importStatus(value: string): string {
  const v = String(value || "").trim();
  if (v === "Inactive" || v === "inactive") return "Inactive";
  return "Active";
}

// Import from an uploaded spreadsheet (base64 JSON body) or a structured array.
router.post("/api/pm/products/import", async (req, res) => {
  try {
    const incoming = req.body;

    if (Array.isArray(incoming)) {
      return handleArrayImport(incoming, res);
    }

    const fileName = String(incoming?.fileName || "");
    const base64 = String(incoming?.base64 || "");
    if (!base64) {
      return res.status(400).json({ error: "Expected an uploaded file payload." });
    }
    const rows = await parseImportWorkbook(fileName, base64);
    return handleImportRows(rows, res);
  } catch (err: any) {
    console.error("Error importing products:", err);
    res.status(500).json({ error: "Failed to import products." });
  }
});

async function handleArrayImport(incoming: any[], res: any): Promise<void> {
  const [groups, uoms, brands] = await Promise.all([getProductGroups(), getUoms(), getBrands()]);
  const subUnits = await getSubUnits();
  const groupByCode = new Map(groups.map((g: any) => [String(g.code).toUpperCase(), g]));
  const groupByName = new Map(groups.map((g: any) => [String(g.name).toLowerCase(), g]));
  const uomByCode = new Map(uoms.map((u: any) => [String(u.code).toUpperCase(), u]));
  const uomByName = new Map(uoms.map((u: any) => [String(u.name).toLowerCase(), u]));
  const subUnitByShortName = new Map(subUnits.map((s: any) => [String(s.short_name).toUpperCase(), s]));
  const subUnitByName = new Map(subUnits.map((s: any) => [String(s.name).toLowerCase(), s]));
  const brandByCode = new Map(brands.map((b: any) => [String(b.code).toUpperCase(), b]));
  const brandByName = new Map(brands.map((b: any) => [String(b.name).toLowerCase(), b]));

  let imported = 0;
  for (const row of incoming) {
    try {
      const code = String(row.code || row["Code"] || row["Product Code"] || "").trim().toUpperCase();
      const name = String(row.name || row["Name"] || row["Product Name"] || "").trim();
      if (!code || !name) {
        continue;
      }
      const groupRef = String(row.product_group_code || row["Group Code"] || row.product_group_name || row["Group"] || "").trim();
      const group = groupByCode.get(groupRef.toUpperCase()) || groupByName.get(groupRef.toLowerCase());
      if (!group) continue;

      const uomRef = String(row.uom_code || row.uom_name || row["UoM"] || row["Unit"] || "").trim();
      const uom = uomRef ? uomByCode.get(uomRef.toUpperCase()) || uomByName.get(uomRef.toLowerCase()) : null;
      const subRef = String(row.sub_unit_id || row.sub_unit_name || row.sub_unit_code || row["Sub Unit"] || "").trim();
      const subUnit = subRef
        ? subUnitByShortName.get(subRef.toUpperCase()) || subUnitByName.get(subRef.toLowerCase())
        : null;
      const brandRef = String(row.brand_code || row.brand_name || row["Brand"] || "").trim();
      const brand = brandRef ? brandByCode.get(brandRef.toUpperCase()) || brandByName.get(brandRef.toLowerCase()) : null;

      const productType = PRODUCT_TYPES.includes(String(row.product_type || "single").toLowerCase())
        ? String(row.product_type).toLowerCase()
        : "single";
      const existing = await getProductByCode(code);
      const now = nowIso();

      const product = {
        id: existing ? existing.id : newId("prod"),
        product_group_id: String(group.id),
        brand_id: brand ? String(brand.id) : existing?.brand_id ?? null,
        uom_id: uom ? String(uom.id) : existing?.uom_id ?? null,
        sub_unit_id: subUnit && uom && String(subUnit.parent_uom_id) === String(uom.id) ? String(subUnit.id) : existing?.sub_unit_id ?? null,
        code,
        name,
        product_type: productType,
        is_variable: productType === "variation",
        purchase_price: productType === "variation" ? null : num(row.purchase_price, existing?.purchase_price ?? null),
        sub_unit_purchase_price: productType === "variation" ? null : num(row.sub_unit_purchase_price, existing?.sub_unit_purchase_price ?? null),
        image_url: existing?.image_url ?? null,
        description: String(row.description || row["Description"] || "").trim(),
        status: importStatus(row.status || existing?.status),
        created_at: existing ? existing.created_at : now,
        updated_at: now,
      };
      await upsertProduct(product);

      if (productType !== "variation") {
        const existingVariants = await getVariants({ productId: product.id });
        const primary =
          existingVariants.find((v: any) => !(v.variation_value_ids ?? []).length) || existingVariants[0] || null;
        const variantSku = String(row.sku || row["SKU"] || "").toUpperCase() || primary?.sku || `${product.code}-001`;
        try {
          await upsertVariant({
            id: primary?.id ?? newId("var"),
            product_id: product.id,
            sku: variantSku,
            name,
            description: String(row.description || row["Description"] || "").trim(),
            variation_value_ids: [],
            sub_unit_id: product.sub_unit_id,
            purchase_price: num(row.purchase_price),
            sub_unit_purchase_price: num(row.sub_unit_purchase_price),
            image_url: null,
            is_active: true,
            status: product.status || "Active",
            created_at: primary?.created_at ?? now,
            updated_at: now,
          });
        } catch (err: any) {
          const errors = res.locals?.errors ?? [];
          errors.push(`${name}: failed to sync default variant (${err?.message}).`);
          res.locals.errors = errors;
        }
      }

      imported += 1;
    } catch (err: any) {
      // skip malformed rows
      const errors = res.locals?.errors ?? [];
      errors.push(`${String(row?.name || row?.code || "").trim()}: ${err?.message || "malformed row"}.`);
      res.locals.errors = errors;
    }
  }
  res.json({ success: true, imported, skipped: incoming.length - imported, errors: res.locals?.errors ?? [] });
}

async function handleImportRows(rows: any[], res: any): Promise<void> {
  const [groups, uoms, brands, templates] = await Promise.all([
    getProductGroups(),
    getUoms(),
    getBrands(),
    getVariationTemplates(),
  ]);
  const subUnits = await getSubUnits();

  const groupByCode = new Map(groups.map((g: any) => [String(g.code).toUpperCase(), g]));
  const groupByName = new Map(groups.map((g: any) => [String(g.name).toLowerCase(), g]));
  const uomByCode = new Map(uoms.map((u: any) => [String(u.code).toUpperCase(), u]));
  const uomByName = new Map(uoms.map((u: any) => [String(u.name).toLowerCase(), u]));
  const subUnitByShortName = new Map(subUnits.map((s: any) => [String(s.short_name).toUpperCase(), s]));
  const subUnitByName = new Map(subUnits.map((s: any) => [String(s.name).toLowerCase(), s]));
  const brandByCode = new Map(brands.map((b: any) => [String(b.code).toUpperCase(), b]));
  const brandByName = new Map(brands.map((b: any) => [String(b.name).toLowerCase(), b]));
  const templateByName = new Map(templates.map((t: any) => [String(t.name).toLowerCase(), t]));
  const valuesByTemplate = new Map<string, Map<string, string>>();
  for (const t of templates) {
    const values = await getVariationTemplateValues(t.id);
    const byName = new Map<string, string>();
    for (const v of values) byName.set(String(v.name).toLowerCase(), String(v.id));
    valuesByTemplate.set(String(t.id), byName);
  }

  const parentRows: any[] = [];
  const variationsByParent = new Map<string, any[]>();
  for (const row of rows) {
    const parentSku = cv(row, "parent_sku").toUpperCase();
    if (parentSku) {
      const list = variationsByParent.get(parentSku) || [];
      list.push(row);
      variationsByParent.set(parentSku, list);
    } else {
      parentRows.push(row);
    }
  }

  const usedCodes = new Set<string>();
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const note = (msg: string) => {
    if (errors.length < 25) errors.push(msg);
  };

  for (const row of parentRows) {
    try {
      const name = cv(row, "name");
      if (!name) {
        skipped += 1;
        note("Row skipped: missing Name.");
        continue;
      }

      const rawCode = cv(row, "sku");
      let code = rawCode ? rawCode.toUpperCase() : autoProductCode(name);
      while (usedCodes.has(code) || (await getProductByCode(code))) {
        code = code && /-/.test(code) ? `${code}-${randomCode()}` : autoProductCode(name);
      }
      usedCodes.add(code);

      const groupRef = cv(row, "product_group") || cv(row, "group") || cv(row, "category");
      const group = groupByCode.get(groupRef.toUpperCase()) || groupByName.get(groupRef.toLowerCase());
      if (!group) {
        skipped += 1;
        note(`${name}: product group "${groupRef || "(blank)"}" was not found.`);
        continue;
      }

      const uomRef = cv(row, "unit") || cv(row, "uom");
      const uom = uomRef ? uomByCode.get(uomRef.toUpperCase()) || uomByName.get(uomRef.toLowerCase()) : null;
      const subRef = cv(row, "sub_unit") || cv(row, "sub unit");
      const subUnit = subRef
        ? subUnitByShortName.get(subRef.toUpperCase()) || subUnitByName.get(subRef.toLowerCase())
        : null;
      const brandRef = cv(row, "brand");
      const brand = brandRef ? brandByCode.get(brandRef.toUpperCase()) || brandByName.get(brandRef.toLowerCase()) : null;

      const rawType = cv(row, "type").toLowerCase();
      const productType = PRODUCT_TYPES.includes(rawType) ? rawType : "single";
      const existing = await getProductByCode(code);
      const now = nowIso();

      const product = {
        id: existing ? existing.id : newId("prod"),
        product_group_id: String(group.id),
        brand_id: brand ? String(brand.id) : existing?.brand_id ?? null,
        uom_id: uom ? String(uom.id) : existing?.uom_id ?? null,
        sub_unit_id:
          subUnit && uom && String(subUnit.parent_uom_id) === String(uom.id) ? String(subUnit.id) : existing?.sub_unit_id ?? null,
        code,
        name,
        product_type: productType,
        is_variable: productType === "variation",
        purchase_price: productType === "variation" ? null : num(cv(row, "purchase_price"), existing?.purchase_price ?? null),
        sub_unit_purchase_price: productType === "variation" ? null : num(cv(row, "sub_unit_purchase_price"), existing?.sub_unit_purchase_price ?? null),
        image_url: existing?.image_url ?? null,
        description: cv(row, "description"),
        status: importStatus(cv(row, "status") || existing?.status || "Active"),
        created_at: existing ? existing.created_at : now,
        updated_at: now,
      };
      await upsertProduct(product);

      if (productType !== "variation") {
        const existingVariants = await getVariants({ productId: product.id });
        const primary =
          existingVariants.find((v: any) => !(v.variation_value_ids ?? []).length) || existingVariants[0] || null;
        const variantSku = cv(row, "sku") || primary?.sku || `${product.code}-001`;
        try {
          await upsertVariant({
            id: primary?.id ?? newId("var"),
            product_id: product.id,
            sku: variantSku,
            name,
            description: cv(row, "description"),
            variation_value_ids: [],
            sub_unit_id: product.sub_unit_id,
            purchase_price: num(cv(row, "purchase_price")),
            sub_unit_purchase_price: num(cv(row, "sub_unit_purchase_price")),
            image_url: null,
            is_active: true,
            status: product.status || "Active",
            created_at: primary?.created_at ?? now,
            updated_at: now,
          });
        } catch (err: any) {
          note(`${name}: failed to sync default variant (${err?.message}).`);
        }
      }

      if (productType === "variation") {
        const tplNames = cvList(row, "variation_templates");
        const templateIds: string[] = [];
        for (const tn of tplNames) {
          const t = templateByName.get(tn.toLowerCase());
          if (t && !templateIds.includes(String(t.id))) templateIds.push(String(t.id));
        }
        if (templateIds.length === 0) {
          skipped += 1;
          note(`${name}: no matching variation templates found for "${cvList(row, "variation_templates").join("|")}".`);
          continue;
        }

        const varRows = variationsByParent.get(code) || [];
        const variations: any[] = [];
        const usedVariantSku = new Set<string>();
        for (const [idx, varRow] of varRows.entries()) {
          const rawValues = cvList(varRow, "variation_values");
          const valueIds: string[] = [];
          let valid = rawValues.length === templateIds.length;
          templateIds.forEach((tplId, i) => {
            const byName = valuesByTemplate.get(tplId);
            const matched = byName?.get(String(rawValues[i] || "").toLowerCase());
            if (matched) valueIds.push(matched);
            else valid = false;
          });
          if (!valid) {
            note(`${code}: variation row "${rawValues.join("|")}" did not match existing template values.`);
            continue;
          }

          const labels = rawValues.map((v) => v.trim());
          const varSkuRaw = cv(varRow, "variation_sku");
          let varSku = varSkuRaw ? varSkuRaw.toUpperCase() : "";
          if (!varSku) {
            const base = `${code}-`;
            let n = idx + 1;
            while (usedVariantSku.has(`${base}${String(n).padStart(3, "0")}`)) n += 1;
            varSku = `${base}${String(n).padStart(3, "0")}`;
          }
          usedVariantSku.add(varSku);
          const varSubRef = cv(varRow, "variation_sub_unit") || cv(varRow, "sub_unit");
          const varSub = varSubRef
            ? subUnitByShortName.get(varSubRef.toUpperCase()) || subUnitByName.get(varSubRef.toLowerCase())
            : null;

          variations.push({
            sku: varSku,
            name: cv(varRow, "variation_name") || labels.join("-"),
            variation_value_ids: valueIds,
            sub_unit_id: varSub && uom && String(varSub.parent_uom_id) === String(uom.id) ? String(varSub.id) : null,
            is_active: cvBool(cv(varRow, "variation_is_active"), true),
          });
        }

        await setProductVariationTemplates(product.id, templateIds);
        await syncVariants(product.id, variations, product.code);
      }

      imported += 1;
    } catch (err: any) {
      skipped += 1;
      note(`${cv(row, "name") || cv(row, "sku") || "row"}: ${err?.message || "unexpected error"}.`);
    }
  }

  for (const [parentSku, list] of variationsByParent) {
    if (!usedCodes.has(parentSku) && !(await getProductByCode(parentSku))) {
      skipped += list.length;
      note(`${parentSku}: parent product for ${list.length} variation row(s) was not imported.`);
    }
  }

  res.json({ success: true, imported, skipped, errors });
}

// ─── Variants ───

router.get("/api/pm/variants", async (req, res) => {
  try {
    const { productId, search, status } = req.query;
    const variants = await getVariants({
      productId: String(productId || ""),
      search: String(search || ""),
      status: String(status || ""),
    });
    res.json(variants);
  } catch (err: any) {
    console.error("Error fetching variants:", err);
    res.status(500).json({ error: "Failed to fetch variants." });
  }
});

router.get("/api/pm/variants/:id", async (req, res) => {
  try {
    const variant = await getVariantById(req.params.id);
    if (!variant) return res.status(404).json({ error: "Variant not found." });
    variant.uoms = await getVariantUoms(req.params.id);
    res.json(variant);
  } catch (err: any) {
    console.error("Error fetching variant:", err);
    res.status(500).json({ error: "Failed to fetch variant." });
  }
});

router.post("/api/pm/variants", async (req, res) => {
  try {
    const input = req.body;
    if (!input.name || !input.product_id) {
      return res.status(400).json({ error: "Name and product are required." });
    }
    const product = await getProductById(String(input.product_id));
    const prefix = (product?.code ?? "VAR").toUpperCase();
    let sku = input.sku ? String(input.sku).trim() : "";
    if (!sku) {
      const existing = await getVariants({ productId: String(input.product_id) });
      let max = 0;
      for (const v of existing) {
        if (v.sku.startsWith(`${prefix}-`)) {
          const n = parseInt(v.sku.slice(prefix.length + 1), 10);
          if (!Number.isNaN(n)) max = Math.max(max, n);
        }
      }
      sku = `${prefix}-${String(max + 1).padStart(3, "0")}`;
    }
    const variant = {
      id: newId("var"),
      product_id: String(input.product_id),
      sku,
      name: String(input.name).trim(),
      description: cleanText(input, "description"),
      variation_value_ids: input.variation_value_ids,
      sub_unit_id: input.sub_unit_id ? String(input.sub_unit_id) : null,
      purchase_price: num(input.purchase_price),
      sub_unit_purchase_price: num(input.sub_unit_purchase_price),
      image_url: input.image_url ? String(input.image_url) : null,
      is_active: coerceBoolInput(input.is_active, true),
      status: statusValue(input.status),
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await upsertVariant(variant);
    res.status(201).json(variant);
  } catch (err: any) {
    console.error("Error creating variant:", err);
    res.status(500).json({ error: "Failed to create variant." });
  }
});

router.put("/api/pm/variants/:id", async (req, res) => {
  try {
    const existing = await getVariantById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Variant not found." });
    const input = req.body;
    const updated = {
      ...existing,
      product_id: input.product_id !== undefined ? String(input.product_id) : existing.product_id,
      sku: input.sku !== undefined ? String(input.sku).trim() : existing.sku,
      name: input.name !== undefined ? String(input.name).trim() : existing.name,
      description: input.description !== undefined ? cleanText(input, "description") : existing.description,
      variation_value_ids: input.variation_value_ids !== undefined ? input.variation_value_ids : existing.variation_value_ids,
      sub_unit_id: input.sub_unit_id !== undefined ? (input.sub_unit_id ? String(input.sub_unit_id) : null) : existing.sub_unit_id,
      purchase_price: input.purchase_price !== undefined ? num(input.purchase_price) : existing.purchase_price,
      sub_unit_purchase_price: input.sub_unit_purchase_price !== undefined ? num(input.sub_unit_purchase_price) : existing.sub_unit_purchase_price,
      image_url: input.image_url !== undefined ? (input.image_url ? String(input.image_url) : null) : existing.image_url,
      is_active: input.is_active !== undefined ? coerceBoolInput(input.is_active, true) : existing.is_active,
      status: input.status !== undefined ? statusValue(input.status, existing.status) : existing.status,
      updated_at: nowIso(),
    };
    await upsertVariant(updated);
    res.json(updated);
  } catch (err: any) {
    console.error("Error updating variant:", err);
    res.status(500).json({ error: "Failed to update variant." });
  }
});

router.delete("/api/pm/variants/:id", async (req, res) => {
  try {
    const deleted = await deleteVariant(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Variant not found." });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting variant:", err);
    res.status(500).json({ error: "Failed to delete variant." });
  }
});

// ─── Standards ───

router.get("/api/pm/standards", async (_req, res) => {
  try {
    res.json(await getStandards());
  } catch (err: any) {
    console.error("Error fetching standards:", err);
    res.status(500).json({ error: "Failed to fetch standards." });
  }
});

router.get("/api/pm/standards/:id", async (req, res) => {
  try {
    const standard = await getStandardById(req.params.id);
    if (!standard) return res.status(404).json({ error: "Standard not found." });
    standard.items = await getStandardItems(req.params.id);
    res.json(standard);
  } catch (err: any) {
    console.error("Error fetching standard:", err);
    res.status(500).json({ error: "Failed to fetch standard." });
  }
});

router.post("/api/pm/standards", async (req, res) => {
  try {
    const input = req.body;
    if (!input.code || !input.name || !input.product_group_id) {
      return res.status(400).json({ error: "Code, name, and product group are required." });
    }
    const standard = {
      id: newId("std"),
      product_group_id: String(input.product_group_id),
      code: String(input.code).toUpperCase().trim(),
      name: String(input.name).trim(),
      description: cleanText(input, "description"),
      status: statusValue(input.status),
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await upsertStandard(standard);
    res.status(201).json(standard);
  } catch (err: any) {
    console.error("Error creating standard:", err);
    res.status(500).json({ error: "Failed to create standard." });
  }
});

router.put("/api/pm/standards/:id", async (req, res) => {
  try {
    const existing = await getStandardById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Standard not found." });
    const input = req.body;
    const updated = {
      ...existing,
      product_group_id: input.product_group_id !== undefined ? String(input.product_group_id) : existing.product_group_id,
      code: input.code !== undefined ? String(input.code).toUpperCase().trim() : existing.code,
      name: input.name !== undefined ? String(input.name).trim() : existing.name,
      description: input.description !== undefined ? cleanText(input, "description") : existing.description,
      status: input.status !== undefined ? statusValue(input.status, existing.status) : existing.status,
      updated_at: nowIso(),
    };
    await upsertStandard(updated);
    res.json(updated);
  } catch (err: any) {
    console.error("Error updating standard:", err);
    res.status(500).json({ error: "Failed to update standard." });
  }
});

router.delete("/api/pm/standards/:id", async (req, res) => {
  try {
    const deleted = await deleteStandard(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Standard not found." });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting standard:", err);
    res.status(500).json({ error: "Failed to delete standard." });
  }
});

// ─── Standard Items ───

router.post("/api/pm/standard-items", async (req, res) => {
  try {
    const input = req.body;
    if (!input.product_standard_id || !input.product_variant_id) {
      return res.status(400).json({ error: "Standard and variant are required." });
    }
    const item = {
      id: newId("sitem"),
      product_standard_id: String(input.product_standard_id),
      product_variant_id: String(input.product_variant_id),
      is_preferred: coerceBool(input.is_preferred),
      effective_from: input.effective_from || null,
      effective_to: input.effective_to || null,
      status: statusValue(input.status),
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await upsertStandardItem(item);
    res.status(201).json(item);
  } catch (err: any) {
    console.error("Error creating standard item:", err);
    res.status(500).json({ error: "Failed to create standard item." });
  }
});

router.delete("/api/pm/standard-items/:id", async (req, res) => {
  try {
    const deleted = await deleteStandardItem(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Standard item not found." });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting standard item:", err);
    res.status(500).json({ error: "Failed to delete standard item." });
  }
});

// ─── Variant UoMs ───

router.get("/api/pm/variant-uoms", async (req, res) => {
  try {
    const variantId = String(req.query.variant_id || "");
    if (!variantId) return res.status(400).json({ error: "variant_id is required." });
    res.json(await getVariantUoms(variantId));
  } catch (err: any) {
    console.error("Error fetching variant UoMs:", err);
    res.status(500).json({ error: "Failed to fetch variant UoMs." });
  }
});

router.post("/api/pm/variant-uoms", async (req, res) => {
  try {
    const input = req.body;
    if (!input.product_variant_id || !input.uom_id) {
      return res.status(400).json({ error: "Variant and UoM are required." });
    }
    const item = {
      id: newId("vuom"),
      product_variant_id: String(input.product_variant_id),
      uom_id: String(input.uom_id),
      conversion_factor: input.conversion_factor !== undefined && input.conversion_factor !== "" ? Number(input.conversion_factor) : 1,
      is_base: coerceBool(input.is_base),
      status: statusValue(input.status),
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await upsertVariantUom(item);
    res.status(201).json(item);
  } catch (err: any) {
    console.error("Error creating variant UoM:", err);
    res.status(500).json({ error: "Failed to create variant UoM." });
  }
});

router.put("/api/pm/variant-uoms/:id", async (req, res) => {
  try {
    const existing = await getVariantUomById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Variant UoM not found." });
    const input = req.body;
    const updated = {
      ...existing,
      uom_id: input.uom_id !== undefined ? String(input.uom_id) : existing.uom_id,
      conversion_factor: input.conversion_factor !== undefined && input.conversion_factor !== "" ? Number(input.conversion_factor) : existing.conversion_factor,
      is_base: input.is_base !== undefined ? coerceBool(input.is_base) : coerceBool(existing.is_base),
      status: input.status !== undefined ? statusValue(input.status, existing.status) : existing.status,
      updated_at: nowIso(),
    };
    await upsertVariantUom(updated);
    res.json(updated);
  } catch (err: any) {
    console.error("Error updating variant UoM:", err);
    res.status(500).json({ error: "Failed to update variant UoM." });
  }
});

router.delete("/api/pm/variant-uoms/:id", async (req, res) => {
  try {
    const deleted = await deleteVariantUom(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Variant UoM not found." });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting variant UoM:", err);
    res.status(500).json({ error: "Failed to delete variant UoM." });
  }
});

// ─── Variation Templates ───

router.get("/api/pm/variation-templates", async (req, res) => {
  try {
    const search = String(req.query.search || "");
    const templates = await getVariationTemplates(search || undefined);
    const values = await Promise.all(templates.map((t) => getVariationTemplateValues(t.id)));
    const rows = templates.map((t, i) => ({ ...t, values: values[i] }));
    res.json(rows);
  } catch (err: any) {
    console.error("Error fetching variation templates:", err);
    res.status(500).json({ error: "Failed to fetch variation templates." });
  }
});

router.get("/api/pm/variation-templates/:id", async (req, res) => {
  try {
    const template = await getVariationTemplateById(req.params.id);
    if (!template) return res.status(404).json({ error: "Variation template not found." });
    template.values = await getVariationTemplateValues(req.params.id);
    res.json(template);
  } catch (err: any) {
    console.error("Error fetching variation template:", err);
    res.status(500).json({ error: "Failed to fetch variation template." });
  }
});

router.post("/api/pm/variation-templates", async (req, res) => {
  try {
    const input = req.body;
    const name = String(input.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "Template name is required." });
    }
    if (name.length > 150) {
      return res.status(400).json({ error: "Template name is too long (max 150 characters)." });
    }
    const values = Array.isArray(input.values) ? input.values : [];
    if (values.length === 0) {
      return res.status(400).json({ error: "Add at least one value." });
    }
    const seenValueNames = new Set<string>();
    for (const v of values) {
      const vName = String(v.name || "").trim();
      if (!vName) {
        return res.status(400).json({ error: "Each variation value needs a name." });
      }
      if (vName.length > 150) {
        return res.status(400).json({ error: "Variation value name is too long (max 150 characters)." });
      }
      const valueKey = vName.toLowerCase();
      if (seenValueNames.has(valueKey)) {
        return res.status(400).json({ error: `Variation value "${vName}" cannot be duplicated in a template.` });
      }
      seenValueNames.add(valueKey);
      if (v.sort_order !== undefined && v.sort_order !== "" && !(Number.isInteger(Number(v.sort_order)) && Number(v.sort_order) >= 0 && Number(v.sort_order) <= 65535)) {
        return res.status(400).json({ error: "Sort order must be a whole number between 0 and 65535." });
      }
    }
    const now = nowIso();
    const template = {
      id: newId("vtpl"),
      name,
      status: statusValue(input.status),
      created_at: now,
      updated_at: now,
    };
    await upsertVariationTemplate(template);
    const createdValues: any[] = [];
    for (const [index, v] of values.entries()) {
      const value = {
        id: newId("vtpv"),
        variation_template_id: template.id,
        name: String(v.name).trim(),
        sort_order: v.sort_order !== undefined && v.sort_order !== "" ? Number(v.sort_order) : (index + 1) * 10,
        created_at: now,
        updated_at: now,
      };
      await upsertVariationTemplateValue(value);
      createdValues.push(value);
    }
    res.status(201).json({ ...template, values: createdValues, value_count: createdValues.length });
  } catch (err: any) {
    console.error("Error creating variation template:", err);
    res.status(500).json({ error: "Failed to create variation template." });
  }
});

router.put("/api/pm/variation-templates/:id", async (req, res) => {
  try {
    const existing = await getVariationTemplateById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Variation template not found." });
    const input = req.body;
    const name = input.name !== undefined ? String(input.name).trim() : existing.name;
    if (!name) {
      return res.status(400).json({ error: "Template name is required." });
    }
    if (name.length > 150) {
      return res.status(400).json({ error: "Template name is too long (max 150 characters)." });
    }
    const values = Array.isArray(input.values) ? input.values : [];
    if (values.length === 0) {
      return res.status(400).json({ error: "Add at least one value." });
    }
    const seenValueNames = new Set<string>();
    for (const v of values) {
      const vName = String(v.name || "").trim();
      if (!vName) {
        return res.status(400).json({ error: "Each variation value needs a name." });
      }
      if (vName.length > 150) {
        return res.status(400).json({ error: "Variation value name is too long (max 150 characters)." });
      }
      const valueKey = vName.toLowerCase();
      if (seenValueNames.has(valueKey)) {
        return res.status(400).json({ error: `Variation value "${vName}" cannot be duplicated in a template.` });
      }
      seenValueNames.add(valueKey);
      if (v.sort_order !== undefined && v.sort_order !== "" && !(Number.isInteger(Number(v.sort_order)) && Number(v.sort_order) >= 0 && Number(v.sort_order) <= 65535)) {
        return res.status(400).json({ error: "Sort order must be a whole number between 0 and 65535." });
      }
    }
    const updated = {
      ...existing,
      name,
      status: input.status !== undefined ? statusValue(input.status, existing.status) : existing.status,
      updated_at: nowIso(),
    };
    await upsertVariationTemplate(updated);

    const existingValues = await getVariationTemplateValues(req.params.id);
    const existingById = new Map(existingValues.map((v) => [v.id, v]));
    const seenIds: string[] = [];
    for (const [index, v] of values.entries()) {
      const sortOrder = v.sort_order !== undefined && v.sort_order !== "" ? Number(v.sort_order) : (index + 1) * 10;
      if (v.id && existingById.has(String(v.id))) {
        const prior = existingById.get(String(v.id));
        await upsertVariationTemplateValue({
          ...prior,
          name: String(v.name).trim(),
          sort_order: sortOrder,
          updated_at: nowIso(),
        });
        seenIds.push(String(v.id));
      } else {
        const value = {
          id: newId("vtpv"),
          variation_template_id: req.params.id,
          name: String(v.name).trim(),
          sort_order: sortOrder,
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        await upsertVariationTemplateValue(value);
        seenIds.push(value.id);
      }
    }
    await deleteVariationTemplateValues(req.params.id, seenIds);

    const finalValues = await getVariationTemplateValues(req.params.id);
    res.json({ ...updated, values: finalValues, value_count: finalValues.length });
  } catch (err: any) {
    console.error("Error updating variation template:", err);
    res.status(500).json({ error: "Failed to update variation template." });
  }
});

router.delete("/api/pm/variation-templates/:id", async (req, res) => {
  try {
    const [productCount, valueUsage] = await Promise.all([
      hasTemplateProducts(req.params.id),
      hasTemplateValueUsage(req.params.id),
    ]);
    if (productCount > 0 || valueUsage > 0) {
      return res.status(409).json({
        error: "Cannot delete a variation template that is assigned to products or used by variants.",
      });
    }
    const deleted = await deleteVariationTemplate(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Variation template not found." });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting variation template:", err);
    res.status(500).json({ error: "Failed to delete variation template." });
  }
});

export default router;