import React, { useState } from "react";
import { useAuth, type AuthMode } from "@/features/auth/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { PackageOpen, Eye, EyeOff, Monitor, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormLabel } from "@/features/shared/components/FormLabel";

const MODE_TABS: { mode: AuthMode; label: string; icon: React.ReactNode }[] = [
  { mode: "local", label: "My System", icon: <Monitor className="w-3.5 h-3.5" /> },
  { mode: "epurchase", label: "E-Purchase", icon: <ShoppingCart className="w-3.5 h-3.5" /> },
];

export default function LoginPage() {
  const { loginLocal, loginEpurchase } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<AuthMode>("local");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/";

  const switchMode = (next: AuthMode) => {
    if (next === mode) return;
    setMode(next);
    setError("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!identifier.trim() || !password.trim()) {
      setError(
        mode === "local"
          ? "Please enter your username and password."
          : "Please enter employee ID and password."
      );
      return;
    }

    setLoading(true);
    const result =
      mode === "local"
        ? await loginLocal(identifier.trim(), password)
        : await loginEpurchase(identifier.trim(), password);
    setLoading(false);

    if (result.ok) {
      navigate(from, { replace: true });
    } else {
      setError(result.error || "Login failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-muted to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-lg mb-4">
            <PackageOpen className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            Product Catalog
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Sign in to your account
          </p>
        </div>

        <form onSubmit={handleLogin} className="bg-card rounded-2xl shadow-xl p-6 space-y-4">
          <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-xl">
            {MODE_TABS.map((tab) => (
              <button
                key={tab.mode}
                type="button"
                onClick={() => switchMode(tab.mode)}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  mode === tab.mode
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive font-medium">
              {error}
            </div>
          )}

          <div>
            <FormLabel variant="mono">{mode === "local" ? "Username" : "Employee ID"}</FormLabel>
            <Input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={mode === "local" ? "Enter your username" : "Enter your employee ID"}
              autoFocus
            />
          </div>

          <div>
            <FormLabel variant="mono">Password</FormLabel>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1 top-1/2 -translate-y-1/2"
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>

          <p className="text-xs text-center text-muted-foreground font-mono">
            {mode === "local"
              ? "Contact admin for account access"
              : "Verified securely with E-Purchase — your password is never stored"}
          </p>
        </form>
      </div>
    </div>
  );
}
