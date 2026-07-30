import nodemailer from "nodemailer";
import ExcelJS from "exceljs";
import type { RowDataPacket } from "mysql2/promise";
import { getPool, assertDb } from "../db.js";
import { buildDebitNoteSheet } from "./excel.js";

export interface EmailProgress {
  status: string;
  finished: boolean;
  success_count?: number;
  failed_count?: number;
  failed_notes?: string[];
}

export const emailProgressMap = new Map<string, EmailProgress>();

export async function runSendDebitNotesEmail(
  debitNoteIds: string[],
  allowResend: boolean,
  progressKey: string,
): Promise<void> {
  try {
    assertDb();
    const p = getPool()!;

    const conn = await p.getConnection();
    let connReleased = false;
    const noteDetails: any[] = [];
    let notes: any[] = [];
    try {
      await conn.beginTransaction();

      const placeholders = debitNoteIds.map(() => "?").join(",");
      const statusFilter = allowResend ? "status != 'sending'" : "status = 'pending'";
      const [lockedNotes] = await conn.execute<RowDataPacket[]>(
        `SELECT * FROM debit_notes WHERE id IN (${placeholders}) AND ${statusFilter} FOR UPDATE`,
        debitNoteIds
      );
      notes = lockedNotes;

      if (notes.length === 0) {
        await conn.rollback();
        conn.release();
        connReleased = true;
        emailProgressMap.set(progressKey, { status: "No eligible debit notes found.", finished: true });
        return;
      }

      const noteIds = notes.map((n: any) => n.id);
      await conn.execute(
        `UPDATE debit_notes SET status = 'sending' WHERE id IN (${noteIds.map(() => "?").join(",")})`,
        noteIds
      );

      await conn.commit();
      conn.release();
      connReleased = true;

      for (const note of notes) {
        const [items] = await p.execute<RowDataPacket[]>(
          "SELECT * FROM debit_note_items WHERE debitNoteId = ? ORDER BY id ASC",
          [note.id]
        );
        let emailConfig = null;
        if (note.debitNoteEmailId) {
          const [emailRows] = await p.execute<RowDataPacket[]>("SELECT * FROM debit_note_emails WHERE id = ?", [note.debitNoteEmailId]);
          emailConfig = emailRows[0] || null;
        }
        noteDetails.push({ ...note, items, emailConfig });
      }
    } finally {
      if (!connReleased) {
        try { conn.release(); } catch {}
      }
    }

    const [settingRows] = await p.query<RowDataPacket[]>("SELECT `key`, value FROM settings");
    const dbSettings: Record<string, string> = {};
    for (const row of settingRows) dbSettings[row.key] = row.value;

    const getSetting = (key: string, envKey: string, fallback: string): string =>
      dbSettings[key] || process.env[envKey] || fallback;

    const transporter = nodemailer.createTransport({
      host: getSetting("smtp_host", "SMTP_HOST", "smtp.gmail.com"),
      port: parseInt(getSetting("smtp_port", "SMTP_PORT", "587")),
      secure: getSetting("smtp_secure", "SMTP_SECURE", "") === "true",
      auth: {
        user: getSetting("smtp_user", "SMTP_USER", ""),
        pass: getSetting("smtp_pass", "SMTP_PASS", ""),
      },
    });

    const fromAddress = getSetting("mail_from_address", "MAIL_FROM_ADDRESS", "") || getSetting("smtp_user", "SMTP_USER", "") || "noreply@procurement.com";
    const fromName = getSetting("mail_from_name", "MAIL_FROM_NAME", "PROCUREMENT");

    const recipientGroups = new Map<string, { notes: any[]; cc: string[] }>();
    for (const detail of noteDetails) {
      if (!detail.emailConfig) {
        await p.execute("UPDATE debit_notes SET status = 'pending' WHERE id = ?", [detail.id]);
        continue;
      }
      const sendToEmails: string[] = JSON.parse(detail.emailConfig.sendToEmail || "[]");
      const ccEmails: string[] = JSON.parse(detail.emailConfig.ccToEmail || "[]");

      for (const email of sendToEmails) {
        const trimmed = email.trim();
        if (!trimmed) continue;
        if (!recipientGroups.has(trimmed)) {
          recipientGroups.set(trimmed, { notes: [], cc: [] });
        }
        recipientGroups.get(trimmed)!.notes.push(detail);
        for (const cc of ccEmails) {
          const ccTrimmed = cc.trim();
          if (ccTrimmed && ccTrimmed !== trimmed && !recipientGroups.get(trimmed)!.cc.includes(ccTrimmed)) {
            recipientGroups.get(trimmed)!.cc.push(ccTrimmed);
          }
        }
      }
    }

    let successCount = 0;
    let failedCount = 0;
    const failedNotesList: string[] = [];
    let emailIndex = 0;
    const totalEmails = recipientGroups.size;

    for (const [recipientEmail, group] of recipientGroups.entries()) {
      emailIndex++;
      emailProgressMap.set(progressKey, {
        status: `Sending email ${emailIndex} of ${totalEmails} to ${recipientEmail}`,
        finished: false,
      });

      try {
        const attachments: any[] = [];
        for (const detail of group.notes) {
          const [userRows] = await p.execute<RowDataPacket[]>("SELECT fullName, position FROM users WHERE username = ?", [detail.createdBy]);
          const pb = userRows.length > 0 ? { name: userRows[0].fullName, position: userRows[0].position } : undefined;
          const workbook = new ExcelJS.Workbook();
          buildDebitNoteSheet(workbook, detail, detail.items, pb);
          const buffer = await workbook.xlsx.writeBuffer();
          const fileName = `DebitNote_${detail.department}_${detail.campus}_${detail.referenceNumber}.xlsx`.replace(/[^a-zA-Z0-9_.-]/g, "_");
          attachments.push({ filename: fileName, content: buffer as Buffer });
        }

        let creatorName = "Vun Thy";
        let creatorPosition = "Procurement Officer";
        let creatorPhone = "+855 96 36 12 146";
        let creatorEmail = "vun.thy@mjqeducation.edu.kh";
        const firstNote = group.notes[0];
        if (firstNote?.createdBy) {
          const [uRows] = await p.execute<RowDataPacket[]>("SELECT fullName, position, phone, email FROM users WHERE username = ?", [firstNote.createdBy]);
          if (uRows.length > 0) {
            creatorName = uRows[0].fullName || creatorName;
            creatorPosition = uRows[0].position || creatorPosition;
            creatorPhone = uRows[0].phone || creatorPhone;
            creatorEmail = uRows[0].email || creatorEmail;
          }
        }

        const campusSet = new Set(group.notes.map((n: any) => n.campus));
        const deptSet = new Set(group.notes.map((n: any) => n.department));
        const campusStr = Array.from(campusSet).join(", ");
        const deptStr = Array.from(deptSet).join(", ");

        const fmtDate = (s: any) => {
          if (!s) return "-";
          const dt = typeof s === "string" ? new Date(s + "T00:00:00") : new Date(s.getTime());
          if (isNaN(dt.getTime())) return "-";
          return dt.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
        };

        const periodStr = fmtDate(group.notes[0]?.startDate) && fmtDate(group.notes[0]?.endDate)
          ? `${fmtDate(group.notes[0]?.startDate)} - ${fmtDate(group.notes[0]?.endDate)}` : "";

        const subject = `Debit Note${group.notes.length > 1 ? "s" : ""}${periodStr ? ` (${periodStr})` : ""} for ${deptStr} - Campus (${campusStr})`;

        const deptNames = [...new Set(group.notes.map((n: any) => n.department).filter(Boolean))];
        const campusNames = [...new Set(group.notes.map((n: any) => n.campus).filter(Boolean))];

        const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Debit Note Notification</title>
    <style>
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f8f9fa; color: #343a40; line-height: 1.6; }
        .container { background-color: #ffffff; padding: 20px; margin: 20px auto; border-radius: 8px; max-width: 100%; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 20px; }
        h2 { color: #007bff; margin-bottom: 5px; }
        .details { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .details th, .details td { border: 1px solid #dee2e6; padding: 10px; text-align: left; }
        .details th { background-color: #e9ecef; }
        .footer { font-size: 0.9rem; color: #6c757d; text-align: center; margin-top: 20px; text-align: left; }
        .footer img { max-width: 150px; margin-bottom: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Monthly Debit Note</h2>
            <p>From Warehouse: <strong>${firstNote?.warehouse || "-"}</strong></p>
        </div>
        <p>Dear <strong>${group.notes[0]?.emailConfig?.receiverName || recipientEmail}</strong>,</p>
        <p>I hope this message finds you well.</p>
        <p>Please find attached the Monthly Debit Note for <strong>${deptNames.join(", ") || "-"}, Campus (${campusNames.join(", ") || "-"})</strong> for the period from <strong>${fmtDate(firstNote?.startDate)}</strong> to <strong>${fmtDate(firstNote?.endDate)}</strong>. This document details all materials requested from stock during the month for operational usage. The debit note includes quantities, item descriptions, and relevant references to help you verify the records efficiently.</p>
        <p>Kindly review the attached file at your earliest convenience. Should you have any questions, discrepancies, or require additional supporting information, please do not hesitate to contact me. I am happy to provide clarification or any further documentation needed.</p>
        <p>Thank you for your time and attention to this matter. I appreciate your cooperation and prompt review.</p>
        <div class="footer">
            <p>Best regards,<br>${creatorName}<br>${creatorPosition}<br>${creatorPhone}<br>${creatorEmail}<br></p>
        </div>
    </div>
</body>
</html>`;

        await transporter.sendMail({
          from: `"${fromName}" <${fromAddress}>`,
          to: recipientEmail,
          cc: group.cc.length > 0 ? group.cc.join(", ") : undefined,
          subject,
          html: htmlBody,
          attachments,
        });

        const sentIds = group.notes.map((n: any) => n.id);
        const todayStr = new Date().toISOString().split("T")[0];
        await p.execute(
          `UPDATE debit_notes SET status = 'sent', sendDate = ? WHERE id IN (${sentIds.map(() => "?").join(",")})`,
          [todayStr, ...sentIds]
        );
        successCount++;
      } catch (err: any) {
        console.error(`Failed to send email to ${recipientEmail}:`, err);
        failedCount++;
        failedNotesList.push(`Failed to send to ${recipientEmail}: ${err.message}`);
        const failedIds = group.notes.map((n: any) => n.id);
        await p.execute(
          `UPDATE debit_notes SET status = 'pending' WHERE id IN (${failedIds.map(() => "?").join(",")})`,
          failedIds
        );
      }
    }

    emailProgressMap.set(progressKey, {
      status: successCount > 0
        ? `Finished. Success: ${successCount}, Failed: ${failedCount}`
        : "No emails were sent.",
      finished: true,
      success_count: successCount,
      failed_count: failedCount,
      failed_notes: failedNotesList.slice(0, 10),
    });
  } catch (err: any) {
    console.error("Error in debit note email job:", err);
    emailProgressMap.set(progressKey, { status: `Error: ${err.message}`, finished: true, failed_count: 1, failed_notes: [err.message] });
  }
}
