import { api } from "@/features/shared/api/client";
import type { Product, Supplier } from "@/features/shared/types";

export interface ProductStats {
  totalProducts: number;
  activeProducts: number;
  categories: number;
  lowStock: number;
}

export interface ProductListResponse {
  data: Product[];
  total: number;
  categories: string[];
  allUoms: string[];
}

export interface SupplierFilterValues {
  statuses: string[];
  registrationTypes: string[];
  paymentMethods: string[];
  countries: string[];
}

export const productsApi = {
  list: (params: Record<string, string>) =>
    api.get<ProductListResponse>("/api/products", params),
  get: (id: string) =>
    api.get<Product>(`/api/products/${id}`),
  create: (data: Partial<Product>) =>
    api.post<Product>("/api/products", data),
  update: (id: string, data: Partial<Product>) =>
    api.put<Product>(`/api/products/${id}`, data),
  remove: (id: string) =>
    api.delete<{ success: boolean }>(`/api/products/${id}`),
  getStats: () =>
    api.get<ProductStats>("/api/products/stats"),
};

export const suppliersApi = {
  list: (params?: Record<string, string>) =>
    api.get<Supplier[]>("/api/suppliers", params),
  getFilterValues: () =>
    api.get<SupplierFilterValues>("/api/suppliers/filters/values"),
  create: (data: Partial<Supplier>) =>
    api.post<Supplier>("/api/suppliers", data),
  update: (id: string, data: Partial<Supplier>) =>
    api.put<Supplier>(`/api/suppliers/${id}`, data),
  remove: (id: string) =>
    api.delete<{ success: boolean }>(`/api/suppliers/${id}`),
};
