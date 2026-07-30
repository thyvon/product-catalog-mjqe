import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useConfirmModal } from "@/features/shared/hooks";
import { RefreshCw, Trash2, Upload, FileText, PlusCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import DataTable from "@/features/shared/components/DataTable";
import ListPageLayout from "@/features/shared/components/ListPageLayout";
import PageContent from "@/features/shared/components/PageContent";
import SelectField from "@/features/shared/components/SelectField";
import DatePicker from "@/features/shared/components/DatePicker";
import ConfirmModal from "@/features/shared/components/ConfirmModal";
import { useToast } from "@/features/shared/components/Toast";
import StockImportModal from "@/features/stock/components/StockImportModal";
import StockItemFormModal from "@/features/stock/components/StockItemFormModal";
import { formatAmount } from "@/features/shared/utils/format";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface StockIssueItem {
  id: string;
  itemCode: string;
  description: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  totalPrice: number;
  transactionDate: string;
  warehouse: string;
  division: string;
  department: string;
  campus: string;
  requesterName: string;
  referenceNo: string;
  transactionType: string;
  accountCode: string;
  remarks: string;
}

export default function StockIssueItemsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<StockIssueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [campusFilter, setCampusFilter] = useState("");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showImport, setShowImport] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<(StockIssueItem & { id: string }) | null>(null);
  const { confirmState, confirm, closeConfirm } = useConfirmModal();

  const fetchIdRef = useRef(0);

  const warehouseOptions = useMemo(() => {
    const values = [...new Set(items.map((i) => i.warehouse).filter(Boolean))];
    return [{ value: "", label: "All Warehouses" }, ...values.map((v) => ({ value: v, label: v }))];
  }, [items]);

  const departmentOptions = useMemo(() => {
    const values = [...new Set(items.map((i) => i.department).filter(Boolean))];
    return [{ value: "", label: "All Departments" }, ...values.map((v) => ({ value: v, label: v }))];
  }, [items]);

  const campusOptions = useMemo(() => {
    const values = [...new Set(items.map((i) => i.campus).filter(Boolean))];
    return [{ value: "", label: "All Campuses" }, ...values.map((v) => ({ value: v, label: v }))];
  }, [items]);

  const transactionTypeOptions = useMemo(() => {
    const values = [...new Set(items.map((i) => i.transactionType).filter(Boolean))];
    return [{ value: "", label: "All Types" }, ...values.map((v) => ({ value: v, label: v }))];
  }, [items]);

  const hasActiveFilters = warehouseFilter || departmentFilter || campusFilter || transactionTypeFilter || startDate || endDate || search;

  const fetchItems = useCallback(async () => {
    const id = ++fetchIdRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (warehouseFilter) params.set("warehouse", warehouseFilter);
      if (departmentFilter) params.set("department", departmentFilter);
      if (campusFilter) params.set("campus", campusFilter);
      if (transactionTypeFilter) params.set("transactionType", transactionTypeFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (search) params.set("search", search);
      params.set("page", String(currentPage));
      params.set("pageSize", String(pageSize));
      const res = await fetch(`/api/stock-issue-items?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      if (id !== fetchIdRef.current) return;
      if (Array.isArray(data)) {
        setItems(data);
        setTotal(data.length);
      } else {
        setItems(data.items || []);
        setTotal(data.total ?? 0);
      }
    } catch {} finally {
      if (id === fetchIdRef.current) setLoading(false);
    }
  }, [search, warehouseFilter, departmentFilter, campusFilter, transactionTypeFilter, startDate, endDate, currentPage, pageSize]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => { setCurrentPage(1); }, [search, warehouseFilter, departmentFilter, campusFilter, transactionTypeFilter, startDate, endDate]);

  const clearFilters = () => {
    setWarehouseFilter("");
    setDepartmentFilter("");
    setCampusFilter("");
    setTransactionTypeFilter("");
    setStartDate("");
    setEndDate("");
    setSearch("");
  };

  const handleDelete = useCallback((id: string) => {
    confirm(
      "Delete Stock Issue Item",
      "Are you sure you want to delete this stock issue item? This cannot be undone.",
      async () => {
        closeConfirm();
        try {
          const res = await fetch(`/api/stock-issue-items/${id}`, { method: "DELETE" });
          if (res.ok) { toast.success("Item deleted."); fetchItems(); }
          else toast.error("Failed to delete item.");
        } catch { toast.error("Failed to delete item."); }
      },
    );
  }, [confirm, closeConfirm, fetchItems]);

  const handleBulkDelete = useCallback(() => {
    if (!hasActiveFilters) {
      toast.error("Apply at least one filter before deleting all items.");
      return;
    }
    confirm(
      "Delete All Filtered Items",
      `Delete all ${total} item${total !== 1 ? "s" : ""} matching current filters? This cannot be undone.`,
      async () => {
        closeConfirm();
        try {
          const params = new URLSearchParams();
          if (warehouseFilter) params.set("warehouse", warehouseFilter);
          if (departmentFilter) params.set("department", departmentFilter);
          if (campusFilter) params.set("campus", campusFilter);
          if (transactionTypeFilter) params.set("transactionType", transactionTypeFilter);
          if (startDate) params.set("startDate", startDate);
          if (endDate) params.set("endDate", endDate);
          if (search) params.set("search", search);
          const res = await fetch(`/api/stock-issue-items/bulk?${params}`, { method: "DELETE" });
          if (res.ok) {
            toast.success(`Deleted ${total} item${total !== 1 ? "s" : ""}.`);
            setCurrentPage(1);
            fetchItems();
          } else toast.error("Failed to delete items.");
        } catch { toast.error("Failed to delete items."); }
      },
    );
  }, [hasActiveFilters, total, confirm, closeConfirm, warehouseFilter, departmentFilter, campusFilter, transactionTypeFilter, startDate, endDate, search, fetchItems]);

  const columns = useMemo<ColumnDef<StockIssueItem>[]>(() => [
    {
      accessorKey: "transactionDate",
      header: "Date",
      meta: { width: "110px" },
      cell: ({ row }) => (
        <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
          {row.original.transactionDate
            ? new Date(row.original.transactionDate).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
            : "—"}
        </span>
      ),
    },
    {
      accessorKey: "itemCode",
      header: "Item Code",
      meta: { width: "140px" },
      cell: ({ row }) => (
        <span className="px-2 py-0.5 bg-primary text-primary-foreground rounded font-semibold font-mono tracking-wider text-xs whitespace-nowrap">
          {row.original.itemCode}
        </span>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <span className="text-sm font-medium text-foreground block max-w-[240px] truncate" title={row.original.description}>
          {row.original.description}
        </span>
      ),
    },
    {
      accessorKey: "quantity",
      header: "Qty",
      meta: { align: "right", width: "64px" },
      cell: ({ row }) => (
        <span className="font-mono font-bold text-sm text-foreground">{row.original.quantity}</span>
      ),
    },
    {
      accessorKey: "uom",
      header: "UoM",
      meta: { width: "60px" },
      cell: ({ row }) => (
        <Badge variant="outline" className="font-mono text-xs uppercase px-1.5">
          {row.original.uom}
        </Badge>
      ),
    },
    {
      accessorKey: "unitPrice",
      header: "Unit Price",
      meta: { align: "right", width: "110px" },
      cell: ({ row }) => (
        <span className="font-mono text-sm text-muted-foreground">{formatAmount(Number(row.original.unitPrice))}</span>
      ),
    },
    {
      accessorKey: "totalPrice",
      header: "Total",
      meta: { align: "right", width: "120px" },
      cell: ({ row }) => (
        <span className="font-mono font-bold text-sm text-foreground">{formatAmount(Number(row.original.totalPrice))}</span>
      ),
    },
    { accessorKey: "warehouse", header: "Warehouse", meta: { width: "120px", className: "text-sm text-muted-foreground truncate max-w-[120px]" } },
    { accessorKey: "department", header: "Dept", meta: { width: "100px", className: "text-sm text-muted-foreground truncate max-w-[100px]" } },
    { accessorKey: "campus", header: "Campus", meta: { width: "90px", className: "text-sm text-muted-foreground truncate max-w-[90px]" } },
    { accessorKey: "requesterName", header: "Requester", meta: { width: "120px", className: "text-sm text-muted-foreground truncate max-w-[120px]" } },
    {
      accessorKey: "transactionType",
      header: "Type",
      meta: { width: "90px" },
      cell: ({ row }) => row.original.transactionType ? (
        <Badge variant="secondary" className="text-xs font-medium uppercase tracking-wide">
          {row.original.transactionType}
        </Badge>
      ) : <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: "referenceNo",
      header: "Ref.No",
      meta: { width: "130px" },
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">{row.original.referenceNo || "—"}</span>
      ),
    },
    {
      accessorKey: "accountCode",
      header: "Account",
      meta: { width: "110px" },
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground truncate block max-w-[110px]" title={row.original.accountCode}>
          {row.original.accountCode || "—"}
        </span>
      ),
    },
    {
      accessorKey: "remarks",
      header: "Purpose",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground block max-w-[180px] truncate" title={row.original.remarks}>
          {row.original.remarks || "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      meta: { align: "right", width: "80px" },
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={() => { setEditItem(item); setShowForm(true); }}><Pencil /></Button>} />
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={() => handleDelete(item.id)}><Trash2 /></Button>} />
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </div>
        );
      },
    },
  ], [handleDelete]);

  return (
    <PageContent>
      <ListPageLayout
        title="Stock Issue Items"
        description={`${total} item${total !== 1 ? "s" : ""} found`}
        actions={(
          <>
            <Tooltip>
              <TooltipTrigger render={
                <Button variant="outline" size="icon" onClick={fetchItems}>
                  <RefreshCw className={loading ? "animate-spin" : ""} />
                </Button>
              } />
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
              <Upload /><span>Import</span>
            </Button>
            <Button size="sm" onClick={() => { setEditItem(null); setShowForm(true); }}>
              <PlusCircle /><span>Add Item</span>
            </Button>
            {total > 0 && hasActiveFilters && (
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash2 /><span>Delete Filtered</span>
              </Button>
            )}
          </>
        )}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by code, description, requester, or reference..."
        filters={(
          <>
            {/* Row 1: dropdown filters */}
            <SelectField
              value={warehouseFilter}
              onChange={setWarehouseFilter}
              options={warehouseOptions}
              containerClassName="min-w-[130px]"
            />
            <SelectField
              value={departmentFilter}
              onChange={setDepartmentFilter}
              options={departmentOptions}
              containerClassName="min-w-[130px]"
            />
            <SelectField
              value={campusFilter}
              onChange={setCampusFilter}
              options={campusOptions}
              containerClassName="min-w-[120px]"
            />
            <SelectField
              value={transactionTypeFilter}
              onChange={setTransactionTypeFilter}
              options={transactionTypeOptions}
              containerClassName="min-w-[110px]"
            />
            {/* Row 2: date range — forced to new line via w-full wrapper */}
            <div className="w-full flex flex-wrap items-center gap-2">
              <DatePicker
                label="From"
                value={startDate}
                onChange={setStartDate}
                containerClassName="min-w-[150px]"
              />
              <DatePicker
                label="To"
                value={endDate}
                onChange={setEndDate}
                containerClassName="min-w-[150px]"
              />
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear all
                </Button>
              )}
            </div>
          </>
        )}
      >
        <ConfirmModal
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={confirmState.onConfirm}
          onCancel={closeConfirm}
        />

        <StockImportModal
          isOpen={showImport}
          onClose={() => setShowImport(false)}
          onImportComplete={() => { setShowImport(false); fetchItems(); }}
        />

        <StockItemFormModal
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); setEditItem(null); fetchItems(); }}
          editItem={editItem}
        />

        <DataTable<StockIssueItem>
          columns={columns}
          data={items}
          loading={loading}
          emptyIcon={<FileText className="w-8 h-8" />}
          emptyMessage={search ? "No items match your search." : "No stock issue items yet."}
          emptyAction={{ label: "Import from Excel", onClick: () => setShowImport(true) }}
          skeletonRows={5}
          getRowId={(item) => item.id}
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
