import { Router } from "express";
import https from "https";
import http from "http";
import { getEnv } from "../config.js";

const router = Router();

interface CompanyLoginResponse {
  result: string;
  data: string;
  formToken: string;
  user: { id: number; username: string; name: string };
}

interface CachedSession {
  token: string;
  formToken: string;
  cookie: string;
  expiresAt: number;
}

const sessionCache = new Map<string, CachedSession>();
const SESSION_TTL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

function getSessionForUser(userId: string): CachedSession | null {
  const session = sessionCache.get(userId);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessionCache.delete(userId);
    return null;
  }
  return session;
}

interface FetchResult<T> {
  data: T;
  cookies: string[];
}

function fetchWithCookies<T>(url: string, options: { method?: string; headers?: Record<string, string>; body?: string; timeout?: number } = {}): Promise<FetchResult<T>> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === "https:";
    const client = isHttps ? https : http;
    const req = client.request(parsedUrl, {
      method: options.method || "GET",
      headers: { ...options.headers },
      timeout: options.timeout ?? FETCH_TIMEOUT_MS,
    }, (res) => {
      let data = "";
      res.on("data", (chunk: string) => { data += chunk; });
      res.on("end", () => {
        const setCookieHeader = res.headers["set-cookie"];
        const cookies: string[] = [];
        if (setCookieHeader) {
          for (const c of setCookieHeader) cookies.push(c.split(";")[0]);
        }
        try { resolve({ data: JSON.parse(data), cookies }); }
        catch { reject(new Error(`Failed to parse JSON: ${data.substring(0, 200)}`)); }
      });
    });
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function fetchJson<T>(url: string, options: { method?: string; headers?: Record<string, string>; body?: string; timeout?: number } = {}): Promise<T> {
  return fetchWithCookies<T>(url, options).then((r) => r.data);
}

async function loginToCompany(employeeId: string, password: string) {
  const env = getEnv();
  const result = await fetchWithCookies<CompanyLoginResponse>(
    `${env.COMPANY_API_URL}/api/default_user_access/login`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employee_id: employeeId, password }) }
  );
  if (result.data.result !== "success") throw new Error("Company login failed");
  return { token: result.data.data, formToken: result.data.formToken, cookie: result.cookies.join("; ") };
}

function buildColumnsQuery(): string {
  const cols = [
    { data: "image", name: "image", searchable: "1", orderable: "1" },
    { data: "ItemCode", name: "ItemCode", searchable: "1", orderable: "1" },
    { data: "Description", name: "Description", searchable: "1", orderable: "1" },
    { data: "LongDescription", name: "LongDescription", searchable: "1", orderable: "1" },
    { data: "BaseItemUnit", name: "BaseItemUnit", searchable: "", orderable: "1" },
    { data: "category", name: "category", searchable: "", orderable: "1" },
    { data: "sub_category", name: "sub_category", searchable: "", orderable: "1" },
    { data: "is_manage_price", name: "is_manage_price", searchable: "", orderable: "1" },
    { data: "estimate_price", name: "estimate_price", searchable: "", orderable: "1" },
    { data: "avg_price_3_months", name: "avg_price_3_months", searchable: "", orderable: "1" },
    { data: "remark", name: "remark", searchable: "", orderable: "1" },
    { data: "show_created_at", name: "created_at", searchable: "", orderable: "1" },
    { data: "created_by", name: "created_by", searchable: "", orderable: "1" },
    { data: "show_updated_at", name: "updated_at", searchable: "", orderable: "1" },
    { data: "updated_by_name", name: "updated_by_name", searchable: "1", orderable: "1" },
    { data: "Status", name: "Status", searchable: "", orderable: "1" },
    { data: "id", name: "Action", searchable: "", orderable: "" },
  ];
  return cols.map((col, i) => [
    `columns[${i}][data]=${encodeURIComponent(col.data)}`,
    `columns[${i}][name]=${encodeURIComponent(col.name)}`,
    `columns[${i}][searchable]=${col.searchable}`,
    `columns[${i}][orderable]=${col.orderable}`,
    `columns[${i}][search][value]=`,
    `columns[${i}][search][regex]=false`,
  ].join("&")).join("&");
}

