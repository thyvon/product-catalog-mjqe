import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { CheckCircle, XCircle, RefreshCw, Layers, Globe, Users, Eye, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { FormLabel } from "@/features/shared/components/FormLabel";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import PageContent from "@/features/shared/components/PageContent";
import SpendAnalyticsCard from "@/features/dashboard/components/SpendAnalyticsCard";
import { productsApi } from "@/features/products/api";
import { dashboardApi } from "@/features/dashboard/api";

const chartConfig = {
  visits: { label: "Visits", color: "var(--color-primary)" },
  visitors: { label: "Visitors", color: "var(--color-chart-2)" },
} as const;

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: stats, isLoading: loading } = useQuery({
    queryKey: ["products", "stats"],
    queryFn: productsApi.getStats,
  });

  const { data: visitStats, isLoading: visitLoading } = useQuery({
    queryKey: ["visit-stats"],
    queryFn: dashboardApi.getVisitStats,
    refetchInterval: 15000,
  });

  const statCards = [
    {
      label: "Total Products",
      value: stats?.totalProducts ?? 0,
      icon: Layers,
      color: "bg-muted text-foreground",
    },
    {
      label: "Active",
      value: stats?.activeProducts ?? 0,
      icon: CheckCircle,
      color: "bg-muted text-foreground",
    },
    {
      label: "Inactive",
      value: (stats?.totalProducts ?? 0) - (stats?.activeProducts ?? 0),
      icon: XCircle,
      color: "bg-muted text-muted-foreground",
    },
    {
      label: "Live Visitors",
      value: visitStats?.liveVisitors ?? 0,
      icon: Users,
      color: "bg-muted text-foreground",
    },
  ];

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const pathLabel = (p: string) => {
    const map: Record<string, string> = {
      "/": "Dashboard",
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
    <PageContent className="p-3 lg:p-5">
      <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">
            Welcome back, {user?.fullName || user?.username}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Here's an overview of your product catalog.
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger render={<Button
          variant="outline"
          size="icon"
        >
          <RefreshCw className={loading || visitLoading ? "animate-spin" : ""} />
        </Button>} />
          <TooltipContent>Refresh stats</TooltipContent>
        </Tooltip>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`p-2 rounded-xl shrink-0 ${card.color}`}>
                <card.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-foreground leading-tight">
                  {loading ? (
                    <span className="inline-block w-10 h-5 bg-muted rounded animate-pulse" />
                  ) : (
                    card.value
                  )}
                </p>
                <p className="text-[11px] font-medium text-muted-foreground mt-0.5 uppercase tracking-wider truncate">
                  {card.label}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <SpendAnalyticsCard />

        {visitStats && (
            <Card className="h-full">
              <CardHeader className="flex-row items-center gap-2 space-y-0 pb-2">
                <Globe className="w-4 h-4 text-foreground shrink-0" />
                <CardTitle className="text-sm">Live Visitor Activity</CardTitle>
                {visitLoading ? (
                  <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground ml-auto" />
                ) : (
                  <span className="ml-auto text-xs font-mono text-muted-foreground">
                    updates every 15s
                  </span>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-muted/50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-foreground">{visitStats.liveVisitors}</p>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Live Now</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-foreground">{visitStats.totalVisits}</p>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Visits (5min)</p>
                  </div>
                </div>

                {(visitStats.timeline?.length ?? 0) > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                      <FormLabel variant="mono" className="mb-0">Traffic Over Time</FormLabel>
                    </div>
                    <ChartContainer config={chartConfig} className="h-[220px] w-full">
                      <AreaChart data={visitStats.timeline} margin={{ left: -24, right: 8 }}>
                        <defs>
                          <linearGradient id="fillVisits" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-visits)" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="var(--color-visits)" stopOpacity={0.05} />
                          </linearGradient>
                          <linearGradient id="fillVisitors" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-visitors)" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="var(--color-visitors)" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tickMargin={8} />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                        <Area dataKey="visits" type="monotone" fill="url(#fillVisits)" stroke="var(--color-visits)" strokeWidth={2} />
                        <Area dataKey="visitors" type="monotone" fill="url(#fillVisitors)" stroke="var(--color-visitors)" strokeWidth={2} />
                        <ChartLegend content={<ChartLegendContent />} />
                      </AreaChart>
                    </ChartContainer>
                  </div>
                )}

                <div className="space-y-2">
                  <FormLabel variant="mono" className="mb-2">Pages Viewed</FormLabel>
                  {visitStats.paths.map((p) => (
                    <div key={p.path} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 min-w-0">
                        <Eye className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="text-xs font-bold text-foreground truncate">{pathLabel(p.path)}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-foreground ml-2">{p.count}</span>
                    </div>
                  ))}
                </div>

                {visitStats.recent.length > 0 && (
                  <><Separator className="my-4" />
                  <div className="pt-3">
                    <FormLabel variant="mono" className="mb-2">Recent Activity</FormLabel>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {visitStats.recent.slice(0, 10).map((r, i) => (
                        <div key={i} className="flex items-center justify-between py-1 px-2">
                          <span className="text-xs font-mono text-muted-foreground">{pathLabel(r.path)}</span>
                          <span className="text-xs font-mono text-muted-foreground">{formatTime(r.time)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>)}
              </CardContent>
            </Card>
          )}
    </div>
    </PageContent>
  );
}
