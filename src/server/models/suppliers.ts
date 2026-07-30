import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool, isDbReady, assertDb } from "../db.js";

export async function getAllSuppliers(): Promise<any[]> {
  const p = getPool();
  if (!p || !isDbReady()) return [];
  const [rows] = await p.query<RowDataPacket[]>("SELECT * FROM suppliers ORDER BY createdAt DESC");
  return rows;
}

export async function getSupplierById(id: string): Promise<any | null> {
  const p = getPool();
  if (!p || !isDbReady()) return null;
  const [rows] = await p.execute<RowDataPacket[]>("SELECT * FROM suppliers WHERE id = ?", [id]);
  return rows[0] || null;
}

export async function upsertSupplier(supplier: any): Promise<void> {
  assertDb();
  const p = getPool()!;
  const columns = [
    "id", "applicationType", "oldSupplierCode", "companyName", "companyNameKhmer",
    "registrationType", "foreignTradeOperator", "contactPerson", "position", "email",
    "phone", "mobile", "website", "address", "addressKhmer", "cityProvince", "districtKhan",
    "businessLicense", "commercialRegistration", "taxRegistration", "vatCertificate",
    "patentTaxCertificate", "nationalId", "establishedYear", "businessActivity",
    "productServiceType", "otherDocuments", "bankName", "bankBranch", "bankAccount",
    "accountHolderName", "swiftCode", "iban", "checkAuthorization", "paymentMethod",
    "paymentMethodOther", "paymentTerm", "paymentTermOther", "conflictOfInterest",
    "conflictDetails", "supplierDeclarationName", "supplierDeclarationDate",
    "buyerCompletedName", "buyerCompletedDate", "companyProfile", "codeOfConductAck",
    "status", "notes", "createdAt", "updatedAt",
  ];
  const values = [
    supplier.id, supplier.applicationType || "new", supplier.oldSupplierCode || "",
    supplier.companyName, supplier.companyNameKhmer || "",
    supplier.registrationType || "vat", supplier.foreignTradeOperator ?? false,
    supplier.contactPerson || "", supplier.position || "", supplier.email || "",
    supplier.phone || "", supplier.mobile || "", supplier.website || "",
    supplier.address || "", supplier.addressKhmer || "", supplier.cityProvince || "",
    supplier.districtKhan || "", supplier.businessLicense || "",
    supplier.commercialRegistration || "", supplier.taxRegistration || "",
    supplier.vatCertificate || "", supplier.patentTaxCertificate || "",
    supplier.nationalId || "", supplier.establishedYear || "",
    supplier.businessActivity || "", supplier.productServiceType || "",
    supplier.otherDocuments || "", supplier.bankName || "", supplier.bankBranch || "",
    supplier.bankAccount || "", supplier.accountHolderName || "",
    supplier.swiftCode || "", supplier.iban || "", supplier.checkAuthorization ?? false,
    supplier.paymentMethod || "bank-transfer", supplier.paymentMethodOther || "",
    supplier.paymentTerm || "no-credit", supplier.paymentTermOther || "",
    supplier.conflictOfInterest ?? false, supplier.conflictDetails || "",
    supplier.supplierDeclarationName || "", supplier.supplierDeclarationDate || "",
    supplier.buyerCompletedName || "", supplier.buyerCompletedDate || "",
    supplier.companyProfile || "", supplier.codeOfConductAck ?? false,
    supplier.status || "Pending", supplier.notes || "",
    supplier.createdAt, supplier.updatedAt,
  ];

  const escapedColumns = columns.map((c) => `\`${c}\``);
  const placeholders = columns.map(() => "?").join(", ");
  const updates = columns
    .filter((c) => c !== "id" && c !== "createdAt")
    .map((c) => `\`${c}\` = VALUES(\`${c}\`)`)
    .join(", ");

  await p.execute(
    `INSERT INTO suppliers (${escapedColumns.join(", ")})
     VALUES (${placeholders})
     ON DUPLICATE KEY UPDATE ${updates}`,
    values
  );
}

export async function deleteSupplier(id: string): Promise<boolean> {
  assertDb();
  const p = getPool()!;
  const [result] = await p.execute<ResultSetHeader>("DELETE FROM suppliers WHERE id = ?", [id]);
  return result.affectedRows > 0;
}
