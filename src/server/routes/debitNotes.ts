import { Router } from "express";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import ExcelJS from "exceljs";
import { ZipArchive } from "archiver";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getPool, assertDb } from "../db.js";
import { buildDebitNoteSheet } from "../services/excel.js";
import { runSendDebitNotesEmail, emailProgressMap } from "../services/email.js";

const router = Router();

function generateDebitNoteNo(warehouse: string, department: string, campus: string): string {
  const now = new Date();
  const yy = now.getFullYear() % 100;
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const w = warehouse.replace(/[^A-Za-z0-9]/g, "").substring(0, 3).toUpperCase() || "WH";
  const d = department.replace(/[^A-Za-z0-9]/g, "").substring(0, 3).toUpperCase() || "DP";
  const c = campus.replace(/[^A-Za-z0-9]/g, "").substring(0, 5).toUpperCase() || "CMP";
  return `DN${yy}${mm}-${w}-${d}-${c}`;
}

// ─── Email Configs ───

router.get("/api/debit-note/emails", async (_req, res) => {
  try {
    const p = getPool();
    if (!p) return res.json([]);
    const [rows] = await p.query<RowDataPacket[]>("SELECT * FROM debit_note_emails ORDER BY createdAt DESC");
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch email configs." });
  }
});

router.get("/api/debit-note/emails/filters/values", async (_req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const [warehouses] = await p.query<RowDataPacket[]>("SELECT DISTINCT warehouse FROM debit_note_emails WHERE warehouse != '' ORDER BY warehouse");
    const [departments] = await p.query<RowDataPacket[]>("SELECT DISTINCT department FROM debit_note_emails WHERE department != '' ORDER BY department");
    const [campuses] = await p.query<RowDataPacket[]>("SELECT DISTINCT campus FROM debit_note_emails WHERE campus != '' ORDER BY campus");
    res.json({
      warehouses: warehouses.map((r: any) => r.warehouse),
      departments: departments.map((r: any) => r.department),
      campuses: campuses.map((r: any) => r.campus),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch filter values." });
  }
});

router.get("/api/debit-note/emails/:id/edit", async (req, res) => {
  try {
    const p = getPool()!;
    const [rows] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_note_emails WHERE id = ?", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Email config not found." });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to fetch email config." });
  }
});

