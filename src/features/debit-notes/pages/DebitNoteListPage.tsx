import { useState, useEffect, useCallback, useMemo } from "react";
import {
  RefreshCw, Send, Download, Trash2, Eye, FileText, PlusCircle,
  AlertCircle, Loader2, FileSpreadsheet,
} from "lucide-react";
import ListPageLayout from "@/features/shared/components/ListPageLayout";
import { useAuth } from "@/features/auth/AuthContext";
import DebitNoteGenerateModal from "@/features/debit-notes/components/DebitNoteGenerateModal";
import DebitNotePreviewModal from "@/features/debit-notes/components/DebitNotePreviewModal";
import DataTable from "@/features/shared/components/DataTable";
import DatePicker from "@/features/shared/components/DatePicker";
import SelectField from "@/features/shared/components/SelectField";
import ConfirmModal from "@/features/shared/components/ConfirmModal";

interface DebitNote {
  id: string;
  referenceNumber: string;
  warehouse: string;
  department: string;
  campus: string;
  startDate: string;
  endDate: string;
  sendDate: string | null;
  status: string;
  createdBy: string;
  itemCount: number;
  totalAmount: number;
  debitNoteEmail: { receiverName: string; sendToEmail: string } | null;
  createdAt: string;
}

interface EmailProgress {
  status: string;
  finished: boolean;
  success_count?: number;
  failed_count?: number;
  failed_notes?: string[];
}

