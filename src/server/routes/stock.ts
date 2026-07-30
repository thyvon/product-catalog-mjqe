import { Router } from "express";
import { getPool, isDbReady, assertDb } from "../db.js";
import crypto from "crypto";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

const router = Router();

router.get("/api/stock-issue-items", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { warehouse, department, campus, transactionType, startDate, endDate, search, page, pageSize } = req.query;
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (warehouse) { whereClauses.push("warehouse = ?"); params.push(warehouse); }
    if (department) { whereClauses.push("department = ?"); params.push(department); }
    if (campus) { whereClauses.push("campus = ?"); params.push(campus); }
    if (transactionType) { whereClauses.push("transactionType = ?"); params.push(transactionType); }
    if (startDate) { whereClauses.push("transactionDate >= ?"); params.push(startDate); }
    if (endDate) { whereClauses.push("transactionDate <= ?"); params.push(endDate); }
    if (search) {
      const q = `%${search}%`;
      whereClauses.push("(itemCode LIKE ? OR description LIKE ? OR requesterName LIKE ? OR referenceNo LIKE ? OR warehouse LIKE ?)");
      params.push(q, q, q, q, q);
    }

    const whereSql = whereClauses.length > 0 ? " WHERE " + whereClauses.join(" AND ") : "";
    const orderSql = " ORDER BY createdAt DESC";

    const [aggRows] = await p.query<RowDataPacket[]>(`SELECT COUNT(*) as total, COALESCE(SUM(quantity),0) as totalQty, COALESCE(SUM(totalPrice),0) as totalAmount FROM stock_issue_items${whereSql}`, params);
    const total = aggRows[0]?.total || 0;
    const totalQty = aggRows[0]?.totalQty || 0;
    const totalAmount = aggRows[0]?.totalAmount || 0;

    let rows: RowDataPacket[];
    if (page && pageSize) {
      const offset = (Number(page) - 1) * Number(pageSize);
      [rows] = await p.query<RowDataPacket[]>(`SELECT * FROM stock_issue_items${whereSql}${orderSql} LIMIT ? OFFSET ?`, [...params, Number(pageSize), offset]);
    } else {
      [rows] = await p.query<RowDataPacket[]>(`SELECT * FROM stock_issue_items${whereSql}${orderSql}`, params);
    }

    res.json({ items: rows, total, totalQty, totalAmount });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch stock issue items." });
  }
});

