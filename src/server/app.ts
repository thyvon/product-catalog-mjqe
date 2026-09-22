import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { getEnv } from "./config.js";
import { initDb, checkDbConnection } from "./db.js";
import { authenticate } from "./middleware/auth.js";
import { isMinioEnabled, getObject, getLocalUploadsDir } from "./services/storage.js";
import productsRouter from "./routes/products.js";
import suppliersRouter from "./routes/suppliers.js";
import stockRouter from "./routes/stock.js";
import debitNotesRouter from "./routes/debitNotes.js";
import settingsRouter from "./routes/settings.js";
import { publicUsersRouter, protectedUsersRouter } from "./routes/users.js";
import aiRouter from "./routes/ai.js";
import productManagementRouter from "./routes/productManagement.js";
import companyProductsRouter from "./routes/companyProducts.js";

dotenv.config();

interface VisitEntry {
  path: string;
  timestamp: number;
  ip: string;
}
const visitLog: VisitEntry[] = [];
const VISIT_WINDOW_MS = 5 * 60 * 1000;

export async function createApp() {
  const app = express();
  const env = getEnv();

  // Security middleware
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(rateLimit({ windowMs: env.RATE_LIMIT_WINDOW_MS, max: env.RATE_LIMIT_MAX }));

  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ limit: "20mb", extended: true }));

  await initDb();

  // Register public routes (no auth required)
  app.use("/api/health", async (_req, res) => {
    const dbOk = await checkDbConnection();
    res.json({ status: dbOk ? "ok" : "degraded", database: dbOk ? "connected" : "unavailable" });
  });

  // Visit tracking (public, rate-limited separately if needed)
  app.post("/api/visit/log", (req, res) => {
    const pagePath = req.body?.path || "/";
    const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "unknown").split(",")[0].trim();
    visitLog.push({ path: pagePath, timestamp: Date.now(), ip });
    const cutoff = Date.now() - VISIT_WINDOW_MS;
    while (visitLog.length > 0 && visitLog[0].timestamp < cutoff) visitLog.shift();
    res.json({ ok: true });
  });

  app.get("/api/visit/stats", (_req, res) => {
    const cutoff = Date.now() - VISIT_WINDOW_MS;
    const live = visitLog.filter((v) => v.timestamp >= cutoff);
    const uniqueIps = new Set(live.map((v) => v.ip));
    const pathCounts: Record<string, number> = {};
    live.forEach((v) => { pathCounts[v.path] = (pathCounts[v.path] || 0) + 1; });
    const paths = Object.entries(pathCounts).map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count);
    const recent = live.slice(-50).reverse().map((v) => ({ path: v.path, time: v.timestamp }));
    const TIMELINE_STEP_MS = 30 * 1000;
    const now = Date.now();
    const buckets: { start: number; visits: number; visitors: Set<string> }[] = [];
    for (let t = cutoff; t <= now; t += TIMELINE_STEP_MS) {
      buckets.push({ start: t, visits: 0, visitors: new Set() });
    }
    live.forEach((v) => {
      const idx = Math.min(buckets.length - 1, Math.floor((v.timestamp - cutoff) / TIMELINE_STEP_MS));
      if (idx >= 0) {
        buckets[idx].visits += 1;
        buckets[idx].visitors.add(v.ip);
      }
    });
    const timeline = buckets.map((b) => ({
      time: new Date(b.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      visits: b.visits,
      visitors: b.visitors.size,
    }));
    res.json({ liveVisitors: uniqueIps.size, totalVisits: live.length, paths, recent, timeline });
  });

  // Uploads: served from MinIO when configured, otherwise local disk
  const uploadsDir = getLocalUploadsDir();
  if (isMinioEnabled()) {
    app.use("/uploads", async (req, res, next) => {
      const key = decodeURIComponent(req.path.replace(/^\/+/, ""));
      if (!key) return next();
      try {
        const obj = await getObject(key);
        if (!obj) return next();
        res.setHeader("Content-Type", obj.contentType);
        res.setHeader("Content-Length", obj.size);
        obj.stream.pipe(res);
      } catch {
        next();
      }
    });
  } else {
    app.use("/uploads", express.static(uploadsDir));
  }

  // Public API routes (login, sync)
  app.use(publicUsersRouter);

  // Protected API routes (require JWT)
  app.use(authenticate, protectedUsersRouter);
  app.use(authenticate, productsRouter);
  app.use(authenticate, suppliersRouter);
  app.use(authenticate, stockRouter);
  app.use(authenticate, debitNotesRouter);
  app.use(authenticate, settingsRouter);
  app.use(authenticate, aiRouter);
  app.use(authenticate, productManagementRouter);
  app.use(authenticate, companyProductsRouter);

  // SPA fallback
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { port: 0 } },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  return app;
}
