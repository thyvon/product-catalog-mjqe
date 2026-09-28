import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { setOnSessionExpired } from "@/features/shared/api/client";

interface User {
  id: string;
  card_id: string;
  username: string;
  name: string;
  email: string;
  real_position: string;
  avatarUrl?: string;
  fullName?: string;
  role?: string;
}

export type AuthMode = "local" | "epurchase";

interface LocalLoginResponse {
  id: string;
  username: string;
  role: string;
  fullName: string;
  email?: string;
  phone?: string;
  position?: string;
  avatarUrl?: string;
  card_id?: string;
  token: string;
}

interface EpurchaseLoginResponse {
  token: string;
  user: User;
}

export interface LoginResult {
  ok: boolean;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  jwt: string | null;
  authMode: AuthMode | null;
  loginLocal: (username: string, password: string) => Promise<LoginResult>;
  loginEpurchase: (employeeId: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_KEYS = ["auth_user", "auth_jwt", "auth_mode"];
const LEGACY_KEYS = ["auth_token", "auth_form_token"];

async function readError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return (body as { error?: string }).error || fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("auth_user");
    return stored ? JSON.parse(stored) : null;
  });

  const [jwt, setJwt] = useState<string | null>(() => {
    return localStorage.getItem("auth_jwt");
  });

  const [authMode, setAuthMode] = useState<AuthMode | null>(() => {
    const stored = localStorage.getItem("auth_mode");
    return stored === "epurchase" ? "epurchase" : stored === "local" ? "local" : null;
  });

  const persistSession = useCallback((u: User, token: string, mode: AuthMode) => {
    setUser(u);
    setJwt(token);
    setAuthMode(mode);
    localStorage.setItem("auth_user", JSON.stringify(u));
    localStorage.setItem("auth_jwt", token);
    localStorage.setItem("auth_mode", mode);
    // Clean up legacy keys that used to hold the raw E-Purchase tokens
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
  }, []);

  // Backfill role/fullName for sessions created before role was persisted
  useEffect(() => {
    if (user && !user.role) {
      const localToken = localStorage.getItem("auth_jwt");
      const headers: Record<string, string> = {};
      if (localToken) headers["Authorization"] = `Bearer ${localToken}`;
      fetch(`/api/users/profile?username=${encodeURIComponent(user.username)}`, { headers })
        .then((res) => (res.ok ? res.json() : null))
        .then((profile) => {
          if (!profile) return;
          const updated = { ...user };
          if (profile.role) updated.role = profile.role;
          if (profile.fullName) updated.fullName = profile.fullName;
          setUser(updated);
          localStorage.setItem("auth_user", JSON.stringify(updated));
        })
        .catch(() => {});
    }
  }, []);

  // Login with "My System" — local account, local DB credentials only.
  const loginLocal = useCallback(async (username: string, password: string): Promise<LoginResult> => {
    try {
      const res = await fetch("/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        return { ok: false, error: await readError(res, "Invalid username or password.") };
      }
      const data: LocalLoginResponse = await res.json();
      const u: User = {
        id: String(data.id),
        card_id: data.card_id || "",
        username: data.username,
        name: data.fullName || data.username,
        email: data.email || "",
        real_position: data.position || "",
        avatarUrl: data.avatarUrl || undefined,
        fullName: data.fullName || data.username,
        role: data.role || "User",
      };
      persistSession(u, data.token, "local");
      return { ok: true };
    } catch {
      return { ok: false, error: "Login failed. Please try again." };
    }
  }, [persistSession]);

  // Login with "E-Purchase" — credentials are verified against the E-Purchase
  // system exactly once and never stored anywhere in this app.
  const loginEpurchase = useCallback(async (employeeId: string, password: string): Promise<LoginResult> => {
    try {
      const res = await fetch("/api/auth/epurchase-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, password }),
      });
      if (!res.ok) {
        return { ok: false, error: await readError(res, "Invalid employee ID or password.") };
      }
      const data: EpurchaseLoginResponse = await res.json();
      if (!data.token || !data.user) {
        return { ok: false, error: "Login failed. Please try again." };
      }
      persistSession({ ...data.user, id: String(data.user.id) }, data.token, "epurchase");
      return { ok: true };
    } catch {
      return { ok: false, error: "Login failed. Please try again." };
    }
  }, [persistSession]);

  const logout = useCallback(() => {
    const currentJwt = localStorage.getItem("auth_jwt");
    const currentMode = localStorage.getItem("auth_mode");
    setUser(null);
    setJwt(null);
    setAuthMode(null);
    [...SESSION_KEYS, ...LEGACY_KEYS].forEach((k) => localStorage.removeItem(k));
    // Drop the server-side E-Purchase proxy session (authenticated by our JWT)
    if (currentMode === "epurchase" && currentJwt) {
      fetch("/api/company/session", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${currentJwt}` },
      }).catch(() => {});
    }
  }, []);

  // Register session-expired handler: logout + redirect to /login
  useEffect(() => {
    setOnSessionExpired(() => {
      logout();
      window.location.href = "/login";
    });
    return () => setOnSessionExpired(() => {});
  }, [logout]);

  const updateProfile = (data: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...data };
      localStorage.setItem("auth_user", JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ user, jwt, authMode, loginLocal, loginEpurchase, logout, updateProfile, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
