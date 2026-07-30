import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool, isDbReady } from "../db.js";

export async function getDebitNotes(
  filters: {
    warehouse?: string; department?: string; campus?: string;
    status?: string; startDate?: string; endDate?: string;
    search?: string; page?: number; pageSize?: number;
  }
): Promise<{ rows: RowDataPacket[]; total: number }> {
  const p = getPool();
  if (!p || !isDbReady()) return { rows: [], total: 0 };

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (filters.warehouse) { whereClauses.push("warehouse = ?"); params.push(filters.warehouse); }
  if (filters.department) { whereClauses.push("department = ?"); params.push(filters.department); }
  if (filters.campus) { whereClauses.push("campus = ?"); params.push(filters.campus); }
  if (filters.status) {
    const statuses = filters.status.split(",");
    whereClauses.push(`status IN (${statuses.map(() => "?").join(",")})`);
    params.push(...statuses);
  }
  if (filters.startDate) { whereClauses.push("startDate >= ?"); params.push(filters.startDate); }
  if (filters.endDate) { whereClauses.push("endDate <= ?"); params.push(filters.endDate); }
  if (filters.search) {
    const q = `%${filters.search}%`;
    whereClauses.push("(referenceNumber LIKE ? OR warehouse LIKE ? OR department LIKE ? OR campus LIKE ? OR createdBy LIKE ? OR status LIKE ?)");
    params.push(q, q, q, q, q, q);
  }

  const whereSql = whereClauses.length > 0 ? " WHERE " + whereClauses.join(" AND ") : "";
  const orderSql = " ORDER BY createdAt DESC";

  const [countRows] = await p.query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM debit_notes${whereSql}`, params);
  const total = countRows[0]?.total || 0;

  let rows: RowDataPacket[];
  if (filters.page && filters.pageSize) {
    const offset = (filters.page - 1) * filters.pageSize;
    [rows] = await p.query<RowDataPacket[]>(`SELECT * FROM debit_notes${whereSql}${orderSql} LIMIT ? OFFSET ?`, [...params, filters.pageSize, offset]);
  } else {
    [rows] = await p.query<RowDataPacket[]>(`SELECT * FROM debit_notes${whereSql}${orderSql}`, params);
  }

  return { rows, total };
}
