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
  countryOfOrigin: string;
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

// ─── Product Management (pm_*) ───

export interface PMCategory {
  id: string;
  parent_id: string | null;
  code: string;
  name: string;
  description: string;
  sort_order: number;
  status: "Active" | "Inactive";
  created_at: string;
  updated_at: string;
}

export interface PMProductGroup {
  id: string;
  category_id: string;
  code: string;
  name: string;
  description: string;
  status: "Active" | "Inactive";
  created_at: string;
  updated_at: string;
  category_name?: string;
  category_code?: string;
}

export interface PMProduct {
  id: string;
  product_group_id: string | null;
  category_id?: string | null;
  brand_id: string | null;
  uom_id: string | null;
  sub_unit_id: string | null;
  code: string;
  name: string;
  product_type: "single" | "variation";
  is_variable: boolean;
  description: string;
  status: "Active" | "Inactive";
  created_at: string;
  updated_at: string;
  product_group_name?: string;
  category_name?: string;
  assigned_category_code?: string;
  assigned_category_name?: string;
  brand_name?: string;
  uom_code?: string;
  uom_name?: string;
  sub_unit_name?: string;
  sub_unit_short_name?: string;
  variant_count?: number;
  variants?: PMVariant[];
  variation_template_ids?: string[];
}

export interface PMVariant {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  description: string;
  variation_value_ids?: string[];
  sub_unit_id?: string | null;
  purchase_price?: number | null;
  sub_unit_purchase_price?: number | null;
  image_url?: string | null;
  status: "Active" | "Inactive";
  created_at: string;
  updated_at: string;
  product_code?: string;
  product_name?: string;
  uoms?: PMVariantUom[];
}

export interface PMStandard {
  id: string;
  product_group_id: string;
  code: string;
  name: string;
  description: string;
  status: "Active" | "Inactive";
  created_at: string;
  updated_at: string;
  product_group_name?: string;
  item_count?: number;
  items?: PMStandardItem[];
}

export interface PMStandardItem {
  id: string;
  product_standard_id: string;
  product_variant_id: string;
  is_preferred: boolean;
  effective_from: string | null;
  effective_to: string | null;
  status: "Active" | "Inactive";
  created_at: string;
  updated_at: string;
  sku?: string;
  variant_name?: string;
  product_code?: string;
  product_name?: string;
}

export interface PMBrand {
  id: string;
  code: string;
  name: string;
  description: string;
  status: "Active" | "Inactive";
  created_at: string;
  updated_at: string;
}

export interface PMSubUnit {
  id: string;
  parent_uom_id: string;
  name: string;
  short_name: string;
  conversion_factor: number;
  status: "Active" | "Inactive";
  created_at: string;
  updated_at: string;
}

export interface PMUom {
  id: string;
  code: string;
  name: string;
  type: string;
  decimal_places: number;
  status: "Active" | "Inactive";
  created_at: string;
  updated_at: string;
  sub_units: Partial<PMSubUnit>[];
}

export interface PMVariantUom {
  id: string;
  product_variant_id: string;
  uom_id: string;
  conversion_factor: number;
  is_base: boolean;
  status: "Active" | "Inactive";
  created_at: string;
  updated_at: string;
}

export interface PMVariationTemplateValue {
  id: string;
  variation_template_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PMVariationTemplate {
  id: string;
  name: string;
  status: "Active" | "Inactive";
  value_count: number;
  values: PMVariationTemplateValue[];
  created_at: string;
  updated_at: string;
}

export interface PMRefs {
  categories: PMCategory[];
  productGroups: PMProductGroup[];
  brands: PMBrand[];
  uoms: PMUom[];
  products: PMProduct[];
  variants: PMVariant[];
  standards: PMStandard[];
  variationTemplates: PMVariationTemplate[];
}
