import { Router } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import type { RowDataPacket } from "mysql2/promise";
import { getPool, assertDb } from "../db.js";
import { getEnv } from "../config.js";
import { hashPassword, comparePassword } from "../services/password.js";
import { loginLimiter } from "../middleware/loginLimiter.js";

// ─── Public routes (no auth) ───
export const publicUsersRouter = Router();

// ─── Protected routes (auth required — mounted behind authenticate in app.ts) ───
export const protectedUsersRouter = Router();

// ─── Login (DB-backed, public) ───
publicUsersRouter.post("/api/users/login", loginLimiter, async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }
    const [rows] = await p.execute<RowDataPacket[]>(
      "SELECT id, username, role, fullName, email, phone, position, avatarUrl, card_id, password FROM users WHERE username = ?",
      [username]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid username or password." });
    }
    const user = rows[0];
    const valid = await comparePassword(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid username or password." });
    }
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      getEnv().JWT_SECRET,
      { expiresIn: "24h" }
    );
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      position: user.position,
      avatarUrl: user.avatarUrl,
      card_id: user.card_id,
      token,
    });
  } catch {
    res.status(500).json({ error: "Login failed." });
  }
});

// ─── List all users (protected) ───
protectedUsersRouter.get("/api/users", async (_req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const [rows] = await p.execute<RowDataPacket[]>(
      "SELECT id, username, role, fullName, email, phone, position, telegramId, createdAt, updatedAt FROM users ORDER BY createdAt DESC"
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch users." });
  }
});

// ─── Get user profile by username (protected) ───
protectedUsersRouter.get("/api/users/profile", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const username = req.query.username as string;
    if (!username) return res.status(400).json({ error: "username is required" });
    const [rows] = await p.execute<RowDataPacket[]>(
      "SELECT id, username, role, fullName, email, phone, position, telegramId, avatarUrl, smtp_pass FROM users WHERE username = ?",
      [username]
    );
    if (rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

// ─── Update own profile (protected) ───
protectedUsersRouter.put("/api/users/profile", async (req, res) => {
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
      "SELECT id, username, role, fullName, email, phone, position, telegramId, avatarUrl, smtp_pass FROM users WHERE username = ?",
      [username]
    );
    res.json(rows[0] || { success: true });
  } catch {
    res.status(500).json({ error: "Failed to update user profile" });
  }
});

// ─── Create user (protected) ───
protectedUsersRouter.post("/api/users", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { username, password, role, fullName, email, phone, position, telegramId, smtp_pass } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }
    const [existing] = await p.execute<RowDataPacket[]>(
      "SELECT id FROM users WHERE username = ?", [username]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: "Username already exists." });
    }
    const id = `usr-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const hashedPassword = await hashPassword(password);
    await p.execute(
      `INSERT INTO users (id, username, password, role, fullName, email, phone, position, telegramId, avatarUrl, smtp_pass, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?)`,
      [id, username, hashedPassword, role || "User", fullName || "", email || "", phone || "", position || "", telegramId || "", smtp_pass || "", now, now]
    );
    const [rows] = await p.execute<RowDataPacket[]>(
      "SELECT id, username, role, fullName, email, phone, position, telegramId, avatarUrl, createdAt, updatedAt FROM users WHERE id = ?",
      [id]
    );
    res.status(201).json(rows[0]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create user.";
    res.status(500).json({ error: message });
  }
});

// ─── Update user (protected, admin) ───
protectedUsersRouter.put("/api/users/:id", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const { role, fullName, email, phone, position, telegramId, password } = req.body;
    const now = new Date().toISOString();
    if (password) {
      const hashedPassword = await hashPassword(password);
      await p.execute(
        "UPDATE users SET role = ?, fullName = ?, email = ?, phone = ?, position = ?, telegramId = ?, password = ?, updatedAt = ? WHERE id = ?",
        [role || "User", fullName || "", email || "", phone || "", position || "", telegramId || "", hashedPassword, now, req.params.id]
      );
    } else {
      await p.execute(
        "UPDATE users SET role = ?, fullName = ?, email = ?, phone = ?, position = ?, telegramId = ?, updatedAt = ? WHERE id = ?",
        [role || "User", fullName || "", email || "", phone || "", position || "", telegramId || "", now, req.params.id]
      );
    }
    const [rows] = await p.execute<RowDataPacket[]>(
      "SELECT id, username, role, fullName, email, phone, position, telegramId, avatarUrl, createdAt, updatedAt FROM users WHERE id = ?",
      [req.params.id]
    );
    res.json(rows[0] || { success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update user.";
    res.status(500).json({ error: message });
  }
});

// ─── Delete user (protected) ───
protectedUsersRouter.delete("/api/users/:id", async (req, res) => {
  try {
    assertDb();
    const p = getPool()!;
    const [rows] = await p.execute<RowDataPacket[]>(
      "SELECT username FROM users WHERE id = ?", [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "User not found." });
    if (rows[0].username === "admin") {
      return res.status(400).json({ error: "Cannot delete the admin user." });
    }
    await p.execute("DELETE FROM users WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete user.";
    res.status(500).json({ error: message });
  }
});
