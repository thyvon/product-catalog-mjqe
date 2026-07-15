import mysql, { type ResultSetHeader, type RowDataPacket } from "mysql2/promise";

let pool: mysql.Pool | null = null;
let dbReady = false;

function getDbConfig() {
  return {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_DATABASE || "product_catalog",
  };
}

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

    await createTables(pool);
    await migrateSchema(pool);

    dbReady = true;
    console.log(`MySQL database '${config.database}' and its tables are ready.`);
  } catch (err) {
    pool = null;
    dbReady = false;
    console.error("Failed to initialize MySQL database:", err);
    console.warn("Start MySQL in XAMPP and verify the DB_* values in .env.");
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

  await p.query(`CREATE TABLE IF NOT EXISTS debit_note_emails (
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

  await p.query(`CREATE TABLE IF NOT EXISTS debit_notes (
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
    department VARCHAR(255) NOT NULL DEFAULT '',
    referenceNo VARCHAR(255) NOT NULL DEFAULT '',
    remarks TEXT NOT NULL,
    createdAt VARCHAR(40) NOT NULL,
    INDEX dn_items_debit_note_idx (debitNoteId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

async function migrateSchema(p: mysql.Pool) {
  try { await p.query("ALTER TABLE stock_issue_items ADD COLUMN division VARCHAR(255) NOT NULL DEFAULT '' AFTER warehouse"); } catch {}
  try { await p.query("ALTER TABLE stock_issue_items ADD COLUMN transactionType VARCHAR(100) NOT NULL DEFAULT '' AFTER referenceNo"); } catch {}
  try { await p.query("ALTER TABLE stock_issue_items ADD COLUMN accountCode VARCHAR(100) NOT NULL DEFAULT '' AFTER transactionType"); } catch {}
}

export async function getAllProducts(): Promise<any[]> {
  const p = getPool();
  if (!p || !dbReady) return [];
  const [rows] = await p.query<RowDataPacket[]>("SELECT * FROM products ORDER BY name ASC");
  return rows;
}

export async function getProductById(id: string): Promise<any | null> {
  const p = getPool();
  if (!p || !dbReady) return null;
  const [rows] = await p.execute<RowDataPacket[]>("SELECT * FROM products WHERE id = ?", [id]);
  return rows[0] || null;
}

export async function getProductByCode(code: string): Promise<any | null> {
  const p = getPool();
  if (!p || !dbReady) return null;
  const [rows] = await p.execute<RowDataPacket[]>("SELECT * FROM products WHERE productCode = ?", [code]);
  return rows[0] || null;
}

export async function upsertProduct(product: any): Promise<void> {
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
      product.id, product.productCode, product.name, product.description || "",
      product.uom, product.category, product.subCategory || "", product.status || "Active",
      product.price ?? null, product.stock ?? null, product.imageUrl || "",
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
