import { Router } from "express";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { assertDb } from "../db.js";
import { isMinioEnabled, saveObject, getLocalUploadsDir } from "../services/storage.js";
import {
  getAllProducts, getProductById, getProductByCode,
  upsertProduct, deleteProduct, insertImportBatch, getProductsPaginated,
} from "../models/products.js";

const router = Router();

const BLANK_PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect fill="#f1f5f9" width="400" height="400"/><text x="50%" y="45%" fill="#94a3b8" font-family="monospace" font-size="16" font-weight="bold" text-anchor="middle" dominant-baseline="middle">NO IMAGE</text><text x="50%" y="55%" fill="#94a3b8" font-family="monospace" font-size="11" text-anchor="middle" dominant-baseline="middle">Click to upload</text></svg>`);

router.get("/api/products", async (req, res) => {
  try {
    const { page, pageSize, search, category, status, sort } = req.query;
    if (page !== undefined || pageSize !== undefined) {
      const result = await getProductsPaginated({
        page: Math.max(1, Number(page) || 1),
        pageSize: pageSize !== undefined ? Math.max(0, Number(pageSize)) : 20,
        search: String(search || ""),
        category: String(category || ""),
        status: String(status || ""),
        sort: String(sort || "name"),
      });
      return res.json(result);
    }
    const products = await getAllProducts();
    res.json(products);
  } catch {
    res.status(500).json({ error: "Failed to fetch products." });
  }
});

router.post("/api/products/upload-image", async (req, res) => {
  try {
    const { image, filename } = req.body;
    if (!image) return res.status(400).json({ error: "Missing image data" });
    const matches = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: "Invalid image data format." });
    const ext = matches[1].split("/")[1].replace("jpeg", "jpg");
    const safeName = (filename || "product").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase().substring(0, 30);
    const uniqueName = `${safeName}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${ext}`;
    const buffer = Buffer.from(matches[2], "base64");

    if (isMinioEnabled()) {
      try {
        await saveObject(uniqueName, buffer, matches[1]);
        return res.json({ imageUrl: `/uploads/${uniqueName}` });
      } catch (err: any) {
        console.warn("[storage] MinIO upload failed, falling back to local disk:", err?.message || err);
      }
    }

    const filePath = path.join(getLocalUploadsDir(), uniqueName);
    fs.writeFileSync(filePath, buffer);
    res.json({ imageUrl: `/uploads/${uniqueName}` });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save image.", details: err.message });
  }
});

router.get("/api/products/stats", async (_req, res) => {
  try {
    const products = await getAllProducts();
    const totalProducts = products.length;
    let activeCount = 0;
    let inactiveCount = 0;
    const categoriesMap: { [cat: string]: { count: number; activeCount: number } } = {};
    products.forEach((p: any) => {
      const status = String(p.status || "Active");
      if (status === "Active") activeCount++;
      else if (status === "Inactive") inactiveCount++;
      const cat = p.category || "Uncategorized";
      if (!categoriesMap[cat]) categoriesMap[cat] = { count: 0, activeCount: 0 };
      categoriesMap[cat].count++;
      if (status === "Active") categoriesMap[cat].activeCount++;
    });
    const categoryStats = Object.keys(categoriesMap).map((cat) => ({
      category: cat,
      count: categoriesMap[cat].count,
      activeCount: categoriesMap[cat].activeCount,
    }));
    res.json({ totalProducts, activeCount, inactiveCount, categoryStats });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch stats." });
  }
});

router.post("/api/products", async (req, res) => {
  try {
    const input = req.body;
    if (!input.name || !input.productCode || !input.uom || !input.category) {
      return res.status(400).json({ error: "Missing required catalog fields. Name, Product Code, UoM, and Category are mandatory." });
    }
    const newProduct = {
      id: `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      productCode: String(input.productCode).toUpperCase().trim(),
      name: String(input.name).trim(),
      description: String(input.description || "").trim(),
      uom: String(input.uom).trim(),
      category: String(input.category).trim(),
      subCategory: String(input.subCategory || "General").trim(),
      status: ["Active", "Inactive"].includes(input.status) ? input.status : "Active",
      imageUrl: String(input.imageUrl || BLANK_PLACEHOLDER).trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await upsertProduct(newProduct);
    res.status(201).json(newProduct);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create product." });
  }
});