router.post("/api/debit-note/emails", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { warehouse, department, campus, receiverName, sendToEmail, ccToEmail } = req.body;
    if (!warehouse || !department || !campus || !receiverName) {
      return res.status(400).json({ error: "warehouse, department, campus, and receiverName are required." });
    }
    const sendTo = Array.isArray(sendToEmail) ? sendToEmail : [];
    const ccTo = Array.isArray(ccToEmail) ? ccToEmail : [];
    if (sendTo.length === 0) return res.status(400).json({ error: "At least one send-to email is required." });
    for (const email of sendTo) { if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: `Invalid email: ${email}` }); }
    for (const email of ccTo) { if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: `Invalid CC email: ${email}` }); }

    const now = new Date().toISOString();
    const id = `dne-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await p.execute(
      `INSERT INTO debit_note_emails (id, warehouse, department, campus, receiverName, sendToEmail, ccToEmail, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE receiverName = VALUES(receiverName), sendToEmail = VALUES(sendToEmail), ccToEmail = VALUES(ccToEmail), updatedAt = VALUES(updatedAt)`,
      [id, warehouse, department, campus, receiverName, JSON.stringify(sendTo), JSON.stringify(ccTo), now, now]
    );
    const [created] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_note_emails WHERE id = ?", [id]);
    res.status(201).json(created[0]);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create email config." });
  }
});

router.put("/api/debit-note/emails/:id", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const [existing] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_note_emails WHERE id = ?", [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: "Email config not found." });

    const { warehouse, department, campus, receiverName, sendToEmail, ccToEmail } = req.body;
    const sendTo = Array.isArray(sendToEmail) ? sendToEmail : JSON.parse(existing[0].sendToEmail || "[]");
    const ccTo = Array.isArray(ccToEmail) ? ccToEmail : JSON.parse(existing[0].ccToEmail || "[]");
    if (sendTo.length === 0) return res.status(400).json({ error: "At least one send-to email is required." });

    const now = new Date().toISOString();
    await p.execute(
      `UPDATE debit_note_emails SET warehouse = ?, department = ?, campus = ?, receiverName = ?, sendToEmail = ?, ccToEmail = ?, updatedAt = ? WHERE id = ?`,
      [warehouse ?? existing[0].warehouse, department ?? existing[0].department, campus ?? existing[0].campus,
       receiverName ?? existing[0].receiverName, JSON.stringify(sendTo), JSON.stringify(ccTo), now, req.params.id]
    );
    const [updated] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_note_emails WHERE id = ?", [req.params.id]);
    res.json(updated[0]);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update email config." });
  }
});

router.delete("/api/debit-note/emails/:id", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const [result] = await p.execute<ResultSetHeader>("DELETE FROM debit_note_emails WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Email config not found." });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete email config." });
  }
});

router.post("/api/debit-note/emails/import", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const items: any[] = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Expected a non-empty array of email configs." });
    }

    const now = new Date().toISOString();
    let count = 0;

    for (const item of items) {
      const warehouse = String(item.warehouse || item["Warehouse"] || "").trim();
      const department = String(item.department || item["Department"] || "").trim();
      const campus = String(item.campus || item["Campus"] || "").trim();
      const receiverName = String(item.receiverName || item["Receiver Name"] || item["Receiver Name"] || "").trim();

      if (!warehouse || !department || !campus || !receiverName) continue;

      const rawSendTo = item.sendToEmail || item["Send To Emails"] || item["Send To"] || "";
      const rawCcTo = item.ccToEmail || item["CC Emails"] || item["CC"] || "";

      const splitEmails = (raw: string): string[] =>
        raw.split(/[;,\n]+/).map((e: string) => e.trim()).filter((e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

      const sendTo = splitEmails(rawSendTo);
      const ccTo = splitEmails(rawCcTo);

      if (sendTo.length === 0) continue;

      const id = `dne-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      await p.execute(
        `INSERT INTO debit_note_emails (id, warehouse, department, campus, receiverName, sendToEmail, ccToEmail, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE receiverName = VALUES(receiverName), sendToEmail = VALUES(sendToEmail), ccToEmail = VALUES(ccToEmail), updatedAt = VALUES(updatedAt)`,
        [id, warehouse, department, campus, receiverName, JSON.stringify(sendTo), JSON.stringify(ccTo), now, now]
      );
      count++;
    }

    if (count === 0) {
      return res.status(400).json({ error: "No valid rows found. Each row needs Warehouse, Department, Campus, Receiver Name, and at least one valid email." });
    }

    res.json({ success: true, count });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to import email configs." });
  }
});

// ─── Debit Note Generation ───

