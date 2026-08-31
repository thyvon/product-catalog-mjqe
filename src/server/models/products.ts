import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool, isDbReady, assertDb } from "../db.js";

export async function getProductsPaginated(opts: {
  page: number;
  pageSize: number;
  search?: string;
  category?: string;
  status?: string;
  sort?: string;
}): Promise<{ data: any[]; total: number; categories: string[]; uoms: string[] }> {
  const p = getPool();
  if (!p || !isDbReady()) return { data: [], total: 0, categories: [], uoms: [] };

  const { page, pageSize, search = "", category = "", status = "", sort = "name" } = opts;

  const conditions: string[] = [];
  const params: any[] = [];

  if (search) {
    conditions.push("(name LIKE ? OR productCode LIKE ? OR category LIKE ? OR subCategory LIKE ?)");
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }
  if (status === "active") {
    conditions.push("status = 'Active'");
  } else if (status === "inactive") {
    conditions.push("status = 'Inactive'");
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const orderBy = sort === "code" ? "productCode ASC" : "name ASC";

  const [countRows] = await p.query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM products ${where}`, params);
  const total = Number((countRows[0] as any).total);

  let rows: RowDataPacket[];
  if (pageSize === 0) {
    [rows] = await p.query<RowDataPacket[]>(`SELECT * FROM products ${where} ORDER BY ${orderBy}`, params);
  } else {
    const offset = (page - 1) * pageSize;
    [rows] = await p.query<RowDataPacket[]>(
      `SELECT * FROM products ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );
  }

  const [catRows] = await p.query<RowDataPacket[]>("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != '' ORDER BY category ASC");
  const categories = catRows.map((r: any) => String(r.category));

  const [uomRows] = await p.query<RowDataPacket[]>("SELECT DISTINCT uom FROM products WHERE uom IS NOT NULL AND uom != '' ORDER BY uom ASC");
  const uoms = uomRows.map((r: any) => String(r.uom));

  return { data: rows, total, categories, uoms };
}

export async function getAllProducts(): Promise<any[]> {
  const p = getPool();
  if (!p || !isDbReady()) return [];
  const [rows] = await p.query<RowDataPacket[]>("SELECT * FROM products ORDER BY name ASC");
  return rows;
}

export async function getProductById(id: string): Promise<any | null> {
  const p = getPool();
  if (!p || !isDbReady()) return null;
  const [rows] = await p.execute<RowDataPacket[]>("SELECT * FROM products WHERE id = ?", [id]);
  return rows[0] || null;
}

export async function getProductByCode(code: string): Promise<any | null> {
  const p = getPool();
  if (!p || !isDbReady()) return null;
  const [rows] = await p.execute<RowDataPacket[]>("SELECT * FROM products WHERE productCode = ?", [code]);
  return rows[0] || null;
}

export async function upsertProduct(product: any): Promise<void> {
  assertDb();
  const p = getPool()!;
  await p.execute(
    `INSERT INTO products (id, productCode, name, description, uom, category, subCategory, status, imageUrl, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        productCode = VALUES(productCode),
        name = VALUES(name),
        description = VALUES(description),
        uom = VALUES(uom),
        category = VALUES(category),
        subCategory = VALUES(subCategory),
        status = VALUES(status),
        imageUrl = VALUES(imageUrl),
        updatedAt = VALUES(updatedAt)`,
    [
      product.id, product.productCode, product.name, product.description || "",
      product.uom, product.category, product.subCategory || "", product.status || "Active",
      product.imageUrl || "",
      product.createdAt, product.updatedAt,
    ]
  );
}

export async function deleteProduct(id: string): Promise<boolean> {
  assertDb();
  const p = getPool()!;
  const [result] = await p.execute<ResultSetHeader>("DELETE FROM products WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

export async function insertImportBatch(products: any[]): Promise<void> {
  for (const p of products) {
    await upsertProduct(p);
  }
}
