import { api } from "@/features/shared/api/client";

export interface CompanyItem {
  item_code: string;
  item_name: string;
  uom: string;
  category: string;
}

export interface CompanyItemsResponse {
  data: CompanyItem[];
  total: number;
}

export const companyProductsApi = {
  list: (params: Record<string, string>) =>
    api.get<CompanyItemsResponse>("/api/company/items", params),
  getLinkedCodes: () =>
    api.get<string[]>("/api/company/item-codes"),
};
