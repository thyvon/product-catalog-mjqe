import { Router } from "express";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import ExcelJS from "exceljs";
import { ZipArchive } from "archiver";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getPool, assertDb } from "../db.js";
import { buildDebitNoteSheet } from "../services/excel.js";
import { runSendDebitNotesEmail, emailProgressMap } from "../services/email.js";

const router = Router();

function dateOnlyStr(v: any): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : String(v);
}

async function generateDebitNoteNo(p: Pool, division: string, department: string, campus: string, startDate: string, excludeId?: string): Promise<string> {
  const v = division.replace(/[^A-Za-z0-9]/g, "");
  const d = department.replace(/[^A-Za-z0-9]/g, "") || "DP";
  const c = campus.replace(/[^A-Za-z0-9]/g, "") || "CMP";
  const mm = String(startDate || "").slice(5, 7) || "00";
  const yy = String(startDate || "").slice(2, 4) || "00";
  const base = v ? `${v}-${d}-${c}-${mm}${yy}` : `${d}-${c}-${mm}${yy}`;
  const [rows] = await p.query<RowDataPacket[]>(
    `SELECT id, referenceNumber FROM debit_notes WHERE referenceNumber = ? OR referenceNumber LIKE ?`,
    [base, `${base}-%`]
  );
  let maxSuffix = 0;
  for (const row of rows) {
    if (excludeId && row.id === excludeId) continue;
    if (row.referenceNumber === base) { maxSuffix = Math.max(maxSuffix, 1); continue; }
    const suffix = parseInt(String(row.referenceNumber).slice(base.length + 1), 10);
    if (!isNaN(suffix)) maxSuffix = Math.max(maxSuffix, suffix);
  }
  return maxSuffix === 0 ? base : `${base}-${maxSuffix + 1}`;
}

// ─── Contacts (shared across email configs) ───

router.get("/api/dn-contacts", async (req, res) => {
  try {
    const p = getPool();
    if (!p) return res.json([]);
    const q = (req.query.q as string || "").trim();
    let rows;
    if (q) {
      [rows] = await p.execute<RowDataPacket[]>(
        `SELECT c.id, c.email, c.name, c.createdAt,
          (SELECT COUNT(*) FROM dn_email_config_contacts ecc WHERE ecc.contact_id = c.id) AS configCount
         FROM dn_contacts c WHERE c.email LIKE ? OR c.name LIKE ? ORDER BY c.email LIMIT 100`,
        [`%${q}%`, `%${q}%`]
      );
    } else {
      [rows] = await p.execute<RowDataPacket[]>(
        `SELECT c.id, c.email, c.name, c.createdAt,
          (SELECT COUNT(*) FROM dn_email_config_contacts ecc WHERE ecc.contact_id = c.id) AS configCount
         FROM dn_contacts c ORDER BY c.email`
      );
    }
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch contacts." });
  }
});