router.post("/api/products/import", async (req, res) => {
  try {
    const incoming = req.body;
    if (!Array.isArray(incoming)) return res.status(400).json({ error: "Expected an array of imported products." });

    const allProducts = await getAllProducts();
    const existingByCode = new Map<string, any>();
    for (const p of allProducts) existingByCode.set(p.productCode, p);

    const itemsToUpsert: any[] = [];
    incoming.forEach((item: any) => {
      const codeStr = item.productCode || item["Product Code"] || item["code"] || item["Code"];
      const nameStr = item.name || item["Product Name"] || item["Name"] || item["Product Name/Description"] || item["Description"];
      const descStr = item.description || item["Description"] || item["Product Name/Description"] || "";
      const uomStr = item.uom || item["UoM"] || item["unit"] || item["Unit"] || "Pcs";
      const catStr = item.category || item["Category"] || "General";
      const subCatStr = item.subCategory || item["Sub Category"] || item["SubCategory"] || "";
      const imgStr = item.imageUrl || item["Image"] || item["imageUrl"] || item["Photo"] || "";
      const rawStatus = item.status || item["Status"] || "Active";
      let norStatus = "Active";
      if (String(rawStatus).toLowerCase().includes("inactive") || String(rawStatus).toLowerCase() === "i") norStatus = "Inactive";
      if (codeStr && nameStr) {
        const normalizedCode = String(codeStr).toUpperCase().trim();
        const existing = existingByCode.get(normalizedCode);
        const now = new Date().toISOString();
        itemsToUpsert.push({
          id: existing ? existing.id : `prod-import-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
          productCode: normalizedCode,
          name: String(nameStr).trim(),
          description: String(descStr || nameStr).trim(),
          uom: String(uomStr).trim(),
          category: String(catStr).trim(),
          subCategory: String(subCatStr).trim(),
          status: norStatus,
          imageUrl: String(imgStr || BLANK_PLACEHOLDER).trim(),
          createdAt: existing ? existing.createdAt : now,
          updatedAt: now,
        });
      }
    });

    if (itemsToUpsert.length === 0) {
      return res.status(400).json({ error: "No records with at least a valid 'Product Code' and 'Product Name' were detected." });
    }
    await insertImportBatch(itemsToUpsert);
    res.json({ success: true, count: itemsToUpsert.length });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to import products." });
  }
});

router.put("/api/products/:id", async (req, res) => {
  try {
    const targetId = req.params.id;
    const existing = await getProductById(targetId);
    if (!existing) return res.status(404).json({ error: `Catalog entry ${targetId} not found.` });

    const input = req.body;
    const updatedProduct = {
      ...existing,
      productCode: input.productCode !== undefined ? String(input.productCode).toUpperCase().trim() : existing.productCode,
      name: input.name !== undefined ? String(input.name).trim() : existing.name,
      description: input.description !== undefined ? String(input.description).trim() : existing.description,
      uom: input.uom !== undefined ? String(input.uom).trim() : existing.uom,
      category: input.category !== undefined ? String(input.category).trim() : existing.category,
      subCategory: input.subCategory !== undefined ? String(input.subCategory).trim() : existing.subCategory,
      status: ["Active", "Inactive"].includes(input.status) ? input.status : existing.status,
      imageUrl: input.imageUrl !== undefined ? String(input.imageUrl).trim() : existing.imageUrl,
      updatedAt: new Date().toISOString(),
    };
    await upsertProduct(updatedProduct);
    res.json(updatedProduct);
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

export default router;
