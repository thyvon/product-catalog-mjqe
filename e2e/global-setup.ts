import { chromium, type FullConfig } from "@playwright/test";

export default async function globalSetup(_config: FullConfig) {
  const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 120_000 });
  } catch {
    // warm-up is best-effort; tests retry the load themselves
  } finally {
    await browser.close();
  }
}