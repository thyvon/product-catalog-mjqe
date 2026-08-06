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
    const [divisions] = await p.query<RowDataPacket[]>("SELECT DISTINCT division FROM stock_issue_items WHERE division != '' ORDER BY division");
    const [transactionTypes] = await p.query<RowDataPacket[]>("SELECT DISTINCT transactionType FROM stock_issue_items WHERE transactionType != '' ORDER BY transactionType");
    res.json({
      warehouses: warehouses.map((r: any) => r.warehouse),
      departments: departments.map((r: any) => r.department),
      campuses: campuses.map((r: any) => r.campus),
      divisions: divisions.map((r: any) => r.division),
      transactionTypes: transactionTypes.map((r: any) => r.transactionType),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch filter values." });
  }
});

router.get("/api/stock-issue-items/analytics", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { startDate, endDate, warehouse, division, department, campus, transactionType } = req.query as Record<string, string | undefined>;
    const top = Math.max(1, Math.min(100, Number(req.query.top) || 10));

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required." });
    }
    if (String(startDate) > String(endDate)) {
      return res.status(400).json({ error: "startDate cannot be after endDate." });
    }

    const whereClauses: string[] = ["transactionDate >= ?", "transactionDate <= ?"];
    const params: any[] = [startDate, endDate];
    if (warehouse) { whereClauses.push("warehouse = ?"); params.push(warehouse); }
    if (division) { whereClauses.push("division = ?"); params.push(division); }
    if (department) { whereClauses.push("department = ?"); params.push(department); }
    if (campus) { whereClauses.push("campus = ?"); params.push(campus); }
    if (transactionType) { whereClauses.push("transactionType = ?"); params.push(transactionType); }

    const whereSql = " WHERE " + whereClauses.join(" AND ");

    const [summaryRows] = await p.query<RowDataPacket[]>(
      `SELECT COUNT(*) as totalItems, COALESCE(SUM(quantity),0) as totalQuantity, COALESCE(SUM(totalPrice),0) as totalAmount FROM stock_issue_items${whereSql}`,
      params
    );

    const [trendRows] = await p.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(transactionDate, '%Y-%m') as month, COUNT(*) as \`count\`, COALESCE(SUM(quantity),0) as quantity, COALESCE(SUM(totalPrice),0) as amount
       FROM stock_issue_items${whereSql} GROUP BY month ORDER BY month ASC`,
      params
    );
    const trend = trendRows.map((r: any) => ({ month: r.month, count: r.count, quantity: r.quantity, amount: r.amount }));

    const dayMs = 86400000;
    const daysDiff = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / dayMs) + 1);
    const prevEnd = new Date(new Date(startDate).getTime() - dayMs);
    const prevStart = new Date(new Date(startDate).getTime() - daysDiff * dayMs);
    const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const prevStartStr = fmtDate(prevStart);
    const prevEndStr = fmtDate(prevEnd);
    const prevWhereClauses: string[] = ["transactionDate >= ?", "transactionDate <= ?"];
    const prevParams: any[] = [prevStartStr, prevEndStr];
    if (warehouse) { prevWhereClauses.push("warehouse = ?"); prevParams.push(warehouse); }
    if (division) { prevWhereClauses.push("division = ?"); prevParams.push(division); }
    if (department) { prevWhereClauses.push("department = ?"); prevParams.push(department); }
    if (campus) { prevWhereClauses.push("campus = ?"); prevParams.push(campus); }
    if (transactionType) { prevWhereClauses.push("transactionType = ?"); prevParams.push(transactionType); }
    const [prevSummaryRows] = await p.query<RowDataPacket[]>(
      `SELECT COUNT(*) as totalItems, COALESCE(SUM(quantity),0) as totalQuantity, COALESCE(SUM(totalPrice),0) as totalAmount
       FROM stock_issue_items WHERE ${prevWhereClauses.join(" AND ")}`,
      prevParams
    );
    const previousSummary = { ...prevSummaryRows[0], startDate: prevStartStr, endDate: prevEndStr };

    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const [curYoYRows] = await p.query<RowDataPacket[]>(
      `SELECT YEAR(transactionDate) as yr, MONTH(transactionDate) as mo, COALESCE(SUM(totalPrice),0) as amount
       FROM stock_issue_items${whereSql} GROUP BY yr, mo ORDER BY yr, mo`,
      params
    );
    const curStartD = new Date(startDate);
    const curEndD = new Date(endDate);
    const prevStartD = new Date(curStartD);
    prevStartD.setFullYear(curStartD.getFullYear() - 1);
    const prevEndD = new Date(curEndD);
    prevEndD.setFullYear(curEndD.getFullYear() - 1);
    const prevYoStartStr = fmtDate(prevStartD);
    const prevYoEndStr = fmtDate(prevEndD);
    const prevYoWhereClauses: string[] = ["transactionDate >= ?", "transactionDate <= ?"];
    const prevYoParams: any[] = [prevYoStartStr, prevYoEndStr];
    if (warehouse) { prevYoWhereClauses.push("warehouse = ?"); prevYoParams.push(warehouse); }
    if (division) { prevYoWhereClauses.push("division = ?"); prevYoParams.push(division); }
    if (department) { prevYoWhereClauses.push("department = ?"); prevYoParams.push(department); }
    if (campus) { prevYoWhereClauses.push("campus = ?"); prevYoParams.push(campus); }
    if (transactionType) { prevYoWhereClauses.push("transactionType = ?"); prevYoParams.push(transactionType); }
    const [prevYoYRows] = await p.query<RowDataPacket[]>(
      `SELECT YEAR(transactionDate) as yr, MONTH(transactionDate) as mo, COALESCE(SUM(totalPrice),0) as amount
       FROM stock_issue_items WHERE ${prevYoWhereClauses.join(" AND ")} GROUP BY yr, mo ORDER BY yr, mo`,
      prevYoParams
    );
    const prevYoYMap = new Map<string, number>();
    prevYoYRows.forEach((r: any) => { prevYoYMap.set(`${r.yr}-${r.mo}`, r.amount); });
    const yoyCompare = curYoYRows.map((r: any) => {
      const prevKey = `${r.yr - 1}-${r.mo}`;
      const previous = prevYoYMap.get(prevKey) || 0;
      return {
        label: `${MONTH_NAMES[r.mo - 1]} ${r.yr}`,
        current: r.amount,
        previous,
        gap: r.amount - previous,
      };
    });

    const dims = ["campus", "department", "division", "warehouse"] as const;
    const agg: Record<string, any[]> = {};
    for (const dim of dims) {
      const [rows] = await p.query<RowDataPacket[]>(
        `SELECT ${dim} as \`key\`, COUNT(*) as \`count\`, COALESCE(SUM(quantity),0) as quantity, COALESCE(SUM(totalPrice),0) as amount
         FROM stock_issue_items${whereSql} GROUP BY ${dim} ORDER BY amount DESC`,
        params
      );
      agg[dim] = rows.map((r: any) => ({ key: r.key || "(Unknown)", count: r.count, quantity: r.quantity, amount: r.amount }));
    }

    const [byRequesterRows] = await p.query<RowDataPacket[]>(
      `SELECT requesterName as \`key\`, COUNT(*) as \`count\`, COALESCE(SUM(quantity),0) as quantity, COALESCE(SUM(totalPrice),0) as amount
       FROM stock_issue_items${whereSql} GROUP BY requesterName ORDER BY amount DESC`,
      params
    );
    const byRequester = byRequesterRows.map((r: any) => ({ key: r.key || "(Unknown)", count: r.count, quantity: r.quantity, amount: r.amount }));

    const [byTypeRows] = await p.query<RowDataPacket[]>(
      `SELECT transactionType as \`key\`, COUNT(*) as \`count\`, COALESCE(SUM(quantity),0) as quantity, COALESCE(SUM(totalPrice),0) as amount
       FROM stock_issue_items${whereSql} GROUP BY transactionType ORDER BY amount DESC`,
      params
    );
    const byType = byTypeRows.map((r: any) => ({ key: r.key || "(Unknown)", count: r.count, quantity: r.quantity, amount: r.amount }));

    const topGroupBy = " FROM stock_issue_items" + whereSql + " GROUP BY itemCode, description, uom ";
    const [topCountRows] = await p.query<RowDataPacket[]>(
      `SELECT itemCode, MAX(description) as description, MAX(uom) as uom, COUNT(*) as \`count\`, COALESCE(SUM(quantity),0) as quantity, COALESCE(SUM(totalPrice),0) as amount
       ${topGroupBy}ORDER BY \`count\` DESC, amount DESC LIMIT ?`,
      [...params, top]
    );
    const [topAmountRows] = await p.query<RowDataPacket[]>(
      `SELECT itemCode, MAX(description) as description, MAX(uom) as uom, COUNT(*) as \`count\`, COALESCE(SUM(quantity),0) as quantity, COALESCE(SUM(totalPrice),0) as amount
       ${topGroupBy}ORDER BY amount DESC, \`count\` DESC LIMIT ?`,
      [...params, top]
    );

    res.json({
      summary: summaryRows[0],
      previousSummary,
      trend,
      yoyCompare,
      byCampus: agg.campus,
      byDepartment: agg.department,
      byDivision: agg.division,
      byWarehouse: agg.warehouse,
      byRequester,
      byType,
      topByCount: topCountRows,
      topByAmount: topAmountRows,
    });
  } catch (err: any) {
    console.error("Error computing stock issue analytics:", err);
    res.status(500).json({ error: "Failed to compute stock issue analytics." });
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