export default function DebitNoteListPage() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<DebitNote[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [warehouse, setWarehouse] = useState("");
  const [department, setDepartment] = useState("");
  const [campus, setCampus] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showGenerate, setShowGenerate] = useState(false);

  // Email progress
  const [progress, setProgress] = useState<EmailProgress | null>(null);
  const [sendingEmails, setSendingEmails] = useState(false);

  // Preview modal
  const [previewNote, setPreviewNote] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  // Filter dropdown values
  const [filterValues, setFilterValues] = useState<{ warehouses: string[]; departments: string[]; campuses: string[]; statuses: string[] }>({
    warehouses: [], departments: [], campuses: [], statuses: [],
  });

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (warehouse) params.set("warehouse", warehouse);
      if (department) params.set("department", department);
      if (campus) params.set("campus", campus);
      if (statusFilter) params.set("status", statusFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (searchQuery) params.set("search", searchQuery);
      params.set("page", String(currentPage));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`/api/debit-notes?${params}`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.data || []);
        setTotal(data.total || 0);
      }
    } catch { } finally { setLoading(false); }
  }, [warehouse, department, campus, statusFilter, startDate, endDate, searchQuery, currentPage, pageSize]);

  const fetchFilterValues = async () => {
    try {
      const res = await fetch("/api/debit-notes/filters/values");
      if (res.ok) {
        const nextValues = await res.json();
        setFilterValues({
          warehouses: nextValues?.warehouses ?? [],
          departments: nextValues?.departments ?? [],
          campuses: nextValues?.campuses ?? [],
          statuses: nextValues?.statuses ?? [],
        });
      }
    } catch { }
  };

  useEffect(() => { fetchNotes(); }, [fetchNotes]);
  useEffect(() => { fetchFilterValues(); }, []);
  useEffect(() => {
    setCurrentPage(1);
  }, [warehouse, department, campus, statusFilter, startDate, endDate, searchQuery]);

  // Poll email progress
  useEffect(() => {
    if (!sendingEmails) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/debit-notes/email-progress");
        if (res.ok) {
          const data = await res.json();
          setProgress(data);
          if (data.finished) {
            setSendingEmails(false);
            clearInterval(interval);
            fetchNotes();
          }
        }
      } catch { }
    }, 1000);
    return () => clearInterval(interval);
  }, [sendingEmails, fetchNotes]);

  const handleSendEmails = async () => {
    setConfirmState({
      isOpen: true,
      title: "Share Debit Notes",
      message: "Send emails for all pending debit notes with the current filters?",
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        setSendingEmails(true);
        setProgress({ status: "Starting...", finished: false });
        try {
          const res = await fetch("/api/debit-notes/send-emails", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              warehouse: warehouse || undefined,
              department: department || undefined,
              campus: campus || undefined,
              startDate: startDate || undefined,
              endDate: endDate || undefined,
              user: user?.username || "anonymous",
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            setSendingEmails(false);
            alert(data.error || "Failed to send emails.");
          }
        } catch {
          setSendingEmails(false);
          alert("Failed to send emails.");
        }
      },
    });
  };

  const handleResend = async (id: string) => {
    if (!confirm("Resend email for this debit note?")) return;
    setSendingEmails(true);
    setProgress({ status: "Starting...", finished: false });
    try {
      const res = await fetch(`/api/debit-notes/${id}/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: user?.username || "anonymous" }),
      });
      if (!res.ok) {
        setSendingEmails(false);
        const data = await res.json();
        alert(data.error || "Failed to resend.");
      }
    } catch {
      setSendingEmails(false);
      alert("Failed to resend.");
    }
  };

  const handleExport = async (id: string) => {
    try {
      const res = await fetch(`/api/debit-notes/${id}/export`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `debit-note-${id.slice(0, 8)}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch {
      alert("Failed to export.");
    }
  };

  const handleBulkExport = async () => {
    try {
      const res = await fetch("/api/debit-notes/export-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouse: warehouse || undefined,
          department: department || undefined,
          campus: campus || undefined,
          status: statusFilter || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `debit-notes-export.zip`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch {
      alert("Failed to bulk export.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this debit note? This action cannot be undone.")) return;
    try {
      const res = await fetch(`/api/debit-notes/${id}`, { method: "DELETE" });
      if (res.ok) fetchNotes();
      else alert("Failed to delete.");
    } catch {
      alert("Failed to delete.");
    }
  };

  const handlePreview = async (id: string) => {
    try {
      const res = await fetch(`/api/debit-notes/${id}`);
      if (res.ok) {
        setPreviewNote(await res.json());
        setShowPreview(true);
      }
    } catch {
      alert("Failed to load details.");
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
      sending: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
      sent: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
    };
    return styles[status] || "bg-slate-50 dark:bg-gray-800 text-slate-500 dark:text-gray-400";
  };

  const clearFilters = () => {
    setWarehouse("");
    setDepartment("");
    setCampus("");
    setStatusFilter("");
    setStartDate("");
    setEndDate("");
    setSearchQuery("");
  };

  const buildFilterOptions = useMemo(() => (values: string[], allLabel: string) => [
    { value: "", label: allLabel },
    ...values.map((value) => ({ value, label: value })),
  ], []);

  return (
    <ListPageLayout
      title="Debit Notes"
      description={`${total} debit note${total !== 1 ? "s" : ""} found`}
      actions={(
        <>
          {sendingEmails && progress && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{progress.status}</span>
            </div>
          )}
          <button
            onClick={fetchNotes}
            className="p-2.5 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-500 dark:text-gray-400 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm cursor-pointer transition-all"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleBulkExport}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-600 dark:text-gray-300 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-bold shadow-sm cursor-pointer transition-all"
            title="Bulk Export to ZIP"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
          <button
            onClick={handleSendEmails}
            disabled={sendingEmails}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-sm font-bold shadow-sm cursor-pointer disabled:cursor-not-allowed transition-all"
          >
            <Send className="w-4 h-4" />
            <span>Send Emails</span>
          </button>
          <button
            onClick={() => setShowGenerate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm cursor-pointer transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Generate</span>
          </button>
        </>
      )}
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Search by reference, warehouse, department, or status..."
      filters={(
        <>
          <SelectField
            value={warehouse}
            onChange={setWarehouse}
            placeholder="All Warehouses"
            containerClassName="min-w-[140px]"
            options={buildFilterOptions(filterValues.warehouses, "All Warehouses")}
          />
          <SelectField
            value={department}
            onChange={setDepartment}
            placeholder="All Departments"
            containerClassName="min-w-[140px]"
            options={buildFilterOptions(filterValues.departments, "All Departments")}
          />
          <SelectField
            value={campus}
            onChange={setCampus}
            placeholder="All Campuses"
            containerClassName="min-w-[140px]"
            options={buildFilterOptions(filterValues.campuses, "All Campuses")}
          />
          <SelectField
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="All Statuses"
            containerClassName="min-w-[140px]"
            options={[
              { value: "", label: "All Statuses" },
              ...filterValues.statuses.map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) })),
            ]}
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
          {(warehouse || department || campus || statusFilter || startDate || endDate || searchQuery) && (
            <button
              onClick={clearFilters}
              className="text-[11px] font-bold text-rose-500 hover:text-rose-600"
            >
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
        confirmLabel="Share"
        cancelLabel="Cancel"
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />

      <DataTable<DebitNote>
        columns={[
          { key: "referenceNumber", header: "Reference", cellClassName: "font-bold text-slate-700 dark:text-gray-300 font-mono" },
          { key: "warehouse", header: "Warehouse", cellClassName: "text-slate-600 dark:text-gray-400" },
          { key: "department", header: "Department", cellClassName: "text-slate-600 dark:text-gray-400" },
          { key: "campus", header: "Campus", cellClassName: "text-slate-600 dark:text-gray-400" },
          { key: "period", header: "Period", cellClassName: "text-[10px] text-slate-500 dark:text-gray-500 font-mono", render: (n) => <>{n.startDate} - {n.endDate}</> },
          { key: "itemCount", header: "Items", align: "right", cellClassName: "font-mono", render: (n) => <span className="text-slate-700 dark:text-gray-300">{n.itemCount}</span> },
          { key: "totalAmount", header: "Total", align: "right", cellClassName: "font-mono", render: (n) => <span className="text-slate-700 dark:text-gray-300">${Number(n.totalAmount).toFixed(2)}</span> },
          { key: "status", header: "Status", align: "center", render: (n) => (
            <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${statusBadge(n.status)}`}>{n.status}</span>
          )},
          { key: "actions", header: "Actions", align: "right", render: (n) => (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => handlePreview(n.id)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg cursor-pointer transition-all" title="Preview">
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleExport(n.id)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg cursor-pointer transition-all" title="Export Excel">
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </button>
              {n.status !== "sending" && (
                <button onClick={() => handleResend(n.id)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg cursor-pointer transition-all" title="Resend Email">
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => handleDelete(n.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg cursor-pointer transition-all" title="Delete">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )},
        ]}
        data={notes}
        loading={loading}
        emptyIcon={<FileText className="w-8 h-8" />}
        emptyMessage="No debit notes found."
        emptyAction={{ label: "Generate one now", onClick: () => setShowGenerate(true) }}
        skeletonRows={4}
        rowKey={(n) => n.id}
        pagination={{
          currentPage,
          pageSize,
          total,
          onPageChange: setCurrentPage,
          onPageSizeChange: setPageSize,
          pageSizeOptions: [10, 25, 50, 100],
        }}
      />

      <DebitNoteGenerateModal isOpen={showGenerate} onClose={() => setShowGenerate(false)} onGenerated={() => { setShowGenerate(false); fetchNotes(); }} />
      <DebitNotePreviewModal isOpen={showPreview} onClose={() => setShowPreview(false)} previewNote={previewNote} />

      {/* Failed notes alert */}
      {progress?.finished && progress.failed_count && progress.failed_count > 0 && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-white dark:bg-gray-900 border border-rose-200 dark:border-rose-800/30 rounded-2xl shadow-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-gray-100">
                {progress.failed_count} email(s) failed
              </p>
              {progress.failed_notes?.slice(0, 3).map((msg, i) => (
                <p key={i} className="text-[10px] text-rose-500 mt-1">{msg}</p>
              ))}
              <button
                onClick={() => setProgress(null)}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 mt-2 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </ListPageLayout>
  );
}