router.post("/api/debit-notes/generate", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { startDate, endDate, warehouse, department, campus } = req.body;
    if (!startDate || !endDate) return res.status(400).json({ error: "startDate and endDate are required." });

    let sql = "SELECT * FROM stock_issue_items WHERE transactionDate >= ? AND transactionDate <= ?";
    const params: any[] = [startDate, endDate];
    if (warehouse) { sql += " AND warehouse = ?"; params.push(warehouse); }
    if (department) { sql += " AND department = ?"; params.push(department); }
    if (campus) { sql += " AND campus = ?"; params.push(campus); }
    sql += " ORDER BY warehouse, department, campus, transactionDate";
    const [items] = await p.query<RowDataPacket[]>(sql, params);
    if (items.length === 0) return res.status(422).json({ error: "No stock issue items found for the given filters." });

    const groups = new Map<string, any[]>();
    for (const item of items) {
      const key = `${item.warehouse}||${item.department}||${item.campus}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    const created: any[] = [];
    for (const [key, groupItems] of groups.entries()) {
      const [grpWarehouse, grpDepartment, grpCampus] = key.split("||");
      const [emailConfigs] = await p.execute<RowDataPacket[]>(
        "SELECT * FROM debit_note_emails WHERE warehouse = ? AND department = ? AND campus = ? LIMIT 1",
        [grpWarehouse, grpDepartment, grpCampus]
      );
      if (emailConfigs.length === 0) continue;
      const emailConfig = emailConfigs[0];

      const now = new Date().toISOString();
      const refNo = generateDebitNoteNo(grpWarehouse, grpDepartment, grpCampus);
      const [existingNotes] = await p.execute<RowDataPacket[]>(
        "SELECT * FROM debit_notes WHERE warehouse = ? AND department = ? AND campus = ? AND startDate = ? AND endDate = ? LIMIT 1",
        [grpWarehouse, grpDepartment, grpCampus, startDate, endDate]
      );

      let debitNoteId: string;
      if (existingNotes.length > 0) {
        debitNoteId = existingNotes[0].id;
        await p.execute("UPDATE debit_notes SET referenceNumber = ?, status = 'pending', debitNoteEmailId = ?, updatedAt = ? WHERE id = ?", [refNo, emailConfig.id, now, debitNoteId]);
        await p.execute("DELETE FROM debit_note_items WHERE debitNoteId = ?", [debitNoteId]);
      } else {
        debitNoteId = `dn-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        await p.execute(
          `INSERT INTO debit_notes (id, referenceNumber, warehouse, division, department, campus, startDate, endDate, status, debitNoteEmailId, createdBy, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
          [debitNoteId, refNo, grpWarehouse, groupItems[0]?.division || "", grpDepartment, grpCampus, startDate, endDate, emailConfig.id, req.body.createdBy || "system", now, now]
        );
      }

      for (const item of groupItems) {
        const itemId = `dni-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        await p.execute(
          `INSERT INTO debit_note_items (id, debitNoteId, stockIssueItemId, itemCode, description, quantity, uom, unitPrice, totalPrice, transactionDate, requesterName, campus, division, department, referenceNo, remarks, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [itemId, debitNoteId, item.id, item.itemCode, item.description, item.quantity, item.uom,
           item.unitPrice, item.totalPrice, item.transactionDate, item.requesterName,
           item.campus, item.division || "", item.department, item.referenceNo, item.remarks, now]
        );
      }

      const [noteRows] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_notes WHERE id = ?", [debitNoteId]);
      if (noteRows.length > 0) created.push(noteRows[0]);
    }

    if (created.length === 0) {
      return res.status(422).json({ error: "No debit notes generated. Ensure email configurations exist for the warehouse/department/campus combinations." });
    }
    res.json({ success: true, count: created.length, debitNotes: created });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to generate debit notes." });
  }
});

// ─── Debit Note List & Detail ───

router.get("/api/debit-notes", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { warehouse, department, campus, status, startDate, endDate, search, page, pageSize } = req.query;
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (warehouse) { whereClauses.push("warehouse = ?"); params.push(warehouse); }
    if (department) { whereClauses.push("department = ?"); params.push(department); }
    if (campus) { whereClauses.push("campus = ?"); params.push(campus); }
    if (status) { const s = String(status).split(","); whereClauses.push(`status IN (${s.map(() => "?").join(",")})`); params.push(...s); }
    if (startDate) { whereClauses.push("startDate >= ?"); params.push(startDate); }
    if (endDate) { whereClauses.push("endDate <= ?"); params.push(endDate); }
    if (search) { const q = `%${search}%`; whereClauses.push("(referenceNumber LIKE ? OR warehouse LIKE ? OR department LIKE ? OR campus LIKE ? OR createdBy LIKE ? OR status LIKE ?)"); params.push(q, q, q, q, q, q); }

    const whereSql = whereClauses.length > 0 ? " WHERE " + whereClauses.join(" AND ") : "";
    const [countRows] = await p.query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM debit_notes${whereSql}`, params);
    const total = countRows[0]?.total || 0;

    let rows: RowDataPacket[];
    if (page && pageSize) {
      const offset = (Number(page) - 1) * Number(pageSize);
      [rows] = await p.query<RowDataPacket[]>(`SELECT * FROM debit_notes${whereSql} ORDER BY createdAt DESC LIMIT ? OFFSET ?`, [...params, Number(pageSize), offset]);
    } else {
      [rows] = await p.query<RowDataPacket[]>(`SELECT * FROM debit_notes${whereSql} ORDER BY createdAt DESC`, params);
    }

    const ids = rows.map((r) => r.id);
    const idPlaceholders = ids.length > 0 ? ids.map(() => "?").join(",") : "";
    const itemCountMap = new Map<string, { count: number; totalAmount: number }>();
    if (idPlaceholders) {
      const [itemRows] = await p.query<RowDataPacket[]>(
        `SELECT debitNoteId, COUNT(*) as count, COALESCE(SUM(totalPrice), 0) as totalAmount FROM debit_note_items WHERE debitNoteId IN (${idPlaceholders}) GROUP BY debitNoteId`, ids
      );
      for (const r of itemRows) itemCountMap.set(r.debitNoteId, { count: r.count, totalAmount: r.totalAmount });
    }

    const emailIds = rows.map((r) => r.debitNoteEmailId).filter(Boolean);
    const emailIdPlaceholders = emailIds.length > 0 ? emailIds.map(() => "?").join(",") : "";
    const emailMap = new Map<string, any>();
    if (emailIdPlaceholders) {
      const [emailRows] = await p.query<RowDataPacket[]>(`SELECT * FROM debit_note_emails WHERE id IN (${emailIdPlaceholders})`, emailIds);
      for (const r of emailRows) emailMap.set(r.id, r);
    }

    const result = rows.map((row) => {
      const itemData = itemCountMap.get(row.id) || { count: 0, totalAmount: 0 };
      return { ...row, itemCount: itemData.count, totalAmount: itemData.totalAmount, debitNoteEmail: row.debitNoteEmailId ? emailMap.get(row.debitNoteEmailId) || null : null };
    });
    res.json({ data: result, total });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch debit notes." });
  }
});

