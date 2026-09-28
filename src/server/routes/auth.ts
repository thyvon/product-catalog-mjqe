import { Router } from "express";
import jwt from "jsonwebtoken";
import type { RowDataPacket } from "mysql2/promise";
import { getPool, assertDb } from "../db.js";
import { getEnv } from "../config.js";
import { verifyCompanyLogin, setCompanySession, CompanyLoginError } from "../services/companySession.js";
import { loginLimiter } from "../middleware/loginLimiter.js";

export const publicAuthRouter = Router();

interface LocalUserRow {
  id: string;
  username: string;
  role: string;
  fullName: string;
  email: string;
  position: string;
  avatarUrl: string;
  card_id: string;
}

// ─── E-Purchase login (public, rate-limited) ───
// Verifies employee credentials against the E-Purchase system and issues a
// local JWT. Read-only with respect to the database: no rows are created or
// updated. The E-Purchase password is discarded immediately after verification.
publicAuthRouter.post("/api/auth/epurchase-login", loginLimiter, async (req, res) => {
  try {
    const employeeId = typeof req.body?.employeeId === "string" ? req.body.employeeId.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!employeeId || !password) {
      return res.status(400).json({ error: "Employee ID and password are required." });
    }

    let verified;
    try {
      verified = await verifyCompanyLogin(employeeId, password);
    } catch (err) {
      if (err instanceof CompanyLoginError && err.code === "UNAVAILABLE") {
        return res.status(503).json({ error: "E-Purchase service is unavailable. Please try again later." });
      }
      return res.status(401).json({ error: "Invalid employee ID or password." });
    }

    // Read-only lookup of an existing local account (never creates or updates).
    let local: LocalUserRow | null = null;
    try {
      assertDb();
      const p = getPool()!;
      const cardId = verified.profile?.card_id || "";
      const [rows] = await p.execute<RowDataPacket[]>(
        `SELECT id, username, role, fullName, email, position, avatarUrl, card_id
         FROM users
         WHERE username = ? OR (card_id IS NOT NULL AND card_id != '' AND card_id = ?)
         LIMIT 1`,
        [employeeId, cardId]
      );
      if (rows.length > 0) local = rows[0] as LocalUserRow;
    } catch { /* DB unavailable — fall back to the E-Purchase identity */ }

    const profile = verified.profile;
    const username = local?.username || profile?.username || employeeId;
    const userId = local?.id || `ep-${profile?.card_id || username}`.slice(0, 64);
    const role = local?.role || "User";
    const fullName = local?.fullName || profile?.name || username;

    const token = jwt.sign(
      { userId, username, role },
      getEnv().JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Establish the server-side E-Purchase proxy session keyed by our own
    // JWT identity. The password is gone at this point; only the returned
    // session tokens are cached (in memory, 30 min sliding TTL).
    setCompanySession(userId, {
      token: verified.token,
      formToken: verified.formToken,
      cookie: verified.cookie,
    });

    res.json({
      token,
      user: {
        id: userId,
        card_id: local?.card_id || profile?.card_id || "",
        username,
        name: fullName,
        email: local?.email || profile?.email || "",
        real_position: local?.position || profile?.real_position || "",
        avatarUrl: local?.avatarUrl || verified.userPhoto || "",
        fullName,
        role,
      },
    });
  } catch {
    res.status(500).json({ error: "Login failed." });
  }
});
