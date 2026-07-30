import { Router } from "express";
import type { RowDataPacket } from "mysql2/promise";
import { getPool, assertDb } from "../db.js";

const router = Router();

router.get("/api/settings", async (_req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const [rows] = await p.query<RowDataPacket[]>("SELECT `key`, value FROM settings ORDER BY `key`");
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json(settings);
  } catch {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.put("/api/settings", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const settings: Record<string, string> = req.body;
    const now = new Date().toISOString();
    for (const [key, value] of Object.entries(settings)) {
      await p.execute(
        "INSERT INTO settings (`key`, value, updatedAt) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = ?, updatedAt = ?",
        [key, value, now, value, now]
      );
    }
    const [rows] = await p.query<RowDataPacket[]>("SELECT `key`, value FROM settings ORDER BY `key`");
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

export default router;