router.post("/api/dn-contacts", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { email, name } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Valid email is required." });
    }
    const now = new Date().toISOString();
    const id = `dc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await p.execute(
      "INSERT INTO dn_contacts (id, email, name, createdAt) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)",
      [id, email.trim(), (name || "").trim(), now]
    );
    const [existing] = await p.execute<RowDataPacket[]>("SELECT id FROM dn_contacts WHERE email = ?", [email.trim()]);
    res.status(201).json(existing[0] || { id, email: email.trim(), name: name || "" });
  } catch {
    res.status(500).json({ error: "Failed to create contact." });
  }
});

router.put("/api/dn-contacts/:id", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { name } = req.body;
    await p.execute("UPDATE dn_contacts SET name = ? WHERE id = ?", [name || "", req.params.id]);
    const [rows] = await p.execute<RowDataPacket[]>("SELECT id, email, name FROM dn_contacts WHERE id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Contact not found." });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to update contact." });
  }
});

router.delete("/api/dn-contacts/:id", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    await p.execute("DELETE FROM dn_email_config_contacts WHERE contact_id = ?", [req.params.id]);
    const [result] = await p.execute<ResultSetHeader>("DELETE FROM dn_contacts WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Contact not found." });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete contact." });
  }
});

// ─── Email Configs ───

router.get("/api/debit-note/emails", async (_req, res) => {
  try {
    const p = getPool();
    if (!p) return res.json([]);
    const [rows] = await p.query<RowDataPacket[]>(
      `SELECT e.*,
        (SELECT GROUP_CONCAT(c.email ORDER BY c.email) FROM dn_email_config_contacts ecc JOIN dn_contacts c ON c.id = ecc.contact_id WHERE ecc.email_config_id = e.id AND ecc.type = 'send_to') AS sendToEmail,
        (SELECT GROUP_CONCAT(c.email ORDER BY c.email) FROM dn_email_config_contacts ecc JOIN dn_contacts c ON c.id = ecc.contact_id WHERE ecc.email_config_id = e.id AND ecc.type = 'cc') AS ccToEmail
       FROM debit_note_emails e ORDER BY e.createdAt DESC`
    );
    for (const row of rows) {
      row.sendToEmail = row.sendToEmail ? row.sendToEmail.split(",") : [];
      row.ccToEmail = row.ccToEmail ? row.ccToEmail.split(",") : [];
    }
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
    const [recipients] = await p.execute<RowDataPacket[]>(
      `SELECT c.id, c.email, c.name, ecc.type FROM dn_email_config_contacts ecc
       JOIN dn_contacts c ON c.id = ecc.contact_id WHERE ecc.email_config_id = ?`, [req.params.id]
    );
    const cfg = rows[0];
    cfg.sendToEmail = recipients.filter((r: any) => r.type === "send_to").map((r: any) => ({ id: r.id, email: r.email, name: r.name }));
    cfg.ccToEmail = recipients.filter((r: any) => r.type === "cc").map((r: any) => ({ id: r.id, email: r.email, name: r.name }));
    res.json(cfg);
  } catch {
    res.status(500).json({ error: "Failed to fetch email config." });
  }
});

router.post("/api/debit-note/emails", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { warehouse, department, campus, division, receiverName, sendToEmail, ccToEmail } = req.body;
    if (!warehouse || !department || !campus || !receiverName) {
      return res.status(400).json({ error: "warehouse, department, campus, and receiverName are required." });
    }
    const sendTo = Array.isArray(sendToEmail) ? sendToEmail : [];
    const ccTo = Array.isArray(ccToEmail) ? ccToEmail : [];
    if (sendTo.length === 0) return res.status(400).json({ error: "At least one send-to email is required." });

    const now = new Date().toISOString();
    const id = `dne-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await p.execute(
      `INSERT INTO debit_note_emails (id, warehouse, department, campus, division, receiverName, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE division = VALUES(division), receiverName = VALUES(receiverName), updatedAt = VALUES(updatedAt)`,
      [id, warehouse, department, campus, division ?? "", receiverName, now, now]
    );

    const [existing] = await p.execute<RowDataPacket[]>(
      "SELECT id FROM debit_note_emails WHERE warehouse = ? AND division = ? AND department = ? AND campus = ?",
      [warehouse, division ?? "", department, campus]
    );
    const realId = existing[0]?.id || id;

    // Upsert contacts and link
    await p.execute("DELETE FROM dn_email_config_contacts WHERE email_config_id = ?", [realId]);
    const upsertContact = async (item: any) => {
      const email = (item.email || item).trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
      const name = item.name || "";
      let contactId = item.id;
      if (!contactId) {
        const [found] = await p.execute<RowDataPacket[]>("SELECT id FROM dn_contacts WHERE email = ?", [email]);
        if (found.length > 0) { contactId = found[0].id; }
        else {
          contactId = `dc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          await p.execute("INSERT INTO dn_contacts (id, email, name, createdAt) VALUES (?, ?, ?, ?)",
            [contactId, email, name, now]);
        }
      }
      return contactId;
    };

    for (const item of sendTo) {
      const cid = await upsertContact(item);
      if (cid) await p.execute("INSERT IGNORE INTO dn_email_config_contacts (email_config_id, contact_id, type) VALUES (?, ?, 'send_to')", [realId, cid]);
    }
    for (const item of ccTo) {
      const cid = await upsertContact(item);
      if (cid) await p.execute("INSERT IGNORE INTO dn_email_config_contacts (email_config_id, contact_id, type) VALUES (?, ?, 'cc')", [realId, cid]);
    }

    const [created] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_note_emails WHERE id = ?", [realId]);
    const [recipients] = await p.execute<RowDataPacket[]>(
      `SELECT c.id, c.email, c.name, ecc.type FROM dn_email_config_contacts ecc
       JOIN dn_contacts c ON c.id = ecc.contact_id WHERE ecc.email_config_id = ?`, [realId]
    );
    created[0].sendToEmail = recipients.filter((r: any) => r.type === "send_to").map((r: any) => ({ id: r.id, email: r.email, name: r.name }));
    created[0].ccToEmail = recipients.filter((r: any) => r.type === "cc").map((r: any) => ({ id: r.id, email: r.email, name: r.name }));
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

    const { warehouse, department, campus, division, receiverName, sendToEmail, ccToEmail } = req.body;
    const sendTo = Array.isArray(sendToEmail) ? sendToEmail : null;
    const ccTo = Array.isArray(ccToEmail) ? ccToEmail : null;

    const now = new Date().toISOString();
    await p.execute(
      `UPDATE debit_note_emails SET warehouse = ?, department = ?, campus = ?, division = ?, receiverName = ?, updatedAt = ? WHERE id = ?`,
      [warehouse ?? existing[0].warehouse, department ?? existing[0].department, campus ?? existing[0].campus,
       division ?? existing[0].division, receiverName ?? existing[0].receiverName, now, req.params.id]
    );

    if (sendTo !== null || ccTo !== null) {
      await p.execute("DELETE FROM dn_email_config_contacts WHERE email_config_id = ?", [req.params.id]);
      const upsertContact = async (item: any) => {
        const email = (item.email || item).trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
        const name = item.name || "";
        let contactId = item.id;
        if (!contactId) {
          const [found] = await p.execute<RowDataPacket[]>("SELECT id FROM dn_contacts WHERE email = ?", [email]);
          if (found.length > 0) { contactId = found[0].id; }
          else {
            contactId = `dc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            await p.execute("INSERT INTO dn_contacts (id, email, name, createdAt) VALUES (?, ?, ?, ?)",
              [contactId, email, name, now]);
          }
        }
        return contactId;
      };

      if (sendTo) {
        for (const item of sendTo) {
          const cid = await upsertContact(item);
          if (cid) await p.execute("INSERT IGNORE INTO dn_email_config_contacts (email_config_id, contact_id, type) VALUES (?, ?, 'send_to')", [req.params.id, cid]);
        }
      }
      if (ccTo) {
        for (const item of ccTo) {
          const cid = await upsertContact(item);
          if (cid) await p.execute("INSERT IGNORE INTO dn_email_config_contacts (email_config_id, contact_id, type) VALUES (?, ?, 'cc')", [req.params.id, cid]);
        }
      }
    }

    const [updated] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_note_emails WHERE id = ?", [req.params.id]);
    const [recipients] = await p.execute<RowDataPacket[]>(
      `SELECT c.id, c.email, c.name, ecc.type FROM dn_email_config_contacts ecc
       JOIN dn_contacts c ON c.id = ecc.contact_id WHERE ecc.email_config_id = ?`, [req.params.id]
    );
    updated[0].sendToEmail = recipients.filter((r: any) => r.type === "send_to").map((r: any) => ({ id: r.id, email: r.email, name: r.name }));
    updated[0].ccToEmail = recipients.filter((r: any) => r.type === "cc").map((r: any) => ({ id: r.id, email: r.email, name: r.name }));
    res.json(updated[0]);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update email config." });
  }
});

