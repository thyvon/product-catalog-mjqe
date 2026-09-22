import { api } from "@/features/shared/api/client";

export interface DebitNote {
  id: string;
  referenceNumber: string;
  warehouse: string;
  department: string;
  campus: string;
  division: string;
  startDate: string;
  endDate: string;
  sendDate: string | null;
  status: string;
  createdBy: string;
  itemCount: number;
  totalAmount: number;
  debitNoteEmail: { receiverName: string; sendToEmail: string[]; ccToEmail: string[] } | null;
  createdAt: string;
}

export interface DebitNoteFilterValues {
  warehouses: string[];
  departments: string[];
  campuses: string[];
  divisions: string[];
  statuses: string[];
}

export interface DebitNoteListResponse {
  data: DebitNote[];
  total: number;
}

export interface DebitNoteEmailConfig {
  id: string;
  warehouse: string;
  department: string;
  campus: string;
  division: string;
  receiverName: string;
  contacts?: { id: string; email: string; name: string; type: string }[];
}

export interface DnContact {
  id: string;
  email: string;
  name: string;
}

export const debitNotesApi = {
  list: (params: Record<string, string>) =>
    api.get<DebitNoteListResponse>("/api/debit-notes", params),
  getFilterValues: () =>
    api.get<DebitNoteFilterValues>("/api/debit-notes/filters/values"),
  remove: (id: string) =>
    api.delete<{ success: boolean }>(`/api/debit-notes/${id}`),
  sendEmails: (ids: string[]) =>
    api.post<{ taskId: string }>("/api/debit-notes/send-emails", { ids }),
  resendEmails: (ids: string[]) =>
    api.post<{ taskId: string }>("/api/debit-notes/resend-emails", { ids }),
  exportExcel: (ids: string[]) =>
    api.post<{ url: string }>("/api/debit-notes/export", { ids }),

  emailConfigs: {
    list: () => api.get<DebitNoteEmailConfig[]>("/api/debit-note/emails"),
    getFilterValues: () =>
      api.get<DebitNoteFilterValues>("/api/debit-note/emails/filters/values"),
    create: (data: Partial<DebitNoteEmailConfig>) =>
      api.post<DebitNoteEmailConfig>("/api/debit-note/emails", data),
    update: (id: string, data: Partial<DebitNoteEmailConfig>) =>
      api.put<DebitNoteEmailConfig>(`/api/debit-note/emails/${id}`, data),
    remove: (id: string) =>
      api.delete<{ success: boolean }>(`/api/debit-note/emails/${id}`),
    bulkRemove: (ids: string[]) =>
      api.post<{ deleted: number }>("/api/debit-note/emails/bulk", { ids }),
  },

  contacts: {
    list: (params?: Record<string, string>) =>
      api.get<DnContact[]>("/api/dn-contacts", params),
    create: (data: { email: string; name: string }) =>
      api.post<DnContact>("/api/dn-contacts", data),
    update: (id: string, data: { email: string; name: string }) =>
      api.put<DnContact>(`/api/dn-contacts/${id}`, data),
    remove: (id: string) =>
      api.delete<{ success: boolean }>(`/api/dn-contacts/${id}`),
  },
};
