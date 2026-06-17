import React from "react";
import {
  Layers,
  CheckCircle,
  ShieldAlert as ShieldWarning,
  XCircle as CloseCircle,
  RefreshCw as Refresh,
  ChartColumn as Chart,
} from "lucide-react";
import { CatalogStats } from "../types";
import { motion } from "motion/react";

interface StatsDashboardProps {
  stats: CatalogStats | null;
  loading: boolean;
  onRefresh: () => void;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export default function StatsDashboard({
  stats,
  loading,
  onRefresh,
  selectedCategory,
  onSelectCategory,
}: StatsDashboardProps) {
  if (loading || !stats) {
    return (
      <div id="stats-dashboard-loading" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl h-24 p-5 flex flex-col justify-between">
            <div className="h-3.5 bg-slate-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="h-6 bg-slate-200 dark:bg-gray-700 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  const maxCategoryCount = Math.max(...stats.categoryStats.map((c) => c.count), 1);

  return (
    <div id="stats-container" className="space-y-6 mb-8">
      {/* 4 Status-based Summary Card Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Stat 1: Total Registered */}
        <motion.div
          id="stat-all-products"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl p-5 hover:border-slate-200 dark:hover:border-gray-700 transition-colors duration-200 flex items-center justify-between shadow-sm"
        >
          <div>
            <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest block">
              Total Entries
            </span>
            <h3 className="text-2xl font-extrabold text-slate-800 dark:text-gray-100 mt-1 font-sans tracking-tight">
              {stats.totalProducts}
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-gray-400 font-sans block mt-1">
              Registered catalog items
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Stat 2: Active */}
        <motion.div
          id="stat-active"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl p-5 hover:border-slate-200 dark:hover:border-gray-700 transition-colors duration-200 flex items-center justify-between shadow-sm"
        >
          <div>
            <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest block">
              Active Items
            </span>
            <h3 className="text-2xl font-extrabold text-emerald-600 mt-1 font-sans tracking-tight">
              {stats.activeCount}
            </h3>
            <span className="text-[11px] text-emerald-500 dark:text-emerald-400 font-sans block mt-1">
              Available in production view
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/50 text-emerald-650 dark:text-emerald-400 flex items-center justify-center animate-pulse">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
          </div>
        </motion.div>

        {/* Stat 3: Inactive */}
        <motion.div
          id="stat-inactive"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl p-5 hover:border-slate-200 dark:hover:border-gray-700 transition-colors duration-200 flex items-center justify-between shadow-sm"
        >
          <div>
            <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest block">
              Inactive Items
            </span>
            <h3 className="text-2xl font-extrabold text-amber-600 mt-1 font-sans tracking-tight">
              {stats.inactiveCount}
            </h3>
            <span className="text-[11px] text-amber-500 dark:text-amber-400 font-sans block mt-1">
              Hidden from casual previewers
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <ShieldWarning className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Stat 4: Discontinued */}
        <motion.div
          id="stat-discontinued"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.15 }}
          className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl p-5 hover:border-slate-200 dark:hover:border-gray-700 transition-colors duration-200 flex items-center justify-between shadow-sm"
        >
          <div>
            <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest block">
              Discontinued
            </span>
            <h3 className="text-2xl font-extrabold text-rose-600 mt-1 font-sans tracking-tight">
              {stats.discontinuedCount}
            </h3>
            <span className="text-[11px] text-rose-500 dark:text-rose-400 font-medium font-sans block mt-1 cursor-pointer hover:underline" onClick={onRefresh}>
              Click to reload from database
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-900/50 text-rose-500 dark:text-rose-400 flex items-center justify-center">
            <CloseCircle className="w-5 h-5" />
          </div>
        </motion.div>
      </div>

      {/* Category distribution panel */}
      <motion.div
        id="category-stats-card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-gray-100 flex items-center gap-1.5 font-sans">
              <Chart className="w-4 h-4 text-slate-500 dark:text-gray-400" />
              Category Breakdown
            </h3>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
              Click a pill or bar to quick-filter your current grid products
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 bg-slate-50 dark:bg-gray-800 p-1 rounded-xl">
            <button
              id="category-pill-all"
              onClick={() => onSelectCategory("")}
              className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                selectedCategory === ""
                  ? "bg-white dark:bg-gray-700 text-slate-800 dark:text-gray-100 shadow-sm border border-slate-100 dark:border-gray-700"
                  : "text-slate-500 dark:text-gray-400 hover:text-slate-850 dark:hover:text-gray-200"
              }`}
            >
              All Categories ({stats.totalProducts})
            </button>
            {stats.categoryStats.map((item) => (
              <button
                key={item.category}
                id={`category-pill-${item.category.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => onSelectCategory(item.category)}
                className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                  selectedCategory === item.category
                    ? "bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow-sm border border-slate-100 dark:border-gray-700 font-bold"
                    : "text-slate-500 dark:text-gray-400 hover:text-slate-850 dark:hover:text-gray-200"
                }`}
              >
                {item.category} ({item.count})
              </button>
            ))}
          </div>
        </div>

        {/* Visual Bar Graphs Grid */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {stats.categoryStats.map((item) => {
              const countPercent = Math.round((item.count / maxCategoryCount) * 100);
              const isSelected = selectedCategory === "" || selectedCategory === item.category;

              return (
                <div
                  key={item.category}
                  onClick={() => onSelectCategory(item.category === selectedCategory ? "" : item.category)}
                  className={`group cursor-pointer space-y-1.5 p-3 rounded-xl border transition-all ${
                    isSelected 
                      ? "border-indigo-100/40 dark:border-indigo-800/40 bg-indigo-50/10 dark:bg-indigo-900/10 hover:bg-indigo-50/20 dark:hover:bg-indigo-900/20" 
                      : "border-transparent opacity-45 hover:opacity-75"
                  }`}
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {item.category}
                    </span>
                    <span className="font-mono font-bold text-slate-500 dark:text-gray-400 text-[11px]">
                      {item.count} {item.count === 1 ? "item" : "items"} <span className="text-slate-300 dark:text-gray-600 font-normal">({item.activeCount} active)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${countPercent}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-indigo-500 to-indigo-650 rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
