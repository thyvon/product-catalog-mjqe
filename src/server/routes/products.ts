import { Router } from "express";
import { getPool, isDbReady, getAllProducts, getProductById, getProductByCode, upsertProduct, deleteProduct, insertImportBatch } from "../db.js";
import crypto from "crypto";

const router = Router();

router.get("/api/products", async (_req, res) => {
  try {
    const products = await getAllProducts();
    res.json(products);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch products." });
  }
});

router.get("/api/products/stats", async (_req, res) => {
  try {
    const pool = getPool();
    if (!pool || !isDbReady()) return res.json({ total: 0, active: 0, inactive: 0, categories: [] });
    const [rows] = await pool.query<any[]>("SELECT status, COUNT(*) as count FROM products GROUP BY status");
    const [catRows] = await pool.query<any[]>("SELECT DISTINCT category FROM products ORDER BY category");
    const total = rows.reduce((sum: number, r: any) => sum + r.count, 0);
    const active = rows.find((r: any) => r.status === "Active")?.count || 0;
    const inactive = rows.find((r: any) => r.status === "Inactive")?.count || 0;
    res.json({ total, active, inactive, categories: catRows.map((r: any) => r.category) });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch stats." });
  }
});

router.post("/api/products", async (req, res) => {
  try {
    const pool = getPool();
    if (!pool || !isDbReady()) return res.status(503).json({ error: "DB not available." });
    const product = req.body;
    const now = new Date().toISOString();
    const id = product.id || crypto.randomUUID();
    await pool.execute(
      `INSERT INTO products (id, productCode, name, description, uom, category, subCategory, status, price, stock, imageUrl, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, product.productCode, product.name, product.description || "", product.uom,
       product.category, product.subCategory || "", product.status || "Active",
       product.price ?? null, product.stock ?? null, product.imageUrl || "", now, now]
    );
    res.json({ id, success: true });
  } catch (err: any) {
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Product code already exists." });
    res.status(500).json({ error: "Failed to create product." });
  }
});

router.put("/api/products/:id", async (req, res) => {
  try {
    const pool = getPool();
    if (!pool || !isDbReady()) return res.status(503).json({ error: "DB not available." });
    const product = { ...req.body, id: req.params.id };
    const existing = await getProductByCode(product.productCode);
    if (existing && existing.id !== product.id) {
      return res.status(409).json({ error: "Product code already in use by another product." });
    }
    await upsertProduct({ ...product, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update product." });
  }
});

router.delete("/api/products/:id", async (req, res) => {
  try {
    const deleted = await deleteProduct(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Product not found." });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete product." });
  }
});

router.post("/api/products/import", async (req, res) => {
  try {
    const pool = getPool();
    if (!pool || !isDbReady()) return res.status(503).json({ error: "DB not available." });
    const products = req.body;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: "Request body must be a non-empty array." });
    }
    const now = new Date().toISOString();
    for (const item of products) {
      const id = item.id || crypto.randomUUID();
      await pool.execute(
        `INSERT INTO products (id, productCode, name, description, uom, category, subCategory, status, price, stock, imageUrl, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name), description = VALUES(description), uom = VALUES(uom),
           category = VALUES(category), subCategory = VALUES(subCategory), status = VALUES(status),
           price = VALUES(price), stock = VALUES(stock), updatedAt = VALUES(updatedAt)`,
        [id, String(item.productCode).toUpperCase(), item.name, item.description || "",
         item.uom || "Pcs", item.category || "General", item.subCategory || "General",
         item.status || "Active", item.price ?? null, item.stock ?? null, "", now, now]
      );
    }
    res.json({ count: products.length, success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to import products." });
  }
});

export default router;
