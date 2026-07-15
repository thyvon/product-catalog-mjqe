import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createHttpServer } from "http";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import mysql, { type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import ExcelJS from "exceljs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const archiver = require("archiver");

dotenv.config();

const app = express();

const BLANK_PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect fill="#f1f5f9" width="400" height="400"/><text x="50%" y="45%" fill="#94a3b8" font-family="monospace" font-size="16" font-weight="bold" text-anchor="middle" dominant-baseline="middle">NO IMAGE</text><text x="50%" y="55%" fill="#94a3b8" font-family="monospace" font-size="11" text-anchor="middle" dominant-baseline="middle">Click to upload</text></svg>`);
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

// MySQL connection pool (XAMPP for local development)
let pool: mysql.Pool | null = null;
let dbReady = false;

function getPool(): mysql.Pool | null {
  return pool;
}

function getDbConfig() {
  return {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_DATABASE || "product_catalog",
  };
}

async function checkDbConnection(): Promise<boolean> {
  if (!pool) return false;
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

async function initDb() {
  const config = getDbConfig();

  if (!/^[a-zA-Z0-9_]+$/.test(config.database)) {
    console.error("DB_DATABASE may contain only letters, numbers, and underscores.");
    return;
  }

  try {
    const adminConnection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
    });
    await adminConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await adminConnection.end();

    pool = mysql.createPool({
      ...config,
      charset: "utf8mb4",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    await pool.query(`CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(64) PRIMARY KEY,
      productCode VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      uom VARCHAR(100) NOT NULL,
      category VARCHAR(150) NOT NULL,
      subCategory VARCHAR(150) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'Active',
      price DOUBLE NULL,
      stock INT NULL,
      imageUrl TEXT NOT NULL,
      createdAt VARCHAR(40) NOT NULL,
      updatedAt VARCHAR(40) NOT NULL,
      UNIQUE KEY products_product_code_unique (productCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await pool.query(`CREATE TABLE IF NOT EXISTS suppliers (
      id VARCHAR(64) PRIMARY KEY,
      applicationType VARCHAR(30) NOT NULL DEFAULT 'new',
      oldSupplierCode VARCHAR(100) NOT NULL DEFAULT '',
      companyName VARCHAR(255) NOT NULL,
      companyNameKhmer VARCHAR(255) NOT NULL DEFAULT '',
      registrationType VARCHAR(30) NOT NULL DEFAULT 'vat',
      foreignTradeOperator BOOLEAN NOT NULL DEFAULT FALSE,
      contactPerson VARCHAR(255) NOT NULL DEFAULT '',
      position VARCHAR(150) NOT NULL DEFAULT '',
      email VARCHAR(255) NOT NULL DEFAULT '',
      phone VARCHAR(100) NOT NULL DEFAULT '',
      mobile VARCHAR(100) NOT NULL DEFAULT '',
      website VARCHAR(255) NOT NULL DEFAULT '',
      address TEXT NOT NULL,
      addressKhmer TEXT NOT NULL,
      cityProvince VARCHAR(150) NOT NULL DEFAULT '',
      districtKhan VARCHAR(150) NOT NULL DEFAULT '',
      businessLicense VARCHAR(255) NOT NULL DEFAULT '',
      commercialRegistration VARCHAR(255) NOT NULL DEFAULT '',
      taxRegistration VARCHAR(255) NOT NULL DEFAULT '',
      vatCertificate VARCHAR(255) NOT NULL DEFAULT '',
      patentTaxCertificate VARCHAR(255) NOT NULL DEFAULT '',
      nationalId VARCHAR(100) NOT NULL DEFAULT '',
      establishedYear VARCHAR(20) NOT NULL DEFAULT '',
      businessActivity VARCHAR(255) NOT NULL DEFAULT '',
      productServiceType VARCHAR(255) NOT NULL DEFAULT '',
      otherDocuments TEXT NOT NULL,
      bankName VARCHAR(255) NOT NULL DEFAULT '',
      bankBranch VARCHAR(255) NOT NULL DEFAULT '',
      bankAccount VARCHAR(150) NOT NULL DEFAULT '',
      accountHolderName VARCHAR(255) NOT NULL DEFAULT '',
      swiftCode VARCHAR(50) NOT NULL DEFAULT '',
      iban VARCHAR(100) NOT NULL DEFAULT '',
      checkAuthorization BOOLEAN NOT NULL DEFAULT FALSE,
      paymentMethod VARCHAR(50) NOT NULL DEFAULT 'bank-transfer',
      paymentMethodOther VARCHAR(255) NOT NULL DEFAULT '',
      paymentTerm VARCHAR(50) NOT NULL DEFAULT 'no-credit',
      paymentTermOther VARCHAR(255) NOT NULL DEFAULT '',
      conflictOfInterest BOOLEAN NOT NULL DEFAULT FALSE,
      conflictDetails TEXT NOT NULL,
      supplierDeclarationName VARCHAR(255) NOT NULL DEFAULT '',
      supplierDeclarationDate VARCHAR(40) NOT NULL DEFAULT '',
      buyerCompletedName VARCHAR(255) NOT NULL DEFAULT '',
      buyerCompletedDate VARCHAR(40) NOT NULL DEFAULT '',
      companyProfile TEXT NOT NULL,
      codeOfConductAck BOOLEAN NOT NULL DEFAULT FALSE,
      status VARCHAR(50) NOT NULL DEFAULT 'Pending',
      notes TEXT NOT NULL,
      createdAt VARCHAR(40) NOT NULL,
      updatedAt VARCHAR(40) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await pool.query(`CREATE TABLE IF NOT EXISTS stock_issue_items (
      id VARCHAR(64) PRIMARY KEY,
      itemCode VARCHAR(100) NOT NULL DEFAULT '',
      description TEXT NOT NULL,
      quantity DECIMAL(15,2) NOT NULL DEFAULT 0,
      uom VARCHAR(50) NOT NULL DEFAULT '',
      unitPrice DECIMAL(15,2) NOT NULL DEFAULT 0,
      totalPrice DECIMAL(15,2) NOT NULL DEFAULT 0,
      transactionDate DATE NULL,
      warehouse VARCHAR(255) NOT NULL DEFAULT '',
      division VARCHAR(255) NOT NULL DEFAULT '',
      department VARCHAR(255) NOT NULL DEFAULT '',
      campus VARCHAR(255) NOT NULL DEFAULT '',
      requesterName VARCHAR(255) NOT NULL DEFAULT '',
      referenceNo VARCHAR(255) NOT NULL DEFAULT '',
      transactionType VARCHAR(100) NOT NULL DEFAULT '',
      accountCode VARCHAR(100) NOT NULL DEFAULT '',
      remarks TEXT NOT NULL,
      importedAt VARCHAR(40) NOT NULL,
      createdAt VARCHAR(40) NOT NULL,
      updatedAt VARCHAR(40) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    // Add columns if they don't exist (for existing tables from earlier versions)
    try { await pool.query("ALTER TABLE stock_issue_items ADD COLUMN division VARCHAR(255) NOT NULL DEFAULT '' AFTER warehouse"); } catch {}
    try { await pool.query("ALTER TABLE stock_issue_items ADD COLUMN transactionType VARCHAR(100) NOT NULL DEFAULT '' AFTER referenceNo"); } catch {}
    try { await pool.query("ALTER TABLE stock_issue_items ADD COLUMN accountCode VARCHAR(100) NOT NULL DEFAULT '' AFTER transactionType"); } catch {}

    await pool.query(`CREATE TABLE IF NOT EXISTS debit_note_emails (
      id VARCHAR(64) PRIMARY KEY,
      warehouse VARCHAR(255) NOT NULL DEFAULT '',
      department VARCHAR(255) NOT NULL DEFAULT '',
      campus VARCHAR(255) NOT NULL DEFAULT '',
      receiverName VARCHAR(255) NOT NULL DEFAULT '',
      sendToEmail JSON NOT NULL,
      ccToEmail JSON NOT NULL,
      createdAt VARCHAR(40) NOT NULL,
      updatedAt VARCHAR(40) NOT NULL,
      UNIQUE KEY dn_emails_unique (warehouse, department, campus)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await pool.query(`CREATE TABLE IF NOT EXISTS debit_notes (
      id VARCHAR(64) PRIMARY KEY,
      referenceNumber VARCHAR(255) NOT NULL,
      warehouse VARCHAR(255) NOT NULL DEFAULT '',
      department VARCHAR(255) NOT NULL DEFAULT '',
      campus VARCHAR(255) NOT NULL DEFAULT '',
      startDate DATE NULL,
      endDate DATE NULL,
      sendDate DATE NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      debitNoteEmailId VARCHAR(64) NULL,
      createdBy VARCHAR(255) NOT NULL DEFAULT '',
      createdAt VARCHAR(40) NOT NULL,
      updatedAt VARCHAR(40) NOT NULL,
      UNIQUE KEY dn_reference_unique (referenceNumber)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await pool.query(`CREATE TABLE IF NOT EXISTS debit_note_items (
      id VARCHAR(64) PRIMARY KEY,
      debitNoteId VARCHAR(64) NOT NULL,
      stockIssueItemId VARCHAR(64) NULL,
      itemCode VARCHAR(100) NOT NULL DEFAULT '',
      description TEXT NOT NULL,
      quantity DECIMAL(15,2) NOT NULL DEFAULT 0,
      uom VARCHAR(50) NOT NULL DEFAULT '',
      unitPrice DECIMAL(15,2) NOT NULL DEFAULT 0,
      totalPrice DECIMAL(15,2) NOT NULL DEFAULT 0,
      transactionDate DATE NULL,
      requesterName VARCHAR(255) NOT NULL DEFAULT '',
      campus VARCHAR(255) NOT NULL DEFAULT '',
      department VARCHAR(255) NOT NULL DEFAULT '',
      referenceNo VARCHAR(255) NOT NULL DEFAULT '',
      remarks TEXT NOT NULL,
      createdAt VARCHAR(40) NOT NULL,
      INDEX dn_items_debit_note_idx (debitNoteId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    dbReady = true;
    console.log(`MySQL database '${config.database}' and its tables are ready.`);
  } catch (err) {
    pool = null;
    dbReady = false;
    console.error("Failed to initialize MySQL database:", err);
    console.warn("Start MySQL in XAMPP and verify the DB_* values in .env.");
  }
}
async function getAllProducts(): Promise<any[]> {
  const p = getPool();
  if (!p || !dbReady) return [];
  const [rows] = await p.query<RowDataPacket[]>("SELECT * FROM products ORDER BY name ASC");
  return rows;
}

async function getProductById(id: string): Promise<any | null> {
  const p = getPool();
  if (!p || !dbReady) return null;
  const [rows] = await p.execute<RowDataPacket[]>("SELECT * FROM products WHERE id = ?", [id]);
  return rows[0] || null;
}

async function getProductByCode(code: string): Promise<any | null> {
  const p = getPool();
  if (!p || !dbReady) return null;
  const [rows] = await p.execute<RowDataPacket[]>("SELECT * FROM products WHERE productCode = ?", [code]);
  return rows[0] || null;
}

function assertDb() {
  if (!getPool() || !dbReady) throw new Error("Database is not available.");
}

async function upsertProduct(product: any): Promise<void> {
  assertDb();
  const p = getPool()!;
  await p.execute(
    `INSERT INTO products (id, productCode, name, description, uom, category, subCategory, status, price, stock, imageUrl, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       productCode = VALUES(productCode),
       name = VALUES(name),
       description = VALUES(description),
       uom = VALUES(uom),
       category = VALUES(category),
       subCategory = VALUES(subCategory),
       status = VALUES(status),
       price = VALUES(price),
       stock = VALUES(stock),
       imageUrl = VALUES(imageUrl),
       updatedAt = VALUES(updatedAt)`,
    [
      product.id,
      product.productCode,
      product.name,
      product.description || "",
      product.uom,
      product.category,
      product.subCategory || "",
      product.status || "Active",
      product.price ?? null,
      product.stock ?? null,
      product.imageUrl || "",
      product.createdAt,
      product.updatedAt,
    ]
  );
}

async function deleteProduct(id: string): Promise<boolean> {
  assertDb();
  const p = getPool()!;
  const [result] = await p.execute<ResultSetHeader>("DELETE FROM products WHERE id = ?", [id]);
  return result.affectedRows > 0;
}
async function insertImportBatch(products: any[]): Promise<void> {
  for (const p of products) {
    await upsertProduct(p);
  }
}

// Lazy load Gemini AI Client safely
let aiClient: GoogleGenAI | null = null;
function getGeminiAI() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY variable is not present. AI copywriting assists will be restricted.");
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build-catalog',
        }
      }
    });
  }
  return aiClient;
}

// --- API Endpoints ---

// GET: Retrieve all products
app.get("/api/products", async (req, res) => {
  try {
    const products = await getAllProducts();
    res.json(products);
  } catch (err: any) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Failed to fetch products." });
  }
});

// POST: Upload custom product images to local storage
app.post("/api/products/upload-image", (req, res) => {
  try {
    const { image, filename } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Missing image data" });
    }

    const matches = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: "Invalid image data format." });
    }

    const ext = matches[1].split("/")[1].replace("jpeg", "jpg");
    const safeName = (filename || "product")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toLowerCase()
      .substring(0, 30);
    const uniqueName = `${safeName}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${ext}`;
    const filePath = path.join(process.cwd(), "uploads", uniqueName);
    const buffer = Buffer.from(matches[2], "base64");

    fs.writeFileSync(filePath, buffer);
    res.json({ imageUrl: `/uploads/${uniqueName}` });
  } catch (err: any) {
    console.error("Local image upload error:", err);
    res.status(500).json({ error: "Failed to save image.", details: err.message });
  }
});

// GET: Calculate stats
app.get("/api/products/stats", async (req, res) => {
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
      if (!categoriesMap[cat]) {
        categoriesMap[cat] = { count: 0, activeCount: 0 };
      }
      categoriesMap[cat].count++;
      if (status === "Active") {
        categoriesMap[cat].activeCount++;
      }
    });

    const categoryStats = Object.keys(categoriesMap).map((cat) => ({
      category: cat,
      count: categoriesMap[cat].count,
      activeCount: categoriesMap[cat].activeCount
    }));

    res.json({
      totalProducts,
      activeCount,
      inactiveCount,

      categoryStats,
    });
  } catch (err: any) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ error: "Failed to fetch stats." });
  }
});

// ─── Live Visit Tracking (in-memory) ───
interface VisitEntry {
  path: string;
  timestamp: number;
  ip: string;
}
const visitLog: VisitEntry[] = [];
const VISIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes for "live"

// POST: Log a page visit
app.post("/api/visit/log", (req, res) => {
  const { path: pagePath } = req.body;
  const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "unknown").split(",")[0].trim();
  visitLog.push({ path: pagePath || "/", timestamp: Date.now(), ip });
  // Trim old entries beyond the window
  const cutoff = Date.now() - VISIT_WINDOW_MS;
  while (visitLog.length > 0 && visitLog[0].timestamp < cutoff) {
    visitLog.shift();
  }
  res.json({ ok: true });
});

// GET: Live visit stats
app.get("/api/visit/stats", (req, res) => {
  const cutoff = Date.now() - VISIT_WINDOW_MS;
  const live = visitLog.filter((v) => v.timestamp >= cutoff);
  const uniqueIps = new Set(live.map((v) => v.ip));
  // Aggregate per path
  const pathCounts: Record<string, number> = {};
  live.forEach((v) => { pathCounts[v.path] = (pathCounts[v.path] || 0) + 1; });
  const paths = Object.entries(pathCounts)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count);

  // Recent visits (last 50)
  const recent = live.slice(-50).reverse().map((v) => ({
    path: v.path,
    time: v.timestamp,
  }));

  res.json({
    liveVisitors: uniqueIps.size,
    totalVisits: live.length,
    paths,
    recent,
  });
});

// GET: Health check
app.get("/api/health", async (req, res) => {
  const dbAlive = dbReady && (await checkDbConnection());
  res.json({
    status: dbAlive ? "ok" : "degraded",
    database: dbAlive ? "connected" : "unavailable",
  });
});

// POST: Add new product
app.post("/api/products", async (req, res) => {
  try {
    const input = req.body;

    if (!input.name || !input.productCode || !input.uom || !input.category) {
      return res.status(400).json({ error: "Missing required catalog fields. Name, Product Code, UoM, and Category are mandatory." });
    }

    const defaultImage = BLANK_PLACEHOLDER;

    const newProduct = {
      id: `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      productCode: String(input.productCode).toUpperCase().trim(),
      name: String(input.name).trim(),
      description: String(input.description || "").trim(),
      uom: String(input.uom).trim(),
      category: String(input.category).trim(),
      subCategory: String(input.subCategory || "General").trim(),
      status: ["Active", "Inactive"].includes(input.status) ? input.status : "Active",
      price: input.price !== undefined ? Math.max(0, parseFloat(input.price)) : null,
      stock: input.stock !== undefined ? Math.max(0, parseInt(input.stock, 10)) : null,
      imageUrl: String(input.imageUrl || defaultImage).trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await upsertProduct(newProduct);
    res.status(201).json(newProduct);
  } catch (err: any) {
    console.error("Error creating product:", err);
    res.status(500).json({ error: "Failed to create product." });
  }
});

// POST: Batch Import multiple parsed products (from Excel / CSV parser)
app.post("/api/products/import", async (req, res) => {
  try {
    const incoming = req.body;

    if (!Array.isArray(incoming)) {
      return res.status(400).json({ error: "Expected an array of imported products." });
    }

    // Build a map of existing products by productCode
    const allProducts = await getAllProducts();
    const existingByCode = new Map<string, any>();
    for (const p of allProducts) {
      existingByCode.set(p.productCode, p);
    }

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
      if (String(rawStatus).toLowerCase().includes("inactive") || String(rawStatus).toLowerCase() === "i") {
        norStatus = "Inactive";
      }

      const itemPrice = item.price || item["Price"] || item["Rate"];
      const itemStock = item.stock || item["Stock"] || item["Qty"] || item["Quantity"];

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
          price: itemPrice !== undefined ? Math.max(0, parseFloat(itemPrice)) : null,
          stock: itemStock !== undefined ? Math.max(0, parseInt(itemStock, 10)) : null,
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
    console.error("Error importing products:", err);
    res.status(500).json({ error: "Failed to import products." });
  }
});

// PUT: Update complete product specifications
app.put("/api/products/:id", async (req, res) => {
  try {
    const targetId = req.params.id;
    const existing = await getProductById(targetId);

    if (!existing) {
      return res.status(404).json({ error: `Catalog entry ${targetId} not found.` });
    }

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
      price: input.price !== undefined ? Math.max(0, parseFloat(input.price)) : existing.price,
      stock: input.stock !== undefined ? Math.max(0, parseInt(input.stock, 10)) : existing.stock,
      imageUrl: input.imageUrl !== undefined ? String(input.imageUrl).trim() : existing.imageUrl,
      updatedAt: new Date().toISOString()
    };

    await upsertProduct(updatedProduct);
    res.json(updatedProduct);
  } catch (err: any) {
    console.error("Error updating product:", err);
    res.status(500).json({ error: "Failed to update product." });
  }
});

// DELETE: Remove product from catalog
app.delete("/api/products/:id", async (req, res) => {
  try {
    const targetId = req.params.id;
    const deleted = await deleteProduct(targetId);

    if (!deleted) {
      return res.status(404).json({ error: `Catalog entry ${targetId} not found.` });
    }

    res.json({ success: true, message: `Product ${targetId} deleted from database registry.` });
  } catch (err: any) {
    console.error("Error deleting product:", err);
    res.status(500).json({ error: "Failed to delete product." });
  }
});

// --- Supplier CRUD Endpoints ---

async function getAllSuppliers(): Promise<any[]> {
  const p = getPool();
  if (!p || !dbReady) return [];
  const [rows] = await p.query<RowDataPacket[]>("SELECT * FROM suppliers ORDER BY createdAt DESC");
  return rows;
}

async function getSupplierById(id: string): Promise<any | null> {
  const p = getPool();
  if (!p || !dbReady) return null;
  const [rows] = await p.execute<RowDataPacket[]>("SELECT * FROM suppliers WHERE id = ?", [id]);
  return rows[0] || null;
}
async function upsertSupplier(supplier: any): Promise<void> {
  assertDb();
  const p = getPool()!;
  const columns = [
    "id",
    "\"applicationType\"",
    "\"oldSupplierCode\"",
    "\"companyName\"",
    "\"companyNameKhmer\"",
    "\"registrationType\"",
    "\"foreignTradeOperator\"",
    "\"contactPerson\"",
    "position",
    "email",
    "phone",
    "mobile",
    "website",
    "address",
    "\"addressKhmer\"",
    "\"cityProvince\"",
    "\"districtKhan\"",
    "\"businessLicense\"",
    "\"commercialRegistration\"",
    "\"taxRegistration\"",
    "\"vatCertificate\"",
    "\"patentTaxCertificate\"",
    "\"nationalId\"",
    "\"establishedYear\"",
    "\"businessActivity\"",
    "\"productServiceType\"",
    "\"otherDocuments\"",
    "\"bankName\"",
    "\"bankBranch\"",
    "\"bankAccount\"",
    "\"accountHolderName\"",
    "\"swiftCode\"",
    "iban",
    "\"checkAuthorization\"",
    "\"paymentMethod\"",
    "\"paymentMethodOther\"",
    "\"paymentTerm\"",
    "\"paymentTermOther\"",
    "\"conflictOfInterest\"",
    "\"conflictDetails\"",
    "\"supplierDeclarationName\"",
    "\"supplierDeclarationDate\"",
    "\"buyerCompletedName\"",
    "\"buyerCompletedDate\"",
    "\"companyProfile\"",
    "\"codeOfConductAck\"",
    "status",
    "notes",
    "\"createdAt\"",
    "\"updatedAt\"",
  ];
  const values = [
    supplier.id,
    supplier.applicationType || "new",
    supplier.oldSupplierCode || "",
    supplier.companyName,
    supplier.companyNameKhmer || "",
    supplier.registrationType || "vat",
    supplier.foreignTradeOperator ?? false,
    supplier.contactPerson || "",
    supplier.position || "",
    supplier.email || "",
    supplier.phone || "",
    supplier.mobile || "",
    supplier.website || "",
    supplier.address || "",
    supplier.addressKhmer || "",
    supplier.cityProvince || "",
    supplier.districtKhan || "",
    supplier.businessLicense || "",
    supplier.commercialRegistration || "",
    supplier.taxRegistration || "",
    supplier.vatCertificate || "",
    supplier.patentTaxCertificate || "",
    supplier.nationalId || "",
    supplier.establishedYear || "",
    supplier.businessActivity || "",
    supplier.productServiceType || "",
    supplier.otherDocuments || "",
    supplier.bankName || "",
    supplier.bankBranch || "",
    supplier.bankAccount || "",
    supplier.accountHolderName || "",
    supplier.swiftCode || "",
    supplier.iban || "",
    supplier.checkAuthorization ?? false,
    supplier.paymentMethod || "bank-transfer",
    supplier.paymentMethodOther || "",
    supplier.paymentTerm || "no-credit",
    supplier.paymentTermOther || "",
    supplier.conflictOfInterest ?? false,
    supplier.conflictDetails || "",
    supplier.supplierDeclarationName || "",
    supplier.supplierDeclarationDate || "",
    supplier.buyerCompletedName || "",
    supplier.buyerCompletedDate || "",
    supplier.companyProfile || "",
    supplier.codeOfConductAck ?? false,
    supplier.status || "Pending",
    supplier.notes || "",
    supplier.createdAt,
    supplier.updatedAt,
  ];
  const columnNames = columns.map((column) => column.replaceAll('"', ""));
  const escapedColumns = columnNames.map((column) => `\`${column}\``);
  const placeholders = columnNames.map(() => "?").join(", ");
  const updates = columnNames
    .filter((column) => column !== "id" && column !== "createdAt")
    .map((column) => `\`${column}\` = VALUES(\`${column}\`)`)
    .join(", ");

  await p.execute(
    `INSERT INTO suppliers (${escapedColumns.join(", ")})
     VALUES (${placeholders})
     ON DUPLICATE KEY UPDATE ${updates}`,
    values
  );
}

async function deleteSupplier(id: string): Promise<boolean> {
  assertDb();
  const p = getPool()!;
  const [result] = await p.execute<ResultSetHeader>("DELETE FROM suppliers WHERE id = ?", [id]);
  return result.affectedRows > 0;
}
app.get("/api/suppliers", async (req, res) => {
  try {
    const suppliers = await getAllSuppliers();
    res.json(suppliers);
  } catch (err: any) {
    console.error("Error fetching suppliers:", err);
    res.status(500).json({ error: "Failed to fetch suppliers." });
  }
});

app.get("/api/suppliers/filters/values", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const [statuses] = await p.query<RowDataPacket[]>("SELECT DISTINCT status FROM suppliers WHERE status != '' ORDER BY status");
    const [applicationTypes] = await p.query<RowDataPacket[]>("SELECT DISTINCT applicationType FROM suppliers WHERE applicationType != '' ORDER BY applicationType");
    const registrationTypes = ["vat", "non-vat"];
    const paymentMethods = ["bank-transfer", "cheque", "cash", "other"];
    const paymentTerms = ["no-credit", "one-week", "two-weeks", "one-month", "other"];
    res.json({
      statuses: statuses.map((row: any) => row.status),
      applicationTypes: applicationTypes.map((row: any) => row.applicationType),
      registrationTypes,
      paymentMethods,
      paymentTerms,
    });
  } catch (err: any) {
    console.error("Error fetching supplier filter values:", err);
    res.status(500).json({ error: "Failed to fetch supplier filter values." });
  }
});

app.get("/api/suppliers/:id", async (req, res) => {
  try {
    const supplier = await getSupplierById(req.params.id);
    if (!supplier) return res.status(404).json({ error: "Supplier not found." });
    res.json(supplier);
  } catch (err: any) {
    console.error("Error fetching supplier:", err);
    res.status(500).json({ error: "Failed to fetch supplier." });
  }
});

function cleanText(input: any, field: string, fallback = ""): string {
  return String(input[field] ?? fallback).trim();
}

function supplierPayload(input: any, existing: any = {}) {
  const paymentMethods = ["bank-transfer", "cheque", "cash", "other"];
  const paymentTerms = ["no-credit", "one-week", "two-weeks", "one-month", "other"];
  const statuses = ["Pending", "Approved", "Rejected", "Suspended"];

  return {
    applicationType: input.applicationType !== undefined && ["new", "update"].includes(input.applicationType) ? input.applicationType : existing.applicationType || "new",
    oldSupplierCode: input.oldSupplierCode !== undefined ? cleanText(input, "oldSupplierCode") : existing.oldSupplierCode || "",
    companyName: input.companyName !== undefined ? cleanText(input, "companyName") : existing.companyName || "",
    companyNameKhmer: input.companyNameKhmer !== undefined ? cleanText(input, "companyNameKhmer") : existing.companyNameKhmer || "",
    registrationType: input.registrationType !== undefined && ["vat", "non-vat"].includes(input.registrationType) ? input.registrationType : existing.registrationType || "vat",
    foreignTradeOperator: input.foreignTradeOperator !== undefined ? !!input.foreignTradeOperator : existing.foreignTradeOperator ?? false,
    contactPerson: input.contactPerson !== undefined ? cleanText(input, "contactPerson") : existing.contactPerson || "",
    position: input.position !== undefined ? cleanText(input, "position") : existing.position || "",
    email: input.email !== undefined ? cleanText(input, "email") : existing.email || "",
    phone: input.phone !== undefined ? cleanText(input, "phone") : existing.phone || "",
    mobile: input.mobile !== undefined ? cleanText(input, "mobile") : existing.mobile || "",
    website: input.website !== undefined ? cleanText(input, "website") : existing.website || "",
    address: input.address !== undefined ? cleanText(input, "address") : existing.address || "",
    addressKhmer: input.addressKhmer !== undefined ? cleanText(input, "addressKhmer") : existing.addressKhmer || "",
    cityProvince: input.cityProvince !== undefined ? cleanText(input, "cityProvince") : existing.cityProvince || "",
    districtKhan: input.districtKhan !== undefined ? cleanText(input, "districtKhan") : existing.districtKhan || "",
    businessLicense: input.businessLicense !== undefined ? cleanText(input, "businessLicense") : existing.businessLicense || "",
    commercialRegistration: input.commercialRegistration !== undefined ? cleanText(input, "commercialRegistration") : existing.commercialRegistration || "",
    taxRegistration: input.taxRegistration !== undefined ? cleanText(input, "taxRegistration") : existing.taxRegistration || "",
    vatCertificate: input.vatCertificate !== undefined ? cleanText(input, "vatCertificate") : existing.vatCertificate || "",
    patentTaxCertificate: input.patentTaxCertificate !== undefined ? cleanText(input, "patentTaxCertificate") : existing.patentTaxCertificate || "",
    nationalId: input.nationalId !== undefined ? cleanText(input, "nationalId") : existing.nationalId || "",
    establishedYear: input.establishedYear !== undefined ? cleanText(input, "establishedYear") : existing.establishedYear || "",
    businessActivity: input.businessActivity !== undefined ? cleanText(input, "businessActivity") : existing.businessActivity || "",
    productServiceType: input.productServiceType !== undefined ? cleanText(input, "productServiceType") : existing.productServiceType || "",
    otherDocuments: input.otherDocuments !== undefined ? cleanText(input, "otherDocuments") : existing.otherDocuments || "",
    bankName: input.bankName !== undefined ? cleanText(input, "bankName") : existing.bankName || "",
    bankBranch: input.bankBranch !== undefined ? cleanText(input, "bankBranch") : existing.bankBranch || "",
    bankAccount: input.bankAccount !== undefined ? cleanText(input, "bankAccount") : existing.bankAccount || "",
    accountHolderName: input.accountHolderName !== undefined ? cleanText(input, "accountHolderName") : existing.accountHolderName || "",
    swiftCode: input.swiftCode !== undefined ? cleanText(input, "swiftCode") : existing.swiftCode || "",
    iban: input.iban !== undefined ? cleanText(input, "iban") : existing.iban || "",
    checkAuthorization: input.checkAuthorization !== undefined ? !!input.checkAuthorization : existing.checkAuthorization ?? false,
    paymentMethod: input.paymentMethod !== undefined && paymentMethods.includes(input.paymentMethod) ? input.paymentMethod : existing.paymentMethod || "bank-transfer",
    paymentMethodOther: input.paymentMethodOther !== undefined ? cleanText(input, "paymentMethodOther") : existing.paymentMethodOther || "",
    paymentTerm: input.paymentTerm !== undefined && paymentTerms.includes(input.paymentTerm) ? input.paymentTerm : existing.paymentTerm || "no-credit",
    paymentTermOther: input.paymentTermOther !== undefined ? cleanText(input, "paymentTermOther") : existing.paymentTermOther || "",
    conflictOfInterest: input.conflictOfInterest !== undefined ? !!input.conflictOfInterest : existing.conflictOfInterest ?? false,
    conflictDetails: input.conflictDetails !== undefined ? cleanText(input, "conflictDetails") : existing.conflictDetails || "",
    supplierDeclarationName: input.supplierDeclarationName !== undefined ? cleanText(input, "supplierDeclarationName") : existing.supplierDeclarationName || "",
    supplierDeclarationDate: input.supplierDeclarationDate !== undefined ? cleanText(input, "supplierDeclarationDate") : existing.supplierDeclarationDate || "",
    buyerCompletedName: input.buyerCompletedName !== undefined ? cleanText(input, "buyerCompletedName") : existing.buyerCompletedName || "",
    buyerCompletedDate: input.buyerCompletedDate !== undefined ? cleanText(input, "buyerCompletedDate") : existing.buyerCompletedDate || "",
    companyProfile: input.companyProfile !== undefined ? cleanText(input, "companyProfile") : existing.companyProfile || "",
    codeOfConductAck: input.codeOfConductAck !== undefined ? !!input.codeOfConductAck : existing.codeOfConductAck ?? false,
    status: input.status !== undefined && statuses.includes(input.status) ? input.status : existing.status || "Pending",
    notes: input.notes !== undefined ? cleanText(input, "notes") : existing.notes || "",
  };
}

app.post("/api/suppliers", async (req, res) => {
  try {
    const input = req.body;
    if (!input.companyName) {
      return res.status(400).json({ error: "Company name is required." });
    }

    const newSupplier = {
      id: `sup-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ...supplierPayload(input),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await upsertSupplier(newSupplier);
    res.status(201).json(newSupplier);
  } catch (err: any) {
    console.error("Error creating supplier:", err);
    res.status(500).json({ error: "Failed to create supplier." });
  }
});

app.put("/api/suppliers/:id", async (req, res) => {
  try {
    const existing = await getSupplierById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Supplier not found." });

    const input = req.body;
    const updated = {
      ...existing,
      ...supplierPayload(input, existing),
      updatedAt: new Date().toISOString(),
    };

    await upsertSupplier(updated);
    res.json(updated);
  } catch (err: any) {
    console.error("Error updating supplier:", err);
    res.status(500).json({ error: "Failed to update supplier." });
  }
});

app.delete("/api/suppliers/:id", async (req, res) => {
  try {
    const deleted = await deleteSupplier(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Supplier not found." });
    res.json({ success: true, message: "Supplier deleted." });
  } catch (err: any) {
    console.error("Error deleting supplier:", err);
    res.status(500).json({ error: "Failed to delete supplier." });
  }
});

// ─── Stock Issue Items ───

// GET: List stock issue items with optional filters
app.get("/api/stock-issue-items", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { warehouse, department, campus, startDate, endDate, transactionType, search, page, pageSize } = req.query;
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (warehouse) { whereClauses.push("warehouse = ?"); params.push(warehouse); }
    if (department) { whereClauses.push("department = ?"); params.push(department); }
    if (campus) { whereClauses.push("campus = ?"); params.push(campus); }
    if (startDate) { whereClauses.push("transactionDate >= ?"); params.push(startDate); }
    if (endDate) { whereClauses.push("transactionDate <= ?"); params.push(endDate); }
    if (transactionType) { whereClauses.push("transactionType = ?"); params.push(transactionType); }
    if (search) {
      const q = `%${search}%`;
      whereClauses.push("(itemCode LIKE ? OR description LIKE ? OR requesterName LIKE ? OR warehouse LIKE ? OR division LIKE ? OR department LIKE ? OR campus LIKE ? OR referenceNo LIKE ? OR accountCode LIKE ? OR remarks LIKE ?)");
      params.push(q, q, q, q, q, q, q, q, q, q);
    }

    const whereSql = whereClauses.length > 0 ? " WHERE " + whereClauses.join(" AND ") : "";
    const orderSql = " ORDER BY transactionDate DESC, createdAt DESC";

    const [countRows] = await p.query<RowDataPacket[]>(`SELECT COUNT(*) as count FROM stock_issue_items${whereSql}`, params);
    const total = (countRows[0] as any).count;

    let rows: RowDataPacket[];
    if (page && pageSize) {
      const offset = (Number(page) - 1) * Number(pageSize);
      [rows] = await p.query<RowDataPacket[]>(`SELECT * FROM stock_issue_items${whereSql}${orderSql} LIMIT ? OFFSET ?`, [...params, Number(pageSize), offset]);
    } else {
      [rows] = await p.query<RowDataPacket[]>(`SELECT * FROM stock_issue_items${whereSql}${orderSql}`, params);
    }
    res.json({ items: rows, total });
  } catch (err: any) {
    console.error("Error fetching stock issue items:", err);
    res.status(500).json({ error: "Failed to fetch stock issue items." });
  }
});

app.get("/api/stock-issue-items/filters/values", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const [campuses] = await p.query<RowDataPacket[]>("SELECT DISTINCT campus FROM stock_issue_items WHERE campus != '' ORDER BY campus");
    const [transactionTypes] = await p.query<RowDataPacket[]>("SELECT DISTINCT transactionType FROM stock_issue_items WHERE transactionType != '' ORDER BY transactionType");
    res.json({
      campuses: campuses.map((row: any) => row.campus),
      transactionTypes: transactionTypes.map((row: any) => row.transactionType),
    });
  } catch (err: any) {
    console.error("Error fetching stock issue item filter values:", err);
    res.status(500).json({ error: "Failed to fetch stock issue item filter values." });
  }
});

// Bulk delete stock issue items by filter (requires at least one filter)
app.delete("/api/stock-issue-items/bulk", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { warehouse, department, campus, transactionType, startDate, endDate, search } = req.query;
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (warehouse) { whereClauses.push("warehouse = ?"); params.push(warehouse); }
    if (department) { whereClauses.push("department = ?"); params.push(department); }
    if (campus) { whereClauses.push("campus = ?"); params.push(campus); }
    if (transactionType) { whereClauses.push("transactionType = ?"); params.push(transactionType); }
    if (startDate) { whereClauses.push("transactionDate >= ?"); params.push(startDate); }
    if (endDate) { whereClauses.push("transactionDate <= ?"); params.push(endDate); }
    if (search) {
      const q = `%${search}%`;
      whereClauses.push("(itemCode LIKE ? OR description LIKE ? OR requesterName LIKE ? OR warehouse LIKE ? OR division LIKE ? OR department LIKE ? OR campus LIKE ? OR referenceNo LIKE ? OR accountCode LIKE ? OR remarks LIKE ?)");
      params.push(q, q, q, q, q, q, q, q, q, q);
    }

    if (whereClauses.length === 0) {
      return res.status(400).json({ error: "At least one filter is required for bulk delete." });
    }

    const whereSql = " WHERE " + whereClauses.join(" AND ");
    const [result] = await p.execute<ResultSetHeader>(`DELETE FROM stock_issue_items${whereSql}`, params);
    res.json({ success: true, count: result.affectedRows });
  } catch (err: any) {
    console.error("Error bulk deleting stock issue items:", err);
    res.status(500).json({ error: "Failed to bulk delete items." });
  }
});

// Delete a stock issue item (also supports bulk delete via :id=bulk + query params)
app.delete("/api/stock-issue-items/:id", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;

    // Bulk delete when id is "bulk" and filter query params are provided
    if (req.params.id === "bulk") {
      const { warehouse, department, campus, transactionType, startDate, endDate, search } = req.query;
      const whereClauses: string[] = [];
      const params: any[] = [];

      if (warehouse) { whereClauses.push("warehouse = ?"); params.push(warehouse); }
      if (department) { whereClauses.push("department = ?"); params.push(department); }
      if (campus) { whereClauses.push("campus = ?"); params.push(campus); }
      if (transactionType) { whereClauses.push("transactionType = ?"); params.push(transactionType); }
      if (startDate) { whereClauses.push("transactionDate >= ?"); params.push(startDate); }
      if (endDate) { whereClauses.push("transactionDate <= ?"); params.push(endDate); }
      if (search) {
        const q = `%${search}%`;
        whereClauses.push("(itemCode LIKE ? OR description LIKE ? OR requesterName LIKE ? OR warehouse LIKE ? OR division LIKE ? OR department LIKE ? OR campus LIKE ? OR referenceNo LIKE ? OR accountCode LIKE ? OR remarks LIKE ?)");
        params.push(q, q, q, q, q, q, q, q, q, q);
      }

      if (whereClauses.length === 0) {
        return res.status(400).json({ error: "At least one filter is required for bulk delete." });
      }

      const whereSql = " WHERE " + whereClauses.join(" AND ");
      const [bulkResult] = await p.execute<ResultSetHeader>(`DELETE FROM stock_issue_items${whereSql}`, params);
      return res.json({ success: true, count: bulkResult.affectedRows });
    }

    const [result] = await p.execute<ResultSetHeader>("DELETE FROM stock_issue_items WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Item not found." });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting stock issue item:", err);
    res.status(500).json({ error: "Failed to delete item." });
  }
});

// POST: Create a single stock issue item
app.post("/api/stock-issue-items", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { itemCode, description, quantity, uom, unitPrice, totalPrice, transactionDate, warehouse, division, department, campus, requesterName, referenceNo, transactionType, accountCode, remarks } = req.body;

    if (!itemCode || !description) {
      return res.status(400).json({ error: "Item code and description are required." });
    }

    const id = `sii-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const now = new Date().toISOString();

    await p.execute(
      `INSERT INTO stock_issue_items (id, itemCode, description, quantity, uom, unitPrice, totalPrice, transactionDate, warehouse, division, department, campus, requesterName, referenceNo, transactionType, accountCode, remarks, importedAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, itemCode, description, quantity ?? 0, uom ?? "Pcs", unitPrice ?? 0, totalPrice ?? 0,
       transactionDate || null, warehouse || "", division || "", department || "", campus || "",
       requesterName || "", referenceNo || "", transactionType || "", accountCode || "", remarks || "",
       now, now, now]
    );

    res.json({ success: true, id });
  } catch (err: any) {
    console.error("Error creating stock issue item:", err);
    res.status(500).json({ error: "Failed to create item." });
  }
});

// PUT: Update a stock issue item
app.put("/api/stock-issue-items/:id", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { itemCode, description, quantity, uom, unitPrice, totalPrice, transactionDate, warehouse, division, department, campus, requesterName, referenceNo, transactionType, accountCode, remarks } = req.body;

    const now = new Date().toISOString();
    const [result] = await p.execute<ResultSetHeader>(
      `UPDATE stock_issue_items SET itemCode = ?, description = ?, quantity = ?, uom = ?, unitPrice = ?, totalPrice = ?, transactionDate = ?, warehouse = ?, division = ?, department = ?, campus = ?, requesterName = ?, referenceNo = ?, transactionType = ?, accountCode = ?, remarks = ?, updatedAt = ? WHERE id = ?`,
      [itemCode, description, quantity ?? 0, uom ?? "Pcs", unitPrice ?? 0, totalPrice ?? 0,
       transactionDate || null, warehouse || "", division || "", department || "", campus || "",
       requesterName || "", referenceNo || "", transactionType || "", accountCode || "", remarks || "",
       now, req.params.id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: "Item not found." });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error updating stock issue item:", err);
    res.status(500).json({ error: "Failed to update item." });
  }
});

// POST: Import stock issue items (batch)
app.post("/api/stock-issue-items/import", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const items = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Expected a non-empty array of items." });
    }

    const now = new Date().toISOString();
    const imported: any[] = [];

    for (const item of items) {
      const id = `sii-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      const entry = {
        id,
        itemCode: String(item.itemCode || item["Code"] || item["ITEM CODE"] || "").trim(),
        description: String(item.description || item["Description"] || item["DESCRIPTION"] || "").trim(),
        quantity: parseFloat(item.quantity || item["Qty"] || item["QTY"] || item["Quantity"] || 0),
        uom: String(item.uom || item["UoM"] || item["UOM"] || item["Unit"] || "Pcs").trim(),
        unitPrice: parseFloat(item.unitPrice || item["Unit Price"] || item["UNIT PRICE"] || item["unit_price"] || 0),
        totalPrice: parseFloat(item.totalPrice || item["Total Amount"] || item["TOTAL AMOUNT"] || item["totalPrice"] || item["Amount"] || 0),
        transactionDate: item.transactionDate || item["Date"] || item["DATE"] || null,
        warehouse: String(item.warehouse || item["Warehouse"] || item["WAREHOUSE"] || "").trim(),
        division: String(item.division || item["Division"] || item["DIVISION"] || "").trim(),
        department: String(item.department || item["Department"] || item["DEPARTMENT"] || "").trim(),
        campus: String(item.campus || item["Campus"] || item["CAMPUS"] || "").trim(),
        requesterName: String(item.requesterName || item["Requester"] || item["REQUESTER"] || item["Requested By"] || "").trim(),
        referenceNo: String(item.referenceNo || item["Ref.No"] || item["REF.NO"] || item["Reference No"] || item["IO Number"] || "").trim(),
        transactionType: String(item.transactionType || item["Transaction Type"] || item["TRANSACTION TYPE"] || "").trim(),
        accountCode: String(item.accountCode || item["Account Code"] || item["ACCOUNT CODE"] || "").trim(),
        remarks: String(item.remarks || item["Description/ Purpose"] || item["DESCRIPTION/ PURPOSE"] || item["Remarks"] || "").trim(),
        importedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      imported.push(entry);
    }

    for (const entry of imported) {
      await p.execute(
        `INSERT INTO stock_issue_items (id, itemCode, description, quantity, uom, unitPrice, totalPrice, transactionDate, warehouse, division, department, campus, requesterName, referenceNo, transactionType, accountCode, remarks, importedAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [entry.id, entry.itemCode, entry.description, entry.quantity, entry.uom, entry.unitPrice, entry.totalPrice,
         entry.transactionDate, entry.warehouse, entry.division, entry.department, entry.campus, entry.requesterName,
         entry.referenceNo, entry.transactionType, entry.accountCode, entry.remarks, entry.importedAt, entry.createdAt, entry.updatedAt]
      );
    }

    res.json({ success: true, count: imported.length });
  } catch (err: any) {
    console.error("Error importing stock issue items:", err);
    res.status(500).json({ error: "Failed to import stock issue items." });
  }
});

// ─── Debit Note Email Configs ───

async function getAllDebitNoteEmails(): Promise<any[]> {
  const p = getPool();
  if (!p || !dbReady) return [];
  const [rows] = await p.query<RowDataPacket[]>("SELECT * FROM debit_note_emails ORDER BY createdAt DESC");
  return rows;
}

async function getDebitNoteEmailById(id: string): Promise<any | null> {
  const p = getPool();
  if (!p || !dbReady) return null;
  const [rows] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_note_emails WHERE id = ?", [id]);
  return rows[0] || null;
}

app.get("/api/debit-note/emails", async (req, res) => {
  try {
    const emails = await getAllDebitNoteEmails();
    res.json(emails);
  } catch (err: any) {
    console.error("Error fetching debit note emails:", err);
    res.status(500).json({ error: "Failed to fetch email configs." });
  }
});

app.get("/api/debit-note/emails/filters/values", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const [warehouses] = await p.query<RowDataPacket[]>("SELECT DISTINCT warehouse FROM debit_note_emails WHERE warehouse != '' ORDER BY warehouse");
    const [departments] = await p.query<RowDataPacket[]>("SELECT DISTINCT department FROM debit_note_emails WHERE department != '' ORDER BY department");
    const [campuses] = await p.query<RowDataPacket[]>("SELECT DISTINCT campus FROM debit_note_emails WHERE campus != '' ORDER BY campus");
    res.json({
      warehouses: warehouses.map((row: any) => row.warehouse),
      departments: departments.map((row: any) => row.department),
      campuses: campuses.map((row: any) => row.campus),
    });
  } catch (err: any) {
    console.error("Error fetching debit note email filter values:", err);
    res.status(500).json({ error: "Failed to fetch debit note email filter values." });
  }
});

app.get("/api/debit-note/emails/:id/edit", async (req, res) => {
  try {
    const email = await getDebitNoteEmailById(req.params.id);
    if (!email) return res.status(404).json({ error: "Email config not found." });
    res.json(email);
  } catch (err: any) {
    console.error("Error fetching email config:", err);
    res.status(500).json({ error: "Failed to fetch email config." });
  }
});

app.post("/api/debit-note/emails", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { warehouse, department, campus, receiverName, sendToEmail, ccToEmail } = req.body;

    if (!warehouse || !department || !campus || !receiverName) {
      return res.status(400).json({ error: "warehouse, department, campus, and receiverName are required." });
    }

    const sendTo = Array.isArray(sendToEmail) ? sendToEmail : [];
    const ccTo = Array.isArray(ccToEmail) ? ccToEmail : [];

    if (sendTo.length === 0) {
      return res.status(400).json({ error: "At least one send-to email is required." });
    }

    for (const email of sendTo) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: `Invalid email: ${email}` });
      }
    }
    for (const email of ccTo) {
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: `Invalid CC email: ${email}` });
      }
    }

    const now = new Date().toISOString();
    const id = `dne-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    await p.execute(
      `INSERT INTO debit_note_emails (id, warehouse, department, campus, receiverName, sendToEmail, ccToEmail, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE receiverName = VALUES(receiverName), sendToEmail = VALUES(sendToEmail), ccToEmail = VALUES(ccToEmail), updatedAt = VALUES(updatedAt)`,
      [id, warehouse, department, campus, receiverName, JSON.stringify(sendTo), JSON.stringify(ccTo), now, now]
    );

    const created = await getDebitNoteEmailById(id);
    res.status(201).json(created);
  } catch (err: any) {
    console.error("Error creating email config:", err);
    res.status(500).json({ error: "Failed to create email config." });
  }
});

app.put("/api/debit-note/emails/:id", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const existing = await getDebitNoteEmailById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Email config not found." });

    const { warehouse, department, campus, receiverName, sendToEmail, ccToEmail } = req.body;
    const sendTo = Array.isArray(sendToEmail) ? sendToEmail : JSON.parse(existing.sendToEmail || "[]");
    const ccTo = Array.isArray(ccToEmail) ? ccToEmail : JSON.parse(existing.ccToEmail || "[]");

    if (sendTo.length === 0) {
      return res.status(400).json({ error: "At least one send-to email is required." });
    }

    const now = new Date().toISOString();
    await p.execute(
      `UPDATE debit_note_emails SET warehouse = ?, department = ?, campus = ?, receiverName = ?, sendToEmail = ?, ccToEmail = ?, updatedAt = ? WHERE id = ?`,
      [
        warehouse ?? existing.warehouse,
        department ?? existing.department,
        campus ?? existing.campus,
        receiverName ?? existing.receiverName,
        JSON.stringify(sendTo),
        JSON.stringify(ccTo),
        now,
        req.params.id
      ]
    );

    const updated = await getDebitNoteEmailById(req.params.id);
    res.json(updated);
  } catch (err: any) {
    console.error("Error updating email config:", err);
    res.status(500).json({ error: "Failed to update email config." });
  }
});

app.delete("/api/debit-note/emails/:id", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const [result] = await p.execute<ResultSetHeader>("DELETE FROM debit_note_emails WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Email config not found." });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting email config:", err);
    res.status(500).json({ error: "Failed to delete email config." });
  }
});

// ─── Debit Note Generation ───

function generateDebitNoteNo(warehouse: string, department: string, campus: string): string {
  const now = new Date();
  const yy = now.getFullYear() % 100;
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const w = warehouse.replace(/[^A-Za-z0-9]/g, "").substring(0, 3).toUpperCase() || "WH";
  const d = department.replace(/[^A-Za-z0-9]/g, "").substring(0, 3).toUpperCase() || "DP";
  const c = campus.replace(/[^A-Za-z0-9]/g, "").substring(0, 5).toUpperCase() || "CMP";
  return `DN${yy}${mm}-${w}-${d}-${c}`;
}

// POST: Generate debit notes from stock issue items
app.post("/api/debit-notes/generate", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { startDate, endDate, warehouse, department, campus } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required." });
    }

    // Build query for stock issue items
    let sql = "SELECT * FROM stock_issue_items WHERE transactionDate >= ? AND transactionDate <= ?";
    const params: any[] = [startDate, endDate];

    if (warehouse) { sql += " AND warehouse = ?"; params.push(warehouse); }
    if (department) { sql += " AND department = ?"; params.push(department); }
    if (campus) { sql += " AND campus = ?"; params.push(campus); }

    sql += " ORDER BY warehouse, department, campus, transactionDate";
    const [items] = await p.query<RowDataPacket[]>(sql, params);

    if (items.length === 0) {
      return res.status(422).json({ error: "No stock issue items found for the given filters." });
    }

    // Group items by warehouse+department+campus
    const groups = new Map<string, any[]>();
    for (const item of items) {
      const key = `${item.warehouse}||${item.department}||${item.campus}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    const created: any[] = [];

    for (const [key, groupItems] of groups.entries()) {
      const [grpWarehouse, grpDepartment, grpCampus] = key.split("||");

      // Check email config exists
      const [emailConfigs] = await p.execute<RowDataPacket[]>(
        "SELECT * FROM debit_note_emails WHERE warehouse = ? AND department = ? AND campus = ? LIMIT 1",
        [grpWarehouse, grpDepartment, grpCampus]
      );

      if (emailConfigs.length === 0) {
        continue;
      }

      const emailConfig = emailConfigs[0];

      // Generate or update debit note
      const now = new Date().toISOString();
      const refNo = generateDebitNoteNo(grpWarehouse, grpDepartment, grpCampus);

      // Use updateOrCreate pattern: find existing by unique key
      const [existingNotes] = await p.execute<RowDataPacket[]>(
        "SELECT * FROM debit_notes WHERE warehouse = ? AND department = ? AND campus = ? AND startDate = ? AND endDate = ? LIMIT 1",
        [grpWarehouse, grpDepartment, grpCampus, startDate, endDate]
      );

      let debitNoteId: string;
      if (existingNotes.length > 0) {
        debitNoteId = existingNotes[0].id;
        await p.execute(
          "UPDATE debit_notes SET referenceNumber = ?, status = 'pending', debitNoteEmailId = ?, updatedAt = ? WHERE id = ?",
          [refNo, emailConfig.id, now, debitNoteId]
        );
        // Delete existing items
        await p.execute("DELETE FROM debit_note_items WHERE debitNoteId = ?", [debitNoteId]);
      } else {
        debitNoteId = `dn-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        await p.execute(
          `INSERT INTO debit_notes (id, referenceNumber, warehouse, department, campus, startDate, endDate, status, debitNoteEmailId, createdBy, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
          [debitNoteId, refNo, grpWarehouse, grpDepartment, grpCampus, startDate, endDate, emailConfig.id, req.body.createdBy || "system", now, now]
        );
      }

      // Bulk insert items
      for (const item of groupItems) {
        const itemId = `dni-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        await p.execute(
          `INSERT INTO debit_note_items (id, debitNoteId, stockIssueItemId, itemCode, description, quantity, uom, unitPrice, totalPrice, transactionDate, requesterName, campus, department, referenceNo, remarks, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [itemId, debitNoteId, item.id, item.itemCode, item.description, item.quantity, item.uom,
           item.unitPrice, item.totalPrice, item.transactionDate, item.requesterName,
           item.campus, item.department, item.referenceNo, item.remarks, now]
        );
      }

      const [noteRows] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_notes WHERE id = ?", [debitNoteId]);
      if (noteRows.length > 0) created.push(noteRows[0]);
    }

    if (created.length === 0) {
      return res.status(422).json({ error: "No debit notes generated. Ensure email configurations exist for the warehouse/department/campus combinations." });
    }

    res.json({ success: true, count: created.length, debitNotes: created });
  } catch (err: any) {
    console.error("Error generating debit notes:", err);
    res.status(500).json({ error: "Failed to generate debit notes." });
  }
});

// ─── Debit Note List & Detail ───

// GET: List debit notes with filters
app.get("/api/debit-notes", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { warehouse, department, campus, status, startDate, endDate, search, page, pageSize } = req.query;
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (warehouse) { whereClauses.push("warehouse = ?"); params.push(warehouse); }
    if (department) { whereClauses.push("department = ?"); params.push(department); }
    if (campus) { whereClauses.push("campus = ?"); params.push(campus); }
    if (status) {
      const statuses = String(status).split(",");
      whereClauses.push(`status IN (${statuses.map(() => "?").join(",")})`);
      params.push(...statuses);
    }
    if (startDate) { whereClauses.push("startDate >= ?"); params.push(startDate); }
    if (endDate) { whereClauses.push("endDate <= ?"); params.push(endDate); }
    if (search) {
      const q = `%${search}%`;
      whereClauses.push("(referenceNumber LIKE ? OR warehouse LIKE ? OR department LIKE ? OR campus LIKE ? OR createdBy LIKE ? OR status LIKE ?)");
      params.push(q, q, q, q, q, q);
    }

    const whereSql = whereClauses.length > 0 ? " WHERE " + whereClauses.join(" AND ") : "";
    const orderSql = " ORDER BY createdAt DESC";

    // Get total count
    const [countRows] = await p.query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM debit_notes${whereSql}`, params);
    const total = countRows[0]?.total || 0;

    let rows: RowDataPacket[];
    if (page && pageSize) {
      const offset = (Number(page) - 1) * Number(pageSize);
      [rows] = await p.query<RowDataPacket[]>(`SELECT * FROM debit_notes${whereSql}${orderSql} LIMIT ? OFFSET ?`, [...params, Number(pageSize), offset]);
    } else {
      [rows] = await p.query<RowDataPacket[]>(`SELECT * FROM debit_notes${whereSql}${orderSql}`, params);
    }

    // Bulk-fetch item counts and email configs to avoid N+1 queries
    const ids = rows.map((r) => r.id);
    const idPlaceholders = ids.length > 0 ? ids.map(() => "?").join(",") : "";

    // Item counts in bulk
    const itemCountMap = new Map<string, { count: number; totalAmount: number }>();
    if (idPlaceholders) {
      const [itemRows] = await p.query<RowDataPacket[]>(
        `SELECT debitNoteId, COUNT(*) as count, COALESCE(SUM(totalPrice), 0) as totalAmount FROM debit_note_items WHERE debitNoteId IN (${idPlaceholders}) GROUP BY debitNoteId`,
        ids
      );
      for (const r of itemRows) {
        itemCountMap.set(r.debitNoteId, { count: r.count, totalAmount: r.totalAmount });
      }
    }

    // Email configs in bulk
    const emailIds = rows.map((r) => r.debitNoteEmailId).filter(Boolean);
    const emailIdPlaceholders = emailIds.length > 0 ? emailIds.map(() => "?").join(",") : "";
    const emailMap = new Map<string, any>();
    if (emailIdPlaceholders) {
      const [emailRows] = await p.query<RowDataPacket[]>(
        `SELECT * FROM debit_note_emails WHERE id IN (${emailIdPlaceholders})`,
        emailIds
      );
      for (const r of emailRows) {
        emailMap.set(r.id, r);
      }
    }

    const result = rows.map((row) => {
      const itemData = itemCountMap.get(row.id) || { count: 0, totalAmount: 0 };
      return {
        ...row,
        itemCount: itemData.count,
        totalAmount: itemData.totalAmount,
        debitNoteEmail: row.debitNoteEmailId ? emailMap.get(row.debitNoteEmailId) || null : null,
      };
    });

    res.json({ data: result, total });
  } catch (err: any) {
    console.error("Error fetching debit notes:", err);
    res.status(500).json({ error: "Failed to fetch debit notes." });
  }
});

