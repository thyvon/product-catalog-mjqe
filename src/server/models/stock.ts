import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool, isDbReady } from "../db.js";

export async function getStockItems(
  filters: {
    warehouse?: string; department?: string; campus?: string;
    transactionType?: string; startDate?: string; endDate?: string;
    search?: string; page?: number; pageSize?: number;
  }
): Promise<{ items: any[]; total: number }> {
  const p = getPool();
  if (!p || !isDbReady()) return { items: [], total: 0 };

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (filters.warehouse) { whereClauses.push("warehouse = ?"); params.push(filters.warehouse); }
  if (filters.department) { whereClauses.push("department = ?"); params.push(filters.department); }
  if (filters.campus) { whereClauses.push("campus = ?"); params.push(filters.campus); }
  if (filters.transactionType) { whereClauses.push("transactionType = ?"); params.push(filters.transactionType); }
  if (filters.startDate) { whereClauses.push("transactionDate >= ?"); params.push(filters.startDate); }
  if (filters.endDate) { whereClauses.push("transactionDate <= ?"); params.push(filters.endDate); }
  if (filters.search) {
    const q = `%${filters.search}%`;
    whereClauses.push("(itemCode LIKE ? OR description LIKE ? OR requesterName LIKE ? OR warehouse LIKE ? OR division LIKE ? OR department LIKE ? OR campus LIKE ? OR referenceNo LIKE ? OR accountCode LIKE ? OR remarks LIKE ?)");
    params.push(q, q, q, q, q, q, q, q, q, q);
  }

  const whereSql = whereClauses.length > 0 ? " WHERE " + whereClauses.join(" AND ") : "";
  const orderSql = " ORDER BY transactionDate DESC, createdAt DESC";

  const [countRows] = await p.query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM stock_issue_items${whereSql}`, params);
  const total = (countRows[0] as any).total || 0;

  let rows: RowDataPacket[];
  if (filters.page && filters.pageSize) {
    const offset = (filters.page - 1) * filters.pageSize;
    [rows] = await p.query<RowDataPacket[]>(`SELECT * FROM stock_issue_items${whereSql}${orderSql} LIMIT ? OFFSET ?`, [...params, filters.pageSize, offset]);
  } else {
    [rows] = await p.query<RowDataPacket[]>(`SELECT * FROM stock_issue_items${whereSql}${orderSql}`, params);
  }

  return { items: rows, total };
}
