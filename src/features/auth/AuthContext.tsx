import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface User {
  username: string;
  role: string;
  fullName?: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const VALID_CREDENTIALS = [
  { username: "admin", password: "admin", role: "Admin" },
  { username: "procurement", password: "procurement", role: "Procurement" },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("auth_user");
    return stored ? JSON.parse(stored) : null;
  });

  const login = (username: string, password: string): boolean => {
    const match = VALID_CREDENTIALS.find(
      (c) => c.username === username && c.password === password
    );
    if (match) {
      const user = { username: match.username, role: match.role };
      setUser(user);
      localStorage.setItem("auth_user", JSON.stringify(user));
      fetch(`/api/users/profile?username=${encodeURIComponent(username)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.fullName) updateProfile({ fullName: data.fullName });
        })
        .catch(() => {});
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("auth_user");
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
    <AuthContext.Provider value={{ user, login, logout, updateProfile, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
