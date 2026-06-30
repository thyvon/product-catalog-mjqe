/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string; // Internal database ID
  productCode: string; // Product Code
  name: string; // Product Name
  description: string; // Description
  uom: string; // Unit of Measure (UoM)
  category: string; // Category
  subCategory: string; // Sub Category
  status: "Active" | "Inactive"; // Status
  price?: number; // Optional price helper
  stock?: number; // Optional stock quantity helper
  imageUrl?: string; // High-resolution visual URL
  createdAt: string;
  updatedAt: string;
}

export type ProductInput = Omit<Product, "id" | "createdAt" | "updatedAt">;

export interface CategoryStats {
  category: string;
  count: number;
  activeCount: number;
}

export interface CatalogStats {
  totalProducts: number;
  activeCount: number;
  inactiveCount: number;

  categoryStats: CategoryStats[];
}

export interface Supplier {
  id: string;
  applicationType: "new" | "update";
  oldSupplierCode: string;
  companyName: string;
  companyNameKhmer: string;
  registrationType: "vat" | "non-vat";
  foreignTradeOperator: boolean;
  contactPerson: string;
  position: string;
  email: string;
  phone: string;
  mobile: string;
  website: string;
  address: string;
  addressKhmer: string;
  cityProvince: string;
  districtKhan: string;
  businessLicense: string;
  commercialRegistration: string;
  taxRegistration: string;
  vatCertificate: string;
  patentTaxCertificate: string;
  nationalId: string;
  establishedYear: string;
  businessActivity: string;
  productServiceType: string;
  otherDocuments: string;
  bankName: string;
  bankBranch: string;
  bankAccount: string;
  accountHolderName: string;
  swiftCode: string;
  iban: string;
  checkAuthorization: boolean;
  paymentMethod: "bank-transfer" | "cheque" | "cash" | "other";
  paymentMethodOther: string;
  paymentTerm: "no-credit" | "one-week" | "two-weeks" | "one-month" | "other";
  paymentTermOther: string;
  conflictOfInterest: boolean;
  conflictDetails: string;
  supplierDeclarationName: string;
  supplierDeclarationDate: string;
  buyerCompletedName: string;
  buyerCompletedDate: string;
  companyProfile: string;
  codeOfConductAck: boolean;
  status: "Pending" | "Approved" | "Rejected" | "Suspended";
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type SupplierInput = Omit<Supplier, "id" | "createdAt" | "updatedAt">;

export interface AICopywriterRequest {
  name: string;
  category?: string;
  subCategory?: string;
  keywords?: string[];
  tone?: "professional" | "playful" | "luxurious" | "technical" | "minimalist";
}

export interface AICopywriterResponse {
  description: string;
  uom: string;
  category: string;
  subCategory: string;
}

