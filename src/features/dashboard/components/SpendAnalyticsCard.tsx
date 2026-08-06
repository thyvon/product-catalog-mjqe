import { useState, useEffect, useCallback, useRef } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { RefreshCw, Building2, Package, Coins, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import DatePicker from "@/features/shared/components/DatePicker";
import SelectField from "@/features/shared/components/SelectField";
import { FormLabel } from "@/features/shared/components/FormLabel";
import { formatAmount } from "@/features/shared/utils/format";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { useToast } from "@/features/shared/components/Toast";

interface DimensionRow {
  key: string;
  count: number;
  quantity: number;
  amount: number;
}

interface TopRow {
  itemCode: string;
  description: string;
  uom: string;
  count: number;
  quantity: number;
  amount: number;
}

interface TrendRow {
  month: string;
  count: number;
  quantity: number;
  amount: number;
}

interface YoYRow {
  label: string;
  current: number;
  previous: number;
  gap: number;
}

interface AnalyticsData {
  summary: { totalItems: number; totalQuantity: number; totalAmount: number };
  previousSummary: { totalItems: number; totalQuantity: number; totalAmount: number; startDate: string; endDate: string };
  trend: TrendRow[];
  yoyCompare: YoYRow[];
  byCampus: DimensionRow[];
  byDepartment: DimensionRow[];
  byDivision: DimensionRow[];
  byWarehouse: DimensionRow[];
  byRequester: DimensionRow[];
  byType: DimensionRow[];
  topByCount: TopRow[];
  topByAmount: TopRow[];
}

const DIMENSION_TABS = [
  { id: "campus", label: "Campus", dataKey: "byCampus" },
  { id: "department", label: "Department", dataKey: "byDepartment" },
  { id: "division", label: "Division", dataKey: "byDivision" },
  { id: "warehouse", label: "Warehouse", dataKey: "byWarehouse" },
  { id: "requester", label: "Requester", dataKey: "byRequester" },
  { id: "type", label: "Type", dataKey: "byType" },
] as const;

const compareConfig = {
  current: { label: "This Year", color: "var(--color-primary)" },
  previous: { label: "Last Year", color: "var(--color-muted-foreground)" },
} as const;

interface FilterValues {
  warehouses: string[];
  departments: string[];
  divisions: string[];
  campuses: string[];
  transactionTypes: string[];
}

export default function SpendAnalyticsCard() {
  const { toast } = useToast();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("campus");

  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [top, setTop] = useState("10");
  const [warehouse, setWarehouse] = useState("");
  const [division, setDivision] = useState("");
  const [department, setDepartment] = useState("");
  const [campus, setCampus] = useState("");
  const [transactionType, setTransactionType] = useState("Issue");
  const [filterValues, setFilterValues] = useState<FilterValues>({
    warehouses: [],
    departments: [],
    divisions: [],
    campuses: [],
    transactionTypes: [],
  });

  useEffect(() => {
    const fetchFilterValues = async () => {
      try {
        const res = await fetch("/api/stock-issue-items/filters/values");
        if (res.ok) setFilterValues(await res.json());
      } catch {
        // ignore
      }
    };
    fetchFilterValues();
  }, []);

  const fetchAnalytics = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("startDate", startDate);
      params.set("endDate", endDate);
      const topNum = Math.max(1, Math.min(100, Number(top) || 10));
      params.set("top", String(topNum));
      if (warehouse) params.set("warehouse", warehouse);
      if (division) params.set("division", division);
      if (department) params.set("department", department);
      if (campus) params.set("campus", campus);
      if (transactionType) params.set("transactionType", transactionType);
      const res = await fetch(`/api/stock-issue-items/analytics?${params}`);
      if (!res.ok) throw new Error((await res.json()).error || "Failed to load analytics.");
      const json = await res.json();
      setData({
        ...json,
        summary: json.summary || { totalItems: 0, totalQuantity: 0, totalAmount: 0 },
        previousSummary: json.previousSummary || { totalItems: 0, totalQuantity: 0, totalAmount: 0, startDate: "", endDate: "" },
        trend: json.trend || [],
        yoyCompare: json.yoyCompare || [],
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, top, warehouse, division, department, campus, transactionType, toast]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!startDate || !endDate) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchAnalytics, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [startDate, endDate, top, warehouse, division, department, campus, transactionType, fetchAnalytics]);

  const dimensionRows: DimensionRow[] = data
    ? (data[DIMENSION_TABS.find((t) => t.id === activeTab)?.dataKey as keyof AnalyticsData] as DimensionRow[])
    : [];

  const totalAmount = data?.summary.totalAmount ?? 0;
  const prevAmount = data?.previousSummary.totalAmount ?? 0;
  const changePct = prevAmount > 0 ? ((totalAmount - prevAmount) / prevAmount) * 100 : null;

  const yoyGapTotal = data?.yoyCompare.reduce((s, r) => s + r.gap, 0) ?? 0;
  const yoyPrevTotal = data?.yoyCompare.reduce((s, r) => s + r.previous, 0) ?? 0;
  const yoyPct = yoyPrevTotal > 0 ? (yoyGapTotal / yoyPrevTotal) * 100 : null;

  const renderBars = (rows: { key: string; amount: number; sub?: string }[], emptyHint?: string) => {
    const max = Math.max(1, ...rows.map((r) => r.amount));
    if (rows.length === 0) {
      return (
        <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
          <Building2 className="mr-2 h-4 w-4" /> {emptyHint ?? "No data for this range."}
        </div>
      );
    }
    return (
      <div className="space-y-1.5">
        {rows.map((r) => {
          const pct = totalAmount > 0 ? (r.amount / totalAmount) * 100 : 0;
          return (
            <div key={r.key} className="relative overflow-hidden rounded-lg bg-muted/30 px-2.5 py-2">
              <div
                className="absolute inset-y-0 left-0 bg-primary/10"
                style={{ width: `${Math.max(2, (r.amount / max) * 100)}%` }}
              />
              <div className="relative flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{r.key}</span>
                <span className="shrink-0 text-right">
                  <span className="text-xs font-mono font-medium text-foreground">{formatAmount(r.amount)}</span>
                  <span className="ml-2 text-[10px] font-mono text-muted-foreground">
                    {pct > 0 ? `${pct.toFixed(1)}%` : ""}
                    {r.sub ? ` · ${r.sub}` : ""}
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDimensionTable = (rows: DimensionRow[]) => (
    <div className="max-h-64 overflow-y-auto rounded-lg border border-border/50">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-muted/70 backdrop-blur">
          <tr className="text-left text-muted-foreground uppercase tracking-wider">
            <th className="px-2.5 py-2 font-medium">Name</th>
            <th className="px-2.5 py-2 font-medium text-right">Lines</th>
            <th className="px-2.5 py-2 font-medium text-right">Qty</th>
            <th className="px-2.5 py-2 font-medium text-right">Amount</th>
            <th className="px-2.5 py-2 font-medium text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-2.5 py-4 text-center text-muted-foreground">No data for this range.</td>
            </tr>
          )}
          {rows.map((r) => {
            const share = totalAmount > 0 ? (r.amount / totalAmount) * 100 : 0;
            return (
              <tr key={r.key} className="border-t border-border/50">
                <td className="px-2.5 py-1.5 font-medium text-foreground">{r.key}</td>
                <td className="px-2.5 py-1.5 text-right font-mono text-muted-foreground">{r.count}</td>
                <td className="px-2.5 py-1.5 text-right font-mono text-muted-foreground">{r.quantity}</td>
                <td className="px-2.5 py-1.5 text-right font-mono font-medium text-foreground">{formatAmount(r.amount)}</td>
                <td className="px-2.5 py-1.5 text-right font-mono text-muted-foreground">{share.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderTopList = (rows: TopRow[], metric: "count" | "amount") => (
    <div className="space-y-1.5">
      {rows.length === 0 && (
        <p className="py-4 text-center text-xs text-muted-foreground">No data for this range.</p>
      )}
      {rows.map((r, i) => {
        const share = totalAmount > 0 ? (r.amount / totalAmount) * 100 : 0;
        return (
          <div key={`${r.itemCode}-${i}`} className="relative flex items-center gap-2.5 overflow-hidden rounded-lg bg-muted/30 px-2.5 py-1.5">
            <div
              className="absolute inset-y-0 left-0 bg-primary/10"
              style={{ width: `${Math.max(2, share)}%` }}
            />
            <span className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground">
              {i + 1}
            </span>
            <div className="relative min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">
                {r.itemCode}
                {r.uom ? <span className="text-muted-foreground"> · {r.uom}</span> : null}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">{r.description}</p>
            </div>
            <div className="relative text-right">
              <p className="text-xs font-mono font-medium text-foreground">
                {metric === "count" ? `${r.count} lines` : formatAmount(r.amount)}
              </p>
              <p className="text-[11px] font-mono text-muted-foreground">
                {metric === "count"
                  ? `${r.quantity} qty · ${formatAmount(r.amount)}`
                  : `${r.count} lines · ${r.quantity} qty`}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );

  const activeDim = DIMENSION_TABS.find((t) => t.id === activeTab)?.label ?? "";

  const option = (list: string[]) => list.map((v) => ({ value: v, label: v }));

  return (
    <div className="space-y-4">
      {/* Filters + KPIs */}
      <Card size="sm">
        <CardHeader className="flex-row items-center gap-2 space-y-0 px-3 pt-1 pb-0.5">
          <Coins className="w-4 h-4 text-foreground shrink-0" />
          <CardTitle className="text-sm">Stock Spend Analytics</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-7 w-7"
            onClick={fetchAnalytics}
            disabled={loading}
          >
            <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-8">
            <div>
              <FormLabel>From</FormLabel>
              <DatePicker value={startDate} onChange={setStartDate} placeholder="Start date" />
            </div>
            <div>
              <FormLabel>To</FormLabel>
              <DatePicker value={endDate} onChange={setEndDate} placeholder="End date" />
            </div>
            <div>
              <FormLabel>Top N</FormLabel>
              <Input type="number" min={1} max={100} value={top} onChange={(e) => setTop(e.target.value)} />
            </div>
            <div>
              <FormLabel>Warehouse</FormLabel>
              <SelectField value={warehouse} onChange={setWarehouse} placeholder="All" options={option(filterValues.warehouses)} />
            </div>
            <div>
              <FormLabel>Department</FormLabel>
              <SelectField value={department} onChange={setDepartment} placeholder="All" options={option(filterValues.departments)} />
            </div>
            <div>
              <FormLabel>Division</FormLabel>
              <SelectField value={division} onChange={setDivision} placeholder="All" options={option(filterValues.divisions)} />
            </div>
            <div>
              <FormLabel>Campus</FormLabel>
              <SelectField value={campus} onChange={setCampus} placeholder="All" options={option(filterValues.campuses)} />
            </div>
            <div>
              <FormLabel>Type</FormLabel>
              <SelectField value={transactionType} onChange={setTransactionType} placeholder="All Types" options={[{ value: "", label: "All Types" }, ...option(filterValues.transactionTypes)]} />
            </div>
          </div>

          {data && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Spend</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <p className="text-xl font-bold text-foreground">{formatAmount(totalAmount)}</p>
                  <ChangeBadge value={changePct} />
                </div>
                <p className="mt-0.5 text-[10px] font-mono text-muted-foreground">
                  vs {formatDisplayPeriod(data.previousSummary.startDate, data.previousSummary.endDate)}
                </p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Request Lines</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <p className="text-xl font-bold text-foreground">{data.summary.totalItems.toLocaleString()}</p>
                  <span className="text-xs font-mono text-muted-foreground">
                    {data.previousSummary.totalItems > 0
                      ? `${(((data.summary.totalItems - data.previousSummary.totalItems) / data.previousSummary.totalItems) * 100).toFixed(1)}%`
                      : ""}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] font-mono text-muted-foreground">vs previous period</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Qty</p>
                <p className="mt-1 text-xl font-bold text-foreground">{data.summary.totalQuantity.toLocaleString()}</p>
                <p className="mt-0.5 text-[10px] font-mono text-muted-foreground">all request lines</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Year-over-Year comparison */}
      {data && data.yoyCompare.length > 0 && (
        <Card size="sm">
          <CardHeader className="flex-row items-center gap-2 space-y-0 px-3 pt-2 pb-1">
            <TrendingUp className="w-4 h-4 text-foreground shrink-0" />
            <CardTitle className="text-sm">Monthly Spend Comparison</CardTitle>
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
              {yoyGapTotal === 0 ? (
                <Minus className="h-3.5 w-3.5" />
              ) : yoyGapTotal > 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-amber-600" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-emerald-600" />
              )}
              Net gap {yoyGapTotal > 0 ? "+" : ""}{formatAmount(yoyGapTotal)}
              {yoyPct !== null && <span className="text-muted-foreground">({Math.abs(yoyPct).toFixed(1)}%)</span>}
            </span>
          </CardHeader>
          <CardContent>
            <ChartContainer config={compareConfig} className="h-[260px] w-full">
              <AreaChart data={data.yoyCompare} margin={{ left: -24, right: 8 }}>
                <defs>
                  <linearGradient id="fillCurrent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-current)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--color-current)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="fillPrevious" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-previous)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-previous)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="previous" fill="url(#fillPrevious)" stroke="var(--color-previous)" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="current" fill="url(#fillCurrent)" stroke="var(--color-current)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 4 }} />
                <ChartLegend content={<ChartLegendContent />} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Breakdown by dimension */}
      <Card size="sm">
        <CardHeader className="flex-row items-center gap-2 space-y-0 px-3 pt-2 pb-1">
          <Building2 className="w-4 h-4 text-foreground shrink-0" />
          <CardTitle className="text-sm">Breakdown by {activeDim}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-3">
            <TabsList className="w-full grid h-auto grid-cols-3 gap-1.5 bg-transparent p-0 sm:grid-cols-6">
              {DIMENSION_TABS.map((t) => (
                <TabsTrigger key={t.id} value={t.id} className="w-full cursor-pointer justify-center border border-border bg-transparent py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground data-active:border-black data-active:bg-black data-active:text-white data-active:hover:bg-black data-active:hover:text-white dark:border-border dark:data-active:border-white dark:data-active:bg-white dark:data-active:text-black dark:data-active:hover:bg-white dark:data-active:hover:text-black">{t.label}</TabsTrigger>
              ))}
            </TabsList>
            {DIMENSION_TABS.map((t) => (
              <TabsContent key={t.id} value={t.id}>
                <div className="mb-3">{renderBars(dimensionRows.slice(0, 12).map((r) => ({ key: r.key, amount: r.amount, sub: `${r.count} lines` })))}</div>
                {renderDimensionTable(dimensionRows)}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Top lists */}
      {data && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card size="sm">
            <CardHeader className="flex-row items-center gap-2 space-y-0 px-3 pt-2 pb-1">
              <Package className="w-4 h-4 text-foreground shrink-0" />
              <CardTitle className="text-sm">Top Products by Requests</CardTitle>
            </CardHeader>
            <CardContent>{renderTopList(data.topByCount, "count")}</CardContent>
          </Card>
          <Card size="sm">
            <CardHeader className="flex-row items-center gap-2 space-y-0 px-3 pt-2 pb-1">
              <Coins className="w-4 h-4 text-foreground shrink-0" />
              <CardTitle className="text-sm">Top by Spend</CardTitle>
            </CardHeader>
            <CardContent>{renderTopList(data.topByAmount, "amount")}</CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function ChangeBadge({ value }: { value: number | null }) {
  if (value === null) {
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  }
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-mono font-medium ${up ? "text-amber-600" : "text-emerald-600"}`}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function formatDisplayPeriod(start: string, end: string) {
  if (!start || !end) return "prev. period";
  const s = start.slice(0, 10).split("-");
  const e = end.slice(0, 10).split("-");
  const mo = (d: string[]) => `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(d[1]) - 1] ?? d[1]}`;
  return `${mo(s)} ${s[0]} – ${mo(e)} ${e[0]}`;
}
