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
  status: "Active" | "Inactive" | "Discontinued"; // Status
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
  discontinuedCount: number;
  categoryStats: CategoryStats[];
}

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

