import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api } from "@/features/shared/api/client";

interface User {
  id: number;
  card_id: string;
  username: string;
  name: string;
  email: string;
  real_position: string;
  avatarUrl?: string;
  fullName?: string;
  role?: string;
}

interface LoginResponse {
  result: string;
  msg: string;
  data: string;
  formToken: string;
  user: {
    id: number;
    card_id: string;
    name: string;
    username: string;
    email: string;
    real_position: string;
  };
  userPhoto?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  formToken: string | null;
  login: (employeeId: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("auth_user");
    return stored ? JSON.parse(stored) : null;
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("auth_token");
  });

  const [formToken, setFormToken] = useState<string | null>(() => {
    return localStorage.getItem("auth_form_token");
  });

  useEffect(() => {
    if (user && !user.role) {
      api.get<{ role: string; fullName: string }>(`/api/users/profile?username=${encodeURIComponent(user.username)}`)
        .then((profile) => {
          const updated = { ...user };
          if (profile.role) updated.role = profile.role;
          if (profile.fullName) updated.fullName = profile.fullName;
          setUser(updated);
          localStorage.setItem("auth_user", JSON.stringify(updated));
        })
        .catch(() => {});
    }
  }, []);

  const login = async (employeeId: string, password: string): Promise<boolean> => {
    try {
      const data = await api.companyPost<LoginResponse>("/default_user_access/login", {
        employee_id: employeeId,
        password,
      });
      if (data.result !== "success") return false;

      try {
        await api.post("/api/users/sync", {
          employeeId: data.user.username,
          cardId: data.user.card_id,
          name: data.user.name,
          email: data.user.email,
          position: data.user.real_position,
          avatarUrl: data.userPhoto || "",
        });
      } catch { /* sync failed, continue with login */ }

      let role = "User";
      try {
        const profile = await api.get<{ role: string }>(`/api/users/profile?username=${encodeURIComponent(data.user.username)}`);
        if (profile.role) role = profile.role;
      } catch { /* use default role */ }

      const u: User = {
        id: data.user.id,
        card_id: data.user.card_id,
        username: data.user.username,
        name: data.user.name,
        email: data.user.email,
        real_position: data.user.real_position,
        avatarUrl: data.userPhoto || undefined,
        fullName: data.user.name,
        role,
      };

      setUser(u);
      setToken(data.data);
      setFormToken(data.formToken);

      localStorage.setItem("auth_user", JSON.stringify(u));
      localStorage.setItem("auth_token", data.data);
      localStorage.setItem("auth_form_token", data.formToken);

      // Create server session + background prefetch all items
      api.post("/api/company/session", {
        employeeId,
        password,
        userId: String(data.user.id),
      }).catch(() => {});

      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    const userId = user?.id;
    setUser(null);
    setToken(null);
    setFormToken(null);
    localStorage.removeItem("auth_user");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_form_token");
    if (userId) {
      fetch(`/api/company/session?userId=${encodeURIComponent(String(userId))}`, { method: "DELETE" }).catch(() => {});
    }
  };

  const updateProfile = (data: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...data };
      localStorage.setItem("auth_user", JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, formToken, login, logout, updateProfile, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
