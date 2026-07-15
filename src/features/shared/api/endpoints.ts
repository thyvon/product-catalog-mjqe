import { api } from "./client";

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

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  data?: T[];
}

export interface DebitNote {
  id: string;
  referenceNumber: string;
  warehouse: string;
  department: string;
  campus: string;
  startDate: string;
  endDate: string;
  sendDate: string | null;
  status: string;
  createdBy: string;
  itemCount: number;
  totalAmount: number;
  debitNoteEmail: { receiverName: string; sendToEmail: string } | null;
  createdAt: string;
}

export const stockApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<StockIssueItem>>("/api/stock-issue-items", params),
  get: (id: string) =>
    api.get<StockIssueItem>(`/api/stock-issue-items/${id}`),
  create: (data: Partial<StockIssueItem>) =>
    api.post<{ success: boolean }>("/api/stock-issue-items", data),
  update: (id: string, data: Partial<StockIssueItem>) =>
    api.put<{ success: boolean }>(`/api/stock-issue-items/${id}`, data),
  delete: (id: string) =>
    api.delete<{ success: boolean }>(`/api/stock-issue-items/${id}`),
  bulkDelete: (params: Record<string, string>) =>
    api.delete<{ success: boolean }>(`/api/stock-issue-items/bulk?${new URLSearchParams(params)}`),
};

export const debitNotesApi = {
  list: (params?: Record<string, string>) =>
    api.get<{ data: DebitNote[]; total: number }>("/api/debit-notes", params),
  get: (id: string) =>
    api.get<DebitNote>(`/api/debit-notes/${id}`),
  delete: (id: string) =>
    api.delete<{ success: boolean }>(`/api/debit-notes/${id}`),
};