async function fetchCompanyItems(session: CachedSession, opts: { start: string; length: string; search?: string; timeout?: number } = { start: "0", length: "10" }) {
  const env = getEnv();
  const columnsQuery = buildColumnsQuery();
  const params = new URLSearchParams();
  params.set("draw", "1");
  params.set("start", opts.start);
  params.set("length", opts.length);
  params.set("search[value]", opts.search || "");
  params.set("search[regex]", "false");
  params.set("order[0][column]", "11");
  params.set("order[0][dir]", "desc");
  params.set("_token", session.formToken);
  params.set("getTable", "1");
  params.set("_", String(Date.now()));

  const url = `${env.COMPANY_API_URL}/items-master-list?${params.toString()}&${columnsQuery}`;
  return fetchJson<{ recordsTotal: number; recordsFiltered: number; data: Record<string, unknown>[]; success?: boolean; message?: string }>(url, {
    headers: { Authorization: `Bearer ${session.token}`, Cookie: session.cookie, "X-Requested-With": "XMLHttpRequest" },
    timeout: opts.timeout ?? FETCH_TIMEOUT_MS,
  });
}

function isValidItem(item: Record<string, unknown>): boolean {
  const code = String(item.ItemCode ?? "").trim();
  const desc = String(item.Description ?? "").trim();
  return code.length > 0 || desc.length > 0;
}

// POST /api/company/session
router.post("/api/company/session", async (req, res) => {
  try {
    const { employeeId, password, userId } = req.body as { employeeId?: string; password?: string; userId?: string };
    if (!employeeId || !password || !userId) { res.status(400).json({ error: "employeeId, password, and userId are required" }); return; }
    const { token, formToken, cookie } = await loginToCompany(employeeId, password);
    sessionCache.set(userId, { token, formToken, cookie, expiresAt: Date.now() + SESSION_TTL_MS });
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(401).json({ error: err instanceof Error ? err.message : "Company session failed" });
  }
});

// DELETE /api/company/session
router.delete("/api/company/session", (req, res) => {
  const userId = (req.query.userId as string) || "";
  if (userId) sessionCache.delete(userId);
  res.json({ success: true });
});

// GET /api/company/items — proxy to company API with server-side search
router.get("/api/company/items", async (req, res) => {
  try {
    const userId = (req.headers["x-user-id"] as string) || "";
    if (!userId) { res.status(401).json({ error: "User ID not provided" }); return; }

    const session = getSessionForUser(userId);
    if (!session) { res.status(401).json({ error: "Company session expired. Please log in again." }); return; }

    const start = String(Number(req.query.start as string) || 0);
    const length = String(Number(req.query.length as string) || 10);
    const searchValue = ((req.query.search as Record<string, string>)?.value || "").trim();

    const result = await fetchCompanyItems(session, { start, length, search: searchValue });
    if (result.success === false) throw new Error(result.message || "Access denied");
    const data = (result.data ?? []).filter(isValidItem);
    res.json({ ...result, data });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to fetch company items" });
  }
});

// GET /api/company/items/codes — returns ItemCode + Description pairs for dropdowns
router.get("/api/company/items/codes", async (req, res) => {
  try {
    const userId = (req.headers["x-user-id"] as string) || "";
    if (!userId) { res.status(401).json({ error: "User ID not provided" }); return; }

    const session = getSessionForUser(userId);
    if (!session) { res.status(401).json({ error: "Company session expired. Please log in again." }); return; }

    const searchValue = String(req.query.search || "").trim();
    const result = await fetchCompanyItems(session, { start: "0", length: searchValue ? "1000" : "200", search: searchValue });
    if (result.success === false) throw new Error(result.message || "Access denied");

    const items = (result.data ?? [])
      .filter(isValidItem)
      .map((item) => ({
        code: String(item.ItemCode ?? "").trim(),
        description: String(item.Description ?? "").trim(),
      }));

    res.json(items);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to fetch item codes" });
  }
});

export default router;