// GET: Single debit note with items
app.get("/api/debit-notes/:id", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const [noteRows] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_notes WHERE id = ?", [req.params.id]);
    if (noteRows.length === 0) return res.status(404).json({ error: "Debit note not found." });

    const note = noteRows[0];
    const [items] = await p.execute<RowDataPacket[]>(
      "SELECT * FROM debit_note_items WHERE debitNoteId = ? ORDER BY id ASC",
      [req.params.id]
    );

    let emailConfig = null;
    if (note.debitNoteEmailId) {
      const [emailRows] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_note_emails WHERE id = ?", [note.debitNoteEmailId]);
      emailConfig = emailRows[0] || null;
    }

    res.json({ ...note, items, debitNoteEmail: emailConfig });
  } catch (err: any) {
    console.error("Error fetching debit note:", err);
    res.status(500).json({ error: "Failed to fetch debit note." });
  }
});

// DELETE: Delete a debit note
app.delete("/api/debit-notes/:id", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    await p.execute("DELETE FROM debit_note_items WHERE debitNoteId = ?", [req.params.id]);
    const [result] = await p.execute<ResultSetHeader>("DELETE FROM debit_notes WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Debit note not found." });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting debit note:", err);
    res.status(500).json({ error: "Failed to delete debit note." });
  }
});

