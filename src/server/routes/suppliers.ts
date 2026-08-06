import { Router } from "express";
import type { RowDataPacket } from "mysql2/promise";
import { getPool, assertDb } from "../db.js";
import { getAllSuppliers, getSupplierById, upsertSupplier, deleteSupplier } from "../models/suppliers.js";

const router = Router();

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

router.get("/api/suppliers", async (_req, res) => {
  try {
    const suppliers = await getAllSuppliers();
    res.json(suppliers);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch suppliers." });
  }
});

router.get("/api/suppliers/filters/values", async (_req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const [statusRows] = await p.query<RowDataPacket[]>("SELECT DISTINCT status FROM suppliers WHERE status != '' ORDER BY status");
    const [applicationTypeRows] = await p.query<RowDataPacket[]>("SELECT DISTINCT applicationType FROM suppliers WHERE applicationType != '' ORDER BY applicationType");
    const canonicalStatuses = ["Pending", "Approved", "Rejected", "Suspended"];
    const canonicalApplicationTypes = ["new", "update"];
    res.json({
      statuses: Array.from(new Set([...statusRows.map((row: any) => row.status), ...canonicalStatuses])),
      applicationTypes: Array.from(new Set([...applicationTypeRows.map((row: any) => row.applicationType), ...canonicalApplicationTypes])),
      registrationTypes: ["vat", "non-vat"],
      paymentMethods: ["bank-transfer", "cheque", "cash", "other"],
      paymentTerms: ["no-credit", "one-week", "two-weeks", "one-month", "other"],
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch supplier filter values." });
  }
});

router.get("/api/suppliers/:id", async (req, res) => {
  try {
    const supplier = await getSupplierById(req.params.id);
    if (!supplier) return res.status(404).json({ error: "Supplier not found." });
    res.json(supplier);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch supplier." });
  }
});

router.post("/api/suppliers", async (req, res) => {
  try {
    const input = req.body;
    if (!input.companyName) return res.status(400).json({ error: "Company name is required." });
    const newSupplier = {
      id: `sup-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ...supplierPayload(input),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await upsertSupplier(newSupplier);
    res.status(201).json(newSupplier);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create supplier." });
  }
});

router.put("/api/suppliers/:id", async (req, res) => {
  try {
    const existing = await getSupplierById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Supplier not found." });
    const updated = {
      ...existing,
      ...supplierPayload(req.body, existing),
      updatedAt: new Date().toISOString(),
    };
    await upsertSupplier(updated);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update supplier." });
  }
});

router.delete("/api/suppliers/:id", async (req, res) => {
  try {
    const deleted = await deleteSupplier(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Supplier not found." });
    res.json({ success: true, message: "Supplier deleted." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete supplier." });
  }
});

export default router;
