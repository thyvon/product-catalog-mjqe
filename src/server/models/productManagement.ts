import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool, isDbReady, assertDb } from "../db.js";

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function coerceBool(value: any, fallback = false): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  return value !== 0 && value !== "0" && value !== "false";
}

// ─── Categories ───

export async function getCategories(): Promise<any[]> {
  const p = getPool();
  if (!p || !isDbReady()) return [];
  const [rows] = await p.query<RowDataPacket[]>(
    "SELECT * FROM pm_categories ORDER BY sort_order ASC, name ASC"
  );
  return rows;
}

export async function getCategoryById(id: string): Promise<any | null> {
  const p = getPool();
  if (!p || !isDbReady()) return null;
  const [rows] = await p.execute<RowDataPacket[]>("SELECT * FROM pm_categories WHERE id = ?", [id]);
  return rows[0] || null;
}

export async function upsertCategory(category: any): Promise<void> {
  assertDb();
  const p = getPool()!;
  await p.execute(
    `INSERT INTO pm_categories (id, parent_id, code, name, description, sort_order, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       parent_id = VALUES(parent_id),
       code = VALUES(code),
       name = VALUES(name),
       description = VALUES(description),
       sort_order = VALUES(sort_order),
       status = VALUES(status),
       updated_at = VALUES(updated_at)`,
    [
      category.id,
      category.parent_id || null,
      category.code,
      category.name,
      category.description || "",
      category.sort_order ?? 0,
      category.status || "Active",
      category.created_at,
      category.updated_at,
    ]
  );
}

export async function deleteCategory(id: string): Promise<boolean> {
  assertDb();
  const p = getPool()!;
  const [result] = await p.execute<ResultSetHeader>("DELETE FROM pm_categories WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

export async function hasCategoryChildren(id: string): Promise<number> {
  const p = getPool();
  if (!p || !isDbReady()) return 0;
  const [rows] = await p.execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM pm_categories WHERE parent_id = ?",
    [id]
  );
  return Number((rows[0] as any).total);
}

export async function hasCategoryGroups(id: string): Promise<number> {
  const p = getPool();
  if (!p || !isDbReady()) return 0;
  const [rows] = await p.execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM pm_product_groups WHERE category_id = ?",
    [id]
  );
  return Number((rows[0] as any).total);
}

// ─── Product Groups ───

export async function getProductGroups(): Promise<any[]> {
  const p = getPool();
  if (!p || !isDbReady()) return [];
  const [rows] = await p.query<RowDataPacket[]>(
    `SELECT g.*, c.name AS category_name, c.code AS category_code
     FROM pm_product_groups g
     LEFT JOIN pm_categories c ON c.id = g.category_id
     ORDER BY g.name ASC`
  );
  return rows;
}

export async function getProductGroupById(id: string): Promise<any | null> {
  const p = getPool();
  if (!p || !isDbReady()) return null;
  const [rows] = await p.execute<RowDataPacket[]>(
    `SELECT g.*, c.name AS category_name, c.code AS category_code
     FROM pm_product_groups g
     LEFT JOIN pm_categories c ON c.id = g.category_id
     WHERE g.id = ?`,
    [id]
  );
  return rows[0] || null;
}

export async function upsertProductGroup(group: any): Promise<void> {
  assertDb();
  const p = getPool()!;
  await p.execute(
    `INSERT INTO pm_product_groups (id, category_id, code, name, description, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       category_id = VALUES(category_id),
       code = VALUES(code),
       name = VALUES(name),
       description = VALUES(description),
       status = VALUES(status),
       updated_at = VALUES(updated_at)`,
    [
      group.id,
      group.category_id,
      group.code,
      group.name,
      group.description || "",
      group.status || "Active",
      group.created_at,
      group.updated_at,
    ]
  );
}

