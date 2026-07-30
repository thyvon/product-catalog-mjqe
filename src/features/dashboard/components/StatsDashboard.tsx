import {
  Layers,
  CheckCircle,
  ShieldAlert as ShieldWarning,
  RefreshCw as Refresh,
  ChartColumn as Chart,
} from "lucide-react";
import { CatalogStats } from "@/features/shared/types";
import { motion } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { FormLabel } from "@/features/shared/components/FormLabel";

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
          <Card key={i} className="animate-pulse h-24">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="h-3.5 bg-muted rounded w-1/3"></div>
              <div className="h-6 bg-muted rounded w-2/3"></div>
            </CardContent>
          </Card>
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
        >
          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <FormLabel variant="mono">Total Entries</FormLabel>
                <h3 className="text-2xl font-bold text-foreground mt-1 font-sans tracking-tight">
                  {stats.totalProducts}
                </h3>
                <span className="text-xs text-muted-foreground font-sans block mt-1">
                  Registered catalog items
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-muted text-foreground flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stat 2: Active */}
        <motion.div
          id="stat-active"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
        >
          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <FormLabel variant="mono">Active Items</FormLabel>
                <h3 className="text-2xl font-bold text-foreground mt-1 font-sans tracking-tight">
                  {stats.activeCount}
                </h3>
                <span className="text-xs text-foreground font-sans block mt-1">
                  Available in production view
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-muted text-foreground flex items-center justify-center animate-pulse">
                <CheckCircle className="w-5 h-5 text-foreground" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stat 3: Inactive */}
        <motion.div
          id="stat-inactive"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <FormLabel variant="mono">Inactive Items</FormLabel>
                <h3 className="text-2xl font-bold text-muted-foreground mt-1 font-sans tracking-tight">
                  {stats.inactiveCount}
                </h3>
                <span className="text-xs text-muted-foreground font-sans block mt-1">
                  Hidden from casual previewers
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-muted text-muted-foreground flex items-center justify-center">
                <ShieldWarning className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

      </div>

      {/* Category distribution panel */}
      <motion.div
        id="category-stats-card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
      >
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 font-sans">
                  <Chart className="w-4 h-4 text-muted-foreground" />
                  Category Breakdown
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click a pill or bar to quick-filter your current grid products
                </p>
              </div>

          <div className="flex flex-wrap gap-1.5 bg-muted p-1 rounded-xl">
            <button
              id="category-pill-all"
              onClick={() => onSelectCategory("")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                selectedCategory === ""
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Categories ({stats.totalProducts})
            </button>
            {stats.categoryStats.map((item) => (
              <button
                key={item.category}
                id={`category-pill-${item.category.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => onSelectCategory(item.category)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  selectedCategory === item.category
                    ? "bg-card text-primary shadow-sm border border-border font-bold"
                    : "text-muted-foreground hover:text-foreground"
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
                      ? "border-border/40 bg-muted/10 hover:bg-muted/20" 
                      : "border-transparent opacity-45 hover:opacity-75"
                  }`}
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-foreground group-hover:text-foreground transition-colors">
                      {item.category}
                    </span>
                    <span className="font-mono font-bold text-muted-foreground text-xs">
                      {item.count} {item.count === 1 ? "item" : "items"} <span className="text-muted-foreground/60 font-normal">({item.activeCount} active)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${countPercent}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-primary to-primary rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
