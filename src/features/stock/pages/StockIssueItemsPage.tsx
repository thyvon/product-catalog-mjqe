import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useConfirmModal } from "@/features/shared/hooks";
import { RefreshCw, Trash2, Upload, FileText, PlusCircle, Pencil, Download } from "lucide-react";
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

  const [filterValues, setFilterValues] = useState<{ warehouses: string[]; departments: string[]; campuses: string[]; transactionTypes: string[] }>({
    warehouses: [],
    departments: [],
    campuses: [],
    transactionTypes: [],
  });

  const warehouseOptions = useMemo(() => {
    return [{ value: "", label: "All Warehouses" }, ...filterValues.warehouses.map((v) => ({ value: v, label: v }))];
  }, [filterValues.warehouses]);

  const departmentOptions = useMemo(() => {
    return [{ value: "", label: "All Departments" }, ...filterValues.departments.map((v) => ({ value: v, label: v }))];
  }, [filterValues.departments]);

  const campusOptions = useMemo(() => {
    return [{ value: "", label: "All Campuses" }, ...filterValues.campuses.map((v) => ({ value: v, label: v }))];
  }, [filterValues.campuses]);

  const transactionTypeOptions = useMemo(() => {
    return [{ value: "", label: "All Types" }, ...filterValues.transactionTypes.map((v) => ({ value: v, label: v }))];
  }, [filterValues.transactionTypes]);

  useEffect(() => {
    const fetchFilterValues = async () => {
      try {
        const res = await fetch("/api/stock-issue-items/filters/values");
        if (res.ok) setFilterValues(await res.json());
      } catch {}
    };
    fetchFilterValues();
  }, []);

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

  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (warehouseFilter) params.set("warehouse", warehouseFilter);
      if (departmentFilter) params.set("department", departmentFilter);
      if (campusFilter) params.set("campus", campusFilter);
      if (transactionTypeFilter) params.set("transactionType", transactionTypeFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (search) params.set("search", search);

      const res = await fetch(`/api/stock-issue-items?${params}`);
      if (!res.ok) throw new Error("Failed to fetch stock issue items.");
      const data = await res.json();
      const rows: any[] = Array.isArray(data) ? data : (data.items || []);

      const XLSX = await import("xlsx");
      const parseExcelDate = (value: string | null | undefined): Date | null => {
        if (!value) return null;
        const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
      };
      const columns = [
        "Date", "Code", "Description", "Qty", "UoM", "Unit Price", "Total Amount",
        "Requester", "Campus", "Division", "Department", "Description/ Purpose",
        "Ref.No", "Transaction Type", "Account Code", "Warehouse"
      ];
      const sheetRows = rows.map((i) => [
        parseExcelDate(i.transactionDate) ?? "",
        i.itemCode || "",
        i.description || "",
        Number(i.quantity ?? 0) || 0,
        i.uom || "",
        Number(i.unitPrice ?? 0) || 0,
        Number(i.totalPrice ?? 0) || 0,
        i.requesterName || "",
        i.campus || "",
        i.division || "",
        i.department || "",
        i.remarks || "",
        i.referenceNo || "",
        i.transactionType || "",
        i.accountCode || "",
        i.warehouse || "",
      ]);
      const ws = XLSX.utils.aoa_to_sheet([columns, ...sheetRows]);
      if (ws["!ref"]) {
        const range = XLSX.utils.decode_range(ws["!ref"]);
        for (let r = 1; r <= range.e.r; r++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
          if (cell && cell.t === "n" && typeof cell.v === "number") cell.z = "yyyy-mm-dd";
        }
      }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Stock Issue Items");
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array", cellDates: true });
      const blob = new Blob([buf], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Stock_Issue_Items.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} item${rows.length !== 1 ? "s" : ""}.`);
    } catch {
      toast.error("Failed to export stock issue items.");
    } finally {
      setExporting(false);
    }
  }, [warehouseFilter, departmentFilter, campusFilter, transactionTypeFilter, startDate, endDate, search, toast]);

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
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <Upload /><span>Import</span>
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              <Download /><span>{exporting ? "Exporting..." : "Export"}</span>
            </Button>
            <Button onClick={() => { setEditItem(null); setShowForm(true); }}>
              <PlusCircle /><span>Add Item</span>
            </Button>
            {total > 0 && hasActiveFilters && (
              <Button variant="destructive" onClick={handleBulkDelete}>
                <Trash2 /><span>Delete Filtered</span>
              </Button>
            )}
          </>
        )}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by code, description, requester, or reference..."
        activeFilterCount={[warehouseFilter, departmentFilter, campusFilter, transactionTypeFilter, startDate, endDate].filter(Boolean).length}
        filters={(
          <>
            <SelectField
              value={warehouseFilter}
              onChange={setWarehouseFilter}
              options={warehouseOptions}
              placeholder="All Warehouses"
              containerClassName="min-w-[140px]"
            />
            <SelectField
              value={departmentFilter}
              onChange={setDepartmentFilter}
              options={departmentOptions}
              placeholder="All Departments"
              containerClassName="min-w-[140px]"
            />
            <SelectField
              value={campusFilter}
              onChange={setCampusFilter}
              options={campusOptions}
              placeholder="All Campuses"
              containerClassName="min-w-[130px]"
            />
            <SelectField
              value={transactionTypeFilter}
              onChange={setTransactionTypeFilter}
              options={transactionTypeOptions}
              placeholder="All Types"
              containerClassName="min-w-[120px]"
            />
          </>
        )}
        subFilters={(
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground whitespace-nowrap">From</span>
              <DatePicker value={startDate} onChange={setStartDate} placeholder="Start date" containerClassName="w-36" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground whitespace-nowrap">To</span>
              <DatePicker value={endDate} onChange={setEndDate} placeholder="End date" containerClassName="w-36" />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                Clear all
              </Button>
            )}
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
