import mysql, { type RowDataPacket } from "mysql2/promise";
import { getEnv } from "./config.js";

let pool: mysql.Pool | null = null;
let dbReady = false;

export function getPool(): mysql.Pool | null {
  return pool;
}

export function isDbReady(): boolean {
  return dbReady;
}

export function assertDb(): void {
  if (!pool || !dbReady) throw new Error("Database is not available.");
}

export async function checkDbConnection(): Promise<boolean> {
  if (!pool) return false;
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function initDb() {
  const env = getEnv();

  if (!/^[a-zA-Z0-9_]+$/.test(env.DB_DATABASE)) {
    console.error("DB_DATABASE may contain only letters, numbers, and underscores.");
    return;
  }

  try {
    const adminConnection = await mysql.createConnection({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
    });
    await adminConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.DB_DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await adminConnection.end();

    pool = mysql.createPool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_DATABASE,
      charset: "utf8mb4",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    await createTables(pool);
    await migrateSchema(pool);
    await seedDefaults(pool);

    dbReady = true;
    console.log(`MySQL database '${env.DB_DATABASE}' and its tables are ready.`);
  } catch (err) {
    pool = null;
    dbReady = false;
    console.error("Failed to initialize MySQL database:", err);
    console.warn("Start MySQL and verify DB_* values in .env.");
  }
}

async function createTables(p: mysql.Pool) {
  await p.query(`CREATE TABLE IF NOT EXISTS products (
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

  await p.query(`CREATE TABLE IF NOT EXISTS suppliers (
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

  await p.query(`CREATE TABLE IF NOT EXISTS stock_issue_items (
    id VARCHAR(64) PRIMARY KEY,
    itemCode VARCHAR(100) NOT NULL DEFAULT '',
    description TEXT NOT NULL,
    quantity DECIMAL(15,2) NOT NULL DEFAULT 0,
    uom VARCHAR(50) NOT NULL DEFAULT '',
    unitPrice DECIMAL(25,15) NOT NULL DEFAULT 0,
    totalPrice DECIMAL(25,15) NOT NULL DEFAULT 0,
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

  await p.query(`CREATE TABLE IF NOT EXISTS debit_note_emails (
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

  try { await p.query("ALTER TABLE debit_note_emails ADD COLUMN division VARCHAR(255) NOT NULL DEFAULT '' AFTER campus"); } catch {}
  try { await p.query("ALTER TABLE debit_note_emails DROP INDEX dn_emails_unique"); } catch {}
  try { await p.query("ALTER TABLE debit_note_emails ADD UNIQUE KEY dn_emails_unique (warehouse, division, department, campus)"); } catch {}

  await p.query(`CREATE TABLE IF NOT EXISTS debit_notes (
    id VARCHAR(64) PRIMARY KEY,
    referenceNumber VARCHAR(255) NOT NULL,
    warehouse VARCHAR(255) NOT NULL DEFAULT '',
    division VARCHAR(255) NOT NULL DEFAULT '',
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

  await p.query(`CREATE TABLE IF NOT EXISTS debit_note_items (
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
    division VARCHAR(255) NOT NULL DEFAULT '',
    department VARCHAR(255) NOT NULL DEFAULT '',
    referenceNo VARCHAR(255) NOT NULL DEFAULT '',
    remarks TEXT NOT NULL,
    createdAt VARCHAR(40) NOT NULL,
    INDEX dn_items_debit_note_idx (debitNoteId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await p.query(`CREATE TABLE IF NOT EXISTS users (
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

  await p.query(`CREATE TABLE IF NOT EXISTS settings (
    \`key\` VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updatedAt VARCHAR(40) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

async function migrateSchema(p: mysql.Pool) {
  try { await p.query("ALTER TABLE stock_issue_items ADD COLUMN division VARCHAR(255) NOT NULL DEFAULT '' AFTER warehouse"); } catch {}
  try { await p.query("ALTER TABLE stock_issue_items ADD COLUMN transactionType VARCHAR(100) NOT NULL DEFAULT '' AFTER referenceNo"); } catch {}
  try { await p.query("ALTER TABLE stock_issue_items ADD COLUMN accountCode VARCHAR(100) NOT NULL DEFAULT '' AFTER transactionType"); } catch {}
  try { await p.query("ALTER TABLE stock_issue_items MODIFY COLUMN unitPrice DECIMAL(25,15) NOT NULL DEFAULT 0"); } catch {}
  try { await p.query("ALTER TABLE stock_issue_items MODIFY COLUMN totalPrice DECIMAL(25,15) NOT NULL DEFAULT 0"); } catch {}
  try { await p.query("ALTER TABLE stock_issue_items ADD INDEX ssi_date_idx (transactionDate)"); } catch {}
  try { await p.query("ALTER TABLE stock_issue_items ADD INDEX ssi_type_date_idx (transactionType, transactionDate)"); } catch {}
  try { await p.query("ALTER TABLE stock_issue_items ADD INDEX ssi_item_idx (itemCode)"); } catch {}
  try { await p.query("ALTER TABLE stock_issue_items ADD INDEX ssi_campus_idx (campus)"); } catch {}
  try { await p.query("ALTER TABLE stock_issue_items ADD INDEX ssi_department_idx (department)"); } catch {}
  try { await p.query("ALTER TABLE stock_issue_items ADD INDEX ssi_division_idx (division)"); } catch {}
  try { await p.query("ALTER TABLE stock_issue_items ADD INDEX ssi_warehouse_idx (warehouse)"); } catch {}
  try { await p.query("ALTER TABLE debit_note_items ADD COLUMN division VARCHAR(255) NOT NULL DEFAULT '' AFTER campus"); } catch {}
  try { await p.query("ALTER TABLE debit_notes ADD COLUMN division VARCHAR(255) NOT NULL DEFAULT '' AFTER campus"); } catch {}
  try { await p.query("ALTER TABLE debit_note_items MODIFY COLUMN unitPrice DECIMAL(25,15) NOT NULL DEFAULT 0"); } catch {}
  try { await p.query("ALTER TABLE debit_note_items MODIFY COLUMN totalPrice DECIMAL(25,15) NOT NULL DEFAULT 0"); } catch {}
  try { await p.query("ALTER TABLE users ADD COLUMN position VARCHAR(255) NOT NULL DEFAULT '' AFTER phone"); } catch {}
  try { await p.query("ALTER TABLE users ADD COLUMN telegramId VARCHAR(100) NOT NULL DEFAULT '' AFTER position"); } catch {}
  try { await p.query("ALTER TABLE suppliers ADD COLUMN countryOfOrigin VARCHAR(150) NOT NULL DEFAULT '' AFTER foreignTradeOperator"); } catch {}
}

async function seedDefaults(p: mysql.Pool) {
  const now = new Date().toISOString();

  await p.execute(
    `INSERT IGNORE INTO users (id, username, password, role, fullName, email, phone, position, telegramId, avatarUrl, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ["usr-001", "admin", "admin", "Admin", "System Administrator", "", "", "", "", "", now, now]
  );
  await p.execute(
    `INSERT IGNORE INTO users (id, username, password, role, fullName, email, phone, position, telegramId, avatarUrl, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ["usr-002", "procurement", "procurement", "Procurement", "Procurement Officer", "", "", "", "", "", now, now]
  );

  await p.execute(
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
    await p.execute(
      "INSERT IGNORE INTO settings (`key`, value, updatedAt) VALUES (?, ?, ?)",
      [key, value, now]
    );
  }
}
