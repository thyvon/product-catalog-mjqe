import { api } from "@/features/shared/api/client";

export interface StockIssueItem {
  id: string;
  itemCode: string;
  description: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  totalPrice: number;
  transactionDate: string;
  warehouse: string;
  division: string;
  department: string;
  campus: string;
  requesterName: string;
  referenceNo: string;
  transactionType: string;
  accountCode: string;
  remarks: string;
}

export interface StockFilterValues {
  warehouses: string[];
  divisions: string[];
  departments: string[];
  campuses: string[];
  transactionTypes: string[];
}

export interface StockListResponse {
  data: StockIssueItem[];
  total: number;
}

export const stockApi = {
  list: (params: Record<string, string>) =>
    api.get<StockListResponse>("/api/stock-issue-items", params),
  getFilterValues: () =>
    api.get<StockFilterValues>("/api/stock-issue-items/filters/values"),
  remove: (id: string) =>
    api.delete<{ success: boolean }>(`/api/stock-issue-items/${id}`),
  bulkRemove: (ids: string[]) =>
    api.post<{ deleted: number }>("/api/stock-issue-items/bulk", { ids }),
};