router.post("/api/debit-note/emails/bulk-delete", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const body: { ids?: string[] } = req.body || {};
    const ids = Array.isArray(body.ids) ? body.ids.map((id) => String(id).trim()).filter(Boolean) : [];
    if (ids.length === 0) return res.status(400).json({ error: "No email configs selected to delete." });
    if (ids.length > 10000) return res.status(400).json({ error: "Too many configs to delete at once." });
    const placeholders = ids.map(() => "?").join(",");
    await p.execute(`DELETE FROM dn_email_config_contacts WHERE email_config_id IN (${placeholders})`, ids);
    const [result] = await p.execute<ResultSetHeader>(`DELETE FROM debit_note_emails WHERE id IN (${placeholders})`, ids);
    res.json({ success: true, count: result.affectedRows });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to bulk delete email configs." });
  }
});

router.delete("/api/debit-note/emails/:id", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    await p.execute("DELETE FROM dn_email_config_contacts WHERE email_config_id = ?", [req.params.id]);
    const [result] = await p.execute<ResultSetHeader>("DELETE FROM debit_note_emails WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Email config not found." });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete email config." });
  }
});

router.post("/api/debit-note/emails/import", async (req, res) => {
  const p = getPool()!;
  let conn: import("mysql2/promise").PoolConnection | null = null;
  try {
    assertDb();
    const items: any[] = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Expected a non-empty array of email configs." });
    }

    const now = new Date().toISOString();
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const splitEmails = (raw: string): string[] =>
      raw.split(/[;,\n]+/).map((e: string) => e.trim()).filter(Boolean);

    const validationErrors: string[] = [];
    const prepared: { warehouse: string; department: string; campus: string; division: string; receiverName: string; sendTo: string[]; ccTo: string[] }[] = [];

    items.forEach((item, index) => {
      const rowNo = index + 2;
      const rowErrors: string[] = [];
      const warehouse = String(item.warehouse || item["Warehouse"] || "").trim();
      const department = String(item.department || item["Department"] || "").trim();
      const campus = String(item.campus || item["Campus"] || "").trim();
      const division = String(item.division || item["Division"] || "").trim();
      const receiverName = String(item.receiverName || item["Receiver Name"] || item["Receiver"] || "").trim();
      if (!warehouse) rowErrors.push("Warehouse");
      if (!department) rowErrors.push("Department");
      if (!campus) rowErrors.push("Campus");
      if (!receiverName) rowErrors.push("Receiver Name");
      const rawSendTo = item.sendToEmail || item["Send To Emails"] || item["Send To"] || "";
      const rawCcTo = item.ccToEmail || item["CC Emails"] || item["CC"] || "";
      const sendTo = splitEmails(rawSendTo).filter((e: string) => EMAIL_RE.test(e));
      const ccTo = splitEmails(rawCcTo).filter((e: string) => EMAIL_RE.test(e));
      if (sendTo.length === 0) rowErrors.push("at least one valid 'Send To Email'");
      if (rowErrors.length > 0) validationErrors.push(`Row ${rowNo}: ${rowErrors.join(", ")}`);
      else prepared.push({ warehouse, department, campus, division, receiverName, sendTo, ccTo });
    });

    if (validationErrors.length > 0) {
      const shown = validationErrors.slice(0, 10).join(" | ");
      const more = validationErrors.length > 10 ? ` | and ${validationErrors.length - 10} more row(s)` : "";
      return res.status(400).json({ error: `Import cancelled: ${validationErrors.length} row(s) failed validation. ${shown}${more}` });
    }

    conn = await p.getConnection();
    await conn.beginTransaction();

    let count = 0;
    for (const cfg of prepared) {
      const id = `dne-${crypto.randomUUID()}`;
      await conn.execute(
        `INSERT INTO debit_note_emails (id, warehouse, department, campus, division, receiverName, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE division = VALUES(division), receiverName = VALUES(receiverName), updatedAt = VALUES(updatedAt)`,
        [id, cfg.warehouse, cfg.department, cfg.campus, cfg.division, cfg.receiverName, now, now]
      );
      const [existing] = await conn.execute<RowDataPacket[]>(
        "SELECT id FROM debit_note_emails WHERE warehouse = ? AND division = ? AND department = ? AND campus = ?",
        [cfg.warehouse, cfg.division, cfg.department, cfg.campus]
      );
      const realId = existing[0]?.id || id;

      await conn.execute("DELETE FROM dn_email_config_contacts WHERE email_config_id = ?", [realId]);
      for (const email of cfg.sendTo) {
        const [found] = await conn.execute<RowDataPacket[]>("SELECT id FROM dn_contacts WHERE email = ?", [email]);
        let cid = found[0]?.id;
        if (!cid) {
          cid = `dc-${crypto.randomUUID()}`;
          await conn.execute("INSERT INTO dn_contacts (id, email, name, createdAt) VALUES (?, ?, '', ?)", [cid, email, now]);
        }
        await conn.execute("INSERT IGNORE INTO dn_email_config_contacts (email_config_id, contact_id, type) VALUES (?, ?, 'send_to')", [realId, cid]);
      }
      for (const email of cfg.ccTo) {
        const [found] = await conn.execute<RowDataPacket[]>("SELECT id FROM dn_contacts WHERE email = ?", [email]);
        let cid = found[0]?.id;
        if (!cid) {
          cid = `dc-${crypto.randomUUID()}`;
          await conn.execute("INSERT INTO dn_contacts (id, email, name, createdAt) VALUES (?, ?, '', ?)", [cid, email, now]);
        }
        await conn.execute("INSERT IGNORE INTO dn_email_config_contacts (email_config_id, contact_id, type) VALUES (?, ?, 'cc')", [realId, cid]);
      }
      count++;
    }

    await conn.commit();
    res.json({ success: true, count });
  } catch (err: any) {
    if (conn) { try { await conn.rollback(); } catch {} }
    res.status(500).json({ error: err?.message || "Failed to import email configs." });
  } finally {
    if (conn) { conn.release(); }
  }
});

