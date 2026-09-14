export interface CompanyItem {
  id: number;
  ItemCode: string;
  Description: string;
  LongDescription: string;
  BaseItemUnit: string;
  category: string;
  sub_category: string | null;
  is_manage_price: number;
  estimate_price: number;
  avg_price_3_months: number;
  remark: string;
  Status: string;
  image: string;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
  updated_by_name: string | null;
  show_updated_at: string;
  show_created_at: string;
}

export interface CompanyItemsResponse {
  recordsTotal: number;
  recordsFiltered: number;
  data: CompanyItem[];
}
