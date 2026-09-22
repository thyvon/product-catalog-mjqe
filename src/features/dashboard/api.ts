import { api } from "@/features/shared/api/client";

export interface ProductStats {
  totalProducts: number;
  activeProducts: number;
  categories: number;
  lowStock: number;
}

export interface VisitStats {
  liveVisitors: number;
  totalVisits: number;
  paths: { path: string; count: number }[];
  recent: { path: string; time: number }[];
  timeline: { time: string; visits: number; visitors: number }[];
}

export const dashboardApi = {
  getProductStats: () => api.get<ProductStats>("/api/products/stats"),
  getVisitStats: () => api.get<VisitStats>("/api/visit/stats"),
};
