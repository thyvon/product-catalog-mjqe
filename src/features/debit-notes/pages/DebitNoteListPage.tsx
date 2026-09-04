import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useConfirmModal } from "@/features/shared/hooks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/features/shared/components/Toast";
import {
  RefreshCw, Send, Download, Trash2, Eye, FileText, PlusCircle,
  AlertCircle, Loader2, FileSpreadsheet,
} from "lucide-react";
import ListPageLayout from "@/features/shared/components/ListPageLayout";
import PageContent from "@/features/shared/components/PageContent";
import { useAuth } from "@/features/auth/AuthContext";
import DebitNoteGenerateModal from "@/features/debit-notes/components/DebitNoteGenerateModal";
import DebitNotePreviewModal from "@/features/debit-notes/components/DebitNotePreviewModal";
import DataTable from "@/features/shared/components/DataTable";
import DatePicker from "@/features/shared/components/DatePicker";
import SelectField from "@/features/shared/components/SelectField";
import ConfirmModal from "@/features/shared/components/ConfirmModal";
import { formatAmount, formatDisplayDate } from "@/features/shared/utils/format";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface DebitNote {
  id: string;
  referenceNumber: string;
  warehouse: string;
  department: string;
  campus: string;
  division: string;
  startDate: string;
  endDate: string;
  sendDate: string | null;
  status: string;
  createdBy: string;
  itemCount: number;
  totalAmount: number;
  debitNoteEmail: { receiverName: string; sendToEmail: string[]; ccToEmail: string[] } | null;
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
  const { toast } = useToast();
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

  const { confirmState, confirm, closeConfirm } = useConfirmModal();

  // Filter dropdown values
  const fetchIdRef = useRef(0);

  const [filterValues, setFilterValues] = useState<{ warehouses: string[]; departments: string[]; campuses: string[]; statuses: string[] }>({
    warehouses: [], departments: [], campuses: [], statuses: [],
  });

  const fetchNotes = useCallback(async () => {
    const id = ++fetchIdRef.current;
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
      if (!res.ok) return;
      const data = await res.json();
      if (id !== fetchIdRef.current) return;
      setNotes(data.data || []);
      setTotal(data.total || 0);
    } catch { } finally { if (id === fetchIdRef.current) setLoading(false); }
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
        const res = await fetch(`/api/debit-notes/email-progress?user=${encodeURIComponent(user?.username || "anonymous")}`);
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
  }, [sendingEmails, fetchNotes, user]);

  const handleSendEmails = useCallback(async () => {
    confirm(
      "Share Debit Notes",
      "Send emails for all pending debit notes with the current filters?",
      async () => {
        closeConfirm();
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
            toast.error(data.error || "Failed to send emails.");
          }
        } catch {
          setSendingEmails(false);
          toast.error("Failed to send emails.");
        }
      },
      "Send",
    );
  }, [warehouse, department, campus, startDate, endDate, user, toast, fetchNotes, confirm, closeConfirm]);

  const handleResend = useCallback((note: DebitNote) => {
    const isPending = note.status === "pending";
    const email = note.debitNoteEmail;
    const emailInfo = email
      ? `To: ${email.receiverName} (${email.sendToEmail})`
      : "No email configuration found.";
    confirm(
      isPending ? "Send Email" : "Resend Email",
      `${isPending ? "Send" : "Resend"} email for ${note.referenceNumber}?\n\n${emailInfo}`,
      async () => {
        closeConfirm();
        setSendingEmails(true);
        setProgress({ status: "Starting...", finished: false });
        try {
          const res = await fetch(`/api/debit-notes/${note.id}/resend`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user: user?.username || "anonymous" }),
          });
          if (!res.ok) {
            setSendingEmails(false);
            const data = await res.json();
            toast.error(data.error || "Failed to resend.");
          }
        } catch {
          setSendingEmails(false);
          toast.error("Failed to resend.");
        }
      },
      isPending ? "Send" : "Resend",
    );
  }, [user, toast, confirm, closeConfirm]);

  const handleExport = useCallback(async (id: string) => {
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
      toast.error("Failed to export.");
    }
  }, []);

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
      toast.error("Failed to bulk export.");
    }
  };

  const handleDelete = useCallback((id: string) => {
    confirm(
      "Delete Debit Note",
      "Delete this debit note? This action cannot be undone.",
      async () => {
        closeConfirm();
        try {
          const res = await fetch(`/api/debit-notes/${id}`, { method: "DELETE" });
          if (res.ok) fetchNotes();
          else toast.error("Failed to delete.");
        } catch {
          toast.error("Failed to delete.");
        }
      },
      "Delete",
    );
  }, [fetchNotes, toast, confirm, closeConfirm]);

  const hasActiveFilters = useMemo(
    () => Boolean(warehouse || department || campus || statusFilter || startDate || endDate || searchQuery),
    [warehouse, department, campus, statusFilter, startDate, endDate, searchQuery],
  );

  const handleBulkDelete = useCallback(() => {
    if (!hasActiveFilters) {
      toast.error("Apply at least one filter before deleting debit notes.");
      return;
    }
    confirm(
      "Delete All Filtered Debit Notes",
      `Delete all ${total} debit note${total !== 1 ? "s" : ""} matching current filters? This cannot be undone.`,
      async () => {
        closeConfirm();
        try {
          const params = new URLSearchParams();
          if (warehouse) params.set("warehouse", warehouse);
          if (department) params.set("department", department);
          if (campus) params.set("campus", campus);
          if (statusFilter) params.set("status", statusFilter);
          if (startDate) params.set("startDate", startDate);
          if (endDate) params.set("endDate", endDate);
          if (searchQuery) params.set("search", searchQuery);
          const res = await fetch(`/api/debit-notes/bulk?${params}`, { method: "DELETE" });
          if (res.ok) {
            const data = await res.json();
            const deleted = data.count ?? total;
            toast.success(`Deleted ${deleted} debit note${deleted !== 1 ? "s" : ""}.`);
            setCurrentPage(1);
            fetchNotes();
          } else {
            const data = await res.json();
            toast.error(data.error || "Failed to delete debit notes.");
          }
        } catch {
          toast.error("Failed to delete debit notes.");
        }
      },
      "Delete All",
    );
  }, [hasActiveFilters, total, confirm, closeConfirm, warehouse, department, campus, statusFilter, startDate, endDate, searchQuery, fetchNotes, toast]);

  const handlePreview = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/debit-notes/${id}`);
      if (res.ok) {
        setPreviewNote(await res.json());
        setShowPreview(true);
      }
    } catch {
      toast.error("Failed to load details.");
    }
  }, []);

  const statusBadge = useCallback((status: string) => {
    const variants: Record<string, string> = {
      pending: "secondary",
      sending: "default",
      sent: "default",
    };
    return variants[status] || "outline";
  }, []);

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

  const columns = useMemo<ColumnDef<DebitNote>[]>(() => [
    { accessorKey: "referenceNumber", header: "Reference", meta: { className: "font-bold text-foreground font-mono" } },
    { accessorKey: "warehouse", header: "Warehouse", meta: { className: "text-muted-foreground" } },
    { accessorKey: "department", header: "Department", meta: { className: "text-muted-foreground" } },
    { accessorKey: "campus", header: "Campus", meta: { className: "text-muted-foreground" } },
    { accessorKey: "division", header: "Division", meta: { className: "text-muted-foreground" } },
    {
      id: "period",
      header: "Period",
      meta: { className: "text-xs text-muted-foreground font-mono" },
      cell: ({ row }) => {
        const n = row.original;
        return <>{formatDisplayDate(n.startDate)} – {formatDisplayDate(n.endDate)}</>;
      },
    },
    {
      accessorKey: "itemCount",
      header: "Items",
      meta: { align: "right", className: "font-mono" },
      cell: ({ row }) => <span className="text-foreground">{row.original.itemCount}</span>,
    },
    {
      accessorKey: "totalAmount",
      header: "Total",
      meta: { align: "right", className: "font-mono" },
      cell: ({ row }) => <span className="text-foreground">{formatAmount(Number(row.original.totalAmount))}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      meta: { align: "center" },
      cell: ({ row }) => (
        <Badge variant={statusBadge(row.original.status) as "default" | "secondary" | "destructive" | "outline"} className="text-xs">{row.original.status}</Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      meta: { align: "right" },
      cell: ({ row }) => {
        const n = row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={() => handlePreview(n.id)}><Eye /></Button>} />
              <TooltipContent>Preview</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={() => handleExport(n.id)}><FileSpreadsheet /></Button>} />
              <TooltipContent>Export Excel</TooltipContent>
            </Tooltip>
            {n.status !== "sending" && (
              <Tooltip>
                <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={() => handleResend(n)}><Send /></Button>} />
                <TooltipContent>{n.status === "pending" ? "Send Email" : "Resend Email"}</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={() => handleDelete(n.id)}><Trash2 /></Button>} />
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </div>
        );
      },
    },
  ], [statusBadge, handlePreview, handleExport, handleResend, handleDelete]);

  return (
    <PageContent>
      <ListPageLayout
      title="Debit Notes"
      description={`${total} debit note${total !== 1 ? "s" : ""} found`}
      actions={(
        <>
          {sendingEmails && progress && (
            <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-xl">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <span className="text-xs font-bold text-primary">{progress.status}</span>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger render={<Button
            variant="outline"
            size="icon"
            onClick={fetchNotes}
          >
            <RefreshCw className={loading ? "animate-spin" : ""} />
          </Button>} />
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
          <Button
            variant="outline"
            onClick={handleBulkExport}
            title="Bulk Export to ZIP"
          >
            <Download />
            <span>Export</span>
          </Button>
          <Button
            onClick={handleSendEmails}
            disabled={sendingEmails}
          >
            <Send />
            <span>Send Emails</span>
          </Button>
          <Button
            onClick={() => setShowGenerate(true)}
          >
            <PlusCircle />
            <span>Generate</span>
          </Button>
          {total > 0 && hasActiveFilters && (
            <Button variant="destructive" onClick={handleBulkDelete}>
              <Trash2 /><span>Delete Filtered</span>
            </Button>
          )}
        </>
      )}
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Search by reference, warehouse, department, or status..."
      activeFilterCount={[warehouse, department, campus, statusFilter, startDate, endDate].filter(Boolean).length}
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
          {(warehouse || department || campus || statusFilter || startDate || endDate || searchQuery) && (
            <Button variant="ghost" onClick={clearFilters}>Clear all</Button>
          )}
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
        </>
      )}
    >
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel || "Confirm"}
        cancelLabel="Cancel"
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />

      <DataTable<DebitNote>
        columns={columns}
        data={notes}
        loading={loading}
        emptyIcon={<FileText className="w-8 h-8" />}
        emptyMessage="No debit notes found."
        emptyAction={{ label: "Generate one now", onClick: () => setShowGenerate(true) }}
        skeletonRows={4}
        getRowId={(n) => n.id}
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
        <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-card border border-destructive/20 rounded-2xl shadow-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-foreground">
                {progress.failed_count} email(s) failed
              </p>
              {progress.failed_notes?.slice(0, 3).map((msg, i) => (
                <p key={i} className="text-xs text-destructive mt-1">{msg}</p>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setProgress(null)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}
    </ListPageLayout>
    </PageContent>
  );
}