// ─── Debit Note Generation ───

router.post("/api/debit-notes/generate", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { startDate, endDate, warehouse, department, campus, skipMissingEmailGroups } = req.body;
    if (!startDate || !endDate) return res.status(400).json({ error: "Start date and end date are required." });
    if (String(startDate) > String(endDate)) return res.status(400).json({ error: "Start date cannot be after end date." });

    let sql = "SELECT * FROM stock_issue_items WHERE transactionDate >= ? AND transactionDate <= ?";
    const params: any[] = [startDate, endDate];
    if (warehouse) { sql += " AND warehouse = ?"; params.push(warehouse); }
    if (department) { sql += " AND department = ?"; params.push(department); }
    if (campus) { sql += " AND campus = ?"; params.push(campus); }
    sql += " ORDER BY warehouse, department, campus, transactionDate";
    const [items] = await p.query<RowDataPacket[]>(sql, params);
    if (items.length === 0) {
      return res.status(422).json({
        error: "No stock issue items found for the selected date range and filters. Check that the start/end dates are correct and that stock issue records exist for the chosen filters.",
      });
    }

    const groups = new Map<string, any[]>();
    for (const item of items) {
      const key = `${item.warehouse}||${item.division || ""}||${item.department}||${item.campus}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    const groupLabel = (w: string, div: string, d: string, c: string) =>
      div ? `${w} / ${div} / ${d} / ${c}` : `${w} / ${d} / ${c}`;

    const emailConfigByGroup = new Map<string, any>();
    const missingEmailGroups: string[] = [];
    for (const key of groups.keys()) {
      const [grpWarehouse, grpDivision, grpDepartment, grpCampus] = key.split("||");
      const [emailConfigs] = await p.execute<RowDataPacket[]>(
        "SELECT * FROM debit_note_emails WHERE warehouse = ? AND division = ? AND department = ? AND campus = ? LIMIT 1",
        [grpWarehouse, grpDivision, grpDepartment, grpCampus]
      );
      if (emailConfigs.length === 0) {
        missingEmailGroups.push(groupLabel(grpWarehouse, grpDivision, grpDepartment, grpCampus));
      } else {
        emailConfigByGroup.set(key, emailConfigs[0]);
      }
    }

    if (missingEmailGroups.length > 0 && !skipMissingEmailGroups) {
      return res.status(422).json({
        error: `Generation cancelled: ${missingEmailGroups.length} group(s) have no email configuration (${missingEmailGroups.join(", ")}). Add email configs in "Debit Note Email Configurations" or skip these groups and generate the rest.`,
        code: "MISSING_EMAIL_CONFIGS",
        missingGroups: missingEmailGroups,
      });
    }

    const created: any[] = [];
    for (const [key, groupItems] of groups.entries()) {
      const [grpWarehouse, grpDivision, grpDepartment, grpCampus] = key.split("||");
      const emailConfig = emailConfigByGroup.get(key);
      if (!emailConfig) continue;

      const now = new Date().toISOString();
      const [existingNotes] = await p.execute<RowDataPacket[]>(
        "SELECT * FROM debit_notes WHERE warehouse = ? AND department = ? AND campus = ? AND division = ? AND startDate = ? AND endDate = ? LIMIT 1",
        [grpWarehouse, grpDepartment, grpCampus, grpDivision, startDate, endDate]
      );
      const refNo = await generateDebitNoteNo(p, grpDivision, grpDepartment, grpCampus, startDate, existingNotes[0]?.id);

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
          [debitNoteId, refNo, grpWarehouse, grpDivision, grpDepartment, grpCampus, startDate, endDate, emailConfig.id, req.body.createdBy || "system", now, now]
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
      const skippedDetail = skipMissingEmailGroups && missingEmailGroups.length > 0
        ? ` All groups were skipped because they have no email configuration.`
        : "";
      return res.status(422).json({
        error: `No debit notes generated.${skippedDetail}`,
      });
    }

    const response: any = { success: true, count: created.length, debitNotes: created };
    if (skipMissingEmailGroups && missingEmailGroups.length > 0) {
      response.skipped = missingEmailGroups.length;
      response.skippedGroups = missingEmailGroups;
    }
    res.json(response);
  } catch (err: any) {
    console.error("Error generating debit notes:", err);
    res.status(500).json({ error: "Failed to generate debit notes. Please try again." });
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
      const [allRecipients] = await p.query<RowDataPacket[]>(
        `SELECT ecc.email_config_id, c.email, ecc.type FROM dn_email_config_contacts ecc
         JOIN dn_contacts c ON c.id = ecc.contact_id WHERE ecc.email_config_id IN (${emailIdPlaceholders})`,
        emailIds
      );
      for (const r of emailRows) {
        const recipients = allRecipients.filter((rp: any) => rp.email_config_id === r.id);
        r.sendToEmail = recipients.filter((rp: any) => rp.type === "send_to").map((rp: any) => rp.email);
        r.ccToEmail = recipients.filter((rp: any) => rp.type === "cc").map((rp: any) => rp.email);
        emailMap.set(r.id, r);
      }
    }

    const result = rows.map((row) => {
      const itemData = itemCountMap.get(row.id) || { count: 0, totalAmount: 0 };
      return {
        ...row,
        startDate: dateOnlyStr(row.startDate),
        endDate: dateOnlyStr(row.endDate),
        sendDate: dateOnlyStr(row.sendDate),
        itemCount: itemData.count,
        totalAmount: itemData.totalAmount,
        debitNoteEmail: row.debitNoteEmailId ? emailMap.get(row.debitNoteEmailId) || null : null,
      };
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
      if (emailRows[0]) {
        const [recipients] = await p.execute<RowDataPacket[]>(
          `SELECT c.email, ecc.type FROM dn_email_config_contacts ecc
           JOIN dn_contacts c ON c.id = ecc.contact_id WHERE ecc.email_config_id = ?`, [note.debitNoteEmailId]
        );
        emailConfig = {
          ...emailRows[0],
          sendToEmail: recipients.filter((r: any) => r.type === "send_to").map((r: any) => r.email),
          ccToEmail: recipients.filter((r: any) => r.type === "cc").map((r: any) => r.email),
        };
      }
    }
    res.json({
      ...note,
      startDate: dateOnlyStr(note.startDate),
      endDate: dateOnlyStr(note.endDate),
      sendDate: dateOnlyStr(note.sendDate),
      totalAmount: items.reduce((s, i) => s + (parseFloat(i.totalPrice) || 0), 0),
      items: items.map((i) => ({ ...i, transactionDate: dateOnlyStr(i.transactionDate) })),
      debitNoteEmail: emailConfig,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch debit note." });
  }
});

router.delete("/api/debit-notes/bulk", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { warehouse, department, campus, status, startDate, endDate, search } = req.query as Record<string, string>;
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (warehouse) { whereClauses.push("warehouse = ?"); params.push(warehouse); }
    if (department) { whereClauses.push("department = ?"); params.push(department); }
    if (campus) { whereClauses.push("campus = ?"); params.push(campus); }
    if (status) { whereClauses.push("status = ?"); params.push(status); }
    if (startDate) { whereClauses.push("startDate >= ?"); params.push(startDate); }
    if (endDate) { whereClauses.push("endDate <= ?"); params.push(endDate); }
    if (search) {
      const q = `%${search}%`;
      whereClauses.push("(referenceNumber LIKE ? OR warehouse LIKE ? OR department LIKE ? OR campus LIKE ? OR createdBy LIKE ? OR status LIKE ?)");
      params.push(q, q, q, q, q, q);
    }

    if (whereClauses.length === 0) {
      return res.status(400).json({ error: "At least one filter is required for bulk delete." });
    }

    const whereSql = " WHERE " + whereClauses.join(" AND ");
    const conn = await p.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query<RowDataPacket[]>(`SELECT id FROM debit_notes${whereSql}`, params);
      const ids = rows.map((r) => r.id);
      let count = 0;
      if (ids.length > 0) {
        const placeholders = ids.map(() => "?").join(",");
        await conn.execute(`DELETE FROM debit_note_items WHERE debitNoteId IN (${placeholders})`, ids);
        const [result] = await conn.execute<ResultSetHeader>(`DELETE FROM debit_notes WHERE id IN (${placeholders})`, ids);
        count = result.affectedRows;
      }
      await conn.commit();
      res.json({ success: true, count });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err: any) {
    console.error("Error bulk deleting debit notes:", err);
    res.status(500).json({ error: "Failed to bulk delete debit notes." });
  }
});

router.delete("/api/debit-notes/:id", async (req, res) => {
  if (req.params.id === "bulk") {
    return res.status(400).json({ error: "Use /bulk endpoint for bulk delete." });
  }
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
    runSendDebitNotesEmail(noteIds, false, progressKey, req.body.user).catch((err) => {
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
    runSendDebitNotesEmail([req.params.id], true, progressKey, req.body.user).catch((err) => {
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
    const [userRows] = await p.execute<RowDataPacket[]>("SELECT fullName, position, phone, email FROM users WHERE username = ?", [note.createdBy]);
    const pb = userRows.length > 0 ? { name: userRows[0].fullName, position: userRows[0].position, phone: userRows[0].phone, email: userRows[0].email } : undefined;
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
      const [userRows] = await p.execute<RowDataPacket[]>("SELECT fullName, position, phone, email FROM users WHERE username = ?", [note.createdBy]);
      const pb = userRows.length > 0 ? { name: userRows[0].fullName, position: userRows[0].position, phone: userRows[0].phone, email: userRows[0].email } : undefined;
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
