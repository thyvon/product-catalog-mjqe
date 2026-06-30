import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import mysql, { type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import dotenv from "dotenv";

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
      let codeStr = item.productCode || item["Product Code"] || item["code"] || item["Code"];
      let nameStr = item.name || item["Product Name"] || item["Name"] || item["Product Name/Description"] || item["Description"];
      let descStr = item.description || item["Description"] || item["Product Name/Description"] || "";
      let uomStr = item.uom || item["UoM"] || item["unit"] || item["Unit"] || "Pcs";
      let catStr = item.category || item["Category"] || "General";
      let subCatStr = item.subCategory || item["Sub Category"] || item["SubCategory"] || "";
      let imgStr = item.imageUrl || item["Image"] || item["imageUrl"] || item["Photo"] || "";

      let rawStatus = item.status || item["Status"] || "Active";
      let norStatus = "Active";
      if (String(rawStatus).toLowerCase().includes("inactive") || String(rawStatus).toLowerCase() === "i") {
        norStatus = "Inactive";
      }

      let itemPrice = item.price || item["Price"] || item["Rate"];
      let itemStock = item.stock || item["Stock"] || item["Qty"] || item["Quantity"];

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
      server: { middlewareMode: true },
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Product Catalog Engine successfully serving at http://0.0.0.0:${PORT} on ${process.env.NODE_ENV || 'development'} mode.`);
  });
}

startServer();
