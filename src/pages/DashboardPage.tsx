import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { ShoppingBag, CheckCircle, XCircle, Archive, RefreshCw, Layers, Sparkles } from "lucide-react";
import type { CatalogStats } from "../types";

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const statCards = [
    {
      label: "Total Products",
      value: stats?.totalProducts ?? 0,
      icon: Layers,
      color: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400",
    },
    {
      label: "Active",
      value: stats?.activeCount ?? 0,
      icon: CheckCircle,
      color: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Inactive",
      value: stats?.inactiveCount ?? 0,
      icon: XCircle,
      color: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
    },
    {
      label: "Discontinued",
      value: stats?.discontinuedCount ?? 0,
      icon: Archive,
      color: "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400",
    },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-gray-100 tracking-tight">
            Welcome back, {user?.username}
          </h1>
          <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
            Here's an overview of your product catalog.
          </p>
        </div>
        <button
          onClick={fetchStats}
          className="p-2.5 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-500 dark:text-gray-400 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm cursor-pointer transition-all"
          title="Refresh stats"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-xl ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-gray-100">
              {loading ? (
                <span className="inline-block w-12 h-6 bg-slate-200 dark:bg-gray-700 rounded animate-pulse" />
              ) : (
                card.value
              )}
            </p>
            <p className="text-xs font-bold text-slate-400 dark:text-gray-500 mt-1 uppercase tracking-wider">
              {card.label}
            </p>
          </div>
        ))}
      </div>

      {stats && stats.categoryStats && stats.categoryStats.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-black text-slate-900 dark:text-gray-100">
              Categories Breakdown
            </h2>
          </div>
          <div className="space-y-2">
            {stats.categoryStats.map((cat) => (
              <div
                key={cat.category}
                className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50/50 dark:bg-gray-800/30"
              >
                <span className="text-xs font-bold text-slate-600 dark:text-gray-300">
                  {cat.category}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    {cat.activeCount} active
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-900 dark:text-gray-100">
                    {cat.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <ShoppingBag className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-gray-100">
              Quick Navigation
            </h3>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 leading-relaxed">
              Use the sidebar to navigate to the <strong>Catalog</strong> module to manage
              products, SKUs, and inventory. Visit <strong>Supplier Docs</strong> to view
              vendor registration and onboarding guidelines.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
