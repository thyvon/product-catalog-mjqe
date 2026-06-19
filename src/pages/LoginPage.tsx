import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { PackageOpen, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }
    const success = login(username.trim(), password);
    if (success) {
      navigate("/dashboard");
    } else {
      setError("Invalid username or password.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50/50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-100 dark:border-gray-800 shadow-sm p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl mb-4">
              <PackageOpen className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-gray-100 tracking-tight">
              Product Catalog
            </h1>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-1 font-medium">
              Sign in to your account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-gray-400 mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full px-4 py-2.5 border border-slate-200 dark:border-gray-700 rounded-xl text-sm bg-slate-50/20 dark:bg-gray-800/50 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-gray-200 placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-gray-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-2.5 pr-10 border border-slate-200 dark:border-gray-700 rounded-xl text-sm bg-slate-50/20 dark:bg-gray-800/50 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-gray-200 placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-rose-500 font-medium bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/30 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-bold text-sm rounded-xl cursor-pointer transition-all shadow-sm"
            >
              Sign In
            </button>
          </form>

          <p className="text-[10px] text-slate-400 dark:text-gray-600 text-center mt-6 font-mono">
            Demo: admin / admin
          </p>
        </div>
      </div>
    </div>
  );
}
