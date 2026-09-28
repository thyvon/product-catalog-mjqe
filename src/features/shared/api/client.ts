type RequestOptions = {
  method?: string;
  body?: unknown;
  params?: Record<string, string>;
  headers?: Record<string, string>;
};

let onSessionExpired: (() => void) | null = null;

export function setOnSessionExpired(cb: () => void) {
  onSessionExpired = cb;
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function handle401() {
  if (onSessionExpired) onSessionExpired();
}

export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("auth_jwt");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// fetch() wrapper that injects the local JWT into protected API calls.
// If a request made WITH a token still comes back 401, the session has
// expired and the global session-expired handler is triggered. Requests
// made without a token (anonymous) are left to the caller.
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const hadToken = Boolean(localStorage.getItem("auth_jwt"));
  const { headers: initHeaders, ...rest } = init;
  const res = await fetch(input, {
    ...rest,
    headers: { ...authHeaders(), ...(initHeaders as Record<string, string> | undefined) },
  });
  if (res.status === 401 && hadToken) handle401();
  return res;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, params, headers: extraHeaders } = options;

  let url = path;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";
  if (extraHeaders) Object.assign(headers, extraHeaders);

  const token = localStorage.getItem("auth_jwt");
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) handle401();
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string, params?: Record<string, string>) =>
    request<T>(path, { params }),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body }),

  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "DELETE", body }),
};

export { ApiError };