// ─── Email Progress Tracking ───

interface EmailProgress {
  status: string;
  finished: boolean;
  success_count?: number;
  failed_count?: number;
  failed_notes?: string[];
}

const emailProgressMap = new Map<string, EmailProgress>();

// GET: Get email progress
app.get("/api/debit-notes/email-progress", (req, res) => {
  const key = `dn_progress_${(req as any).user || "anonymous"}`;
  const progress = emailProgressMap.get(key) || { status: "No sending in progress.", finished: true };
  res.json(progress);
});

// ─── Email Sending ───

async function runSendDebitNotesEmail(
  debitNoteIds: string[],
  allowResend: boolean,
  progressKey: string,
  logoPath?: string
): Promise<void> {
  try {
    assertDb();
    const p = getPool()!;

    // Lock and update statuses within a transaction
    const conn = await p.getConnection();
    let connReleased = false;
    const noteDetails: any[] = [];
    let notes: any[] = [];
    try {
      await conn.beginTransaction();

      const placeholders = debitNoteIds.map(() => "?").join(",");
      const statusFilter = allowResend ? "status != 'sending'" : "status = 'pending'";
      const [lockedNotes] = await conn.execute<RowDataPacket[]>(
        `SELECT * FROM debit_notes WHERE id IN (${placeholders}) AND ${statusFilter} FOR UPDATE`,
        debitNoteIds
      );
      notes = lockedNotes;

      if (notes.length === 0) {
        await conn.rollback();
        conn.release();
        connReleased = true;
        emailProgressMap.set(progressKey, { status: "No eligible debit notes found.", finished: true });
        return;
      }

      const noteIds = notes.map((n: any) => n.id);
      await conn.execute(
        `UPDATE debit_notes SET status = 'sending' WHERE id IN (${noteIds.map(() => "?").join(",")})`,
        noteIds
      );

      await conn.commit();
      conn.release();
      connReleased = true;

      // Get email configs and items for each note
      for (const note of notes) {
        const [items] = await p.execute<RowDataPacket[]>(
          "SELECT * FROM debit_note_items WHERE debitNoteId = ? ORDER BY id ASC",
          [note.id]
        );
        let emailConfig = null;
        if (note.debitNoteEmailId) {
          const [emailRows] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_note_emails WHERE id = ?", [note.debitNoteEmailId]);
          emailConfig = emailRows[0] || null;
        }
        noteDetails.push({ ...note, items, emailConfig });
      }
    } finally {
      if (!connReleased) {
        try { conn.release(); } catch {}
      }
    }

    // Setup email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const fromAddress = process.env.MAIL_FROM_ADDRESS || process.env.SMTP_USER || "noreply@procurement.com";
    const fromName = process.env.MAIL_FROM_NAME || "PROCUREMENT";

    // Group notes by recipient email
    const recipientGroups = new Map<string, { notes: any[], cc: string[] }>();
    for (const detail of noteDetails) {
      if (!detail.emailConfig) {
        await p.execute("UPDATE debit_notes SET status = 'pending' WHERE id = ?", [detail.id]);
        continue;
      }
      const sendToEmails: string[] = JSON.parse(detail.emailConfig.sendToEmail || "[]");
      const ccEmails: string[] = JSON.parse(detail.emailConfig.ccToEmail || "[]");

      for (const email of sendToEmails) {
        const trimmed = email.trim();
        if (!trimmed) continue;
        if (!recipientGroups.has(trimmed)) {
          recipientGroups.set(trimmed, { notes: [], cc: [] });
        }
        recipientGroups.get(trimmed)!.notes.push(detail);
        // Merge CC emails
        for (const cc of ccEmails) {
          const ccTrimmed = cc.trim();
          if (ccTrimmed && ccTrimmed !== trimmed && !recipientGroups.get(trimmed)!.cc.includes(ccTrimmed)) {
            recipientGroups.get(trimmed)!.cc.push(ccTrimmed);
          }
        }
      }
    }

    let successCount = 0;
    let failedCount = 0;
    const failedNotesList: string[] = [];
    let emailIndex = 0;
    const totalEmails = recipientGroups.size;

    for (const [recipientEmail, group] of recipientGroups.entries()) {
      emailIndex++;
      emailProgressMap.set(progressKey, {
        status: `Sending email ${emailIndex} of ${totalEmails} to ${recipientEmail}`,
        finished: false,
      });

      try {
        // Generate Excel attachments for each debit note in the group
        const attachments: any[] = [];
        for (const detail of group.notes) {
          const workbook = new ExcelJS.Workbook();
          const sheet = workbook.addWorksheet("Debit Note");

          // Title
          sheet.mergeCells("A1:N1");
          const titleCell = sheet.getCell("A1");
          titleCell.value = "DEBIT NOTE";
          titleCell.font = { bold: true, size: 14 };
          titleCell.alignment = { horizontal: "center" };

          // Subtitle
          sheet.mergeCells("A2:N2");
          const subCell = sheet.getCell("A2");
          subCell.value = `${detail.department} - ${detail.warehouse} (${detail.startDate} - ${detail.endDate})`;
          subCell.font = { bold: true };
          subCell.alignment = { horizontal: "center" };

          // Headers
          const headers = ["No", "Date", "Code", "Item Name", "Qty", "UoM", "U/Price", "Amount", "Requester", "Campus", "Department", "IO Number", "Remarks"];
          const headerRow = sheet.getRow(4);
          headers.forEach((h, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = h;
            cell.font = { bold: true };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCFFCC" } };
            cell.alignment = { horizontal: "center" };
          });

          // Data rows
          let rowIdx = 5;
          for (const item of detail.items) {
            const row = sheet.getRow(rowIdx);
            row.getCell(1).value = rowIdx - 4;
            row.getCell(2).value = item.transactionDate || "";
            row.getCell(3).value = item.itemCode || "";
            row.getCell(4).value = item.description || "";
            row.getCell(5).value = parseFloat(item.quantity) || 0;
            row.getCell(6).value = item.uom || "";
            row.getCell(7).value = parseFloat(item.unitPrice) || 0;
            row.getCell(8).value = parseFloat(item.totalPrice) || 0;
            row.getCell(9).value = item.requesterName || "";
            row.getCell(10).value = item.campus || "";
            row.getCell(11).value = item.department || "";
            row.getCell(12).value = item.referenceNo || "";
            row.getCell(13).value = item.remarks || "";
            rowIdx++;
          }

          // Total row
          const totalRow = sheet.getRow(rowIdx);
          totalRow.getCell(7).value = "TOTAL:";
          totalRow.getCell(7).font = { bold: true };
          const totalCell = totalRow.getCell(8);
          totalCell.value = { formula: `SUM(H5:H${rowIdx - 1})` };
          totalCell.font = { bold: true };

          // Column widths
          sheet.getColumn(1).width = 5;
          sheet.getColumn(2).width = 12;
          sheet.getColumn(3).width = 15;
          sheet.getColumn(4).width = 30;
          sheet.getColumn(5).width = 10;
          sheet.getColumn(6).width = 8;
          sheet.getColumn(7).width = 12;
          sheet.getColumn(8).width = 15;
          sheet.getColumn(9).width = 20;
          sheet.getColumn(10).width = 15;
          sheet.getColumn(11).width = 15;
          sheet.getColumn(12).width = 15;
          sheet.getColumn(13).width = 20;

          const buffer = await workbook.xlsx.writeBuffer();
          const fileName = `DebitNote_${detail.department}_${detail.campus}_${detail.referenceNumber}.xlsx`.replace(/[^a-zA-Z0-9_.-]/g, "_");
          attachments.push({ filename: fileName, content: buffer as Buffer });
        }

        // Build subject
        const campusSet = new Set(group.notes.map((n: any) => n.campus));
        const deptSet = new Set(group.notes.map((n: any) => n.department));
        const campusStr = Array.from(campusSet).join(", ");
        const deptStr = Array.from(deptSet).join(", ");
        const periodStr = group.notes[0]?.startDate && group.notes[0]?.endDate
          ? `${group.notes[0].startDate} - ${group.notes[0].endDate}` : "";

        const subject = `Debit Note${group.notes.length > 1 ? "s" : ""}${periodStr ? ` (${periodStr})` : ""} for ${deptStr} - Campus (${campusStr})`;

        // Build HTML body
        let htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
            <h2 style="color: #1e3a5f;">Debit Note${group.notes.length > 1 ? "s" : ""}</h2>
            <p>Dear ${recipientEmail},</p>
            <p>Please find attached the debit note${group.notes.length > 1 ? "s" : ""} for the period <strong>${periodStr}</strong>.</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
              <tr style="background: #f0f4f8;">
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Reference</th>
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Department</th>
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Campus</th>
                <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">Items</th>
                <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">Total Amount</th>
              </tr>`;

        for (const detail of group.notes) {
          const itemTotal = detail.items.reduce((sum: number, item: any) => sum + parseFloat(item.totalPrice || 0), 0);
          htmlBody += `
            <tr>
              <td style="padding: 6px; border: 1px solid #ddd;">${detail.referenceNumber}</td>
              <td style="padding: 6px; border: 1px solid #ddd;">${detail.department}</td>
              <td style="padding: 6px; border: 1px solid #ddd;">${detail.campus}</td>
              <td style="padding: 6px; text-align: right; border: 1px solid #ddd;">${detail.items.length}</td>
              <td style="padding: 6px; text-align: right; border: 1px solid #ddd;">$${itemTotal.toFixed(2)}</td>
            </tr>`;
        }

        htmlBody += `
            </table>
            <p style="margin-top: 20px; color: #666; font-size: 12px;">
              This is an automated email from the PROCUREMENT system. Please do not reply directly.
            </p>
          </div>`;

        await transporter.sendMail({
          from: `"${fromName}" <${fromAddress}>`,
          to: recipientEmail,
          cc: group.cc.length > 0 ? group.cc.join(", ") : undefined,
          subject,
          html: htmlBody,
          attachments,
        });

        // Mark notes as sent
        const sentIds = group.notes.map((n: any) => n.id);
        const todayStr = new Date().toISOString().split("T")[0];
        await p.execute(
          `UPDATE debit_notes SET status = 'sent', sendDate = ? WHERE id IN (${sentIds.map(() => "?").join(",")})`,
          [todayStr, ...sentIds]
        );
        successCount++;
      } catch (err: any) {
        console.error(`Failed to send email to ${recipientEmail}:`, err);
        failedCount++;
        failedNotesList.push(`Failed to send to ${recipientEmail}: ${err.message}`);
        // Restore status
        const failedIds = group.notes.map((n: any) => n.id);
        await p.execute(
          `UPDATE debit_notes SET status = 'pending' WHERE id IN (${failedIds.map(() => "?").join(",")})`,
          failedIds
        );
      }
    }

    emailProgressMap.set(progressKey, {
      status: successCount > 0
        ? `Finished. Success: ${successCount}, Failed: ${failedCount}`
        : "No emails were sent.",
      finished: true,
      success_count: successCount,
      failed_count: failedCount,
      failed_notes: failedNotesList.slice(0, 10),
    });
  } catch (err: any) {
    console.error("Error in debit note email job:", err);
    emailProgressMap.set(progressKey, { status: `Error: ${err.message}`, finished: true, failed_count: 1, failed_notes: [err.message] });
  }
}

// POST: Send debit note emails (bulk)
app.post("/api/debit-notes/send-emails", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { ids, warehouse, department, campus, startDate, endDate } = req.body;

    let noteIds: string[] = [];

    if (Array.isArray(ids) && ids.length > 0) {
      noteIds = ids;
    } else {
      // Build query to find eligible pending notes
      let sql = "SELECT id FROM debit_notes WHERE status = 'pending'";
      const params: any[] = [];

      if (warehouse) { sql += " AND warehouse = ?"; params.push(warehouse); }
      if (department) { sql += " AND department = ?"; params.push(department); }
      if (campus) { sql += " AND campus = ?"; params.push(campus); }
      if (startDate) { sql += " AND startDate >= ?"; params.push(startDate); }
      if (endDate) { sql += " AND endDate <= ?"; params.push(endDate); }

      const [rows] = await p.query<RowDataPacket[]>(sql, params);
      noteIds = rows.map((r: any) => r.id);
    }

    if (noteIds.length === 0) {
      return res.status(422).json({ error: "No eligible debit notes found to send." });
    }

    const progressKey = `dn_progress_${req.body.user || "anonymous"}`;

    // Check if already in progress
    const existing = emailProgressMap.get(progressKey);
    if (existing && !existing.finished) {
      return res.status(409).json({ error: "Email sending is already in progress." });
    }

    emailProgressMap.set(progressKey, { status: "Starting...", finished: false });

    // Run asynchronously (non-blocking)
    runSendDebitNotesEmail(noteIds, false, progressKey, req.body.logoPath);

    res.json({ success: true, message: "Email sending started. Track progress via email-progress endpoint." });
  } catch (err: any) {
    console.error("Error sending debit note emails:", err);
    res.status(500).json({ error: "Failed to send emails." });
  }
});

// POST: Resend a single debit note email
app.post("/api/debit-notes/:id/resend", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const [noteRows] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_notes WHERE id = ?", [req.params.id]);
    if (noteRows.length === 0) return res.status(404).json({ error: "Debit note not found." });

    const progressKey = `dn_progress_${req.body.user || "anonymous"}`;
    const existing = emailProgressMap.get(progressKey);
    if (existing && !existing.finished) {
      return res.status(409).json({ error: "Email sending is already in progress." });
    }

    emailProgressMap.set(progressKey, { status: "Starting...", finished: false });
    runSendDebitNotesEmail([req.params.id], true, progressKey, req.body.logoPath);

    res.json({ success: true, message: "Resending email." });
  } catch (err: any) {
    console.error("Error resending debit note email:", err);
    res.status(500).json({ error: "Failed to resend email." });
  }
});

// ─── Excel Export ───

// GET: Export single debit note to Excel
app.get("/api/debit-notes/:id/export", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const [noteRows] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_notes WHERE id = ?", [req.params.id]);
    if (noteRows.length === 0) return res.status(404).json({ error: "Debit note not found." });

    const note = noteRows[0];
    const [items] = await p.execute<RowDataPacket[]>(
      "SELECT * FROM debit_note_items WHERE debitNoteId = ? ORDER BY id ASC",
      [req.params.id]
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Debit Note");

    // Title
    sheet.mergeCells("A1:M1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = "DEBIT NOTE";
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: "center" };

    // Subtitle
    sheet.mergeCells("A2:M2");
    const subCell = sheet.getCell("A2");
    subCell.value = `${note.department} - ${note.warehouse} (${note.startDate} - ${note.endDate})`;
    subCell.font = { bold: true };
    subCell.alignment = { horizontal: "center" };

    // Headers
    const headers = ["No", "Date", "Code", "Item Name", "Qty", "UoM", "U/Price", "Amount", "Requester", "Campus", "Department", "IO Number", "Remarks"];
    const headerRow = sheet.getRow(4);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCFFCC" } };
      cell.alignment = { horizontal: "center" };
    });

    // Data
    let rowIdx = 5;
    for (const item of items) {
      const row = sheet.getRow(rowIdx);
      row.getCell(1).value = rowIdx - 4;
      row.getCell(2).value = item.transactionDate || "";
      row.getCell(3).value = item.itemCode || "";
      row.getCell(4).value = item.description || "";
      row.getCell(5).value = parseFloat(item.quantity) || 0;
      row.getCell(6).value = item.uom || "";
      row.getCell(7).value = parseFloat(item.unitPrice) || 0;
      row.getCell(8).value = parseFloat(item.totalPrice) || 0;
      row.getCell(9).value = item.requesterName || "";
      row.getCell(10).value = item.campus || "";
      row.getCell(11).value = item.department || "";
      row.getCell(12).value = item.referenceNo || "";
      row.getCell(13).value = item.remarks || "";
      rowIdx++;
    }

    // Total
    const totalRow = sheet.getRow(rowIdx);
    totalRow.getCell(7).value = "TOTAL:";
    totalRow.getCell(7).font = { bold: true };
    const totalCell = totalRow.getCell(8);
    totalCell.value = { formula: `SUM(H5:H${rowIdx - 1})` };
    totalCell.font = { bold: true };

    // Column widths
    sheet.getColumn(1).width = 5;
    sheet.getColumn(2).width = 12;
    sheet.getColumn(3).width = 15;
    sheet.getColumn(4).width = 30;
    sheet.getColumn(5).width = 10;
    sheet.getColumn(6).width = 8;
    sheet.getColumn(7).width = 12;
    sheet.getColumn(8).width = 15;
    sheet.getColumn(9).width = 20;
    sheet.getColumn(10).width = 15;
    sheet.getColumn(11).width = 15;
    sheet.getColumn(12).width = 15;
    sheet.getColumn(13).width = 20;

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `DebitNote_${note.referenceNumber}.xlsx`.replace(/[^a-zA-Z0-9_.-]/g, "_");

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (err: any) {
    console.error("Error exporting debit note:", err);
    res.status(500).json({ error: "Failed to export debit note." });
  }
});

// POST: Bulk export debit notes as ZIP
app.post("/api/debit-notes/export-bulk", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { ids, warehouse, department, campus, startDate, endDate, status } = req.body;

    let noteIds: string[] = [];
    if (Array.isArray(ids) && ids.length > 0) {
      noteIds = ids;
    } else {
      let sql = "SELECT id FROM debit_notes WHERE 1=1";
      const params: any[] = [];
      if (warehouse) { sql += " AND warehouse = ?"; params.push(warehouse); }
      if (department) { sql += " AND department = ?"; params.push(department); }
      if (campus) { sql += " AND campus = ?"; params.push(campus); }
      if (status) { sql += " AND status = ?"; params.push(status); }
      if (startDate) { sql += " AND startDate >= ?"; params.push(startDate); }
      if (endDate) { sql += " AND endDate <= ?"; params.push(endDate); }
      const [rows] = await p.query<RowDataPacket[]>(sql, params);
      noteIds = rows.map((r: any) => r.id);
    }

    if (noteIds.length === 0) {
      return res.status(422).json({ error: "No debit notes found." });
    }

    const zipFileName = `debit-notes-export-${Date.now()}.zip`;
    const zipPath = path.join(process.cwd(), "temp", zipFileName);
    if (!fs.existsSync(path.join(process.cwd(), "temp"))) {
      fs.mkdirSync(path.join(process.cwd(), "temp"), { recursive: true });
    }

    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(output);

    for (const noteId of noteIds) {
      const [noteRows] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_notes WHERE id = ?", [noteId]);
      if (noteRows.length === 0) continue;
      const note = noteRows[0];

      const [items] = await p.execute<RowDataPacket[]>(
        "SELECT * FROM debit_note_items WHERE debitNoteId = ? ORDER BY id ASC",
        [noteId]
      );

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Debit Note");

      sheet.mergeCells("A1:M1");
      sheet.getCell("A1").value = "DEBIT NOTE";
      sheet.getCell("A1").font = { bold: true, size: 14 };
      sheet.getCell("A1").alignment = { horizontal: "center" };

      sheet.mergeCells("A2:M2");
      sheet.getCell("A2").value = `${note.department} - ${note.warehouse} (${note.startDate} - ${note.endDate})`;
      sheet.getCell("A2").font = { bold: true };
      sheet.getCell("A2").alignment = { horizontal: "center" };

      const headers = ["No", "Date", "Code", "Item Name", "Qty", "UoM", "U/Price", "Amount", "Requester", "Campus", "Department", "IO Number", "Remarks"];
      const headerRow = sheet.getRow(4);
      headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCFFCC" } };
        cell.alignment = { horizontal: "center" };
      });

      let rowIdx = 5;
      for (const item of items) {
        const row = sheet.getRow(rowIdx);
        row.getCell(1).value = rowIdx - 4;
        row.getCell(2).value = item.transactionDate || "";
        row.getCell(3).value = item.itemCode || "";
        row.getCell(4).value = item.description || "";
        row.getCell(5).value = parseFloat(item.quantity) || 0;
        row.getCell(6).value = item.uom || "";
        row.getCell(7).value = parseFloat(item.unitPrice) || 0;
        row.getCell(8).value = parseFloat(item.totalPrice) || 0;
        row.getCell(9).value = item.requesterName || "";
        row.getCell(10).value = item.campus || "";
        row.getCell(11).value = item.department || "";
        row.getCell(12).value = item.referenceNo || "";
        row.getCell(13).value = item.remarks || "";
        rowIdx++;
      }

      const totalRow = sheet.getRow(rowIdx);
      totalRow.getCell(7).value = "TOTAL:";
      totalRow.getCell(7).font = { bold: true };
      const totalCell = totalRow.getCell(8);
      totalCell.value = { formula: `SUM(H5:H${rowIdx - 1})` };
      totalCell.font = { bold: true };

      sheet.getColumn(1).width = 5;
      sheet.getColumn(2).width = 12;
      sheet.getColumn(3).width = 15;
      sheet.getColumn(4).width = 30;
      sheet.getColumn(5).width = 10;
      sheet.getColumn(6).width = 8;
      sheet.getColumn(7).width = 12;
      sheet.getColumn(8).width = 15;
      sheet.getColumn(9).width = 20;
      sheet.getColumn(10).width = 15;
      sheet.getColumn(11).width = 15;
      sheet.getColumn(12).width = 15;
      sheet.getColumn(13).width = 20;

      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = `DebitNote_${note.referenceNumber}.xlsx`.replace(/[^a-zA-Z0-9_.-]/g, "_");
      archive.append(buffer as Buffer, { name: fileName });
    }

    await archive.finalize();

    await new Promise<void>((resolve) => output.on("close", resolve));

    res.download(zipPath, zipFileName, () => {
      fs.unlinkSync(zipPath);
    });
  } catch (err: any) {
    console.error("Error bulk exporting debit notes:", err);
    res.status(500).json({ error: "Failed to export debit notes." });
  }
});

// GET: Get distinct filter values for dropdowns
app.get("/api/debit-notes/filters/values", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const [warehouses] = await p.query<RowDataPacket[]>("SELECT DISTINCT warehouse FROM stock_issue_items WHERE warehouse != '' ORDER BY warehouse");
    const [departments] = await p.query<RowDataPacket[]>("SELECT DISTINCT department FROM stock_issue_items WHERE department != '' ORDER BY department");
    const [campuses] = await p.query<RowDataPacket[]>("SELECT DISTINCT campus FROM stock_issue_items WHERE campus != '' ORDER BY campus");
    const [statuses] = await p.query<RowDataPacket[]>("SELECT DISTINCT status FROM debit_notes WHERE status != '' ORDER BY status");
    res.json({
      warehouses: warehouses.map((r: any) => r.warehouse),
      departments: departments.map((r: any) => r.department),
      campuses: campuses.map((r: any) => r.campus),
      statuses: statuses.map((r: any) => r.status),
    });
  } catch (err: any) {
    console.error("Error fetching filter values:", err);
    res.status(500).json({ error: "Failed to fetch filter values." });
  }
});

// POST: AI Copywriter assistant with Gemini
app.post("/api/ai/copywrite", async (req, res) => {
  try {
    const { name, category, subCategory, keywords, tone } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Product name is required for generation." });
    }

    const ai = getGeminiAI();
    if (!ai) {
      return res.status(503).json({
        error: "AI service could not load. Ensure your GEMINI_API_KEY is configured in Secrets settings."
      });
    }

    const keywordsStr = keywords && Array.isArray(keywords) ? keywords.filter(Boolean).join(", ") : "None";
    const selectedTone = tone || "professional";

    const prompt = `Develop logical catalog attributes for a newly catalogued product with these raw properties:
    - Rough Product Title: "${name}"
    - Rough Category Hint: "${category || 'General'}"
    - Rough Subcategory Hint: "${subCategory || 'General'}"
    - Attributes / Keywords: "${keywordsStr}"
    - Copy tone: "${selectedTone}"
    
    You must generate and autofill:
    1. A concise, professional e-commerce product description (70-130 words). Clean, direct, and benefit-focused.
    2. A suggested logical standard Unit of Measure (UoM) (must select one option like: 'Pcs', 'Box', 'Set', 'Kg', 'Pack', 'Doz').
    3. A polished, standardized Category name.
    4. A polished, standardized Subcategory name.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a senior catalog architect and structured content generator. Respond strictly with formatted structured fields, avoiding all conversational fluff or markdown wrapper texts.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: {
              type: Type.STRING,
              description: "Expert clean product catalog description explaining utility, craftsmanship and specs."
            },
            uom: {
              type: Type.STRING,
              description: "Logical single value representing Unit of Measure, e.g. Pcs, Box, Set, Pack."
            },
            category: {
              type: Type.STRING,
              description: "Polished standard Category title."
            },
            subCategory: {
              type: Type.STRING,
              description: "Polished standard Subcategory title."
            }
          },
          required: ["description", "uom", "category", "subCategory"]
        }
      }
    });

    const parsedData = JSON.parse(response.text || "{}");
    res.json(parsedData);
  } catch (err: any) {
    console.error("Gemini AI copy generation failure:", err);
    res.status(500).json({ error: "Gemini copywriter was unable to complete this query.", details: err.message });
  }
});

// --- Server Delivery Pipelines ---
async function startServer() {
  await initDb();

  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use("/uploads", express.static(uploadsDir));

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { port: 0 } },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const tryListen = (port: number) => {
    const server = createHttpServer(app);

    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        const fallbackPort = port + 1;
        console.warn(`Port ${port} is already in use. Trying ${fallbackPort} instead.`);
        tryListen(fallbackPort);
        return;
      }

      console.error("Failed to start server:", err);
      process.exit(1);
    });

    server.listen(port, "0.0.0.0", () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      console.log(`PROCUREMENT Engine successfully serving at http://0.0.0.0:${actualPort} on ${process.env.NODE_ENV || 'development'} mode.`);
    });
  };

  tryListen(PORT);
}

startServer();
