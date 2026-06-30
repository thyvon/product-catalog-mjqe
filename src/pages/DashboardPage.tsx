import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { ShoppingBag, CheckCircle, XCircle, RefreshCw, Layers, Globe, Users, Eye } from "lucide-react";
import type { CatalogStats } from "../types";

interface VisitStats {
  liveVisitors: number;
  totalVisits: number;
  paths: { path: string; count: number }[];
  recent: { path: string; time: number }[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [visitStats, setVisitStats] = useState<VisitStats | null>(null);
  const [visitLoading, setVisitLoading] = useState(true);

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

  const fetchVisitStats = async () => {
    setVisitLoading(true);
    try {
      const res = await fetch("/api/visit/stats");
      if (res.ok) {
        const data = await res.json();
        setVisitStats(data);
      }
    } catch {
      // ignore
    } finally {
      setVisitLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchVisitStats();
    const interval = setInterval(fetchVisitStats, 15000);
    return () => clearInterval(interval);
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
      label: "Live Visitors",
      value: visitStats?.liveVisitors ?? 0,
      icon: Users,
      color: "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400",
    },
  ];

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const pathLabel = (p: string) => {
    const map: Record<string, string> = {
      "/": "Home",
      "/product-list": "Product List",
      "/dashboard": "Dashboard",
      "/catalog": "Catalog",
      "/supplier-register": "Supplier Register",
      "/supplier-docs": "Supplier Docs",
      "/login": "Login",
    };
    return map[p] || p;
  };

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
          onClick={() => { fetchStats(); fetchVisitStats(); }}
          className="p-2.5 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-500 dark:text-gray-400 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm cursor-pointer transition-all"
          title="Refresh stats"
        >
          <RefreshCw className={`w-4 h-4 ${loading || visitLoading ? "animate-spin" : ""}`} />
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

      {visitStats && (
        <div className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-cyan-500" />
            <h2 className="text-sm font-black text-slate-900 dark:text-gray-100">
              Live Visitor Activity
            </h2>
            {visitLoading ? (
              <RefreshCw className="w-3 h-3 animate-spin text-slate-400 ml-auto" />
            ) : (
              <span className="ml-auto text-[10px] font-mono text-slate-400 dark:text-gray-500">
                updates every 15s
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-slate-50/50 dark:bg-gray-800/30 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-slate-900 dark:text-gray-100">{visitStats.liveVisitors}</p>
              <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">Live Now</p>
            </div>
            <div className="bg-slate-50/50 dark:bg-gray-800/30 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-slate-900 dark:text-gray-100">{visitStats.totalVisits}</p>
              <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">Visits (5min)</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-mono font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-2">Pages Viewed</p>
            {visitStats.paths.map((p) => (
              <div key={p.path} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-50/30 dark:bg-gray-800/20">
                <div className="flex items-center gap-2 min-w-0">
                  <Eye className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-600 dark:text-gray-300 truncate">{pathLabel(p.path)}</span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-gray-100 ml-2">{p.count}</span>
              </div>
            ))}
          </div>

          {visitStats.recent.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-gray-800">
              <p className="text-[10px] font-mono font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-2">Recent Activity</p>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {visitStats.recent.slice(0, 10).map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-1 px-2">
                    <span className="text-[10px] font-mono text-slate-500 dark:text-gray-400">{pathLabel(r.path)}</span>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-gray-500">{formatTime(r.time)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
