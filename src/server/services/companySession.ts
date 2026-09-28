import https from "https";
import http from "http";
import { getEnv } from "../config.js";

const SESSION_TTL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

export interface CompanyUserProfile {
  id: number;
  username: string;
  card_id?: string;
  name?: string;
  email?: string;
  real_position?: string;
}

interface CompanyLoginData {
  result: string;
  data: string;
  formToken: string;
  user?: CompanyUserProfile;
  userPhoto?: string;
}

export interface CompanySession {
  token: string;
  formToken: string;
  cookie: string;
  expiresAt: number;
}

export interface VerifiedCompanyLogin {
  token: string;
  formToken: string;
  cookie: string;
  profile?: CompanyUserProfile;
  userPhoto?: string;
}

export class CompanyLoginError extends Error {
  code: "INVALID_CREDENTIALS" | "UNAVAILABLE";
  constructor(message: string, code: "INVALID_CREDENTIALS" | "UNAVAILABLE") {
    super(message);
    this.name = "CompanyLoginError";
    this.code = code;
  }
}

// In-memory only: E-Purchase credentials are never persisted — only the
// short-lived session tokens returned by a successful verification.
const sessionCache = new Map<string, CompanySession>();

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
        catch { reject(new CompanyLoginError("E-Purchase service returned an invalid response.", "UNAVAILABLE")); }
      });
    });
    req.on("timeout", () => { req.destroy(); reject(new CompanyLoginError("E-Purchase service timed out.", "UNAVAILABLE")); });
    req.on("error", () => reject(new CompanyLoginError("E-Purchase service is unreachable.", "UNAVAILABLE")));
    if (options.body) req.write(options.body);
    req.end();
  });
}

export function fetchJson<T>(url: string, options: { method?: string; headers?: Record<string, string>; body?: string; timeout?: number } = {}): Promise<T> {
  return fetchWithCookies<T>(url, options).then((r) => r.data);
}

/**
 * Verifies credentials against the E-Purchase (company) API.
 * The password is used only for this single verification request and is
 * never stored, logged, or reused anywhere else in the system.
 */
export async function verifyCompanyLogin(employeeId: string, password: string): Promise<VerifiedCompanyLogin> {
  const env = getEnv();
  let result: FetchResult<CompanyLoginData>;
  try {
    result = await fetchWithCookies<CompanyLoginData>(
      `${env.COMPANY_API_URL}/api/default_user_access/login`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employee_id: employeeId, password }) }
    );
  } catch (err) {
    if (err instanceof CompanyLoginError) throw err;
    throw new CompanyLoginError("E-Purchase service is unreachable.", "UNAVAILABLE");
  }
  if (result.data.result !== "success") {
    throw new CompanyLoginError("Invalid employee ID or password.", "INVALID_CREDENTIALS");
  }
  return {
    token: result.data.data,
    formToken: result.data.formToken,
    cookie: result.cookies.join("; "),
    profile: result.data.user,
    userPhoto: result.data.userPhoto,
  };
}

export function setCompanySession(userId: string, session: Omit<CompanySession, "expiresAt">): void {
  sessionCache.set(userId, { ...session, expiresAt: Date.now() + SESSION_TTL_MS });
}

export function getCompanySession(userId: string): CompanySession | null {
  const session = sessionCache.get(userId);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessionCache.delete(userId);
    return null;
  }
  return session;
}

/** Sliding expiration: active use keeps the session alive. */
export function touchCompanySession(userId: string): void {
  const session = sessionCache.get(userId);
  if (session) session.expiresAt = Date.now() + SESSION_TTL_MS;
}

export function deleteCompanySession(userId: string): void {
  sessionCache.delete(userId);
}
