import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { GitMerge, SquarePen, RefreshCw, X, Lock as LockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/features/shared/components/Toast";
import DataTable from "@/features/shared/components/DataTable";
import PageContent from "@/features/shared/components/PageContent";
import ListPageLayout from "@/features/shared/components/ListPageLayout";
import PmMergeVariationModal from "@/features/product-management/components/PmMergeVariationModal";
import type { CompanyItem } from "@/features/company-products/types";
import type { PMProduct } from "@/features/shared/types";
import { pmLinkedEpurchaseCodes, pmProducts } from "@/features/product-management/api";
import { useAuth } from "@/features/auth/AuthContext";

const companyItemsApi = {
  list: async (params: URLSearchParams): Promise<{ data: CompanyItem[]; recordsFiltered: number; recordsTotal: number }> => {
    const headers: Record<string, string> = {};
    const jwt = localStorage.getItem("auth_jwt");
    if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
    const res = await fetch(`/api/company/items?${params.toString()}`, { headers });
    if (res.status === 401) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.code === "EPURCHASE_REQUIRED" ? "EPURCHASE_REQUIRED" : "UNAUTHORIZED");
    }
    if (!res.ok) throw new Error("Failed to fetch company items.");
    return res.json();
  },
};

const isAuthError = (err: unknown): boolean =>
  err instanceof Error && (err.message === "EPURCHASE_REQUIRED" || err.message === "UNAUTHORIZED");

