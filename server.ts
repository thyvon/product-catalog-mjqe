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
import { ZipArchive } from "archiver";
import { isMinioEnabled, saveObject, getObject, getLocalUploadsDir } from "./src/server/services/storage.js";

dotenv.config();

const app = express();

const BLANK_PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect fill="#f1f5f9" width="400" height="400"/><text x="50%" y="45%" fill="#94a3b8" font-family="monospace" font-size="16" font-weight="bold" text-anchor="middle" dominant-baseline="middle">NO IMAGE</text><text x="50%" y="55%" fill="#94a3b8" font-family="monospace" font-size="11" text-anchor="middle" dominant-baseline="middle">Click to upload</text></svg>`);
const PORT = parseInt(process.env.PORT || "3000", 10);

// Debit note Excel logo (fetched from remote URL and cached)
const DEBIT_NOTE_LOGO_URL = "https://sms.mjqeducation.edu.kh/assets/images/logo/logo-dark.png";
const DEBIT_NOTE_LOGO_WIDTH = 140;
const DEBIT_NOTE_LOGO_HEIGHT = 67;
let debitNoteLogoBase64: string | null = null;
let debitNoteLogoLoadPromise: Promise<void> | null = null;

async function loadDebitNoteLogo(): Promise<void> {
  try {
    const res = await fetch(DEBIT_NOTE_LOGO_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) throw new Error("Empty image response");
    debitNoteLogoBase64 = buffer.toString("base64");
    console.log(`[logo] Debit note logo loaded (${buffer.length} bytes): ${DEBIT_NOTE_LOGO_URL}`);
  } catch (err: any) {
    console.warn(`[logo] Failed to load debit note logo from ${DEBIT_NOTE_LOGO_URL}:`, err?.message || err);
  }
}

function ensureDebitNoteLogo(): void {
  if (!debitNoteLogoLoadPromise) debitNoteLogoLoadPromise = loadDebitNoteLogo();
}

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

// MySQL connection pool (XAMPP for local development)
let pool: mysql.Pool | null = null;
let dbReady = false;

function getPool(): mysql.Pool | null {
  return pool;
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

function getDbConfig() {
  return {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_DATABASE || "product_catalog",
  };
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
      countryOfOrigin VARCHAR(150) NOT NULL DEFAULT '',
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

    // Indexes for large-dataset analytics (date-range + type filters)
    try { await pool.query("ALTER TABLE stock_issue_items ADD INDEX ssi_date_idx (transactionDate)"); } catch {}
    try { await pool.query("ALTER TABLE stock_issue_items ADD INDEX ssi_type_date_idx (transactionType, transactionDate)"); } catch {}
    try { await pool.query("ALTER TABLE stock_issue_items ADD INDEX ssi_item_idx (itemCode)"); } catch {}
    try { await pool.query("ALTER TABLE stock_issue_items ADD INDEX ssi_campus_idx (campus)"); } catch {}
    try { await pool.query("ALTER TABLE stock_issue_items ADD INDEX ssi_department_idx (department)"); } catch {}
    try { await pool.query("ALTER TABLE stock_issue_items ADD INDEX ssi_division_idx (division)"); } catch {}
    try { await pool.query("ALTER TABLE stock_issue_items ADD INDEX ssi_warehouse_idx (warehouse)"); } catch {}

    await pool.query(`CREATE TABLE IF NOT EXISTS debit_note_emails (
      id VARCHAR(64) PRIMARY KEY,
      warehouse VARCHAR(255) NOT NULL DEFAULT '',
      department VARCHAR(255) NOT NULL DEFAULT '',
      campus VARCHAR(255) NOT NULL DEFAULT '',
      division VARCHAR(255) NOT NULL DEFAULT '',
      receiverName VARCHAR(255) NOT NULL DEFAULT '',
      sendToEmail JSON NOT NULL,
      ccToEmail JSON NOT NULL,
      createdAt VARCHAR(40) NOT NULL,
      updatedAt VARCHAR(40) NOT NULL,
      UNIQUE KEY dn_emails_unique (warehouse, division, department, campus)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    try { await pool.query("ALTER TABLE debit_note_emails ADD COLUMN division VARCHAR(255) NOT NULL DEFAULT '' AFTER campus"); } catch {}
    try { await pool.query("ALTER TABLE debit_note_emails DROP INDEX dn_emails_unique"); } catch {}
    try { await pool.query("ALTER TABLE debit_note_emails ADD UNIQUE KEY dn_emails_unique (warehouse, division, department, campus)"); } catch {}

    await pool.query(`CREATE TABLE IF NOT EXISTS debit_notes (
      id VARCHAR(64) PRIMARY KEY,
      referenceNumber VARCHAR(255) NOT NULL,
      warehouse VARCHAR(255) NOT NULL DEFAULT '',
      department VARCHAR(255) NOT NULL DEFAULT '',
      campus VARCHAR(255) NOT NULL DEFAULT '',
      startDate DATE NULL,
      endDate DATE NULL,
      sendDate DATE NULL,
      division VARCHAR(255) NOT NULL DEFAULT '',
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
    try { await pool.query("ALTER TABLE debit_note_items ADD COLUMN division VARCHAR(255) NOT NULL DEFAULT '' AFTER campus"); } catch {}
    try { await pool.query("ALTER TABLE debit_notes ADD COLUMN division VARCHAR(255) NOT NULL DEFAULT '' AFTER campus"); } catch {}

    await pool.query(`CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'User',
      fullName VARCHAR(255) NOT NULL DEFAULT '',
      email VARCHAR(255) NOT NULL DEFAULT '',
      phone VARCHAR(50) NOT NULL DEFAULT '',
      position VARCHAR(255) NOT NULL DEFAULT '',
      telegramId VARCHAR(100) NOT NULL DEFAULT '',
      avatarUrl TEXT NOT NULL,
      createdAt VARCHAR(40) NOT NULL,
      updatedAt VARCHAR(40) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    try { await pool.query("ALTER TABLE users ADD COLUMN position VARCHAR(255) NOT NULL DEFAULT '' AFTER phone"); } catch {}
    try { await pool.query("ALTER TABLE users ADD COLUMN telegramId VARCHAR(100) NOT NULL DEFAULT '' AFTER position"); } catch {}
    try { await pool.query("ALTER TABLE suppliers ADD COLUMN countryOfOrigin VARCHAR(150) NOT NULL DEFAULT '' AFTER foreignTradeOperator"); } catch {}

    // Seed default users
    const now = new Date().toISOString();
    await pool.execute(
      `INSERT IGNORE INTO users (id, username, password, role, fullName, email, phone, position, telegramId, avatarUrl, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["usr-001", "admin", "admin", "Admin", "System Administrator", "", "", "", "", "", now, now]
    );
    await pool.execute(
      `INSERT IGNORE INTO users (id, username, password, role, fullName, email, phone, position, telegramId, avatarUrl, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["usr-002", "procurement", "procurement", "Procurement", "Procurement Officer", "", "", "", "", "", now, now]
    );
    await pool.execute(
      `INSERT IGNORE INTO suppliers (
        id, applicationType, oldSupplierCode, companyName, companyNameKhmer, registrationType,
        foreignTradeOperator, countryOfOrigin, contactPerson, position, email, phone, mobile, website,
        address, addressKhmer, cityProvince, districtKhan, businessLicense, commercialRegistration,
        taxRegistration, vatCertificate, patentTaxCertificate, nationalId, establishedYear, businessActivity,
        productServiceType, otherDocuments, bankName, bankBranch, bankAccount, accountHolderName, swiftCode,
        iban, checkAuthorization, paymentMethod, paymentMethodOther, paymentTerm, paymentTermOther,
        conflictOfInterest, conflictDetails, supplierDeclarationName, supplierDeclarationDate,
        buyerCompletedName, buyerCompletedDate, companyProfile, codeOfConductAck, status, notes,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["sup-seed-001", "new", "", "Acme Trading Co., Ltd.", "ក្រុមហ៊ុន អេកមី ប្រូឌូឃ្មង", "vat", true, "Cambodia",
        "Sopheap Chan", "Managing Director", "sopheap@acmetrading.com", "+855 12 345 678", "+855 88 123 4567",
        "https://acmetrading.com", "123 Russian Federation Blvd, Phnom Penh", "ផ្លូវ 123 មហាវិថី ភ្នំពេញ",
        "Phnom Penh", "Khan Toul Kork", "LIC-00112233", "MRC-2021-000456",
        "Tax-000-889", "VAT-213-332", "PT-2025-778", "NID-004-112233",
        "2023", "General trading, office supplies, stationery", "Office products, paper, ink",
        "BODIUM", "ACLEDA Bank", "Main Branch", "001234567", "Acme Trading Co., Ltd.",
        "ACLBKHPP", "KH", true, "bank-transfer", "", "one-month", "",
        false, "", "Sara Chan", "2025-12-15",
        "Dara Vong", "2025-12-16", "Wholesale & retail supplier of office consumables.", true,
        "Pending", "Test seed supplier",
        now, now
      ]
    );

    await pool.query(`CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(100) PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt VARCHAR(40) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    // ─── Product Management module (pm_*) ───

    await pool.query(`CREATE TABLE IF NOT EXISTS pm_categories (
      id VARCHAR(64) PRIMARY KEY,
      parent_id VARCHAR(64) NULL,
      code VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'Active',
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      UNIQUE KEY pm_categories_code_unique (code),
      INDEX pm_categories_parent_idx (parent_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await pool.query(`CREATE TABLE IF NOT EXISTS pm_product_groups (
      id VARCHAR(64) PRIMARY KEY,
      category_id VARCHAR(64) NOT NULL,
      code VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'Active',
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      UNIQUE KEY pm_product_groups_code_unique (code),
      INDEX pm_product_groups_category_idx (category_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await pool.query(`CREATE TABLE IF NOT EXISTS pm_brands (
      id VARCHAR(64) PRIMARY KEY,
      code VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'Active',
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      UNIQUE KEY pm_brands_code_unique (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await pool.query(`CREATE TABLE IF NOT EXISTS pm_uoms (
      id VARCHAR(64) PRIMARY KEY,
      code VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'unit',
      decimal_places INT NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'Active',
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      UNIQUE KEY pm_uoms_code_unique (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await pool.query(`CREATE TABLE IF NOT EXISTS pm_products (
      id VARCHAR(64) PRIMARY KEY,
      product_group_id VARCHAR(64) NOT NULL,
      brand_id VARCHAR(64) NULL,
      code VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL,
      product_type VARCHAR(50) NOT NULL DEFAULT 'goods',
      is_variable BOOLEAN NOT NULL DEFAULT FALSE,
      description TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'Active',
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      UNIQUE KEY pm_products_code_unique (code),
      INDEX pm_products_group_idx (product_group_id),
      INDEX pm_products_brand_idx (brand_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await pool.query(`CREATE TABLE IF NOT EXISTS pm_product_variants (
      id VARCHAR(64) PRIMARY KEY,
      product_id VARCHAR(64) NOT NULL,
      sku VARCHAR(150) NOT NULL,
      name VARCHAR(255) NOT NULL,
      barcode VARCHAR(150) NULL,
      description TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'Active',
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      UNIQUE KEY pm_product_variants_sku_unique (sku),
      UNIQUE KEY pm_product_variants_barcode_unique (barcode),
      INDEX pm_product_variants_product_idx (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await pool.query(`CREATE TABLE IF NOT EXISTS pm_product_standards (
      id VARCHAR(64) PRIMARY KEY,
      product_group_id VARCHAR(64) NOT NULL,
      code VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'Active',
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      UNIQUE KEY pm_product_standards_code_unique (code),
      INDEX pm_product_standards_group_idx (product_group_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await pool.query(`CREATE TABLE IF NOT EXISTS pm_product_standard_items (
      id VARCHAR(64) PRIMARY KEY,
      product_standard_id VARCHAR(64) NOT NULL,
      product_variant_id VARCHAR(64) NOT NULL,
      is_preferred BOOLEAN NOT NULL DEFAULT FALSE,
      effective_from DATE NULL,
      effective_to DATE NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'Active',
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      INDEX pm_standard_items_standard_idx (product_standard_id),
      INDEX pm_standard_items_variant_idx (product_variant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await pool.query(`CREATE TABLE IF NOT EXISTS pm_product_variant_uoms (
      id VARCHAR(64) PRIMARY KEY,
      product_variant_id VARCHAR(64) NOT NULL,
      uom_id VARCHAR(64) NOT NULL,
      conversion_factor DECIMAL(15,6) NOT NULL DEFAULT 1,
      is_base BOOLEAN NOT NULL DEFAULT FALSE,
      can_purchase BOOLEAN NOT NULL DEFAULT FALSE,
      can_stock BOOLEAN NOT NULL DEFAULT FALSE,
      can_issue BOOLEAN NOT NULL DEFAULT FALSE,
      can_sell BOOLEAN NOT NULL DEFAULT FALSE,
      status VARCHAR(20) NOT NULL DEFAULT 'Active',
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      INDEX pm_variant_uoms_variant_idx (product_variant_id),
      INDEX pm_variant_uoms_uom_idx (uom_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    const defaults: [string, string][] = [
      ["smtp_host", "smtp.gmail.com"],
      ["smtp_port", "587"],
      ["smtp_secure", ""],
      ["smtp_user", ""],
      ["smtp_pass", ""],
      ["mail_from_address", ""],
      ["mail_from_name", "PROCUREMENT"],
    ];
    for (const [key, value] of defaults) {
      await pool.execute(
        "INSERT IGNORE INTO settings (`key`, value, updatedAt) VALUES (?, ?, ?)",
        [key, value, now]
      );
    }

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

// GET: Retrieve products (paginated or all)
app.get("/api/products", async (req, res) => {
  try {
    const { page, pageSize, search, category, status, sort } = req.query;
    if (page !== undefined || pageSize !== undefined) {
      const p = getPool();
      if (!p || !dbReady) return res.json({ data: [], total: 0, categories: [], uoms: [] });

      const conditions: string[] = [];
      const params: any[] = [];
      const searchStr = String(search || "");
      const categoryStr = String(category || "");
      const statusStr = String(status || "");

      if (searchStr) {
        conditions.push("(name LIKE ? OR productCode LIKE ? OR category LIKE ? OR subCategory LIKE ?)");
        const like = `%${searchStr}%`;
        params.push(like, like, like, like);
      }
      if (categoryStr) {
        conditions.push("category = ?");
        params.push(categoryStr);
      }
      if (statusStr === "active") {
        conditions.push("status = 'Active'");
      } else if (statusStr === "inactive") {
        conditions.push("status = 'Inactive'");
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const orderBy = sort === "code" ? "productCode ASC" : "name ASC";

      const [countRows] = await p.query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM products ${where}`, params);
      const total = Number((countRows[0] as any).total);

      const pageSizeNum = pageSize !== undefined ? Math.max(0, Number(pageSize)) : 20;
      let rows: RowDataPacket[];
      if (pageSizeNum === 0) {
        [rows] = await p.query<RowDataPacket[]>(`SELECT * FROM products ${where} ORDER BY ${orderBy}`, params);
      } else {
        const pageNum = Math.max(1, Number(page) || 1);
        const offset = (pageNum - 1) * pageSizeNum;
        [rows] = await p.query<RowDataPacket[]>(
          `SELECT * FROM products ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
          [...params, pageSizeNum, offset],
        );
      }

      const [catRows] = await p.query<RowDataPacket[]>("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != '' ORDER BY category ASC");
      const categories = catRows.map((r: any) => String(r.category));

      const [uomRows] = await p.query<RowDataPacket[]>("SELECT DISTINCT uom FROM products WHERE uom IS NOT NULL AND uom != '' ORDER BY uom ASC");
      const uoms = uomRows.map((r: any) => String(r.uom));

      return res.json({ data: rows, total, categories, uoms });
    }
    const products = await getAllProducts();
    res.json(products);
  } catch (err: any) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Failed to fetch products." });
  }
});

// POST: Upload custom product images to MinIO (fallback: local storage)
app.post("/api/products/upload-image", async (req, res) => {
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

  // Timeline: bucket visits by 30s over the live window
  const TIMELINE_STEP_MS = 30 * 1000;
  const now = Date.now();
  const buckets: { start: number; visits: number; visitors: Set<string> }[] = [];
  for (let t = cutoff; t <= now; t += TIMELINE_STEP_MS) {
    buckets.push({ start: t, visits: 0, visitors: new Set() });
  }
  live.forEach((v) => {
    const idx = Math.min(
      buckets.length - 1,
      Math.floor((v.timestamp - cutoff) / TIMELINE_STEP_MS)
    );
    if (idx >= 0) {
      buckets[idx].visits += 1;
      buckets[idx].visitors.add(v.ip);
    }
  });
  const timeline = buckets.map((b) => ({
    time: new Date(b.start).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    visits: b.visits,
    visitors: b.visitors.size,
  }));

  res.json({
    liveVisitors: uniqueIps.size,
    totalVisits: live.length,
    paths,
    recent,
    timeline,
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
    "\"countryOfOrigin\"",
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
    supplier.countryOfOrigin || "",
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
    const [statusRows] = await p.query<RowDataPacket[]>("SELECT DISTINCT status FROM suppliers WHERE status != '' ORDER BY status");
    const [applicationTypeRows] = await p.query<RowDataPacket[]>("SELECT DISTINCT applicationType FROM suppliers WHERE applicationType != '' ORDER BY applicationType");
    const canonicalStatuses = ["Pending", "Approved", "Rejected", "Suspended"];
    const canonicalApplicationTypes = ["new", "update"];
    const registrationTypes = ["vat", "non-vat"];
    const paymentMethods = ["bank-transfer", "cheque", "cash", "other"];
    const paymentTerms = ["no-credit", "one-week", "two-weeks", "one-month", "other"];
    res.json({
      statuses: Array.from(new Set([...statusRows.map((row: any) => row.status), ...canonicalStatuses])),
      applicationTypes: Array.from(new Set([...applicationTypeRows.map((row: any) => row.applicationType), ...canonicalApplicationTypes])),
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
    countryOfOrigin: input.countryOfOrigin !== undefined ? cleanText(input, "countryOfOrigin") : existing.countryOfOrigin || "",
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

    const [countRows] = await p.query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM stock_issue_items${whereSql}`, params);
    const total = (countRows[0] as any).total || 0;

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
    const [warehouses] = await p.query<RowDataPacket[]>("SELECT DISTINCT warehouse FROM stock_issue_items WHERE warehouse != '' ORDER BY warehouse");
    const [departments] = await p.query<RowDataPacket[]>("SELECT DISTINCT department FROM stock_issue_items WHERE department != '' ORDER BY department");
    const [campuses] = await p.query<RowDataPacket[]>("SELECT DISTINCT campus FROM stock_issue_items WHERE campus != '' ORDER BY campus");
    const [divisions] = await p.query<RowDataPacket[]>("SELECT DISTINCT division FROM stock_issue_items WHERE division != '' ORDER BY division");
    const [transactionTypes] = await p.query<RowDataPacket[]>("SELECT DISTINCT transactionType FROM stock_issue_items WHERE transactionType != '' ORDER BY transactionType");
    res.json({
      warehouses: warehouses.map((row: any) => row.warehouse),
      departments: departments.map((row: any) => row.department),
      campuses: campuses.map((row: any) => row.campus),
      divisions: divisions.map((row: any) => row.division),
      transactionTypes: transactionTypes.map((row: any) => row.transactionType),
    });
  } catch (err: any) {
    console.error("Error fetching stock issue item filter values:", err);
    res.status(500).json({ error: "Failed to fetch stock issue item filter values." });
  }
});

// GET: Stock issue spend analytics
app.get("/api/stock-issue-items/analytics", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { startDate, endDate, warehouse, division, department, campus, transactionType } = req.query as Record<string, string | undefined>;
    const top = Math.max(1, Math.min(100, Number(req.query.top) || 10));

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required." });
    }
    if (String(startDate) > String(endDate)) {
      return res.status(400).json({ error: "startDate cannot be after endDate." });
    }

    const whereClauses: string[] = ["transactionDate >= ?", "transactionDate <= ?"];
    const params: any[] = [startDate, endDate];
    if (warehouse) { whereClauses.push("warehouse = ?"); params.push(warehouse); }
    if (division) { whereClauses.push("division = ?"); params.push(division); }
    if (department) { whereClauses.push("department = ?"); params.push(department); }
    if (campus) { whereClauses.push("campus = ?"); params.push(campus); }
    if (transactionType) { whereClauses.push("transactionType = ?"); params.push(transactionType); }

    const whereSql = " WHERE " + whereClauses.join(" AND ");

    const [summaryRows] = await p.query<RowDataPacket[]>(
      `SELECT COUNT(*) as totalItems, COALESCE(SUM(quantity),0) as totalQuantity, COALESCE(SUM(totalPrice),0) as totalAmount FROM stock_issue_items${whereSql}`,
      params
    );

    // Monthly trend over the selected window
    const [trendRows] = await p.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(transactionDate, '%Y-%m') as month, COUNT(*) as \`count\`, COALESCE(SUM(quantity),0) as quantity, COALESCE(SUM(totalPrice),0) as amount
       FROM stock_issue_items${whereSql} GROUP BY month ORDER BY month ASC`,
      params
    );
    const trend = trendRows.map((r: any) => ({
      month: r.month,
      count: r.count,
      quantity: r.quantity,
      amount: r.amount,
    }));

    // Previous equivalent window for growth comparison
    const dayMs = 86400000;
    const daysDiff = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / dayMs) + 1);
    const prevEnd = new Date(new Date(startDate).getTime() - dayMs);
    const prevStart = new Date(new Date(startDate).getTime() - daysDiff * dayMs);
    const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const prevStartStr = fmtDate(prevStart);
    const prevEndStr = fmtDate(prevEnd);
    const prevWhereClauses: string[] = ["transactionDate >= ?", "transactionDate <= ?"];
    const prevParams: any[] = [prevStartStr, prevEndStr];
    if (warehouse) { prevWhereClauses.push("warehouse = ?"); prevParams.push(warehouse); }
    if (division) { prevWhereClauses.push("division = ?"); prevParams.push(division); }
    if (department) { prevWhereClauses.push("department = ?"); prevParams.push(department); }
    if (campus) { prevWhereClauses.push("campus = ?"); prevParams.push(campus); }
    if (transactionType) { prevWhereClauses.push("transactionType = ?"); prevParams.push(transactionType); }
    const [prevSummaryRows] = await p.query<RowDataPacket[]>(
      `SELECT COUNT(*) as totalItems, COALESCE(SUM(quantity),0) as totalQuantity, COALESCE(SUM(totalPrice),0) as totalAmount
       FROM stock_issue_items WHERE ${prevWhereClauses.join(" AND ")}`,
      prevParams
    );
    const previousSummary = { ...prevSummaryRows[0], startDate: prevStartStr, endDate: prevEndStr };

    // Year-over-year monthly comparison (this year's months vs same month last year)
    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const [curYoYRows] = await p.query<RowDataPacket[]>(
      `SELECT YEAR(transactionDate) as yr, MONTH(transactionDate) as mo, COALESCE(SUM(totalPrice),0) as amount
       FROM stock_issue_items${whereSql} GROUP BY yr, mo ORDER BY yr, mo`,
      params
    );
    const curStartD = new Date(startDate);
    const curEndD = new Date(endDate);
    const prevStartD = new Date(curStartD);
    prevStartD.setFullYear(curStartD.getFullYear() - 1);
    const prevEndD = new Date(curEndD);
    prevEndD.setFullYear(curEndD.getFullYear() - 1);
    const prevYoStartStr = fmtDate(prevStartD);
    const prevYoEndStr = fmtDate(prevEndD);
    const prevYoWhereClauses: string[] = ["transactionDate >= ?", "transactionDate <= ?"];
    const prevYoParams: any[] = [prevYoStartStr, prevYoEndStr];
    if (warehouse) { prevYoWhereClauses.push("warehouse = ?"); prevYoParams.push(warehouse); }
    if (division) { prevYoWhereClauses.push("division = ?"); prevYoParams.push(division); }
    if (department) { prevYoWhereClauses.push("department = ?"); prevYoParams.push(department); }
    if (campus) { prevYoWhereClauses.push("campus = ?"); prevYoParams.push(campus); }
    if (transactionType) { prevYoWhereClauses.push("transactionType = ?"); prevYoParams.push(transactionType); }
    const [prevYoYRows] = await p.query<RowDataPacket[]>(
      `SELECT YEAR(transactionDate) as yr, MONTH(transactionDate) as mo, COALESCE(SUM(totalPrice),0) as amount
       FROM stock_issue_items WHERE ${prevYoWhereClauses.join(" AND ")} GROUP BY yr, mo ORDER BY yr, mo`,
      prevYoParams
    );
    const prevYoYMap = new Map<string, number>();
    prevYoYRows.forEach((r: any) => { prevYoYMap.set(`${r.yr}-${r.mo}`, r.amount); });
    const yoyCompare = curYoYRows.map((r: any) => {
      const prevKey = `${r.yr - 1}-${r.mo}`;
      const previous = prevYoYMap.get(prevKey) || 0;
      return {
        label: `${MONTH_NAMES[r.mo - 1]} ${r.yr}`,
        current: r.amount,
        previous,
        gap: r.amount - previous,
      };
    });

    const dims = ["campus", "department", "division", "warehouse"] as const;
    const agg: Record<string, any[]> = {};
    for (const dim of dims) {
      const [rows] = await p.query<RowDataPacket[]>(
        `SELECT ${dim} as \`key\`, COUNT(*) as \`count\`, COALESCE(SUM(quantity),0) as quantity, COALESCE(SUM(totalPrice),0) as amount
         FROM stock_issue_items${whereSql} GROUP BY ${dim} ORDER BY amount DESC`,
        params
      );
      agg[dim] = rows.map((r: any) => ({ key: r.key || "(Unknown)", count: r.count, quantity: r.quantity, amount: r.amount }));
    }

    const [byRequesterRows] = await p.query<RowDataPacket[]>(
      `SELECT requesterName as \`key\`, COUNT(*) as \`count\`, COALESCE(SUM(quantity),0) as quantity, COALESCE(SUM(totalPrice),0) as amount
       FROM stock_issue_items${whereSql} GROUP BY requesterName ORDER BY amount DESC`,
      params
    );
    const byRequester = byRequesterRows.map((r: any) => ({ key: r.key || "(Unknown)", count: r.count, quantity: r.quantity, amount: r.amount }));

    const [byTypeRows] = await p.query<RowDataPacket[]>(
      `SELECT transactionType as \`key\`, COUNT(*) as \`count\`, COALESCE(SUM(quantity),0) as quantity, COALESCE(SUM(totalPrice),0) as amount
       FROM stock_issue_items${whereSql} GROUP BY transactionType ORDER BY amount DESC`,
      params
    );
    const byType = byTypeRows.map((r: any) => ({ key: r.key || "(Unknown)", count: r.count, quantity: r.quantity, amount: r.amount }));

    const topGroupBy = " FROM stock_issue_items" + whereSql + " GROUP BY itemCode, description, uom ";
    const [topCountRows] = await p.query<RowDataPacket[]>(
      `SELECT itemCode, MAX(description) as description, MAX(uom) as uom, COUNT(*) as \`count\`, COALESCE(SUM(quantity),0) as quantity, COALESCE(SUM(totalPrice),0) as amount
       ${topGroupBy}ORDER BY \`count\` DESC, amount DESC LIMIT ?`,
      [...params, top]
    );
    const [topAmountRows] = await p.query<RowDataPacket[]>(
      `SELECT itemCode, MAX(description) as description, MAX(uom) as uom, COUNT(*) as \`count\`, COALESCE(SUM(quantity),0) as quantity, COALESCE(SUM(totalPrice),0) as amount
       ${topGroupBy}ORDER BY amount DESC, \`count\` DESC LIMIT ?`,
      [...params, top]
    );

    res.json({
      summary: summaryRows[0],
      previousSummary,
      trend,
      yoyCompare,
      byCampus: agg.campus,
      byDepartment: agg.department,
      byDivision: agg.division,
      byWarehouse: agg.warehouse,
      byRequester,
      byType,
      topByCount: topCountRows,
      topByAmount: topAmountRows,
    });
  } catch (err: any) {
    console.error("Error computing stock issue analytics:", err);
    res.status(500).json({ error: "Failed to compute stock issue analytics." });
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
    const conn = await p.getConnection();
    try {
      await conn.query("START TRANSACTION");
      const BATCH_SIZE = 500;
      let count = 0;
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        const placeholders: string[] = [];
        const params: any[] = [];
        for (const item of batch) {
          placeholders.push("(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
          params.push(
            crypto.randomUUID(), item.itemCode || "", item.description || "", item.quantity || 0, item.uom || "Pcs",
            item.unitPrice || 0, item.totalPrice || 0, item.transactionDate || null,
            item.warehouse || "", item.division || "", item.department || "", item.campus || "",
            item.requesterName || "", item.referenceNo || "", item.transactionType || "", item.accountCode || "",
            item.remarks || "", now, now, now
          );
        }
        await conn.query(
          `INSERT INTO stock_issue_items (id, itemCode, description, quantity, uom, unitPrice, totalPrice, transactionDate, warehouse, division, department, campus, requesterName, referenceNo, transactionType, accountCode, remarks, importedAt, createdAt, updatedAt) VALUES ${placeholders.join(", ")}`,
          params
        );
        count += batch.length;
      }
      await conn.query("COMMIT");
      res.json({ success: true, count });
    } catch (batchErr) {
      try { await conn.query("ROLLBACK"); } catch {}
      throw batchErr;
    } finally {
      try { conn.release(); } catch {}
    }
  } catch (err: any) {
    const msg = err?.sqlMessage || err?.message || String(err) || "Unknown error";
    console.error("[Stock Import]", msg);
    res.status(500).json({ error: msg });
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
    const { warehouse, department, campus, division, receiverName, sendToEmail, ccToEmail } = req.body;

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
      `INSERT INTO debit_note_emails (id, warehouse, department, campus, division, receiverName, sendToEmail, ccToEmail, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE division = VALUES(division), receiverName = VALUES(receiverName), sendToEmail = VALUES(sendToEmail), ccToEmail = VALUES(ccToEmail), updatedAt = VALUES(updatedAt)`,
      [id, warehouse, department, campus, division ?? "", receiverName, JSON.stringify(sendTo), JSON.stringify(ccTo), now, now]
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

    const { warehouse, department, campus, division, receiverName, sendToEmail, ccToEmail } = req.body;
    const sendTo = Array.isArray(sendToEmail) ? sendToEmail : JSON.parse(existing.sendToEmail || "[]");
    const ccTo = Array.isArray(ccToEmail) ? ccToEmail : JSON.parse(existing.ccToEmail || "[]");

    if (sendTo.length === 0) {
      return res.status(400).json({ error: "At least one send-to email is required." });
    }

    const now = new Date().toISOString();
    await p.execute(
      `UPDATE debit_note_emails SET warehouse = ?, department = ?, campus = ?, division = ?, receiverName = ?, sendToEmail = ?, ccToEmail = ?, updatedAt = ? WHERE id = ?`,
      [
        warehouse ?? existing.warehouse,
        department ?? existing.department,
        campus ?? existing.campus,
        division ?? existing.division,
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

app.post("/api/debit-note/emails/bulk-delete", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const body: { ids?: string[] } = req.body || {};
    const ids = Array.isArray(body.ids) ? body.ids.map((id) => String(id).trim()).filter(Boolean) : [];
    if (ids.length === 0) {
      return res.status(400).json({ error: "No email configs selected to delete." });
    }
    if (ids.length > 10000) {
      return res.status(400).json({ error: "Too many configs to delete at once." });
    }
    const placeholders = ids.map(() => "?").join(",");
    const [result] = await p.execute<ResultSetHeader>(`DELETE FROM debit_note_emails WHERE id IN (${placeholders})`, ids);
    res.json({ success: true, count: result.affectedRows });
  } catch (err: any) {
    console.error("Error bulk deleting email configs:", err);
    res.status(500).json({ error: "Failed to bulk delete email configs." });
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

app.post("/api/debit-note/emails/import", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const items: any[] = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Expected a non-empty array of email configs." });
    }
    const now = new Date().toISOString();
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const splitEmails = (raw: string): string[] =>
      raw.split(/[;,\n]+/).map((e: string) => e.trim()).filter(Boolean);

    const validationErrors: string[] = [];
    const prepared: { warehouse: string; department: string; campus: string; division: string; receiverName: string; sendTo: string[]; ccTo: string[] }[] = [];

    items.forEach((item, index) => {
      const rowNo = index + 2; // spreadsheet header is row 1, data starts at row 2
      const rowErrors: string[] = [];

      const warehouse = String(item.warehouse || item["Warehouse"] || "").trim();
      const department = String(item.department || item["Department"] || "").trim();
      const campus = String(item.campus || item["Campus"] || "").trim();
      const division = String(item.division || item["Division"] || "").trim();
      const receiverName = String(item.receiverName || item["Receiver Name"] || item["Receiver"] || "").trim();

      if (!warehouse) rowErrors.push("Warehouse");
      if (!department) rowErrors.push("Department");
      if (!campus) rowErrors.push("Campus");
      if (!receiverName) rowErrors.push("Receiver Name");

      const rawSendTo = item.sendToEmail || item["Send To Emails"] || item["Send To"] || "";
      const rawCcTo = item.ccToEmail || item["CC Emails"] || item["CC"] || "";

      const sendTo = splitEmails(rawSendTo).filter((e: string) => EMAIL_RE.test(e));
      const ccTo = splitEmails(rawCcTo).filter((e: string) => EMAIL_RE.test(e));

      if (sendTo.length === 0) rowErrors.push("at least one valid 'Send To Email'");

      if (rowErrors.length > 0) {
        validationErrors.push(`Row ${rowNo}: ${rowErrors.join(", ")}`);
} else {
        prepared.push({ warehouse, department, campus, division, receiverName, sendTo, ccTo });
      }
    });

    if (validationErrors.length > 0) {
      const shown = validationErrors.slice(0, 10).join(" | ");
      const more = validationErrors.length > 10 ? ` | and ${validationErrors.length - 10} more row(s)` : "";
      return res.status(400).json({
        error: `Import cancelled: ${validationErrors.length} row(s) failed validation. ${shown}${more}`,
      });
    }

    let count = 0;
    for (const cfg of prepared) {
      const id = `dne-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      await p.execute(
        `INSERT INTO debit_note_emails (id, warehouse, department, campus, division, receiverName, sendToEmail, ccToEmail, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE division = VALUES(division), receiverName = VALUES(receiverName), sendToEmail = VALUES(sendToEmail), ccToEmail = VALUES(ccToEmail), updatedAt = VALUES(updatedAt)`,
        [id, cfg.warehouse, cfg.department, cfg.campus, cfg.division, cfg.receiverName, JSON.stringify(cfg.sendTo), JSON.stringify(cfg.ccTo), now, now]
      );
      count++;
    }
    res.json({ success: true, count });
  } catch (err: any) {
    console.error("Error importing email configs:", err);
    res.status(500).json({ error: "Failed to import email configs." });
  }
});

// ─── Debit Note Generation ───

async function generateDebitNoteNo(p: mysql.Pool, division: string, department: string, campus: string, startDate: string, excludeId?: string): Promise<string> {
  const v = division.replace(/[^A-Za-z0-9]/g, "");
  const d = department.replace(/[^A-Za-z0-9]/g, "") || "DP";
  const c = campus.replace(/[^A-Za-z0-9]/g, "") || "CMP";
  const mm = String(startDate || "").slice(5, 7) || "00";
  const yy = String(startDate || "").slice(2, 4) || "00";
  const base = v ? `${v}-${d}-${c}-${mm}${yy}` : `${d}-${c}-${mm}${yy}`;
  const [rows] = await p.query<RowDataPacket[]>(
    `SELECT id, referenceNumber FROM debit_notes WHERE referenceNumber = ? OR referenceNumber LIKE ?`,
    [base, `${base}-%`]
  );
  let maxSuffix = 0;
  for (const row of rows) {
    if (excludeId && row.id === excludeId) continue;
    if (row.referenceNumber === base) { maxSuffix = Math.max(maxSuffix, 1); continue; }
    const suffix = parseInt(String(row.referenceNumber).slice(base.length + 1), 10);
    if (!isNaN(suffix)) maxSuffix = Math.max(maxSuffix, suffix);
  }
  return maxSuffix === 0 ? base : `${base}-${maxSuffix + 1}`;
}

// POST: Generate debit notes from stock issue items
app.post("/api/debit-notes/generate", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { startDate, endDate, warehouse, department, campus, skipMissingEmailGroups } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Start date and end date are required." });
    }
    if (String(startDate) > String(endDate)) {
      return res.status(400).json({ error: "Start date cannot be after end date." });
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
      return res.status(422).json({ error: "No stock issue items found for the selected date range and filters. Check that the start/end dates are correct and that stock issue records exist for the chosen filters." });
    }

    // Group items by warehouse+division+department+campus
    const groups = new Map<string, any[]>();
    for (const item of items) {
      const key = `${item.warehouse}||${item.division || ""}||${item.department}||${item.campus}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    const groupLabel = (w: string, div: string, d: string, c: string) =>
      div ? `${w} / ${div} / ${d} / ${c}` : `${w} / ${d} / ${c}`;

    const emailConfigByGroup = new Map<string, any>();
    const missingEmailGroups: string[] = [];

    for (const key of groups.keys()) {
      const [grpWarehouse, grpDivision, grpDepartment, grpCampus] = key.split("||");

      // Check email config exists
      const [emailConfigs] = await p.execute<RowDataPacket[]>(
        "SELECT * FROM debit_note_emails WHERE warehouse = ? AND division = ? AND department = ? AND campus = ? LIMIT 1",
        [grpWarehouse, grpDivision, grpDepartment, grpCampus]
      );

      if (emailConfigs.length === 0) {
        missingEmailGroups.push(groupLabel(grpWarehouse, grpDivision, grpDepartment, grpCampus));
      } else {
        emailConfigByGroup.set(key, emailConfigs[0]);
      }
    }

    if (missingEmailGroups.length > 0 && !skipMissingEmailGroups) {
      return res.status(422).json({
        error: `Generation cancelled: ${missingEmailGroups.length} group(s) have no email configuration (${missingEmailGroups.join(", ")}). Add email configs in "Debit Note Email Configurations" or skip these groups and generate the rest.`,
        code: "MISSING_EMAIL_CONFIGS",
        missingGroups: missingEmailGroups,
      });
    }

    const created: any[] = [];

    for (const [key, groupItems] of groups.entries()) {
      const [grpWarehouse, grpDivision, grpDepartment, grpCampus] = key.split("||");
      const emailConfig = emailConfigByGroup.get(key);
      if (!emailConfig) continue;

      // Generate or update debit note
      const now = new Date().toISOString();

      // Use updateOrCreate pattern: find existing by unique key
      const [existingNotes] = await p.execute<RowDataPacket[]>(
        "SELECT * FROM debit_notes WHERE warehouse = ? AND department = ? AND campus = ? AND division = ? AND startDate = ? AND endDate = ? LIMIT 1",
        [grpWarehouse, grpDepartment, grpCampus, grpDivision, startDate, endDate]
      );
      const refNo = await generateDebitNoteNo(p, grpDivision, grpDepartment, grpCampus, startDate, existingNotes[0]?.id);

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
          `INSERT INTO debit_notes (id, referenceNumber, warehouse, division, department, campus, startDate, endDate, status, debitNoteEmailId, createdBy, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
          [debitNoteId, refNo, grpWarehouse, grpDivision, grpDepartment, grpCampus, startDate, endDate, emailConfig.id, req.body.createdBy || "system", now, now]
        );
      }

      // Bulk insert items
      for (const item of groupItems) {
        const itemId = `dni-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        await p.execute(
          `INSERT INTO debit_note_items (id, debitNoteId, stockIssueItemId, itemCode, description, quantity, uom, unitPrice, totalPrice, transactionDate, requesterName, campus, division, department, referenceNo, remarks, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [itemId, debitNoteId, item.id, item.itemCode, item.description, item.quantity, item.uom,
           item.unitPrice, item.totalPrice, item.transactionDate, item.requesterName,
           item.campus, item.division || "", item.department, item.referenceNo, item.remarks, now]
        );
      }

      const [noteRows] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_notes WHERE id = ?", [debitNoteId]);
      if (noteRows.length > 0) created.push(noteRows[0]);
    }

    if (created.length === 0) {
      const skippedDetail = skipMissingEmailGroups && missingEmailGroups.length > 0
        ? ` All groups were skipped because they have no email configuration.`
        : "";
      return res.status(422).json({
        error: `No debit notes generated.${skippedDetail}`,
      });
    }

    const response: any = { success: true, count: created.length, debitNotes: created };
    if (skipMissingEmailGroups && missingEmailGroups.length > 0) {
      response.skipped = missingEmailGroups.length;
      response.skippedGroups = missingEmailGroups;
    }
    res.json(response);
  } catch (err: any) {
    console.error("Error generating debit notes:", err);
    res.status(500).json({ error: "Failed to generate debit notes. Please try again." });
  }
});

// ─── Debit Note List & Detail ───

// GET: List debit notes with filters
function dateOnlyStr(v: any): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : String(v);
}

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
        startDate: dateOnlyStr(row.startDate),
        endDate: dateOnlyStr(row.endDate),
        sendDate: dateOnlyStr(row.sendDate),
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

// GET: Get email progress
app.get("/api/debit-notes/email-progress", (req, res) => {
  const key = `dn_progress_${(req.query.user as string) || "anonymous"}`;
  const progress = emailProgressMap.get(key) || { status: "No sending in progress.", finished: true };
  console.log(`[email] progress check: key="${key}", found=${emailProgressMap.has(key)}, status="${progress.status}"`);
  res.json(progress);
});

// GET: Debug email progress map
app.get("/api/debit-notes/email-progress-debug", (req, res) => {
  res.json({
    mapSize: emailProgressMap.size,
    entries: Array.from(emailProgressMap.entries()).map(([k, v]) => ({ key: k, ...v })),
  });
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

    res.json({
      ...note,
      startDate: dateOnlyStr(note.startDate),
      endDate: dateOnlyStr(note.endDate),
      sendDate: dateOnlyStr(note.sendDate),
      totalAmount: items.reduce((s, i) => s + (parseFloat(i.totalPrice) || 0), 0),
      items: items.map((i) => ({ ...i, transactionDate: dateOnlyStr(i.transactionDate) })),
      debitNoteEmail: emailConfig,
    });
  } catch (err: any) {
    console.error("Error fetching debit note:", err);
    res.status(500).json({ error: "Failed to fetch debit note." });
  }
});

// DELETE: Bulk delete debit notes by filter (requires at least one filter)
app.delete("/api/debit-notes/bulk", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { warehouse, department, campus, status, startDate, endDate, search } = req.query;
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (warehouse) { whereClauses.push("warehouse = ?"); params.push(warehouse); }
    if (department) { whereClauses.push("department = ?"); params.push(department); }
    if (campus) { whereClauses.push("campus = ?"); params.push(campus); }
    if (status) { whereClauses.push("status = ?"); params.push(status); }
    if (startDate) { whereClauses.push("startDate >= ?"); params.push(startDate); }
    if (endDate) { whereClauses.push("endDate <= ?"); params.push(endDate); }
    if (search) {
      const q = `%${search}%`;
      whereClauses.push("(referenceNumber LIKE ? OR warehouse LIKE ? OR department LIKE ? OR campus LIKE ? OR createdBy LIKE ? OR status LIKE ?)");
      params.push(q, q, q, q, q, q);
    }

    if (whereClauses.length === 0) {
      return res.status(400).json({ error: "At least one filter is required for bulk delete." });
    }

    const whereSql = " WHERE " + whereClauses.join(" AND ");
    const conn = await p.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query<RowDataPacket[]>(`SELECT id FROM debit_notes${whereSql}`, params);
      const ids = rows.map((r) => r.id);
      let count = 0;
      if (ids.length > 0) {
        const placeholders = ids.map(() => "?").join(",");
        await conn.execute(`DELETE FROM debit_note_items WHERE debitNoteId IN (${placeholders})`, ids);
        const [result] = await conn.execute<ResultSetHeader>(`DELETE FROM debit_notes WHERE id IN (${placeholders})`, ids);
        count = result.affectedRows;
      }
      await conn.commit();
      res.json({ success: true, count });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err: any) {
    console.error("Error bulk deleting debit notes:", err);
    res.status(500).json({ error: "Failed to bulk delete debit notes." });
  }
});

// DELETE: Delete a debit note
app.delete("/api/debit-notes/:id", async (req, res) => {
  if (req.params.id === "bulk") {
    return res.status(400).json({ error: "Use /bulk endpoint for bulk delete." });
  }
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

    // Load settings from DB (fallback to env vars)
    const [settingRows] = await p.query<RowDataPacket[]>("SELECT `key`, value FROM settings");
    const dbSettings: Record<string, string> = {};
    for (const row of settingRows) dbSettings[row.key] = row.value;

    const getSetting = (key: string, envKey: string, fallback: string): string =>
      dbSettings[key] || process.env[envKey] || fallback;

    // Setup email transporter
    const transporter = nodemailer.createTransport({
      host: getSetting("smtp_host", "SMTP_HOST", "smtp.gmail.com"),
      port: parseInt(getSetting("smtp_port", "SMTP_PORT", "587")),
      secure: getSetting("smtp_secure", "SMTP_SECURE", "") === "true",
      auth: {
        user: getSetting("smtp_user", "SMTP_USER", ""),
        pass: getSetting("smtp_pass", "SMTP_PASS", ""),
      },
    });

    const fromAddress = getSetting("mail_from_address", "MAIL_FROM_ADDRESS", "") || getSetting("smtp_user", "SMTP_USER", "") || "noreply@procurement.com";
    const fromName = getSetting("mail_from_name", "MAIL_FROM_NAME", "PROCUREMENT");

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
          const [userRows] = await p.execute<RowDataPacket[]>("SELECT fullName, position FROM users WHERE username = ?", [detail.createdBy]);
          const pb = userRows.length > 0 ? { name: userRows[0].fullName, position: userRows[0].position } : undefined;
          const workbook = new ExcelJS.Workbook();
          buildDebitNoteSheet(workbook, detail, detail.items, pb);

          const buffer = await workbook.xlsx.writeBuffer();
          const fileName = `DebitNote_${detail.department}_${detail.campus}_${detail.referenceNumber}.xlsx`.replace(/[^a-zA-Z0-9_.-]/g, "_");
          attachments.push({ filename: fileName, content: buffer as Buffer });
        }

        // Get creator info for email footer
        let creatorName = "Vun Thy";
        let creatorPosition = "Procurement Officer";
        let creatorPhone = "+855 96 36 12 146";
        let creatorEmail = "vun.thy@mjqeducation.edu.kh";
        const firstNote = group.notes[0];
        if (firstNote?.createdBy) {
          const [uRows] = await p.execute<RowDataPacket[]>("SELECT fullName, position, phone, email FROM users WHERE username = ?", [firstNote.createdBy]);
          if (uRows.length > 0) {
            creatorName = uRows[0].fullName || creatorName;
            creatorPosition = uRows[0].position || creatorPosition;
            creatorPhone = uRows[0].phone || creatorPhone;
            creatorEmail = uRows[0].email || creatorEmail;
          }
        }

        // Build subject
        const campusSet = new Set(group.notes.map((n: any) => n.campus));
        const deptSet = new Set(group.notes.map((n: any) => n.department));
        const campusStr = Array.from(campusSet).join(", ");
        const deptStr = Array.from(deptSet).join(", ");
        const fmtDate = (s: any) => {
          if (!s) return "-";
          const dt = typeof s === "string" ? new Date(s + "T00:00:00") : new Date(s);
          if (isNaN(dt.getTime())) return "-";
          const utc = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
          return utc.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "2-digit", year: "numeric" });
        };

        const periodStr = fmtDate(group.notes[0]?.startDate) && fmtDate(group.notes[0]?.endDate)
          ? `${fmtDate(group.notes[0]?.startDate)} - ${fmtDate(group.notes[0]?.endDate)}` : "";

        const subject = `Debit Note${group.notes.length > 1 ? "s" : ""}${periodStr ? ` (${periodStr})` : ""} for ${deptStr} - Campus (${campusStr})`;

        const deptNames = [...new Set(group.notes.map((n: any) => n.department).filter(Boolean))];
        const campusNames = [...new Set(group.notes.map((n: any) => n.campus).filter(Boolean))];

        // Build HTML body
        const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Debit Note Notification</title>
    <style>
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background-color: #f8f9fa;
            color: #343a40;
            line-height: 1.6;
        }
        .container {
            background-color: #ffffff;
            padding: 20px;
            margin: 20px auto;
            border-radius: 8px;
            max-width: 100%;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 20px;
        }
        h2 {
            color: #007bff;
            margin-bottom: 5px;
        }
        .details {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        .details th, .details td {
            border: 1px solid #dee2e6;
            padding: 10px;
            text-align: left;
        }
        .details th {
            background-color: #e9ecef;
        }
        .footer {
            font-size: 0.9rem;
            color: #6c757d;
            text-align: center;
            margin-top: 20px;
            text-align: left;
        }
        .footer img {
            max-width: 150px;
            margin-bottom: 10px;
        }
        .btn-primary {
            display: inline-block;
            padding: 8px 15px;
            background-color: #007bff;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Monthly Debit Note</h2>
            <p>From Warehouse: <strong>${firstNote?.warehouse || "-"}</strong></p>
        </div>

        <p>Dear <strong>${group.notes[0]?.emailConfig?.receiverName || recipientEmail}</strong>,</p>

        <p>I hope this message finds you well.</p>

        <p>
            Please find attached the Monthly Debit Note for
            <strong>${deptNames.join(", ") || "-"}, Campus (${campusNames.join(", ") || "-"})</strong>
            for the period from
            <strong>${fmtDate(firstNote?.startDate)}</strong>
            to
            <strong>${fmtDate(firstNote?.endDate)}</strong>.
            This document details all materials requested from stock during the month for operational usage.
            The debit note includes quantities, item descriptions, and relevant references to help you verify the records efficiently.
        </p>

        <p>Kindly review the attached file at your earliest convenience. Should you have any questions, discrepancies, or require additional supporting information, please do not hesitate to contact me. I am happy to provide clarification or any further documentation needed.</p>

        <p>Thank you for your time and attention to this matter. I appreciate your cooperation and prompt review.</p>

        <div class="footer">
            <p>
                Best regards,<br>

                ${creatorName}<br>
                ${creatorPosition}<br>
                ${creatorPhone}<br>
                ${creatorEmail}<br>
            </p>
        <img src="https://ci3.googleusercontent.com/mail-sig/AIorK4zsFWN0XTmb1CVNaUS-BqiFPyZpKwge_qnFJ5x7vfn77RaF1FldZ8ebYBrhuszIuQHYxgi8l4BB7ojF" alt="Company Logo" style="max-width: 400px; margin-bottom: 10px;">
        </div>
    </div>
</body>
</html>`;

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
    console.log(`[email] job complete: key="${progressKey}", success=${successCount}, failed=${failedCount}`);
  } catch (err: any) {
    console.error("Error in debit note email job:", err);
    emailProgressMap.set(progressKey, { status: `Error: ${err.message}`, finished: true, failed_count: 1, failed_notes: [err.message] });
  }
}

function buildDebitNoteSheet(workbook: ExcelJS.Workbook, note: any, items: any[], preparedBy?: { name: string; position: string }) {
  const sheet = workbook.addWorksheet("Debit Note");
  const COL_COUNT = 14;

  [5, 14, 16, 45, 8, 7, 14, 16, 18, 12, 14, 14, 16, 40]
    .forEach((w, i) => sheet.getColumn(i + 1).width = w);

  ensureDebitNoteLogo();
  if (debitNoteLogoBase64) {
    const imageId = workbook.addImage({ base64: debitNoteLogoBase64, extension: "png" });
    sheet.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width: DEBIT_NOTE_LOGO_WIDTH, height: DEBIT_NOTE_LOGO_HEIGHT },
    });
  }

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin" }, left: { style: "thin" },
    bottom: { style: "thin" }, right: { style: "thin" },
  };

  const toDateOnly = (s: any) => {
    if (!s) return null;
    const dt = typeof s === "string" ? new Date(s + "T00:00:00") : new Date(s);
    if (isNaN(dt.getTime())) return null;
    return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  };

  sheet.mergeCells(1, 1, 1, COL_COUNT);
  const titleCell = sheet.getCell("A1");
  titleCell.value = "DEBIT NOTE";
  titleCell.font = { name: "TW CEN MT", bold: true, size: 16, color: { argb: "FF1F4E79" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 30;

  sheet.mergeCells(2, 1, 2, COL_COUNT);
  const infoCell = sheet.getCell("A2");
  const fmtDate = (s: any) => {
    const dt = toDateOnly(s);
    if (!dt) return "";
    return dt.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "2-digit", year: "numeric" });
  };
  infoCell.value = `${note.division || ""} - ${note.department || ""} - ${note.campus || ""}  |  ${fmtDate(note.startDate)} to ${fmtDate(note.endDate)}`;
  infoCell.font = { name: "TW CEN MT", size: 10, color: { argb: "FF777777" } };
  infoCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(2).height = 18;

  const headers = ["No", "Date", "Code", "Item Name", "Qty", "UoM", "U/Price", "Amount", "Requester", "Campus", "Division", "Department", "IO Number", "Remarks"];
  const headerRow = sheet.getRow(4);
  headerRow.height = 22;
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "TW CEN MT", bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E75B6" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
  });

  let rowIdx = 5;
  for (const item of items) {
    const row = sheet.getRow(rowIdx);

    row.getCell(1).value = rowIdx - 4;
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    const d = item.transactionDate;
    if (d) {
      const dt = toDateOnly(d);
      row.getCell(2).value = dt ?? "";
      row.getCell(2).numFmt = 'mmm dd, yyyy';
    } else {
      row.getCell(2).value = "";
    }
    row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(3).value = item.itemCode || "";
    row.getCell(3).alignment = { vertical: "middle" };
    row.getCell(4).value = item.description || "";
    row.getCell(4).alignment = { vertical: "middle", wrapText: true };
    row.getCell(5).value = parseFloat(item.quantity) || 0;
    row.getCell(5).alignment = { horizontal: "right", vertical: "middle" };
    row.getCell(5).numFmt = '0.00';
    row.getCell(6).value = item.uom || "";
    row.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(7).value = parseFloat(item.unitPrice) || 0;
    row.getCell(7).alignment = { horizontal: "right", vertical: "middle" };
    row.getCell(7).numFmt = '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)';
    row.getCell(8).value = parseFloat(item.totalPrice) || 0;
    row.getCell(8).alignment = { horizontal: "right", vertical: "middle" };
    row.getCell(8).numFmt = '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)';
    row.getCell(9).value = item.requesterName || "";
    row.getCell(9).alignment = { vertical: "middle" };
    row.getCell(10).value = item.campus || "";
    row.getCell(10).alignment = { vertical: "middle" };
    row.getCell(11).value = item.division || "";
    row.getCell(11).alignment = { vertical: "middle" };
    row.getCell(12).value = item.department || "";
    row.getCell(12).alignment = { vertical: "middle" };
    row.getCell(13).value = item.referenceNo || "";
    row.getCell(13).alignment = { vertical: "middle" };
    row.getCell(14).value = item.remarks || "";
    row.getCell(14).alignment = { vertical: "middle", wrapText: true };

    for (let c = 1; c <= COL_COUNT; c++) {
      const cell = row.getCell(c);
      if (!cell.font?.name) cell.font = { name: "TW CEN MT", size: 10 };
      cell.border = thinBorder;
      if (rowIdx % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F7FB" } };
      }
    }
    rowIdx++;
  }

  const totalRow = sheet.getRow(rowIdx);
  totalRow.height = 22;
  totalRow.getCell(7).value = "TOTAL:";
  totalRow.getCell(7).font = { name: "TW CEN MT", bold: true, size: 11 };
  totalRow.getCell(7).alignment = { horizontal: "right", vertical: "middle" };
  const totalAmtCell = totalRow.getCell(8);
  totalAmtCell.value = { formula: `SUM(H5:H${rowIdx - 1})` };
  totalAmtCell.font = { name: "TW CEN MT", bold: true, size: 11 };
  totalAmtCell.alignment = { horizontal: "right", vertical: "middle" };
  totalAmtCell.numFmt = '$#,##0.00';

  for (let c = 1; c <= COL_COUNT; c++) {
    const cell = totalRow.getCell(c);
    cell.border = {
      top: { style: "double" }, left: { style: "thin" },
      bottom: { style: "double" }, right: { style: "thin" },
    };
  }

  rowIdx += 2;
  const endDateStr = fmtDate(note.endDate);
  const footerData = [
    ["Prepared by:", preparedBy?.name || note.createdBy || ""],
    ["Position:", preparedBy?.position || ""],
    ["Date:", endDateStr],
  ];
  footerData.forEach(([label, value]) => {
    const row = sheet.getRow(rowIdx);
    sheet.mergeCells(rowIdx, 1, rowIdx, 2);
    row.getCell(1).value = label;
    row.getCell(1).font = { name: "TW CEN MT", bold: true, size: 10 };
    row.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
    row.getCell(3).value = value;
    row.getCell(3).font = { name: "TW CEN MT", size: 10 };
    row.getCell(3).alignment = { vertical: "middle" };
    row.height = 18;
    rowIdx++;
  });

  sheet.pageSetup.orientation = "landscape";
  sheet.pageSetup.fitToPage = true;
  sheet.pageSetup.fitToWidth = 1;
  sheet.pageSetup.margins = {
    top: 0.5, right: 0.5, bottom: 0.5, left: 0.5,
    header: 0.3, footer: 0.3,
  };
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
    console.log(`[email] send-emails: key="${progressKey}", notes=${noteIds.length}`);

    // Check if already in progress
    const existing = emailProgressMap.get(progressKey);
    if (existing && !existing.finished) {
      return res.status(409).json({ error: "Email sending is already in progress." });
    }

    emailProgressMap.set(progressKey, { status: "Starting...", finished: false });

    // Run asynchronously (non-blocking)
    runSendDebitNotesEmail(noteIds, false, progressKey, req.body.logoPath).catch((err) => {
      console.error("Email send error:", err);
      emailProgressMap.set(progressKey, { status: `Error: ${err.message}`, finished: true });
    });

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
    console.log(`[email] resend: key="${progressKey}", noteId=${req.params.id}`);
    const existing = emailProgressMap.get(progressKey);
    if (existing && !existing.finished) {
      return res.status(409).json({ error: "Email sending is already in progress." });
    }

    emailProgressMap.set(progressKey, { status: "Starting...", finished: false });
    runSendDebitNotesEmail([req.params.id], true, progressKey, req.body.logoPath).catch((err) => {
      console.error("Email resend error:", err);
      emailProgressMap.set(progressKey, { status: `Error: ${err.message}`, finished: true });
    });

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
    const [userRows] = await p.execute<RowDataPacket[]>("SELECT fullName, position FROM users WHERE username = ?", [note.createdBy]);
    const pb = userRows.length > 0 ? { name: userRows[0].fullName, position: userRows[0].position } : undefined;
    buildDebitNoteSheet(workbook, note, items, pb);
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
    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.pipe(output);

    for (const noteId of noteIds) {
      const [noteRows] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_notes WHERE id = ?", [noteId]);
      if (noteRows.length === 0) continue;
      const note = noteRows[0];

      const [items] = await p.execute<RowDataPacket[]>(
        "SELECT * FROM debit_note_items WHERE debitNoteId = ? ORDER BY id ASC",
        [noteId]
      );

      const [userRows] = await p.execute<RowDataPacket[]>("SELECT fullName, position FROM users WHERE username = ?", [note.createdBy]);
      const pb = userRows.length > 0 ? { name: userRows[0].fullName, position: userRows[0].position } : undefined;

      const workbook = new ExcelJS.Workbook();
      buildDebitNoteSheet(workbook, note, items, pb);

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

// ─── Settings ───

// GET: Get all settings
app.get("/api/settings", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const [rows] = await p.query<RowDataPacket[]>("SELECT `key`, value FROM settings ORDER BY `key`");
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// PUT: Update settings (bulk)
app.put("/api/settings", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const settings: Record<string, string> = req.body;
    const now = new Date().toISOString();
    for (const [key, value] of Object.entries(settings)) {
      await p.execute(
        "INSERT INTO settings (`key`, value, updatedAt) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = ?, updatedAt = ?",
        [key, value, now, value, now]
      );
    }
    const [rows] = await p.query<RowDataPacket[]>("SELECT `key`, value FROM settings ORDER BY `key`");
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// ─── User Profile ───

// GET: Get current user profile
app.get("/api/users/profile", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const username = req.query.username as string;
    if (!username) return res.status(400).json({ error: "username is required" });
    const [rows] = await p.execute<RowDataPacket[]>("SELECT id, username, role, fullName, email, phone, position, telegramId, avatarUrl FROM users WHERE username = ?", [username]);
    if (rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  } catch (err: any) {
    console.error("Error fetching user profile:", err);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

// PUT: Update current user profile
app.put("/api/users/profile", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { username, fullName, email, phone, position, telegramId } = req.body;
    if (!username) return res.status(400).json({ error: "username is required" });
    const now = new Date().toISOString();
    await p.execute(
      "UPDATE users SET fullName = ?, email = ?, phone = ?, position = ?, telegramId = ?, updatedAt = ? WHERE username = ?",
      [fullName || "", email || "", phone || "", position || "", telegramId || "", now, username]
    );
    const [rows] = await p.execute<RowDataPacket[]>("SELECT id, username, role, fullName, email, phone, position, telegramId, avatarUrl FROM users WHERE username = ?", [username]);
    res.json(rows[0] || { success: true });
  } catch (err: any) {
    console.error("Error updating user profile:", err);
    res.status(500).json({ error: "Failed to update user profile" });
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

// ─── Product Management (pm_*) helpers ───

function pmNewId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function pmBool(value: any, fallback = false): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  return value !== 0 && value !== "0" && value !== "false";
}

function pmStatus(value: any, fallback = "Active"): string {
  return ["Active", "Inactive"].includes(value) ? value : fallback;
}

function pmText(input: any, field: string, fallback = ""): string {
  return String(input?.[field] ?? fallback).trim();
}

async function pmGetAll(table: string, orderBy = "name ASC"): Promise<any[]> {
  const p = getPool();
  if (!p || !dbReady) return [];
  const [rows] = await p.query<RowDataPacket[]>(`SELECT * FROM \`${table}\` ORDER BY ${orderBy}`);
  return rows;
}

async function pmGetById(table: string, id: string): Promise<any | null> {
  const p = getPool();
  if (!p || !dbReady) return null;
  const [rows] = await p.execute<RowDataPacket[]>(`SELECT * FROM \`${table}\` WHERE id = ?`, [id]);
  return rows[0] || null;
}

async function pmDeleteById(table: string, id: string): Promise<boolean> {
  assertDb();
  const p = getPool()!;
  const [result] = await p.execute<ResultSetHeader>(`DELETE FROM \`${table}\` WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

async function pmCount(table: string, column: string, id: string): Promise<number> {
  const p = getPool();
  if (!p || !dbReady) return 0;
  const [rows] = await p.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM \`${table}\` WHERE \`${column}\` = ?`,
    [id]
  );
  return Number((rows[0] as any).total);
}

// ─── Product Management categories ───

app.get("/api/pm/categories", async (_req, res) => {
  try {
    res.json(await pmGetAll("pm_categories", "sort_order ASC, name ASC"));
  } catch {
    res.status(500).json({ error: "Failed to fetch categories." });
  }
});

app.post("/api/pm/categories", async (req, res) => {
  try {
    const input = req.body;
    if (!input.code || !input.name) return res.status(400).json({ error: "Code and name are required." });
    const now = new Date().toISOString();
    const category = {
      id: pmNewId("cat"),
      parent_id: input.parent_id || null,
      code: String(input.code).toUpperCase().trim(),
      name: String(input.name).trim(),
      description: pmText(input, "description"),
      sort_order: input.sort_order !== undefined ? Math.max(0, parseInt(input.sort_order, 10) || 0) : 0,
      status: pmStatus(input.status),
      created_at: now,
      updated_at: now,
    };
    assertDb();
    await getPool()!.execute(
      `INSERT INTO pm_categories (id, parent_id, code, name, description, sort_order, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE parent_id = VALUES(parent_id), code = VALUES(code), name = VALUES(name),
         description = VALUES(description), sort_order = VALUES(sort_order), status = VALUES(status), updated_at = VALUES(updated_at)`,
      [category.id, category.parent_id, category.code, category.name, category.description, category.sort_order, category.status, category.created_at, category.updated_at]
    );
    res.status(201).json(category);
  } catch (err: any) {
    console.error("Error creating category:", err);
    res.status(500).json({ error: "Failed to create category." });
  }
});

app.put("/api/pm/categories/:id", async (req, res) => {
  try {
    const existing = await pmGetById("pm_categories", req.params.id);
    if (!existing) return res.status(404).json({ error: "Category not found." });
    const input = req.body;
    const now = new Date().toISOString();
    const updated = {
      ...existing,
      parent_id: input.parent_id !== undefined ? input.parent_id || null : existing.parent_id,
      code: input.code !== undefined ? String(input.code).toUpperCase().trim() : existing.code,
      name: input.name !== undefined ? String(input.name).trim() : existing.name,
      description: input.description !== undefined ? pmText(input, "description") : existing.description,
      sort_order: input.sort_order !== undefined ? Math.max(0, parseInt(input.sort_order, 10) || 0) : existing.sort_order,
      status: input.status !== undefined ? pmStatus(input.status, existing.status) : existing.status,
      updated_at: now,
    };
    assertDb();
    await getPool()!.execute(
      `UPDATE pm_categories SET parent_id = ?, code = ?, name = ?, description = ?, sort_order = ?, status = ?, updated_at = ? WHERE id = ?`,
      [updated.parent_id, updated.code, updated.name, updated.description, updated.sort_order, updated.status, updated.updated_at, updated.id]
    );
    res.json(updated);
  } catch (err: any) {
    console.error("Error updating category:", err);
    res.status(500).json({ error: "Failed to update category." });
  }
});

app.delete("/api/pm/categories/:id", async (req, res) => {
  try {
    const [children, groups] = await Promise.all([
      pmCount("pm_categories", "parent_id", req.params.id),
      pmCount("pm_product_groups", "category_id", req.params.id),
    ]);
    if (children > 0 || groups > 0) {
      return res.status(409).json({ error: "Cannot delete a category that has child categories or product groups." });
    }
    const deleted = await pmDeleteById("pm_categories", req.params.id);
    if (!deleted) return res.status(404).json({ error: "Category not found." });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting category:", err);
    res.status(500).json({ error: "Failed to delete category." });
  }
});

// ─── Product Management product groups ───

app.get("/api/pm/product-groups", async (_req, res) => {
  try {
    const p = getPool();
    if (!p || !dbReady) return res.json([]);
    const [rows] = await p.query<RowDataPacket[]>(
      `SELECT g.*, c.name AS category_name, c.code AS category_code
       FROM pm_product_groups g LEFT JOIN pm_categories c ON c.id = g.category_id ORDER BY g.name ASC`
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch product groups." });
  }
});

app.post("/api/pm/product-groups", async (req, res) => {
  try {
    const input = req.body;
    if (!input.code || !input.name || !input.category_id) return res.status(400).json({ error: "Code, name, and category are required." });
    const now = new Date().toISOString();
    const group = {
      id: pmNewId("pgrp"),
      category_id: String(input.category_id),
      code: String(input.code).toUpperCase().trim(),
      name: String(input.name).trim(),
      description: pmText(input, "description"),
      status: pmStatus(input.status),
      created_at: now,
      updated_at: now,
    };
    assertDb();
    await getPool()!.execute(
      `INSERT INTO pm_product_groups (id, category_id, code, name, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE category_id = VALUES(category_id), code = VALUES(code), name = VALUES(name),
         description = VALUES(description), status = VALUES(status), updated_at = VALUES(updated_at)`,
      [group.id, group.category_id, group.code, group.name, group.description, group.status, group.created_at, group.updated_at]
    );
    res.status(201).json(group);
  } catch (err: any) {
    console.error("Error creating product group:", err);
    res.status(500).json({ error: "Failed to create product group." });
  }
});

app.put("/api/pm/product-groups/:id", async (req, res) => {
  try {
    const existing = await pmGetById("pm_product_groups", req.params.id);
    if (!existing) return res.status(404).json({ error: "Product group not found." });
    const input = req.body;
    const now = new Date().toISOString();
    const updated = {
      ...existing,
      category_id: input.category_id !== undefined ? String(input.category_id) : existing.category_id,
      code: input.code !== undefined ? String(input.code).toUpperCase().trim() : existing.code,
      name: input.name !== undefined ? String(input.name).trim() : existing.name,
      description: input.description !== undefined ? pmText(input, "description") : existing.description,
      status: input.status !== undefined ? pmStatus(input.status, existing.status) : existing.status,
      updated_at: now,
    };
    assertDb();
    await getPool()!.execute(
      `UPDATE pm_product_groups SET category_id = ?, code = ?, name = ?, description = ?, status = ?, updated_at = ? WHERE id = ?`,
      [updated.category_id, updated.code, updated.name, updated.description, updated.status, updated.updated_at, updated.id]
    );
    res.json(updated);
  } catch (err: any) {
    console.error("Error updating product group:", err);
    res.status(500).json({ error: "Failed to update product group." });
  }
});

app.delete("/api/pm/product-groups/:id", async (req, res) => {
  try {
    const count = await pmCount("pm_products", "product_group_id", req.params.id);
    if (count > 0) return res.status(409).json({ error: "Cannot delete a product group that still has products." });
    const deleted = await pmDeleteById("pm_product_groups", req.params.id);
    if (!deleted) return res.status(404).json({ error: "Product group not found." });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting product group:", err);
    res.status(500).json({ error: "Failed to delete product group." });
  }
});

// ─── Product Management brands ───

app.get("/api/pm/brands", async (_req, res) => {
  try {
    res.json(await pmGetAll("pm_brands"));
  } catch {
    res.status(500).json({ error: "Failed to fetch brands." });
  }
});

app.post("/api/pm/brands", async (req, res) => {
  try {
    const input = req.body;
    if (!input.code || !input.name) return res.status(400).json({ error: "Code and name are required." });
    const now = new Date().toISOString();
    const brand = {
      id: pmNewId("brnd"),
      code: String(input.code).toUpperCase().trim(),
      name: String(input.name).trim(),
      description: pmText(input, "description"),
      status: pmStatus(input.status),
      created_at: now,
      updated_at: now,
    };
    assertDb();
    await getPool()!.execute(
      `INSERT INTO pm_brands (id, code, name, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE code = VALUES(code), name = VALUES(name), description = VALUES(description), status = VALUES(status), updated_at = VALUES(updated_at)`,
      [brand.id, brand.code, brand.name, brand.description, brand.status, brand.created_at, brand.updated_at]
    );
    res.status(201).json(brand);
  } catch (err: any) {
    console.error("Error creating brand:", err);
    res.status(500).json({ error: "Failed to create brand." });
  }
});

app.put("/api/pm/brands/:id", async (req, res) => {
  try {
    const existing = await pmGetById("pm_brands", req.params.id);
    if (!existing) return res.status(404).json({ error: "Brand not found." });
    const input = req.body;
    const now = new Date().toISOString();
    const updated = {
      ...existing,
      code: input.code !== undefined ? String(input.code).toUpperCase().trim() : existing.code,
      name: input.name !== undefined ? String(input.name).trim() : existing.name,
      description: input.description !== undefined ? pmText(input, "description") : existing.description,
      status: input.status !== undefined ? pmStatus(input.status, existing.status) : existing.status,
      updated_at: now,
    };
    assertDb();
    await getPool()!.execute(
      `UPDATE pm_brands SET code = ?, name = ?, description = ?, status = ?, updated_at = ? WHERE id = ?`,
      [updated.code, updated.name, updated.description, updated.status, updated.updated_at, updated.id]
    );
    res.json(updated);
  } catch (err: any) {
    console.error("Error updating brand:", err);
    res.status(500).json({ error: "Failed to update brand." });
  }
});

app.delete("/api/pm/brands/:id", async (req, res) => {
  try {
    const count = await pmCount("pm_products", "brand_id", req.params.id);
    if (count > 0) return res.status(409).json({ error: "Cannot delete a brand that is assigned to products." });
    const deleted = await pmDeleteById("pm_brands", req.params.id);
    if (!deleted) return res.status(404).json({ error: "Brand not found." });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting brand:", err);
    res.status(500).json({ error: "Failed to delete brand." });
  }
});

// ─── Product Management UoMs ───

app.get("/api/pm/uoms", async (_req, res) => {
  try {
    res.json(await pmGetAll("pm_uoms"));
  } catch {
    res.status(500).json({ error: "Failed to fetch UoMs." });
  }
});

app.post("/api/pm/uoms", async (req, res) => {
  try {
    const input = req.body;
    if (!input.code || !input.name) return res.status(400).json({ error: "Code and name are required." });
    const now = new Date().toISOString();
    const uom = {
      id: pmNewId("uom"),
      code: String(input.code).toUpperCase().trim(),
      name: String(input.name).trim(),
      type: ["unit", "weight", "volume", "length", "time", "packaging", "other"].includes(input.type) ? input.type : "unit",
      decimal_places: input.decimal_places !== undefined ? Math.max(0, parseInt(input.decimal_places, 10) || 0) : 0,
      status: pmStatus(input.status),
      created_at: now,
      updated_at: now,
    };
    assertDb();
    await getPool()!.execute(
      `INSERT INTO pm_uoms (id, code, name, type, decimal_places, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE code = VALUES(code), name = VALUES(name), type = VALUES(type), decimal_places = VALUES(decimal_places), status = VALUES(status), updated_at = VALUES(updated_at)`,
      [uom.id, uom.code, uom.name, uom.type, uom.decimal_places, uom.status, uom.created_at, uom.updated_at]
    );
    res.status(201).json(uom);
  } catch (err: any) {
    console.error("Error creating UoM:", err);
    res.status(500).json({ error: "Failed to create UoM." });
  }
});

app.put("/api/pm/uoms/:id", async (req, res) => {
  try {
    const existing = await pmGetById("pm_uoms", req.params.id);
    if (!existing) return res.status(404).json({ error: "UoM not found." });
    const input = req.body;
    const now = new Date().toISOString();
    const updated = {
      ...existing,
      code: input.code !== undefined ? String(input.code).toUpperCase().trim() : existing.code,
      name: input.name !== undefined ? String(input.name).trim() : existing.name,
      type: input.type !== undefined && ["unit", "weight", "volume", "length", "time", "packaging", "other"].includes(input.type) ? input.type : existing.type,
      decimal_places: input.decimal_places !== undefined ? Math.max(0, parseInt(input.decimal_places, 10) || 0) : existing.decimal_places,
      status: input.status !== undefined ? pmStatus(input.status, existing.status) : existing.status,
      updated_at: now,
    };
    assertDb();
    await getPool()!.execute(
      `UPDATE pm_uoms SET code = ?, name = ?, type = ?, decimal_places = ?, status = ?, updated_at = ? WHERE id = ?`,
      [updated.code, updated.name, updated.type, updated.decimal_places, updated.status, updated.updated_at, updated.id]
    );
    res.json(updated);
  } catch (err: any) {
    console.error("Error updating UoM:", err);
    res.status(500).json({ error: "Failed to update UoM." });
  }
});

app.delete("/api/pm/uoms/:id", async (req, res) => {
  try {
    const count = await pmCount("pm_product_variant_uoms", "uom_id", req.params.id);
    if (count > 0) return res.status(409).json({ error: "Cannot delete a UoM that is in use by variants." });
    const deleted = await pmDeleteById("pm_uoms", req.params.id);
    if (!deleted) return res.status(404).json({ error: "UoM not found." });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting UoM:", err);
    res.status(500).json({ error: "Failed to delete UoM." });
  }
});

// ─── Product Management products ───

app.get("/api/pm/products", async (req, res) => {
  try {
    const { page, pageSize, search, groupId, categoryId, brandId, status, sort } = req.query;
    const p = getPool();
    if (!p || !dbReady) return res.json({ data: [], total: 0 });

    const conditions: string[] = [];
    const params: any[] = [];
    if (search) {
      conditions.push("(p.name LIKE ? OR p.code LIKE ? OR g.name LIKE ? OR b.name LIKE ?)");
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (groupId) { conditions.push("p.product_group_id = ?"); params.push(groupId); }
    if (categoryId) { conditions.push("g.category_id = ?"); params.push(categoryId); }
    if (brandId) { conditions.push("p.brand_id = ?"); params.push(brandId); }
    if (status === "active") conditions.push("p.status = 'Active'");
    else if (status === "inactive") conditions.push("p.status = 'Inactive'");

    const fromSql =
      `FROM pm_products p
       LEFT JOIN pm_product_groups g ON g.id = p.product_group_id
       LEFT JOIN pm_categories c ON c.id = g.category_id
       LEFT JOIN pm_brands b ON b.id = p.brand_id`;
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [countRows] = await p.query<RowDataPacket[]>(`SELECT COUNT(*) as total ${fromSql} ${where}`, params);
    const total = Number((countRows[0] as any).total);

    const orderBy = sort === "code" ? "p.code ASC" : sort === "group" ? "g.name ASC" : sort === "brand" ? "b.name ASC" : "p.name ASC";
    const selectSql = `SELECT p.*, g.name AS product_group_name, g.code AS product_group_code, c.name AS category_name, b.name AS brand_name,
         (SELECT COUNT(*) FROM pm_product_variants v WHERE v.product_id = p.id) AS variant_count
       ${fromSql} ${where} ORDER BY ${orderBy}`;

    const pageSizeNum = pageSize !== undefined ? Math.max(0, Number(pageSize)) : 20;
    let rows: RowDataPacket[];
    if (pageSizeNum === 0) {
      [rows] = await p.query<RowDataPacket[]>(selectSql, params);
    } else {
      const pageNum = Math.max(1, Number(page) || 1);
      [rows] = await p.query<RowDataPacket[]>(`${selectSql} LIMIT ? OFFSET ?`, [...params, pageSizeNum, (pageNum - 1) * pageSizeNum]);
    }
    res.json({ data: rows, total });
  } catch (err: any) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Failed to fetch products." });
  }
});

app.get("/api/pm/products/:id", async (req, res) => {
  try {
    const p = getPool();
    if (!p || !dbReady) return res.status(503).json({ error: "Database is not available." });
    const [rows] = await p.execute<RowDataPacket[]>(
      `SELECT p.*, g.name AS product_group_name, g.code AS product_group_code, c.name AS category_name, b.name AS brand_name
       FROM pm_products p
       LEFT JOIN pm_product_groups g ON g.id = p.product_group_id
       LEFT JOIN pm_categories c ON c.id = g.category_id
       LEFT JOIN pm_brands b ON b.id = p.brand_id
       WHERE p.id = ?`,
      [req.params.id]
    );
    const product = rows[0];
    if (!product) return res.status(404).json({ error: "Product not found." });
    const [variants] = await p.execute<RowDataPacket[]>(
      `SELECT * FROM pm_product_variants WHERE product_id = ? ORDER BY name ASC`,
      [req.params.id]
    );
    product.variants = variants;
    res.json(product);
  } catch (err: any) {
    console.error("Error fetching product:", err);
    res.status(500).json({ error: "Failed to fetch product." });
  }
});

app.post("/api/pm/products", async (req, res) => {
  try {
    const input = req.body;
    if (!input.code || !input.name || !input.product_group_id) return res.status(400).json({ error: "Code, name, and product group are required." });
    const now = new Date().toISOString();
    const product = {
      id: pmNewId("prod"),
      product_group_id: String(input.product_group_id),
      brand_id: input.brand_id || null,
      code: String(input.code).toUpperCase().trim(),
      name: String(input.name).trim(),
      product_type: ["single", "variation"].includes(input.product_type) ? input.product_type : "single",
      is_variable: ["single", "variation"].includes(input.product_type) ? input.product_type === "variation" : pmBool(input.is_variable),
      description: pmText(input, "description"),
      status: pmStatus(input.status),
      created_at: now,
      updated_at: now,
    };
    assertDb();
    await getPool()!.execute(
      `INSERT INTO pm_products (id, product_group_id, brand_id, code, name, product_type, is_variable, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE product_group_id = VALUES(product_group_id), brand_id = VALUES(brand_id), code = VALUES(code),
         name = VALUES(name), product_type = VALUES(product_type), is_variable = VALUES(is_variable), description = VALUES(description),
         status = VALUES(status), updated_at = VALUES(updated_at)`,
      [product.id, product.product_group_id, product.brand_id, product.code, product.name, product.product_type, product.is_variable, product.description, product.status, product.created_at, product.updated_at]
    );
    res.status(201).json(product);
  } catch (err: any) {
    console.error("Error creating product:", err);
    res.status(500).json({ error: "Failed to create product." });
  }
});

app.put("/api/pm/products/:id", async (req, res) => {
  try {
    const p = getPool();
    if (!p || !dbReady) return res.status(503).json({ error: "Database is not available." });
    const [rows] = await p.execute<RowDataPacket[]>("SELECT * FROM pm_products WHERE id = ?", [req.params.id]);
    const existing = rows[0] as any;
    if (!existing) return res.status(404).json({ error: "Product not found." });
    const input = req.body;
    const now = new Date().toISOString();
    const updated = {
      ...existing,
      product_group_id: input.product_group_id !== undefined ? String(input.product_group_id) : existing.product_group_id,
      brand_id: input.brand_id !== undefined ? input.brand_id || null : existing.brand_id,
      code: input.code !== undefined ? String(input.code).toUpperCase().trim() : existing.code,
      name: input.name !== undefined ? String(input.name).trim() : existing.name,
      product_type: input.product_type !== undefined && ["single", "variation"].includes(input.product_type) ? input.product_type : existing.product_type,
      is_variable: input.product_type !== undefined && ["single", "variation"].includes(input.product_type) ? input.product_type === "variation" : (input.is_variable !== undefined ? pmBool(input.is_variable) : pmBool(existing.is_variable)),
      description: input.description !== undefined ? pmText(input, "description") : existing.description,
      status: input.status !== undefined ? pmStatus(input.status, existing.status) : existing.status,
      updated_at: now,
    };
    await p.execute(
      `UPDATE pm_products SET product_group_id = ?, brand_id = ?, code = ?, name = ?, product_type = ?, is_variable = ?, description = ?, status = ?, updated_at = ? WHERE id = ?`,
      [updated.product_group_id, updated.brand_id, updated.code, updated.name, updated.product_type, updated.is_variable, updated.description, updated.status, updated.updated_at, updated.id]
    );
    res.json(updated);
  } catch (err: any) {
    console.error("Error updating product:", err);
    res.status(500).json({ error: "Failed to update product." });
  }
});

app.delete("/api/pm/products/:id", async (req, res) => {
  try {
    const count = await pmCount("pm_product_variants", "product_id", req.params.id);
    if (count > 0) return res.status(409).json({ error: "Cannot delete a product that still has variants." });
    const deleted = await pmDeleteById("pm_products", req.params.id);
    if (!deleted) return res.status(404).json({ error: "Product not found." });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting product:", err);
    res.status(500).json({ error: "Failed to delete product." });
  }
});

// ─── Product Management variants ───

app.get("/api/pm/variants", async (req, res) => {
  try {
    const p = getPool();
    if (!p || !dbReady) return res.json([]);
    const conditions: string[] = [];
    const params: any[] = [];
    const productId = String(req.query.productId || "");
    const search = String(req.query.search || "");
    const status = String(req.query.status || "");
    if (productId) { conditions.push("v.product_id = ?"); params.push(productId); }
    if (search) {
      conditions.push("(v.sku LIKE ? OR v.name LIKE ? OR v.barcode LIKE ? OR p.name LIKE ? OR p.code LIKE ?)");
      const like = `%${search}%`;
      params.push(like, like, like, like, like);
    }
    if (status === "active") conditions.push("v.status = 'Active'");
    else if (status === "inactive") conditions.push("v.status = 'Inactive'");
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await p.query<RowDataPacket[]>(
      `SELECT v.*, p.code AS product_code, p.name AS product_name, p.product_type, p.is_variable, g.name AS product_group_name
       FROM pm_product_variants v
       JOIN pm_products p ON p.id = v.product_id
       LEFT JOIN pm_product_groups g ON g.id = p.product_group_id
       ${where} ORDER BY v.name ASC`,
      params
    );
    res.json(rows);
  } catch (err: any) {
    console.error("Error fetching variants:", err);
    res.status(500).json({ error: "Failed to fetch variants." });
  }
});

app.post("/api/pm/variants", async (req, res) => {
  try {
    const input = req.body;
    if (!input.name || !input.product_id) return res.status(400).json({ error: "Name and product are required." });
    assertDb();
    const p = getPool()!;
    const prod = await pmGetById("pm_products", String(input.product_id));
    const prefix = (prod?.code ?? "VAR").toUpperCase();
    let sku = input.sku ? String(input.sku).trim() : "";
    if (!sku) {
      const [vrows] = await p.query<RowDataPacket[]>("SELECT sku FROM pm_product_variants WHERE product_id = ?", [input.product_id]);
      let max = 0;
      for (const r of vrows as any[]) {
        if (r.sku.startsWith(`${prefix}-`)) {
          const n = parseInt(r.sku.slice(prefix.length + 1), 10);
          if (!Number.isNaN(n)) max = Math.max(max, n);
        }
      }
      sku = `${prefix}-${String(max + 1).padStart(3, "0")}`;
    }
    const now = new Date().toISOString();
    const variant = {
      id: pmNewId("var"),
      product_id: String(input.product_id),
      sku,
      name: String(input.name).trim(),
      barcode: input.barcode ? String(input.barcode).trim() : null,
      description: pmText(input, "description"),
      status: pmStatus(input.status),
      created_at: now,
      updated_at: now,
    };
    await p.execute(
      `INSERT INTO pm_product_variants (id, product_id, sku, name, barcode, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE product_id = VALUES(product_id), sku = VALUES(sku), name = VALUES(name), barcode = VALUES(barcode),
         description = VALUES(description), status = VALUES(status), updated_at = VALUES(updated_at)`,
      [variant.id, variant.product_id, variant.sku, variant.name, variant.barcode, variant.description, variant.status, variant.created_at, variant.updated_at]
    );
    res.status(201).json(variant);
  } catch (err: any) {
    console.error("Error creating variant:", err);
    res.status(500).json({ error: "Failed to create variant." });
  }
});

app.put("/api/pm/variants/:id", async (req, res) => {
  try {
    const existing = await pmGetById("pm_product_variants", req.params.id);
    if (!existing) return res.status(404).json({ error: "Variant not found." });
    const input = req.body;
    const now = new Date().toISOString();
    const updated = {
      ...existing,
      product_id: input.product_id !== undefined ? String(input.product_id) : existing.product_id,
      sku: input.sku !== undefined ? String(input.sku).trim() : existing.sku,
      name: input.name !== undefined ? String(input.name).trim() : existing.name,
      barcode: input.barcode !== undefined ? (input.barcode ? String(input.barcode).trim() : null) : existing.barcode,
      description: input.description !== undefined ? pmText(input, "description") : existing.description,
      status: input.status !== undefined ? pmStatus(input.status, existing.status) : existing.status,
      updated_at: now,
    };
    assertDb();
    await getPool()!.execute(
      `UPDATE pm_product_variants SET product_id = ?, sku = ?, name = ?, barcode = ?, description = ?, status = ?, updated_at = ? WHERE id = ?`,
      [updated.product_id, updated.sku, updated.name, updated.barcode, updated.description, updated.status, updated.updated_at, updated.id]
    );
    res.json(updated);
  } catch (err: any) {
    console.error("Error updating variant:", err);
    res.status(500).json({ error: "Failed to update variant." });
  }
});

app.delete("/api/pm/variants/:id", async (req, res) => {
  try {
    const deleted = await pmDeleteById("pm_product_variants", req.params.id);
    if (!deleted) return res.status(404).json({ error: "Variant not found." });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting variant:", err);
    res.status(500).json({ error: "Failed to delete variant." });
  }
});

// ─── Product Management standards ───

app.get("/api/pm/standards", async (_req, res) => {
  try {
    const p = getPool();
    if (!p || !dbReady) return res.json([]);
    const [rows] = await p.query<RowDataPacket[]>(
      `SELECT s.*, g.name AS product_group_name, g.code AS product_group_code,
              (SELECT COUNT(*) FROM pm_product_standard_items i WHERE i.product_standard_id = s.id) AS item_count
       FROM pm_product_standards s LEFT JOIN pm_product_groups g ON g.id = s.product_group_id ORDER BY s.name ASC`
    );
    res.json(rows);
  } catch (err: any) {
    console.error("Error fetching standards:", err);
    res.status(500).json({ error: "Failed to fetch standards." });
  }
});

app.get("/api/pm/standards/:id", async (req, res) => {
  try {
    const p = getPool();
    if (!p || !dbReady) return res.status(503).json({ error: "Database is not available." });
    const [rows] = await p.execute<RowDataPacket[]>(
      `SELECT s.*, g.name AS product_group_name, g.code AS product_group_code
       FROM pm_product_standards s LEFT JOIN pm_product_groups g ON g.id = s.product_group_id WHERE s.id = ?`,
      [req.params.id]
    );
    const standard = rows[0];
    if (!standard) return res.status(404).json({ error: "Standard not found." });
    const [items] = await p.execute<RowDataPacket[]>(
      `SELECT i.*, v.sku, v.name AS variant_name, v.barcode, p.code AS product_code, p.name AS product_name
       FROM pm_product_standard_items i
       JOIN pm_product_variants v ON v.id = i.product_variant_id
       LEFT JOIN pm_products p ON p.id = v.product_id
       WHERE i.product_standard_id = ?
       ORDER BY i.is_preferred DESC, v.name ASC`,
      [req.params.id]
    );
    standard.items = items;
    res.json(standard);
  } catch (err: any) {
    console.error("Error fetching standard:", err);
    res.status(500).json({ error: "Failed to fetch standard." });
  }
});

app.post("/api/pm/standards", async (req, res) => {
  try {
    const input = req.body;
    if (!input.code || !input.name || !input.product_group_id) return res.status(400).json({ error: "Code, name, and product group are required." });
    const now = new Date().toISOString();
    const standard = {
      id: pmNewId("std"),
      product_group_id: String(input.product_group_id),
      code: String(input.code).toUpperCase().trim(),
      name: String(input.name).trim(),
      description: pmText(input, "description"),
      status: pmStatus(input.status),
      created_at: now,
      updated_at: now,
    };
    assertDb();
    await getPool()!.execute(
      `INSERT INTO pm_product_standards (id, product_group_id, code, name, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE product_group_id = VALUES(product_group_id), code = VALUES(code), name = VALUES(name),
         description = VALUES(description), status = VALUES(status), updated_at = VALUES(updated_at)`,
      [standard.id, standard.product_group_id, standard.code, standard.name, standard.description, standard.status, standard.created_at, standard.updated_at]
    );
    res.status(201).json(standard);
  } catch (err: any) {
    console.error("Error creating standard:", err);
    res.status(500).json({ error: "Failed to create standard." });
  }
});

app.put("/api/pm/standards/:id", async (req, res) => {
  try {
    const existing = await pmGetById("pm_product_standards", req.params.id);
    if (!existing) return res.status(404).json({ error: "Standard not found." });
    const input = req.body;
    const now = new Date().toISOString();
    const updated = {
      ...existing,
      product_group_id: input.product_group_id !== undefined ? String(input.product_group_id) : existing.product_group_id,
      code: input.code !== undefined ? String(input.code).toUpperCase().trim() : existing.code,
      name: input.name !== undefined ? String(input.name).trim() : existing.name,
      description: input.description !== undefined ? pmText(input, "description") : existing.description,
      status: input.status !== undefined ? pmStatus(input.status, existing.status) : existing.status,
      updated_at: now,
    };
    assertDb();
    await getPool()!.execute(
      `UPDATE pm_product_standards SET product_group_id = ?, code = ?, name = ?, description = ?, status = ?, updated_at = ? WHERE id = ?`,
      [updated.product_group_id, updated.code, updated.name, updated.description, updated.status, updated.updated_at, updated.id]
    );
    res.json(updated);
  } catch (err: any) {
    console.error("Error updating standard:", err);
    res.status(500).json({ error: "Failed to update standard." });
  }
});

app.delete("/api/pm/standards/:id", async (req, res) => {
  try {
    const deleted = await pmDeleteById("pm_product_standards", req.params.id);
    if (!deleted) return res.status(404).json({ error: "Standard not found." });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting standard:", err);
    res.status(500).json({ error: "Failed to delete standard." });
  }
});

// ─── Product Management standard items ───

app.post("/api/pm/standard-items", async (req, res) => {
  try {
    const input = req.body;
    if (!input.product_standard_id || !input.product_variant_id) return res.status(400).json({ error: "Standard and variant are required." });
    const now = new Date().toISOString();
    const item = {
      id: pmNewId("sitem"),
      product_standard_id: String(input.product_standard_id),
      product_variant_id: String(input.product_variant_id),
      is_preferred: pmBool(input.is_preferred),
      effective_from: input.effective_from || null,
      effective_to: input.effective_to || null,
      status: pmStatus(input.status),
      created_at: now,
      updated_at: now,
    };
    assertDb();
    await getPool()!.execute(
      `INSERT INTO pm_product_standard_items (id, product_standard_id, product_variant_id, is_preferred, effective_from, effective_to, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE product_standard_id = VALUES(product_standard_id), product_variant_id = VALUES(product_variant_id),
         is_preferred = VALUES(is_preferred), effective_from = VALUES(effective_from), effective_to = VALUES(effective_to),
         status = VALUES(status), updated_at = VALUES(updated_at)`,
      [item.id, item.product_standard_id, item.product_variant_id, item.is_preferred, item.effective_from, item.effective_to, item.status, item.created_at, item.updated_at]
    );
    res.status(201).json(item);
  } catch (err: any) {
    console.error("Error creating standard item:", err);
    res.status(500).json({ error: "Failed to create standard item." });
  }
});

app.delete("/api/pm/standard-items/:id", async (req, res) => {
  try {
    const deleted = await pmDeleteById("pm_product_standard_items", req.params.id);
    if (!deleted) return res.status(404).json({ error: "Standard item not found." });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting standard item:", err);
    res.status(500).json({ error: "Failed to delete standard item." });
  }
});

// ─── Product Management variant UoMs ───

app.get("/api/pm/variant-uoms", async (req, res) => {
  try {
    const variantId = String(req.query.variant_id || "");
    if (!variantId) return res.status(400).json({ error: "variant_id is required." });
    const p = getPool();
    if (!p || !dbReady) return res.json([]);
    const [rows] = await p.execute<RowDataPacket[]>(
      `SELECT u.*, uom.code AS uom_code, uom.name AS uom_name, uom.type AS uom_type, uom.decimal_places AS uom_decimal_places
       FROM pm_product_variant_uoms u JOIN pm_uoms uom ON uom.id = u.uom_id
       WHERE u.product_variant_id = ?
       ORDER BY u.is_base DESC, uom.name ASC`,
      [variantId]
    );
    res.json(rows);
  } catch (err: any) {
    console.error("Error fetching variant UoMs:", err);
    res.status(500).json({ error: "Failed to fetch variant UoMs." });
  }
});

app.post("/api/pm/variant-uoms", async (req, res) => {
  try {
    const input = req.body;
    if (!input.product_variant_id || !input.uom_id) return res.status(400).json({ error: "Variant and UoM are required." });
    const now = new Date().toISOString();
    const item = {
      id: pmNewId("vuom"),
      product_variant_id: String(input.product_variant_id),
      uom_id: String(input.uom_id),
      conversion_factor: input.conversion_factor !== undefined && input.conversion_factor !== "" ? Number(input.conversion_factor) : 1,
      is_base: pmBool(input.is_base),
      can_purchase: pmBool(input.can_purchase),
      can_stock: pmBool(input.can_stock),
      can_issue: pmBool(input.can_issue),
      can_sell: pmBool(input.can_sell),
      status: pmStatus(input.status),
      created_at: now,
      updated_at: now,
    };
    assertDb();
    await getPool()!.execute(
      `INSERT INTO pm_product_variant_uoms (id, product_variant_id, uom_id, conversion_factor, is_base, can_purchase, can_stock, can_issue, can_sell, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE product_variant_id = VALUES(product_variant_id), uom_id = VALUES(uom_id),
         conversion_factor = VALUES(conversion_factor), is_base = VALUES(is_base), can_purchase = VALUES(can_purchase),
         can_stock = VALUES(can_stock), can_issue = VALUES(can_issue), can_sell = VALUES(can_sell),
         status = VALUES(status), updated_at = VALUES(updated_at)`,
      [item.id, item.product_variant_id, item.uom_id, item.conversion_factor, item.is_base, item.can_purchase, item.can_stock, item.can_issue, item.can_sell, item.status, item.created_at, item.updated_at]
    );
    res.status(201).json(item);
  } catch (err: any) {
    console.error("Error creating variant UoM:", err);
    res.status(500).json({ error: "Failed to create variant UoM." });
  }
});

app.put("/api/pm/variant-uoms/:id", async (req, res) => {
  try {
    const existing = await pmGetById("pm_product_variant_uoms", req.params.id);
    if (!existing) return res.status(404).json({ error: "Variant UoM not found." });
    const input = req.body;
    const now = new Date().toISOString();
    const updated = {
      ...existing,
      uom_id: input.uom_id !== undefined ? String(input.uom_id) : existing.uom_id,
      conversion_factor: input.conversion_factor !== undefined && input.conversion_factor !== "" ? Number(input.conversion_factor) : existing.conversion_factor,
      is_base: input.is_base !== undefined ? pmBool(input.is_base) : pmBool(existing.is_base),
      can_purchase: input.can_purchase !== undefined ? pmBool(input.can_purchase) : pmBool(existing.can_purchase),
      can_stock: input.can_stock !== undefined ? pmBool(input.can_stock) : pmBool(existing.can_stock),
      can_issue: input.can_issue !== undefined ? pmBool(input.can_issue) : pmBool(existing.can_issue),
      can_sell: input.can_sell !== undefined ? pmBool(input.can_sell) : pmBool(existing.can_sell),
      status: input.status !== undefined ? pmStatus(input.status, existing.status) : existing.status,
      updated_at: now,
    };
    assertDb();
    await getPool()!.execute(
      `UPDATE pm_product_variant_uoms SET uom_id = ?, conversion_factor = ?, is_base = ?, can_purchase = ?, can_stock = ?, can_issue = ?, can_sell = ?, status = ?, updated_at = ? WHERE id = ?`,
      [updated.uom_id, updated.conversion_factor, updated.is_base, updated.can_purchase, updated.can_stock, updated.can_issue, updated.can_sell, updated.status, updated.updated_at, updated.id]
    );
    res.json(updated);
  } catch (err: any) {
    console.error("Error updating variant UoM:", err);
    res.status(500).json({ error: "Failed to update variant UoM." });
  }
});

app.delete("/api/pm/variant-uoms/:id", async (req, res) => {
  try {
    const deleted = await pmDeleteById("pm_product_variant_uoms", req.params.id);
    if (!deleted) return res.status(404).json({ error: "Variant UoM not found." });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting variant UoM:", err);
    res.status(500).json({ error: "Failed to delete variant UoM." });
  }
});

// ─── Product Management refs ───

app.get("/api/pm/refs", async (_req, res) => {
  try {
    const p = getPool();
    if (!p || !dbReady) {
      return res.json({ categories: [], productGroups: [], brands: [], uoms: [], products: [], variants: [], standards: [] });
    }
    const [categories] = await p.query<RowDataPacket[]>("SELECT * FROM pm_categories ORDER BY sort_order ASC, name ASC");
    const [productGroups] = await p.query<RowDataPacket[]>(
      `SELECT g.*, c.name AS category_name FROM pm_product_groups g LEFT JOIN pm_categories c ON c.id = g.category_id ORDER BY g.name ASC`
    );
    const [brands] = await p.query<RowDataPacket[]>("SELECT * FROM pm_brands ORDER BY name ASC");
    const [uoms] = await p.query<RowDataPacket[]>("SELECT * FROM pm_uoms ORDER BY name ASC");
    const [products] = await p.query<RowDataPacket[]>(
      `SELECT p.*, g.name AS product_group_name FROM pm_products p LEFT JOIN pm_product_groups g ON g.id = p.product_group_id ORDER BY p.name ASC`
    );
    const [variants] = await p.query<RowDataPacket[]>(
      `SELECT v.*, p.code AS product_code, p.name AS product_name FROM pm_product_variants v JOIN pm_products p ON p.id = v.product_id ORDER BY v.name ASC`
    );
    const [standards] = await p.query<RowDataPacket[]>("SELECT * FROM pm_product_standards ORDER BY name ASC");
    res.json({ categories, productGroups, brands, uoms, products, variants, standards });
  } catch (err: any) {
    console.error("Error fetching product management refs:", err);
    res.status(500).json({ error: "Failed to fetch references." });
  }
});

// --- Server Delivery Pipelines ---
async function startServer() {
  await initDb();

  ensureDebitNoteLogo();

  const uploadsDir = getLocalUploadsDir();
  if (isMinioEnabled()) {
    app.use("/uploads", async (req, res, next) => {
      const key = decodeURIComponent(req.path.replace(/^\/+/, ""));
      if (!key) return next();
      try {
        const obj = await getObject(key);
        if (!obj) return next();
        res.setHeader("Content-Type", obj.contentType);
        res.setHeader("Content-Length", obj.size);
        obj.stream.pipe(res);
      } catch {
        next();
      }
    });
  } else {
    app.use("/uploads", express.static(uploadsDir));
  }

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
