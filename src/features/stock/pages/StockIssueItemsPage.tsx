import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { RefreshCw, Trash2, Upload, FileText, PlusCircle, Pencil } from "lucide-react";
import DataTable from "@/features/shared/components/DataTable";
import ListPageLayout from "@/features/shared/components/ListPageLayout";
import SelectField from "@/features/shared/components/SelectField";
import DatePicker from "@/features/shared/components/DatePicker";
import ConfirmModal from "@/features/shared/components/ConfirmModal";
import { useToast } from "@/features/shared/components/Toast";
import StockImportModal from "@/features/stock/components/StockImportModal";
import StockItemFormModal from "@/features/stock/components/StockItemFormModal";

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
    return [{ value: "", label: "All Transaction Types" }, ...values.map((v) => ({ value: v, label: v }))];
  }, [items]);

  const fetchIdRef = useRef(0);

  const [showImport, setShowImport] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<(StockIssueItem & { id: string }) | null>(null);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const fetchItems = async () => {
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
    } catch {} finally { if (id === fetchIdRef.current) setLoading(false); }
  };

  useEffect(() => { fetchItems(); }, [search, warehouseFilter, departmentFilter, campusFilter, transactionTypeFilter, startDate, endDate, currentPage, pageSize]);

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

  const hasActiveFilters = warehouseFilter || departmentFilter || campusFilter || transactionTypeFilter || startDate || endDate || search;

  const handleDelete = useCallback((id: string) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Stock Issue Item",
      message: "Are you sure you want to delete this stock issue item?",
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch(`/api/stock-issue-items/${id}`, { method: "DELETE" });
          if (res.ok) {
            toast.success("Stock issue item deleted.");
            fetchItems();
          } else {
            toast.error("Failed to delete stock issue item.");
          }
        } catch {
          toast.error("Failed to delete stock issue item.");
        }
      },
    });
  }, []);

  const columns = useMemo(() => [
    { key: "transactionDate", header: "Date", cellClassName: "text-[10px] text-slate-500 font-mono whitespace-nowrap", render: (item: StockIssueItem) => item.transactionDate ? new Date(item.transactionDate).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "" },
    { key: "itemCode", header: "Code", cellClassName: "font-mono font-bold text-slate-700 dark:text-gray-300 whitespace-nowrap" },
    { key: "description", header: "Description", cellClassName: "text-slate-600 dark:text-gray-400 max-w-[160px] truncate" },
    { key: "quantity", header: "Qty", align: "right" as const, cellClassName: "font-mono text-slate-700 dark:text-gray-300 whitespace-nowrap" },
    { key: "uom", header: "UoM", cellClassName: "text-slate-500" },
    { key: "unitPrice", header: "Unit Price", align: "right" as const, cellClassName: "font-mono text-slate-700 dark:text-gray-300 whitespace-nowrap", render: (item: StockIssueItem) => `$${Number(item.unitPrice).toFixed(2)}` },
    { key: "totalPrice", header: "Total Amount", align: "right" as const, cellClassName: "font-mono text-slate-700 dark:text-gray-300 whitespace-nowrap", render: (item: StockIssueItem) => `$${Number(item.totalPrice).toFixed(2)}` },
    { key: "requesterName", header: "Requester", cellClassName: "text-slate-600 dark:text-gray-400" },
    { key: "campus", header: "Campus", cellClassName: "text-slate-600 dark:text-gray-400" },
    { key: "division", header: "Division", cellClassName: "text-slate-600 dark:text-gray-400" },
    { key: "department", header: "Department", cellClassName: "text-slate-600 dark:text-gray-400" },
    { key: "remarks", header: "Description/Purpose", cellClassName: "text-slate-500 max-w-[120px] truncate" },
    { key: "referenceNo", header: "Ref.No", cellClassName: "font-mono text-slate-600 dark:text-gray-400 whitespace-nowrap" },
    { key: "transactionType", header: "Trans Type", cellClassName: "text-slate-500" },
    { key: "accountCode", header: "Account Code", cellClassName: "font-mono text-slate-500" },
    { key: "warehouse", header: "Warehouse", cellClassName: "text-slate-600 dark:text-gray-400" },
    { key: "actions", header: "Actions", align: "center" as const, cellClassName: "text-center", render: (item: StockIssueItem) => (
      <div className="flex items-center justify-center gap-1">
        <button onClick={() => { setEditItem(item); setShowForm(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg cursor-pointer transition-all" title="Edit">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg cursor-pointer transition-all" title="Delete">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    )},
  ], [handleDelete]);

  const handleBulkDelete = useCallback(() => {
    if (!hasActiveFilters) {
      toast.error("Please apply at least one filter before deleting all items.");
      return;
    }
    setConfirmState({
      isOpen: true,
      title: "Delete All Filtered Items",
      message: `Delete all ${total} item${total !== 1 ? "s" : ""} matching the current filters? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
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
          } else {
            toast.error("Failed to delete items.");
          }
        } catch {
          toast.error("Failed to delete items.");
        }
      },
    });
  }, [hasActiveFilters, total]);

  return (
    <ListPageLayout
      title="Stock Issue Items"
      description={`${total} item${total !== 1 ? "s" : ""} found`}
      actions={(
        <>
          <button onClick={fetchItems} className="p-2.5 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-500 dark:text-gray-400 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm cursor-pointer transition-all" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm cursor-pointer transition-all">
            <Upload className="w-4 h-4" /><span>Import Excel</span>
          </button>
          <button onClick={() => { setEditItem(null); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm cursor-pointer transition-all">
            <PlusCircle className="w-4 h-4" /><span>Add Item</span>
          </button>
          {total > 0 && (
            <button onClick={handleBulkDelete} className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-sm cursor-pointer transition-all">
              <Trash2 className="w-4 h-4" /><span>Delete All</span>
            </button>
          )}
        </>
      )}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by code, description, requester, or reference..."
      filters={(
        <>
          <SelectField
            value={warehouseFilter}
            onChange={setWarehouseFilter}
            placeholder="All Warehouses"
            containerClassName="min-w-[140px]"
            options={warehouseOptions}
          />
          <SelectField
            value={departmentFilter}
            onChange={setDepartmentFilter}
            placeholder="All Departments"
            containerClassName="min-w-[140px]"
            options={departmentOptions}
          />
          <SelectField
            value={campusFilter}
            onChange={setCampusFilter}
            placeholder="All Campuses"
            containerClassName="min-w-[140px]"
            options={campusOptions}
          />
          <SelectField
            value={transactionTypeFilter}
            onChange={setTransactionTypeFilter}
            placeholder="All Transaction Types"
            containerClassName="min-w-[160px]"
            options={transactionTypeOptions}
          />
          <DatePicker
            value={startDate}
            onChange={setStartDate}
            className="min-w-[140px] py-2 text-xs font-medium"
            containerClassName="min-w-[140px]"
          />
          <DatePicker
            value={endDate}
            onChange={setEndDate}
            className="min-w-[140px] py-2 text-xs font-medium"
            containerClassName="min-w-[140px]"
          />
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-[11px] font-bold text-rose-500 hover:text-rose-600 cursor-pointer">
              Clear all
            </button>
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
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />

      <StockImportModal isOpen={showImport} onClose={() => setShowImport(false)} onImportComplete={() => { setShowImport(false); fetchItems(); }} />
      <StockItemFormModal isOpen={showForm} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); setEditItem(null); fetchItems(); }} editItem={editItem} />

      <DataTable<StockIssueItem>
        columns={columns}
        data={items}
        loading={loading}
        emptyIcon={<FileText className="w-8 h-8" />}
        emptyMessage={search ? "No items match your search." : "No items imported yet."}
        emptyAction={{ label: "Import from Excel", onClick: () => setShowImport(true) }}
        skeletonRows={3}
        rowKey={(item) => item.id}
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
  );
}