export default function CompanyItemsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout, authMode } = useAuth();
  const queryClient = useQueryClient();
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeableProducts, setMergeableProducts] = useState<PMProduct[]>([]);
  const [epurchaseCodeMap, setEpurchaseCodeMap] = useState<{ productId: string; epurchaseItemCode: string }[]>([]);
  const [fetchingMerge, setFetchingMerge] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(inputValue);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      draw: "1",
      start: String((currentPage - 1) * pageSize),
      length: String(pageSize),
      "search[value]": searchQuery,
      "search[regex]": "false",
      "order[0][column]": "11",
      "order[0][dir]": "desc",
    });
    return params.toString();
  }, [currentPage, pageSize, searchQuery]);

  const { data, isLoading: loading, isError, error, refetch } = useQuery({
    queryKey: ["company-items", queryParams],
    queryFn: () => companyItemsApi.list(new URLSearchParams(queryParams)),
    placeholderData: (prev) => prev,
    retry: (failureCount, err) => (isAuthError(err) ? false : failureCount < 1),
  });

  const rows = useMemo(() => data?.data ?? [], [data]);
  const total = data?.recordsFiltered ?? data?.recordsTotal ?? 0;

  const errKind = isError && error instanceof Error ? error.message : null;
  const requiresEpurchaseLogin = errKind === "EPURCHASE_REQUIRED" && authMode !== "epurchase";
  const epurchaseSessionExpired = errKind === "EPURCHASE_REQUIRED" && authMode === "epurchase";

  // Local JWT expired/invalid — end the session like any other protected route
  useEffect(() => {
    if (errKind === "UNAUTHORIZED") {
      logout();
      navigate("/login");
    }
  }, [errKind, logout, navigate]);

  const { data: linkedCodesData } = useQuery({
    queryKey: ["pm-linked-codes"],
    queryFn: pmLinkedEpurchaseCodes,
  });

  const linkedCodes = useMemo(() => new Set(linkedCodesData ?? []), [linkedCodesData]);

  const toggleSelect = (itemCode: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemCode)) next.delete(itemCode);
      else next.add(itemCode);
      return next;
    });
  };

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.ItemCode));

  const selectedItems = useMemo(
    () => rows.filter((r) => selected.has(r.ItemCode)),
    [rows, selected]
  );

  const selectedLinkedCount = selectedItems.filter((r) => linkedCodes.has(r.ItemCode)).length;

  const handleMergeClick = async () => {
    setFetchingMerge(true);
    try {
      const products: PMProduct[] = [];
      const codeMap: { productId: string; epurchaseItemCode: string }[] = [];

      for (const item of selectedItems) {
        if (!linkedCodes.has(item.ItemCode)) continue;
        try {
          const result = await pmProducts({ search: item.ItemCode, pageSize: "10" });
          const match = result.data.find((p) => p.epurchase_item_code === item.ItemCode);
          if (match && match.product_type === "single") {
            products.push(match);
            codeMap.push({ productId: match.id, epurchaseItemCode: item.ItemCode });
          }
        } catch {
          // Skip items that fail to fetch
        }
      }

      if (products.length < 2) {
        toast.error("Need at least 2 linked single products to merge.");
        return;
      }

      setMergeableProducts(products);
      setEpurchaseCodeMap(codeMap);
      setMergeOpen(true);
    } finally {
      setFetchingMerge(false);
    }
  };

  const columns = useMemo<ColumnDef<CompanyItem, unknown>[]>(() => [
    {
      id: "select",
      header: () => (
        <Checkbox
          checked={allOnPageSelected}
          onCheckedChange={() => {
            setSelected((prev) => {
              const next = new Set(prev);
              if (allOnPageSelected) rows.forEach((r) => next.delete(r.ItemCode));
              else rows.forEach((r) => next.add(r.ItemCode));
              return next;
            });
          }}
          aria-label="Select all on page"
        />
      ),
      meta: { width: "36px" },
      cell: ({ row }) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected.has(row.original.ItemCode)} onCheckedChange={() => toggleSelect(row.original.ItemCode)} />
        </span>
      ),
    },
    { accessorKey: "ItemCode", header: "Code", meta: { width: "100px" } },
    { accessorKey: "Description", header: "Description", meta: { width: "25%", className: "font-medium" } },
    { id: "category", header: "Category", meta: { width: "10%" }, cell: ({ row }) => row.original.category || "—" },
    { id: "sub_category", header: "Sub Category", meta: { width: "10%" }, cell: ({ row }) => row.original.sub_category || "—" },
    { id: "uom", header: "UoM", meta: { width: "6%" }, cell: ({ row }) => row.original.BaseItemUnit || "—" },
    { id: "estimate_price", header: "Est. Price", meta: { align: "right", width: "8%" }, cell: ({ row }) => <span className="font-mono">{(row.original.estimate_price ?? 0).toLocaleString()}</span> },
    { id: "avg_price", header: "Avg Price", meta: { align: "right", width: "8%" }, cell: ({ row }) => <span className="font-mono">{(row.original.avg_price_3_months ?? 0).toLocaleString()}</span> },
    { id: "status", header: "Status", meta: { width: "6%" }, cell: ({ row }) => <Badge variant={row.original.Status === "1" ? "default" : "secondary"}>{row.original.Status === "1" ? "Active" : "Inactive"}</Badge> },
    { id: "link", header: "Link", meta: { width: "6%" }, cell: ({ row }) => {
      const isLinked = linkedCodes.has(row.original.ItemCode);
      return <Badge variant={isLinked ? "default" : "outline"} className={isLinked ? "bg-green-100 text-green-800 border-green-200" : ""}>{isLinked ? "Linked" : "Unlinked"}</Badge>;
    } },
    {
      id: "actions",
      header: "Actions",
      meta: { width: "70px", align: "right" },
      cell: ({ row }) => {
        const itemCode = row.original.ItemCode;
        const isLinked = linkedCodes.has(itemCode);
        return (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            title={isLinked ? "Edit linked product" : "Create product from this item"}
            onClick={async () => {
              if (isLinked) {
                const result = await pmProducts({ search: itemCode, pageSize: "10" });
                const match = result.data.find((p) => p.epurchase_item_code === itemCode);
                if (match) {
                  navigate(`/product-management/products/${match.id}/edit`);
                  return;
                }
              }
              navigate(`/product-management/products/new?epurchase_item_code=${encodeURIComponent(itemCode)}`);
            }}
          >
            <SquarePen className="size-4" />
          </Button>
        );
      },
    },
  ], [linkedCodes, navigate, rows, selected, allOnPageSelected]);

  return (
    <PageContent>
      <ListPageLayout
        title="E-Purchase Items"
        description={`${(total ?? 0).toLocaleString()} item${total !== 1 ? "s" : ""} found`}
        actions={
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
          </Button>
        }
        searchValue={inputValue}
        onSearchChange={setInputValue}
        searchPlaceholder="Search by code or description..."
      >
        {requiresEpurchaseLogin ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <LockIcon className="w-8 h-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">This page requires an E-Purchase login</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              You signed in with My System. Sign out and choose the E-Purchase option to view E-Purchase items.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => { logout(); navigate("/login"); }}>
              Switch account
            </Button>
          </div>
        ) : epurchaseSessionExpired ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <RefreshCw className="w-8 h-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">Your E-Purchase session has expired</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Please sign in with E-Purchase again to continue viewing E-Purchase items.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => { logout(); navigate("/login"); }}>
              Sign in again
            </Button>
          </div>
        ) : errKind ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-destructive">
              {error instanceof Error ? error.message : "Failed to fetch E-Purchase items."}
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            {selected.size > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
                <span className="text-sm font-medium text-foreground">
                  {selected.size} selected
                  {selectedLinkedCount !== selected.size && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      ({selected.size - selectedLinkedCount} not linked — link products first to merge)
                    </span>
                  )}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    size="sm"
                    disabled={selectedLinkedCount < 2 || fetchingMerge}
                    onClick={handleMergeClick}
                    title={selectedLinkedCount < 2 ? "Select at least 2 linked items to merge" : undefined}
                  >
                    <GitMerge />
                    {fetchingMerge ? "Loading..." : "Merge into Variation"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                    <X />
                    Clear
                  </Button>
                </div>
              </div>
            )}
            <DataTable<CompanyItem>
              columns={columns}
              data={rows}
              loading={loading}
              getRowId={(r) => String(r.id)}
              pagination={{
                currentPage,
                pageSize,
                total,
                onPageChange: setCurrentPage,
                onPageSizeChange: setPageSize,
                pageSizeOptions: [10, 25, 50, 100],
              }}
            />
          </>
        )}
      </ListPageLayout>

      <PmMergeVariationModal
        isOpen={mergeOpen}
        onClose={() => setMergeOpen(false)}
        products={mergeableProducts}
        epurchaseItemCodes={epurchaseCodeMap}
        onMerged={() => {
          setSelected(new Set());
          setMergeableProducts([]);
          setEpurchaseCodeMap([]);
          queryClient.invalidateQueries({ queryKey: ["company-items"] });
        }}
      />
    </PageContent>
  );
}