router.get("/api/debit-notes/email-progress", (req, res) => {
  const key = `dn_progress_${(req.query.user as string) || "anonymous"}`;
  const progress = emailProgressMap.get(key) || { status: "No sending in progress.", finished: true };
  res.json(progress);
});

router.get("/api/debit-notes/email-progress-debug", (_req, res) => {
  res.json({ mapSize: emailProgressMap.size, entries: Array.from(emailProgressMap.entries()).map(([k, v]) => ({ key: k, ...v })) });
});

router.get("/api/debit-notes/:id", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const [noteRows] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_notes WHERE id = ?", [req.params.id]);
    if (noteRows.length === 0) return res.status(404).json({ error: "Debit note not found." });
    const note = noteRows[0];
    const [items] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_note_items WHERE debitNoteId = ? ORDER BY id ASC", [req.params.id]);
    let emailConfig = null;
    if (note.debitNoteEmailId) {
      const [emailRows] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_note_emails WHERE id = ?", [note.debitNoteEmailId]);
      emailConfig = emailRows[0] || null;
    }
    res.json({ ...note, items, debitNoteEmail: emailConfig });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch debit note." });
  }
});

router.delete("/api/debit-notes/:id", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    await p.execute("DELETE FROM debit_note_items WHERE debitNoteId = ?", [req.params.id]);
    const [result] = await p.execute<ResultSetHeader>("DELETE FROM debit_notes WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Debit note not found." });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete debit note." });
  }
});

// ─── Email Sending ───

router.post("/api/debit-notes/send-emails", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { ids, warehouse, department, campus, startDate, endDate } = req.body;

    let noteIds: string[] = [];
    if (Array.isArray(ids) && ids.length > 0) {
      noteIds = ids;
    } else {
      let sql = "SELECT id FROM debit_notes WHERE status = 'pending'";
      const params: any[] = [];
      if (warehouse) { sql += " AND warehouse = ?"; params.push(warehouse); }
      if (department) { sql += " AND department = ?"; params.push(department); }
      if (campus) { sql += " AND campus = ?"; params.push(campus); }
      if (startDate) { sql += " AND startDate >= ?"; params.push(startDate); }
      if (endDate) { sql += " AND endDate <= ?"; params.push(endDate); }
      const [rows] = await p.query<RowDataPacket[]>(sql, params);
      noteIds = rows.map((r: any) => r.id);
    }

    if (noteIds.length === 0) return res.status(422).json({ error: "No eligible debit notes found to send." });

    const progressKey = `dn_progress_${req.body.user || "anonymous"}`;
    const existing = emailProgressMap.get(progressKey);
    if (existing && !existing.finished) return res.status(409).json({ error: "Email sending is already in progress." });

    emailProgressMap.set(progressKey, { status: "Starting...", finished: false });
    runSendDebitNotesEmail(noteIds, false, progressKey).catch((err) => {
      console.error("Email send error:", err);
      emailProgressMap.set(progressKey, { status: `Error: ${err.message}`, finished: true });
    });
    res.json({ success: true, message: "Email sending started. Track progress via email-progress endpoint." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to send emails." });
  }
});

router.post("/api/debit-notes/:id/resend", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const [noteRows] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_notes WHERE id = ?", [req.params.id]);
    if (noteRows.length === 0) return res.status(404).json({ error: "Debit note not found." });

    const progressKey = `dn_progress_${req.body.user || "anonymous"}`;
    const existing = emailProgressMap.get(progressKey);
    if (existing && !existing.finished) return res.status(409).json({ error: "Email sending is already in progress." });

    emailProgressMap.set(progressKey, { status: "Starting...", finished: false });
    runSendDebitNotesEmail([req.params.id], true, progressKey).catch((err) => {
      console.error("Email resend error:", err);
      emailProgressMap.set(progressKey, { status: `Error: ${err.message}`, finished: true });
    });
    res.json({ success: true, message: "Resending email." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to resend email." });
  }
});

