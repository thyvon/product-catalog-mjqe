import { Router } from "express";
import type { RowDataPacket } from "mysql2/promise";
import { getPool, assertDb } from "../db.js";

const router = Router();

router.get("/api/users/profile", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const username = req.query.username as string;
    if (!username) return res.status(400).json({ error: "username is required" });
    const [rows] = await p.execute<RowDataPacket[]>(
      "SELECT id, username, role, fullName, email, phone, position, telegramId, avatarUrl, smtp_pass FROM users WHERE username = ?", [username]
    );
    if (rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

router.put("/api/users/profile", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { username, fullName, email, phone, position, telegramId, smtp_pass } = req.body;
    if (!username) return res.status(400).json({ error: "username is required" });
    const now = new Date().toISOString();
    await p.execute(
      "UPDATE users SET fullName = ?, email = ?, phone = ?, position = ?, telegramId = ?, smtp_pass = ?, updatedAt = ? WHERE username = ?",
      [fullName || "", email || "", phone || "", position || "", telegramId || "", smtp_pass || "", now, username]
    );
    const [rows] = await p.execute<RowDataPacket[]>(
      "SELECT id, username, role, fullName, email, phone, position, telegramId, avatarUrl, smtp_pass FROM users WHERE username = ?", [username]
    );
    res.json(rows[0] || { success: true });
  } catch {
    res.status(500).json({ error: "Failed to update user profile" });
  }
});

export default router;
