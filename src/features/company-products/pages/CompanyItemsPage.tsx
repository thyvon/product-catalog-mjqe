import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { GitMerge, SquarePen, RefreshCw, X } from "lucide-react";
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

export default function CompanyItemsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout } = useAuth();
  const [rows, setRows] = useState<CompanyItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const abortRef = useRef<AbortController | null>(null);
  const [linkedCodes, setLinkedCodes] = useState<Set<string>>(new Set());

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeableProducts, setMergeableProducts] = useState<PMProduct[]>([]);
  const [epurchaseCodeMap, setEpurchaseCodeMap] = useState<{ productId: string; epurchaseItemCode: string }[]>([]);
  const [fetchingMerge, setFetchingMerge] = useState(false);

  // Debounce search input: 300ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(inputValue);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const load = useCallback(async () => {
    abortRef.current?.abort("new request");
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const userId = JSON.parse(localStorage.getItem("auth_user") || "{}")?.id;
      if (!userId) return;

      const params = new URLSearchParams({
        draw: "1",
        start: String((currentPage - 1) * pageSize),
        length: String(pageSize),
        "search[value]": searchQuery,
        "search[regex]": "false",
        "order[0][column]": "11",
        "order[0][dir]": "desc",
      });

      const res = await fetch(`/api/company/items?${params.toString()}`, {
        headers: { "X-User-Id": String(userId) },
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      const json = await res.json();

      if (res.status === 401) {
        logout();
        navigate("/login");
        return;
      }

      if (!res.ok || json.error) {
        setRows([]);
        setTotal(0);
        return;
      }

      setRows(json.data ?? []);
      setTotal(json.recordsFiltered ?? json.recordsTotal ?? 0);
    } catch {
      if (controller.signal.aborted) return;
      setRows([]);
      setTotal(0);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [currentPage, pageSize, searchQuery]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    pmLinkedEpurchaseCodes()
      .then((codes) => setLinkedCodes(new Set(codes)))
      .catch(() => {});
  }, []);

  // Selection helpers (same pattern as PmProductsTab)
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

  // Fetch linked PM products for selected items and open merge modal
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

  const columns = useMemo<ColumnDef<CompanyItem, any>[]>(() => [
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
          <Button variant="outline" size="icon" onClick={load}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
          </Button>
        }
        searchValue={inputValue}
        onSearchChange={setInputValue}
        searchPlaceholder="Search by code or description..."
      >
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
          load();
        }}
      />
    </PageContent>
  );
}