router.get("/api/stock-issue-items/filters/values", async (_req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const [warehouses] = await p.query<RowDataPacket[]>("SELECT DISTINCT warehouse FROM stock_issue_items WHERE warehouse != '' ORDER BY warehouse");
    const [departments] = await p.query<RowDataPacket[]>("SELECT DISTINCT department FROM stock_issue_items WHERE department != '' ORDER BY department");
    const [campuses] = await p.query<RowDataPacket[]>("SELECT DISTINCT campus FROM stock_issue_items WHERE campus != '' ORDER BY campus");
    const [transactionTypes] = await p.query<RowDataPacket[]>("SELECT DISTINCT transactionType FROM stock_issue_items WHERE transactionType != '' ORDER BY transactionType");
    res.json({
      warehouses: warehouses.map((r: any) => r.warehouse),
      departments: departments.map((r: any) => r.department),
      campuses: campuses.map((r: any) => r.campus),
      transactionTypes: transactionTypes.map((r: any) => r.transactionType),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch filter values." });
  }
});

router.post("/api/stock-issue-items", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const body = req.body;
    await p.execute(
      `INSERT INTO stock_issue_items (id, itemCode, description, quantity, uom, unitPrice, totalPrice, transactionDate, warehouse, division, department, campus, requesterName, referenceNo, transactionType, accountCode, remarks, importedAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, body.itemCode || "", body.description || "", body.quantity || 0, body.uom || "Pcs",
       body.unitPrice || 0, body.totalPrice || 0, body.transactionDate || null,
       body.warehouse || "", body.division || "", body.department || "", body.campus || "",
       body.requesterName || "", body.referenceNo || "", body.transactionType || "", body.accountCode || "",
       body.remarks || "", now, now, now]
    );
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create item." });
  }
});

router.put("/api/stock-issue-items/:id", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const now = new Date().toISOString();
    const body = req.body;
    await p.execute(
      `UPDATE stock_issue_items SET itemCode=?, description=?, quantity=?, uom=?, unitPrice=?, totalPrice=?, transactionDate=?, warehouse=?, division=?, department=?, campus=?, requesterName=?, referenceNo=?, transactionType=?, accountCode=?, remarks=?, updatedAt=? WHERE id=?`,
      [body.itemCode || "", body.description || "", body.quantity || 0, body.uom || "Pcs",
       body.unitPrice || 0, body.totalPrice || 0, body.transactionDate || null,
       body.warehouse || "", body.division || "", body.department || "", body.campus || "",
       body.requesterName || "", body.referenceNo || "", body.transactionType || "", body.accountCode || "",
       body.remarks || "", now, req.params.id]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update item." });
  }
});

router.delete("/api/stock-issue-items/bulk", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { warehouse, department, campus, transactionType, startDate, endDate, search } = req.query as Record<string, string>;
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (warehouse) { whereClauses.push("warehouse = ?"); params.push(warehouse); }
    if (department) { whereClauses.push("department = ?"); params.push(department); }
    if (campus) { whereClauses.push("campus = ?"); params.push(campus); }
    if (transactionType) { whereClauses.push("transactionType = ?"); params.push(transactionType); }
    if (startDate) { whereClauses.push("transactionDate >= ?"); params.push(startDate); }
    if (endDate) { whereClauses.push("transactionDate <= ?"); params.push(endDate); }
    if (search) { whereClauses.push("(itemCode LIKE ? OR description LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }

    if (whereClauses.length === 0) {
      return res.status(400).json({ error: "At least one filter is required for bulk delete." });
    }

    const whereSql = " WHERE " + whereClauses.join(" AND ");
    await p.execute(`DELETE FROM stock_issue_items${whereSql}`, params);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete items." });
  }
});

router.delete("/api/stock-issue-items/:id", async (req, res) => {
  if (req.params.id === "bulk") {
    // handled by /bulk route above
    return res.status(400).json({ error: "Use /bulk endpoint for bulk delete." });
  }
  try {
    assertDb();
    const p = getPool()!;
    const [result] = await p.execute<ResultSetHeader>("DELETE FROM stock_issue_items WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Item not found." });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete item." });
  }
});

router.post("/api/stock-issue-items/import", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const items: any[] = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Body must be a non-empty array." });
    }
    const now = new Date().toISOString();
    const conn = await p.getConnection();
    try {
      await conn.query("START TRANSACTION");
      const BATCH_SIZE = 500;
      let count = 0;
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        const placeholders: string[] = [];
        const params: any[] = [];
        for (const item of batch) {
          placeholders.push("(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
          params.push(
            crypto.randomUUID(), item.itemCode || "", item.description || "", item.quantity || 0, item.uom || "Pcs",
            item.unitPrice || 0, item.totalPrice || 0, item.transactionDate || null,
            item.warehouse || "", item.division || "", item.department || "", item.campus || "",
            item.requesterName || "", item.referenceNo || "", item.transactionType || "", item.accountCode || "",
            item.remarks || "", now, now, now
          );
        }
        await conn.query(
          `INSERT INTO stock_issue_items (id, itemCode, description, quantity, uom, unitPrice, totalPrice, transactionDate, warehouse, division, department, campus, requesterName, referenceNo, transactionType, accountCode, remarks, importedAt, createdAt, updatedAt) VALUES ${placeholders.join(", ")}`,
          params
        );
        count += batch.length;
      }
      await conn.query("COMMIT");
      res.json({ count, success: true });
    } catch (batchErr) {
      try { await conn.query("ROLLBACK"); } catch {}
      throw batchErr;
    } finally {
      try { conn.release(); } catch {}
    }
  } catch (err: any) {
    const msg = err?.sqlMessage || err?.message || String(err) || "Unknown error";
    console.error("[Stock Import]", msg);
    res.status(500).json({ error: msg });
  }
});

export default router;
