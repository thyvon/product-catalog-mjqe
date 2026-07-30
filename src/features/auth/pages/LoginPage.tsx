import React, { useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { useNavigate } from "react-router-dom";
import { PackageOpen, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormLabel } from "@/features/shared/components/FormLabel";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Please enter username and password.");
      return;
    }

    const success = login(username, password);
    if (success) {
      navigate("/", { replace: true });
    } else {
      setError("Invalid username or password.");
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
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive font-medium">
              {error}
            </div>
          )}

          <div>
            <FormLabel variant="mono">Username</FormLabel>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
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

          <Button type="submit" className="w-full">
            Sign In
          </Button>

          <p className="text-xs text-center text-muted-foreground font-mono">
            Demo: admin / admin
          </p>
        </form>
      </div>
    </div>
  );
}
