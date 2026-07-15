import express from "express";
import path from "path";
import { createServer as createHttpServer } from "http";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { initDb, isDbReady, checkDbConnection } from "./db.js";
import productsRouter from "./routes/products.js";
import stockRouter from "./routes/stock.js";
import { getAllProducts } from "./db.js";

dotenv.config();

export async function createApp() {
  const app = express();

  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ limit: "20mb", extended: true }));

  // Initialize database
  await initDb();

  // Health check
  app.get("/api/health", async (_req, res) => {
    const dbOk = await checkDbConnection();
    res.json({ status: dbOk ? "ok" : "degraded", db: dbOk ? "connected" : "disconnected" });
  });

  // Visit logging
  let visitCount = 0;
  app.post("/api/visit/log", (_req, res) => { visitCount++; res.json({ count: visitCount }); });
  app.get("/api/visit/stats", (_req, res) => res.json({ visits: visitCount }));

  // Image upload
  const BLANK_PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect fill="#f1f5f9" width="400" height="400"/><text x="50%" y="45%" fill="#94a3b8" font-family="monospace" font-size="16" font-weight="bold" text-anchor="middle" dominant-baseline="middle">NO IMAGE</text><text x="50%" y="55%" fill="#94a3b8" font-family="monospace" font-size="11" text-anchor="middle" dominant-baseline="middle">Click to upload</text></svg>`);

  // Register route modules
  app.use(productsRouter);
  app.use(stockRouter);
  // TODO: Register debit note, supplier, AI routes

  // SPA fallback for production
  if (process.env.NODE_ENV === "production") {
    const distPath = path.resolve(import.meta.dirname, "../../dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return app;
}

// Start server
const PORT = parseInt(process.env.PORT || "3000", 10);

createApp().then((app) => {
  const server = createHttpServer(app);
  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
});
