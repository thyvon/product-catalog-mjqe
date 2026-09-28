import { Router, type Request, type Response } from "express";
import { getEnv } from "../config.js";
import {
  fetchJson,
  getCompanySession,
  touchCompanySession,
  deleteCompanySession,
  type CompanySession,
} from "../services/companySession.js";

const router = Router();

const FETCH_TIMEOUT_MS = 10_000;

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

async function fetchCompanyItems(session: CompanySession, opts: { start: string; length: string; search?: string; timeout?: number } = { start: "0", length: "10" }) {
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

// Resolves the caller's E-Purchase session from the verified JWT identity
// (never trusted from client-supplied headers).
function resolveCompanySession(req: Request, res: Response): { userId: string; session: CompanySession } | null {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return null;
  }
  const session = getCompanySession(userId);
  if (!session) {
    res.status(401).json({ error: "E-Purchase session required. Please log in with E-Purchase.", code: "EPURCHASE_REQUIRED" });
    return null;
  }
  return { userId, session };
}

// DELETE /api/company/session — clears the caller's cached E-Purchase session on logout
router.delete("/api/company/session", (req, res) => {
  const userId = req.user?.userId;
  if (userId) deleteCompanySession(userId);
  res.json({ success: true });
});

// GET /api/company/items — proxy to company API with server-side search
router.get("/api/company/items", async (req, res) => {
  try {
    const resolved = resolveCompanySession(req, res);
    if (!resolved) return;
    const { userId, session } = resolved;

    const start = String(Number(req.query.start as string) || 0);
    const length = String(Number(req.query.length as string) || 10);
    const searchValue = ((req.query.search as Record<string, string>)?.value || "").trim();

    const result = await fetchCompanyItems(session, { start, length, search: searchValue });
    if (result.success === false) throw new Error(result.message || "Access denied");
    touchCompanySession(userId);
    const data = (result.data ?? []).filter(isValidItem);
    res.json({ ...result, data });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to fetch company items" });
  }
});

// GET /api/company/items/codes — returns ItemCode + Description pairs for dropdowns
router.get("/api/company/items/codes", async (req, res) => {
  try {
    const resolved = resolveCompanySession(req, res);
    if (!resolved) return;
    const { userId, session } = resolved;

    const searchValue = String(req.query.search || "").trim();
    const result = await fetchCompanyItems(session, { start: "0", length: searchValue ? "1000" : "1000", search: searchValue });
    if (result.success === false) throw new Error(result.message || "Access denied");
    touchCompanySession(userId);

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