export async function deleteProductGroup(id: string): Promise<boolean> {
  assertDb();
  const p = getPool()!;
  const [result] = await p.execute<ResultSetHeader>("DELETE FROM pm_product_groups WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

export async function hasGroupProducts(id: string): Promise<number> {
  const p = getPool();
  if (!p || !isDbReady()) return 0;
  const [rows] = await p.execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM pm_products WHERE product_group_id = ?",
    [id]
  );
  return Number((rows[0] as any).total);
}

// ─── Brands ───

export async function getBrands(): Promise<any[]> {
  const p = getPool();
  if (!p || !isDbReady()) return [];
  const [rows] = await p.query<RowDataPacket[]>("SELECT * FROM pm_brands ORDER BY name ASC");
  return rows;
}

export async function getBrandById(id: string): Promise<any | null> {
  const p = getPool();
  if (!p || !isDbReady()) return null;
  const [rows] = await p.execute<RowDataPacket[]>("SELECT * FROM pm_brands WHERE id = ?", [id]);
  return rows[0] || null;
}

export async function upsertBrand(brand: any): Promise<void> {
  assertDb();
  const p = getPool()!;
  await p.execute(
    `INSERT INTO pm_brands (id, code, name, description, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       code = VALUES(code),
       name = VALUES(name),
       description = VALUES(description),
       status = VALUES(status),
       updated_at = VALUES(updated_at)`,
    [
      brand.id,
      brand.code,
      brand.name,
      brand.description || "",
      brand.status || "Active",
      brand.created_at,
      brand.updated_at,
    ]
  );
}

export async function deleteBrand(id: string): Promise<boolean> {
  assertDb();
  const p = getPool()!;
  const [result] = await p.execute<ResultSetHeader>("DELETE FROM pm_brands WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

export async function hasBrandProducts(id: string): Promise<number> {
  const p = getPool();
  if (!p || !isDbReady()) return 0;
  const [rows] = await p.execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM pm_products WHERE brand_id = ?",
    [id]
  );
  return Number((rows[0] as any).total);
}

// ─── UoMs ───

export async function getUoms(): Promise<any[]> {
  const p = getPool();
  if (!p || !isDbReady()) return [];
  const [rows] = await p.query<RowDataPacket[]>("SELECT * FROM pm_uoms ORDER BY name ASC");
  return rows;
}

export async function getUomById(id: string): Promise<any | null> {
  const p = getPool();
  if (!p || !isDbReady()) return null;
  const [rows] = await p.execute<RowDataPacket[]>("SELECT * FROM pm_uoms WHERE id = ?", [id]);
  return rows[0] || null;
}

export async function upsertUom(uom: any): Promise<void> {
  assertDb();
  const p = getPool()!;
  await p.execute(
    `INSERT INTO pm_uoms (id, code, name, type, decimal_places, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       code = VALUES(code),
       name = VALUES(name),
       type = VALUES(type),
       decimal_places = VALUES(decimal_places),
       status = VALUES(status),
       updated_at = VALUES(updated_at)`,
    [
      uom.id,
      uom.code,
      uom.name,
      uom.type || "unit",
      uom.decimal_places ?? 0,
      uom.status || "Active",
      uom.created_at,
      uom.updated_at,
    ]
  );
}

export async function deleteUom(id: string): Promise<boolean> {
  assertDb();
  const p = getPool()!;
  const [result] = await p.execute<ResultSetHeader>("DELETE FROM pm_uoms WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

export async function hasVariantUoms(id: string): Promise<number> {
  const p = getPool();
  if (!p || !isDbReady()) return 0;
  const [rows] = await p.execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM pm_product_variant_uoms WHERE uom_id = ?",
    [id]
  );
  return Number((rows[0] as any).total);
}

export async function hasUomProducts(id: string): Promise<number> {
  const p = getPool();
  if (!p || !isDbReady()) return 0;
  const [rows] = await p.execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM pm_products WHERE uom_id = ?",
    [id]
  );
  return Number((rows[0] as any).total);
}

// ─── Sub Units ───

export async function getSubUnits(uomId?: string): Promise<any[]> {
  const p = getPool();
  if (!p || !isDbReady()) return [];
  if (uomId) {
    const [rows] = await p.execute<RowDataPacket[]>(
      "SELECT * FROM pm_sub_units WHERE parent_uom_id = ? ORDER BY name ASC",
      [uomId]
    );
    return rows;
  }
  const [rows] = await p.query<RowDataPacket[]>("SELECT * FROM pm_sub_units ORDER BY name ASC");
  return rows;
}

export async function getSubUnitById(id: string): Promise<any | null> {
  const p = getPool();
  if (!p || !isDbReady()) return null;
  const [rows] = await p.execute<RowDataPacket[]>("SELECT * FROM pm_sub_units WHERE id = ?", [id]);
  return rows[0] || null;
}

export async function upsertSubUnit(subUnit: any): Promise<void> {
  assertDb();
  const p = getPool()!;
  await p.execute(
    `INSERT INTO pm_sub_units (id, parent_uom_id, name, short_name, conversion_factor, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       parent_uom_id = VALUES(parent_uom_id),
       name = VALUES(name),
       short_name = VALUES(short_name),
       conversion_factor = VALUES(conversion_factor),
       status = VALUES(status),
       updated_at = VALUES(updated_at)`,
    [
      subUnit.id,
      subUnit.parent_uom_id,
      subUnit.name,
      subUnit.short_name,
      subUnit.conversion_factor ?? 1,
      subUnit.status || "Active",
      subUnit.created_at,
      subUnit.updated_at,
    ]
  );
}

export async function deleteSubUnit(id: string): Promise<boolean> {
  assertDb();
  const p = getPool()!;
  const [result] = await p.execute<ResultSetHeader>("DELETE FROM pm_sub_units WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

export async function hasSubUnitProductReferences(id: string): Promise<number> {
  const p = getPool();
  if (!p || !isDbReady()) return 0;
  const [rows] = await p.execute<RowDataPacket[]>(
    `SELECT (SELECT COUNT(*) FROM pm_products WHERE sub_unit_id = ?) +
            (SELECT COUNT(*) FROM pm_product_variants WHERE sub_unit_id = ?) AS total`,
    [id, id]
  );
  return Number((rows[0] as any).total);
}

export async function hasSubUnits(id: string): Promise<number> {
  const p = getPool();
  if (!p || !isDbReady()) return 0;
  const [rows] = await p.execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM pm_sub_units WHERE parent_uom_id = ?",
    [id]
  );
  return Number((rows[0] as any).total);
}

// ─── Products ───

export async function getProductsPaginated(opts: {
  page: number;
  pageSize: number;
  search?: string;
  groupId?: string;
  categoryId?: string;
  assignedCategoryId?: string;
  brandId?: string;
  status?: string;
  type?: string;
  sort?: string;
}): Promise<{ data: any[]; total: number }> {
  const p = getPool();
  if (!p || !isDbReady()) return { data: [], total: 0 };

  const { page, pageSize, search = "", groupId = "", categoryId = "", assignedCategoryId = "", brandId = "", status = "", type = "", sort = "name" } = opts;

  const conditions: string[] = [];
  const params: any[] = [];

  if (search) {
    conditions.push("(p.name LIKE ? OR p.code LIKE ? OR g.name LIKE ? OR b.name LIKE ?)");
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  if (groupId) {
    conditions.push("p.product_group_id = ?");
    params.push(groupId);
  }
  if (categoryId) {
    conditions.push("g.category_id = ?");
    params.push(categoryId);
  }
  if (assignedCategoryId) {
    conditions.push("p.category_id = ?");
    params.push(assignedCategoryId);
  }
  if (brandId) {
    conditions.push("p.brand_id = ?");
    params.push(brandId);
  }
  if (type) {
    conditions.push("p.product_type = ?");
    params.push(type);
  }
  if (status === "active") {
    conditions.push("p.status = 'Active'");
  } else if (status === "inactive") {
    conditions.push("p.status = 'Inactive'");
  }

  const fromSql =
    `FROM pm_products p
     LEFT JOIN pm_product_groups g ON g.id = p.product_group_id
     LEFT JOIN pm_categories c ON c.id = g.category_id
     LEFT JOIN pm_categories oc ON oc.id = p.category_id
     LEFT JOIN pm_brands b ON b.id = p.brand_id
     LEFT JOIN pm_uoms u ON u.id = p.uom_id
     LEFT JOIN pm_sub_units su ON su.id = p.sub_unit_id`;
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const [countRows] = await p.query<RowDataPacket[]>(
    `SELECT COUNT(*) as total ${fromSql} ${where}`,
    params
  );
  const total = Number((countRows[0] as any).total);

  const orderBy =
    sort === "code"
      ? "p.code ASC"
      : sort === "group"
        ? "g.name ASC"
        : sort === "brand"
          ? "b.name ASC"
          : "p.name ASC";

  const selectSql = `SELECT p.*, g.name AS product_group_name, g.code AS product_group_code, c.name AS category_name,
       oc.code AS assigned_category_code, oc.name AS assigned_category_name, b.name AS brand_name,
       u.code AS uom_code, u.name AS uom_name, su.name AS sub_unit_name, su.short_name AS sub_unit_short_name,
       su.conversion_factor AS sub_unit_conversion_factor,
       (SELECT COUNT(*) FROM pm_product_variants v WHERE v.product_id = p.id) AS variant_count
     ${fromSql} ${where} ORDER BY ${orderBy}`;

  let rows: RowDataPacket[];
  if (pageSize === 0) {
    [rows] = await p.query<RowDataPacket[]>(selectSql, params);
  } else {
    const offset = (page - 1) * pageSize;
    [rows] = await p.query<RowDataPacket[]>(`${selectSql} LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
  }

  return { data: rows, total };
}

export async function getProductById(id: string): Promise<any | null> {
  const p = getPool();
  if (!p || !isDbReady()) return null;
  const [rows] = await p.execute<RowDataPacket[]>(
    `SELECT p.*, g.name AS product_group_name, g.code AS product_group_code, c.name AS category_name, b.name AS brand_name,
            u.code AS uom_code, u.name AS uom_name, su.name AS sub_unit_name, su.short_name AS sub_unit_short_name,
            su.conversion_factor AS sub_unit_conversion_factor
     FROM pm_products p
     LEFT JOIN pm_product_groups g ON g.id = p.product_group_id
     LEFT JOIN pm_categories c ON c.id = g.category_id
     LEFT JOIN pm_brands b ON b.id = p.brand_id
     LEFT JOIN pm_uoms u ON u.id = p.uom_id
     LEFT JOIN pm_sub_units su ON su.id = p.sub_unit_id
     WHERE p.id = ?`,
    [id]
  );
  return rows[0] || null;
}

export async function getProductByCode(code: string): Promise<any | null> {
  const p = getPool();
  if (!p || !isDbReady()) return null;
  const [rows] = await p.execute<RowDataPacket[]>(
    "SELECT * FROM pm_products WHERE code = ?",
    [code]
  );
  return rows[0] || null;
}

export async function getProductByName(name: string): Promise<any | null> {
  const p = getPool();
  if (!p || !isDbReady()) return null;
  const [rows] = await p.execute<RowDataPacket[]>(
    "SELECT * FROM pm_products WHERE LOWER(name) = LOWER(?)",
    [name]
  );
  return rows[0] || null;
}

export async function upsertProduct(product: any): Promise<void> {
  assertDb();
  const p = getPool()!;
  await p.execute(
    `INSERT INTO pm_products (id, product_group_id, category_id, brand_id, uom_id, sub_unit_id, code, name, product_type, is_variable,
       purchase_price, sub_unit_purchase_price, image_url, description, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        product_group_id = VALUES(product_group_id),
        category_id = VALUES(category_id),
        brand_id = VALUES(brand_id),
        uom_id = VALUES(uom_id),
        sub_unit_id = VALUES(sub_unit_id),
        code = VALUES(code),
        name = VALUES(name),
        product_type = VALUES(product_type),
        is_variable = VALUES(is_variable),
        purchase_price = VALUES(purchase_price),
        sub_unit_purchase_price = VALUES(sub_unit_purchase_price),
        image_url = VALUES(image_url),
        description = VALUES(description),
        status = VALUES(status),
        updated_at = VALUES(updated_at)`,
    [
      product.id,
      product.product_group_id,
      product.category_id || null,
      product.brand_id || null,
      product.uom_id || null,
      product.sub_unit_id || null,
      product.code,
      product.name,
      product.product_type || "single",
      coerceBool(product.is_variable),
      product.purchase_price ?? null,
      product.sub_unit_purchase_price ?? null,
      product.image_url || null,
      product.description || "",
      product.status || "Active",
      product.created_at,
      product.updated_at,
    ]
  );
}

export async function deleteProduct(id: string): Promise<boolean> {
  assertDb();
  const p = getPool()!;
  await p.execute("DELETE FROM pm_product_variation_templates WHERE product_id = ?", [id]);
  await p.execute("DELETE FROM pm_product_combo_items WHERE product_id = ?", [id]);
  await p.execute("DELETE FROM pm_product_custom_fields WHERE product_id = ?", [id]);
  await p.execute("DELETE FROM pm_product_variants WHERE product_id = ?", [id]);
  const [result] = await p.execute<ResultSetHeader>("DELETE FROM pm_products WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

// ─── Variants ───

export async function getVariants(opts: { productId?: string; search?: string; status?: string }): Promise<any[]> {
  const p = getPool();
  if (!p || !isDbReady()) return [];
  const conditions: string[] = [];
  const params: any[] = [];
  if (opts.productId) {
    conditions.push("v.product_id = ?");
    params.push(opts.productId);
  }
  if (opts.search) {
    const like = `%${opts.search}%`;
    conditions.push("(v.sku LIKE ? OR v.name LIKE ? OR p.name LIKE ? OR p.code LIKE ?)");
    params.push(like, like, like, like);
  }
  if (opts.status === "active") conditions.push("v.status = 'Active'");
  else if (opts.status === "inactive") conditions.push("v.status = 'Inactive'");
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const [rows] = await p.query<RowDataPacket[]>(
    `SELECT v.*, p.code AS product_code, p.name AS product_name, p.product_type, p.is_variable,
            g.name AS product_group_name
     FROM pm_product_variants v
     JOIN pm_products p ON p.id = v.product_id
     LEFT JOIN pm_product_groups g ON g.id = p.product_group_id
     ${where}
     ORDER BY v.name ASC`,
    params
  );
  return rows.map(normalizeVariantRow);
}

export async function getVariantById(id: string): Promise<any | null> {
  const p = getPool();
  if (!p || !isDbReady()) return null;
  const [rows] = await p.execute<RowDataPacket[]>(
    `SELECT v.*, p.code AS product_code, p.name AS product_name
     FROM pm_product_variants v
     JOIN pm_products p ON p.id = v.product_id
     WHERE v.id = ?`,
    [id]
  );
  return rows[0] ? normalizeVariantRow(rows[0]) : null;
}

function normalizeVariantRow(row: any): any {
  return {
    ...row,
    variation_value_ids: parseJsonArray(row.variation_value_ids),
  };
}

function parseJsonArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function upsertVariant(variant: any): Promise<void> {
  assertDb();
  const p = getPool()!;
  await p.execute(
    `INSERT INTO pm_product_variants (id, product_id, sku, name, description, variation_value_ids, sub_unit_id,
       purchase_price, sub_unit_purchase_price, image_url, is_active, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        product_id = VALUES(product_id),
        sku = VALUES(sku),
        name = VALUES(name),
        description = VALUES(description),
        variation_value_ids = VALUES(variation_value_ids),
        sub_unit_id = VALUES(sub_unit_id),
        purchase_price = VALUES(purchase_price),
        sub_unit_purchase_price = VALUES(sub_unit_purchase_price),
        image_url = VALUES(image_url),
        is_active = VALUES(is_active),
        status = VALUES(status),
        updated_at = VALUES(updated_at)`,
    [
      variant.id,
      variant.product_id,
      variant.sku,
      variant.name,
      variant.description || "",
      variant.variation_value_ids
        ? JSON.stringify(Array.isArray(variant.variation_value_ids) ? variant.variation_value_ids : [])
        : null,
      variant.sub_unit_id || null,
      variant.purchase_price ?? null,
      variant.sub_unit_purchase_price ?? null,
      variant.image_url || null,
      coerceBool(variant.is_active, true),
      variant.status || "Active",
      variant.created_at,
      variant.updated_at,
    ]
  );
}

export async function deleteVariant(id: string): Promise<boolean> {
  assertDb();
  const p = getPool()!;
  const [result] = await p.execute<ResultSetHeader>("DELETE FROM pm_product_variants WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

// ─── Standards ───

export async function getStandards(): Promise<any[]> {
  const p = getPool();
  if (!p || !isDbReady()) return [];
  const [rows] = await p.query<RowDataPacket[]>(
    `SELECT s.*, g.name AS product_group_name, g.code AS product_group_code,
            (SELECT COUNT(*) FROM pm_product_standard_items i WHERE i.product_standard_id = s.id) AS item_count
     FROM pm_product_standards s
     LEFT JOIN pm_product_groups g ON g.id = s.product_group_id
     ORDER BY s.name ASC`
  );
  return rows;
}

export async function getStandardById(id: string): Promise<any | null> {
  const p = getPool();
  if (!p || !isDbReady()) return null;
  const [rows] = await p.execute<RowDataPacket[]>(
    `SELECT s.*, g.name AS product_group_name, g.code AS product_group_code
     FROM pm_product_standards s
     LEFT JOIN pm_product_groups g ON g.id = s.product_group_id
     WHERE s.id = ?`,
    [id]
  );
  return rows[0] || null;
}

export async function getStandardItems(standardId: string): Promise<any[]> {
  const p = getPool();
  if (!p || !isDbReady()) return [];
  const [rows] = await p.execute<RowDataPacket[]>(
    `SELECT i.*, v.sku, v.name AS variant_name, p.code AS product_code, p.name AS product_name
     FROM pm_product_standard_items i
     JOIN pm_product_variants v ON v.id = i.product_variant_id
     LEFT JOIN pm_products p ON p.id = v.product_id
     WHERE i.product_standard_id = ?
     ORDER BY i.is_preferred DESC, v.name ASC`,
    [standardId]
  );
  return rows;
}

export async function upsertStandard(standard: any): Promise<void> {
  assertDb();
  const p = getPool()!;
  await p.execute(
    `INSERT INTO pm_product_standards (id, product_group_id, code, name, description, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       product_group_id = VALUES(product_group_id),
       code = VALUES(code),
       name = VALUES(name),
       description = VALUES(description),
       status = VALUES(status),
       updated_at = VALUES(updated_at)`,
    [
      standard.id,
      standard.product_group_id,
      standard.code,
      standard.name,
      standard.description || "",
      standard.status || "Active",
      standard.created_at,
      standard.updated_at,
    ]
  );
}

export async function deleteStandard(id: string): Promise<boolean> {
  assertDb();
  const p = getPool()!;
  const [result] = await p.execute<ResultSetHeader>("DELETE FROM pm_product_standards WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

export async function upsertStandardItem(item: any): Promise<void> {
  assertDb();
  const p = getPool()!;
  await p.execute(
    `INSERT INTO pm_product_standard_items (id, product_standard_id, product_variant_id, is_preferred, effective_from, effective_to, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       product_standard_id = VALUES(product_standard_id),
       product_variant_id = VALUES(product_variant_id),
       is_preferred = VALUES(is_preferred),
       effective_from = VALUES(effective_from),
       effective_to = VALUES(effective_to),
       status = VALUES(status),
       updated_at = VALUES(updated_at)`,
    [
      item.id,
      item.product_standard_id,
      item.product_variant_id,
      coerceBool(item.is_preferred),
      item.effective_from || null,
      item.effective_to || null,
      item.status || "Active",
      item.created_at,
      item.updated_at,
    ]
  );
}

export async function deleteStandardItem(id: string): Promise<boolean> {
  assertDb();
  const p = getPool()!;
  const [result] = await p.execute<ResultSetHeader>("DELETE FROM pm_product_standard_items WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

// ─── Variant UoMs ───

export async function getVariantUoms(variantId: string): Promise<any[]> {
  const p = getPool();
  if (!p || !isDbReady()) return [];
  const [rows] = await p.execute<RowDataPacket[]>(
    `SELECT u.*, uom.code AS uom_code, uom.name AS uom_name, uom.type AS uom_type, uom.decimal_places AS uom_decimal_places
     FROM pm_product_variant_uoms u
     JOIN pm_uoms uom ON uom.id = u.uom_id
     WHERE u.product_variant_id = ?
     ORDER BY u.is_base DESC, uom.name ASC`,
    [variantId]
  );
  return rows;
}

export async function getVariantUomById(id: string): Promise<any | null> {
  const p = getPool();
  if (!p || !isDbReady()) return null;
  const [rows] = await p.execute<RowDataPacket[]>(
    `SELECT u.*, uom.code AS uom_code, uom.name AS uom_name
     FROM pm_product_variant_uoms u
     JOIN pm_uoms uom ON uom.id = u.uom_id
     WHERE u.id = ?`,
    [id]
  );
  return rows[0] || null;
}

export async function upsertVariantUom(item: any): Promise<void> {
  assertDb();
  const p = getPool()!;
  await p.execute(
    `INSERT INTO pm_product_variant_uoms (id, product_variant_id, uom_id, conversion_factor, is_base, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        product_variant_id = VALUES(product_variant_id),
        uom_id = VALUES(uom_id),
        conversion_factor = VALUES(conversion_factor),
        is_base = VALUES(is_base),
        status = VALUES(status),
        updated_at = VALUES(updated_at)`,
    [
      item.id,
      item.product_variant_id,
      item.uom_id,
      item.conversion_factor ?? 1,
      coerceBool(item.is_base),
      item.status || "Active",
      item.created_at,
      item.updated_at,
    ]
  );
}

export async function deleteVariantUom(id: string): Promise<boolean> {
  assertDb();
  const p = getPool()!;
  const [result] = await p.execute<ResultSetHeader>("DELETE FROM pm_product_variant_uoms WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

// ─── Variation Templates ───

export async function getVariationTemplates(search?: string): Promise<any[]> {
  const p = getPool();
  if (!p || !isDbReady()) return [];
  const conditions: string[] = [];
  const params: any[] = [];
  if (search) {
    const like = `%${search}%`;
    conditions.push(
      "(t.name LIKE ? OR EXISTS (SELECT 1 FROM pm_variation_template_values vv WHERE vv.variation_template_id = t.id AND vv.name LIKE ?))"
    );
    params.push(like, like);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const [rows] = await p.query<RowDataPacket[]>(
    `SELECT t.*,
            (SELECT COUNT(*) FROM pm_variation_template_values vv WHERE vv.variation_template_id = t.id) AS value_count
     FROM pm_variation_templates t
     ${where}
     ORDER BY t.name ASC`,
    params
  );
  return rows;
}

export async function getVariationTemplateValues(templateId: string): Promise<any[]> {
  const p = getPool();
  if (!p || !isDbReady()) return [];
  const [rows] = await p.execute<RowDataPacket[]>(
    "SELECT * FROM pm_variation_template_values WHERE variation_template_id = ? ORDER BY sort_order ASC, name ASC",
    [templateId]
  );
  return rows;
}

export async function getVariationTemplateById(id: string): Promise<any | null> {
  const p = getPool();
  if (!p || !isDbReady()) return null;
  const [rows] = await p.execute<RowDataPacket[]>(
    `SELECT t.*,
            (SELECT COUNT(*) FROM pm_variation_template_values vv WHERE vv.variation_template_id = t.id) AS value_count
     FROM pm_variation_templates t
     WHERE t.id = ?`,
    [id]
  );
  return rows[0] || null;
}

export async function upsertVariationTemplate(template: any): Promise<void> {
  assertDb();
  const p = getPool()!;
  await p.execute(
    `INSERT INTO pm_variation_templates (id, name, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       status = VALUES(status),
       updated_at = VALUES(updated_at)`,
    [
      template.id,
      template.name,
      template.status || "Active",
      template.created_at,
      template.updated_at,
    ]
  );
}

export async function upsertVariationTemplateValue(value: any): Promise<void> {
  assertDb();
  const p = getPool()!;
  await p.execute(
    `INSERT INTO pm_variation_template_values (id, variation_template_id, name, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       variation_template_id = VALUES(variation_template_id),
       name = VALUES(name),
       sort_order = VALUES(sort_order),
       updated_at = VALUES(updated_at)`,
    [
      value.id,
      value.variation_template_id,
      value.name,
      value.sort_order ?? 0,
      value.created_at,
      value.updated_at,
    ]
  );
}

export async function deleteVariationTemplate(id: string): Promise<boolean> {
  assertDb();
  const p = getPool()!;
  await p.execute("DELETE FROM pm_variation_template_values WHERE variation_template_id = ?", [id]);
  const [result] = await p.execute<ResultSetHeader>("DELETE FROM pm_variation_templates WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

export async function deleteVariationTemplateValues(templateId: string, keepIds: string[]): Promise<void> {
  assertDb();
  const p = getPool()!;
  if (keepIds.length === 0) {
    await p.execute("DELETE FROM pm_variation_template_values WHERE variation_template_id = ?", [templateId]);
  } else {
    const placeholders = keepIds.map(() => "?").join(",");
    await p.execute(
      `DELETE FROM pm_variation_template_values WHERE variation_template_id = ? AND id NOT IN (${placeholders})`,
      [templateId, ...keepIds]
    );
  }
}

// ─── Product ↔ Variation Template links ───

export async function hasTemplateProducts(templateId: string): Promise<number> {
  const p = getPool();
  if (!p || !isDbReady()) return 0;
  const [rows] = await p.execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM pm_product_variation_templates WHERE variation_template_id = ?",
    [templateId]
  );
  return Number((rows[0] as any).total);
}

export async function hasTemplateValueUsage(templateId: string): Promise<number> {
  const p = getPool();
  if (!p || !isDbReady()) return 0;
  const values = await getVariationTemplateValues(templateId);
  if (values.length === 0) return 0;
  let total = 0;
  for (const v of values) {
    const [rows] = await p.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM pm_product_variants
       WHERE (variation_value_ids LIKE ? OR variation_value_ids LIKE ? OR variation_value_ids LIKE ?)`,
      [`%${JSON.stringify(v.id)}%`, `%${v.id}%`, `%"${v.id}"%`]
    );
    total += Number((rows[0] as any).total);
  }
  return total;
}

export async function getProductVariationTemplates(productId: string): Promise<string[]> {
  const p = getPool();
  if (!p || !isDbReady()) return [];
  const [rows] = await p.execute<RowDataPacket[]>(
    `SELECT variation_template_id FROM pm_product_variation_templates WHERE product_id = ? ORDER BY variation_template_id`,
    [productId]
  );
  return rows.map((r: any) => String(r.variation_template_id));
}

export async function setProductVariationTemplates(productId: string, templateIds: string[]): Promise<void> {
  assertDb();
  const p = getPool()!;
  await p.execute("DELETE FROM pm_product_variation_templates WHERE product_id = ?", [productId]);
  const ids = Array.isArray(templateIds) ? [...new Set(templateIds.map(String).filter(Boolean))] : [];
  for (const templateId of ids) {
    await p.execute(
      "INSERT INTO pm_product_variation_templates (product_id, variation_template_id) VALUES (?, ?)",
      [productId, templateId]
    );
  }
}

// ─── Combo items ───

export async function getComboItems(productId: string): Promise<any[]> {
  const p = getPool();
  if (!p || !isDbReady()) return [];
  const [rows] = await p.execute<RowDataPacket[]>(
    `SELECT i.*, cp.code AS child_product_code, cp.name AS child_product_name,
            cv.sku AS child_variant_sku, cv.name AS child_variant_name
     FROM pm_product_combo_items i
     LEFT JOIN pm_products cp ON cp.id = i.child_product_id
     LEFT JOIN pm_product_variants cv ON cv.id = i.child_variation_id
     WHERE i.product_id = ?
     ORDER BY i.created_at ASC`,
    [productId]
  );
  return rows;
}

export async function replaceComboItems(productId: string, items: any[]): Promise<any[]> {
  assertDb();
  const p = getPool()!;
  await p.execute("DELETE FROM pm_product_combo_items WHERE product_id = ?", [productId]);
  const list = Array.isArray(items) ? items : [];
  const created: any[] = [];
  const now = new Date().toISOString();
  for (const item of list) {
    if (!item.child_product_id) continue;
    const childVariantId = item.child_variation_id || null;
    const quantity = item.quantity !== undefined && item.quantity !== "" && Number(item.quantity) > 0 ? Number(item.quantity) : 1;
    const row = {
      id: newId("combo"),
      product_id: productId,
      child_product_id: String(item.child_product_id),
      child_variation_id: childVariantId,
      quantity,
      status: "Active",
      created_at: now,
      updated_at: now,
    };
    await p.execute(
      `INSERT INTO pm_product_combo_items (id, product_id, child_product_id, child_variation_id, quantity, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.product_id, row.child_product_id, row.child_variation_id, row.quantity, row.status, row.created_at, row.updated_at]
    );
    created.push(row);
  }
  return created;
}

// ─── Custom fields ───

export async function getCustomFields(): Promise<any[]> {
  const p = getPool();
  if (!p || !isDbReady()) return [];
  const [rows] = await p.query<RowDataPacket[]>(
    "SELECT * FROM pm_custom_fields WHERE status = 'Active' ORDER BY sort_order ASC, field_label ASC"
  );
  return rows.map((row: any) => ({
    ...row,
    options: parseJsonArray(String(row.options || "[]")).length ? row.options : [],
  }));
}

export async function getProductCustomFields(productId: string): Promise<Record<string, unknown>> {
  const p = getPool();
  if (!p || !isDbReady()) return {};
  const [rows] = await p.execute<RowDataPacket[]>(
    "SELECT field_name, field_value FROM pm_product_custom_fields WHERE product_id = ?",
    [productId]
  );
  const map: Record<string, unknown> = {};
  for (const row of rows) {
    const value = (row as any).field_value;
    if (value === null || value === undefined) {
      map[(row as any).field_name] = null;
      continue;
    }
    try {
      map[(row as any).field_name] = JSON.parse(String(value));
    } catch {
      map[(row as any).field_name] = String(value);
    }
  }
  return map;
}

export async function replaceProductCustomFields(productId: string, fields: Record<string, unknown>): Promise<void> {
  assertDb();
  const p = getPool()!;
  await p.execute("DELETE FROM pm_product_custom_fields WHERE product_id = ?", [productId]);
  const now = new Date().toISOString();
  for (const [key, value] of Object.entries(fields || {})) {
    const name = String(key).trim();
    if (!name) continue;
    const normalized = value === null || value === undefined || value === "" ? null : value;
    await p.execute(
      "INSERT INTO pm_product_custom_fields (product_id, field_name, field_value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      [productId, name, normalized !== null ? JSON.stringify(normalized) : null, now, now]
    );
  }
}

// ─── Combo candidate products (single/variation products with variants) ───

export async function getComboCandidateProducts(): Promise<any[]> {
  const p = getPool();
  if (!p || !isDbReady()) return [];
  const [products] = await p.query<RowDataPacket[]>(
    `SELECT p.id, p.code, p.name, p.product_type
     FROM pm_products p
     WHERE p.product_type IN ('single', 'variation') AND p.status = 'Active'
     ORDER BY p.name ASC`
  );
  const [variants] = await p.query<RowDataPacket[]>(
    `SELECT v.id, v.product_id, v.sku, v.name
     FROM pm_product_variants v
     JOIN pm_products p ON p.id = v.product_id
     WHERE p.status = 'Active' AND v.status = 'Active'
     ORDER BY v.name ASC`
  );
  const variantMap: Record<string, any[]> = {};
  for (const v of variants) {
    const pid = String((v as any).product_id);
    (variantMap[pid] ??= []).push(v);
  }
  return products.map((product: any) => ({
    ...product,
    variations: variantMap[product.id] ?? [],
  }));
}

export { newId, coerceBool };