// ─── Excel Export ───

router.get("/api/debit-notes/:id/export", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const [noteRows] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_notes WHERE id = ?", [req.params.id]);
    if (noteRows.length === 0) return res.status(404).json({ error: "Debit note not found." });
    const note = noteRows[0];
    const [items] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_note_items WHERE debitNoteId = ? ORDER BY id ASC", [req.params.id]);
    const workbook = new ExcelJS.Workbook();
    const [userRows] = await p.execute<RowDataPacket[]>("SELECT fullName, position FROM users WHERE username = ?", [note.createdBy]);
    const pb = userRows.length > 0 ? { name: userRows[0].fullName, position: userRows[0].position } : undefined;
    buildDebitNoteSheet(workbook, note, items, pb);
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `DebitNote_${note.referenceNumber}.xlsx`.replace(/[^a-zA-Z0-9_.-]/g, "_");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to export debit note." });
  }
});

router.post("/api/debit-notes/export-bulk", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { ids, warehouse, department, campus, startDate, endDate, status } = req.body;

    let noteIds: string[] = [];
    if (Array.isArray(ids) && ids.length > 0) {
      noteIds = ids;
    } else {
      let sql = "SELECT id FROM debit_notes WHERE 1=1";
      const params: any[] = [];
      if (warehouse) { sql += " AND warehouse = ?"; params.push(warehouse); }
      if (department) { sql += " AND department = ?"; params.push(department); }
      if (campus) { sql += " AND campus = ?"; params.push(campus); }
      if (status) { sql += " AND status = ?"; params.push(status); }
      if (startDate) { sql += " AND startDate >= ?"; params.push(startDate); }
      if (endDate) { sql += " AND endDate <= ?"; params.push(endDate); }
      const [rows] = await p.query<RowDataPacket[]>(sql, params);
      noteIds = rows.map((r: any) => r.id);
    }

    if (noteIds.length === 0) return res.status(422).json({ error: "No debit notes found." });

    const zipFileName = `debit-notes-export-${Date.now()}.zip`;
    const zipPath = path.join(process.cwd(), "temp", zipFileName);
    if (!fs.existsSync(path.join(process.cwd(), "temp"))) fs.mkdirSync(path.join(process.cwd(), "temp"), { recursive: true });

    const output = fs.createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.pipe(output);

    for (const noteId of noteIds) {
      const [noteRows] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_notes WHERE id = ?", [noteId]);
      if (noteRows.length === 0) continue;
      const note = noteRows[0];
      const [items] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_note_items WHERE debitNoteId = ? ORDER BY id ASC", [noteId]);
      const [userRows] = await p.execute<RowDataPacket[]>("SELECT fullName, position FROM users WHERE username = ?", [note.createdBy]);
      const pb = userRows.length > 0 ? { name: userRows[0].fullName, position: userRows[0].position } : undefined;
      const workbook = new ExcelJS.Workbook();
      buildDebitNoteSheet(workbook, note, items, pb);
      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = `DebitNote_${note.referenceNumber}.xlsx`.replace(/[^a-zA-Z0-9_.-]/g, "_");
      archive.append(buffer as Buffer, { name: fileName });
    }

    await archive.finalize();
    await new Promise<void>((resolve) => output.on("close", resolve));
    res.download(zipPath, zipFileName, () => { fs.unlinkSync(zipPath); });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to export debit notes." });
  }
});

router.get("/api/debit-notes/filters/values", async (_req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const [warehouses] = await p.query<RowDataPacket[]>("SELECT DISTINCT warehouse FROM stock_issue_items WHERE warehouse != '' ORDER BY warehouse");
    const [departments] = await p.query<RowDataPacket[]>("SELECT DISTINCT department FROM stock_issue_items WHERE department != '' ORDER BY department");
    const [campuses] = await p.query<RowDataPacket[]>("SELECT DISTINCT campus FROM stock_issue_items WHERE campus != '' ORDER BY campus");
    const [statuses] = await p.query<RowDataPacket[]>("SELECT DISTINCT status FROM debit_notes WHERE status != '' ORDER BY status");
    res.json({
      warehouses: warehouses.map((r: any) => r.warehouse),
      departments: departments.map((r: any) => r.department),
      campuses: campuses.map((r: any) => r.campus),
      statuses: statuses.map((r: any) => r.status),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch filter values." });
  }
});

export default router;
