import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { SquarePen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DataTable from "@/features/shared/components/DataTable";
import PageContent from "@/features/shared/components/PageContent";
import ListPageLayout from "@/features/shared/components/ListPageLayout";
import type { CompanyItem } from "@/features/company-products/types";
import { pmLinkedEpurchaseCodes, pmProducts } from "@/features/product-management/api";

export default function CompanyItemsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<CompanyItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const abortRef = useRef<AbortController | null>(null);
  const [linkedCodes, setLinkedCodes] = useState<Set<string>>(new Set());

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

  const columns = useMemo<ColumnDef<CompanyItem, any>[]>(() => [
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
  ], [linkedCodes, navigate]);

  return (
    <PageContent>
      <ListPageLayout
        title="Company Items"
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
    </PageContent>
  );
}
