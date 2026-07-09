import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, Send, Download, Trash2, Eye, FileText, PlusCircle,
  Filter, Search, AlertCircle, X, Loader2, FileSpreadsheet,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

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
  const [showFilters, setShowFilters] = useState(false);

  // Generate modal
  const [showGenerate, setShowGenerate] = useState(false);
  const [genStartDate, setGenStartDate] = useState("");
  const [genEndDate, setGenEndDate] = useState("");
  const [genWarehouse, setGenWarehouse] = useState("");
  const [genDepartment, setGenDepartment] = useState("");
  const [genCampus, setGenCampus] = useState("");
  const [generating, setGenerating] = useState(false);

  // Email progress
  const [progress, setProgress] = useState<EmailProgress | null>(null);
  const [sendingEmails, setSendingEmails] = useState(false);

  // Preview modal
  const [previewNote, setPreviewNote] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Filter dropdown values
  const [filterValues, setFilterValues] = useState<{ warehouses: string[]; departments: string[]; campuses: string[] }>({
    warehouses: [], departments: [], campuses: [],
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

      const res = await fetch(`/api/debit-notes?${params}`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.data || []);
        setTotal(data.total || 0);
      }
    } catch { } finally { setLoading(false); }
  }, [warehouse, department, campus, statusFilter, startDate, endDate]);

  const fetchFilterValues = async () => {
    try {
      const res = await fetch("/api/debit-notes/filters/values");
      if (res.ok) setFilterValues(await res.json());
    } catch { }
  };

  useEffect(() => { fetchNotes(); }, [fetchNotes]);
  useEffect(() => { fetchFilterValues(); }, []);

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

  const handleGenerate = async () => {
    if (!genStartDate || !genEndDate) {
      alert("Start date and end date are required.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/debit-notes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: genStartDate,
          endDate: genEndDate,
          warehouse: genWarehouse || undefined,
          department: genDepartment || undefined,
          campus: genCampus || undefined,
          createdBy: user?.username || "system",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowGenerate(false);
        fetchNotes();
        alert(`Generated ${data.count} debit note(s) successfully.`);
      } else {
        alert(data.error || "Failed to generate.");
      }
    } catch {
      alert("Failed to generate debit notes.");
    } finally { setGenerating(false); }
  };

  const handleSendEmails = async () => {
    if (!confirm("Send emails for all pending debit notes with current filters?")) return;
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
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-gray-100 tracking-tight">
            Debit Notes
          </h1>
          <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
            {total} debit note{total !== 1 ? "s" : ""} found
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200 cursor-pointer transition-all"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>
          {(warehouse || department || campus || statusFilter || startDate || endDate) && (
            <button
              onClick={clearFilters}
              className="text-[10px] font-bold text-rose-500 hover:text-rose-600 cursor-pointer"
            >
              Clear all
            </button>
          )}
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <select
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-xs text-slate-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              <option value="">All Warehouses</option>
              {filterValues.warehouses.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-xs text-slate-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              <option value="">All Departments</option>
              {filterValues.departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select
              value={campus}
              onChange={(e) => setCampus(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-xs text-slate-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              <option value="">All Campuses</option>
              {filterValues.campuses.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-xs text-slate-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="sending">Sending</option>
              <option value="sent">Sent</option>
            </select>
            <input
              type="date" value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-xs text-slate-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              placeholder="Start date"
            />
            <input
              type="date" value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-xs text-slate-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              placeholder="End date"
            />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/30">
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Reference</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Warehouse</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Department</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Campus</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Period</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Items</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Total</th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Status</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50 dark:border-gray-800/50">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-200 dark:bg-gray-700 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : notes.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center">
                  <FileText className="w-8 h-8 text-slate-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 dark:text-gray-500">No debit notes found.</p>
                  <button
                    onClick={() => setShowGenerate(true)}
                    className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 cursor-pointer"
                  >
                    Generate one now
                  </button>
                </td></tr>
              ) : (
                notes.map((note) => (
                  <tr key={note.id} className="border-b border-slate-50 dark:border-gray-800/50 hover:bg-slate-50/50 dark:hover:bg-gray-800/20">
                    <td className="px-4 py-3 text-xs font-bold text-slate-700 dark:text-gray-300 font-mono">{note.referenceNumber}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-gray-400">{note.warehouse}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-gray-400">{note.department}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-gray-400">{note.campus}</td>
                    <td className="px-4 py-3 text-[10px] text-slate-500 dark:text-gray-500 font-mono">
                      {note.startDate} - {note.endDate}
                    </td>
                    <td className="px-4 py-3 text-xs text-right text-slate-700 dark:text-gray-300 font-mono">{note.itemCount}</td>
                    <td className="px-4 py-3 text-xs text-right text-slate-700 dark:text-gray-300 font-mono">
                      ${Number(note.totalAmount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${statusBadge(note.status)}`}>
                        {note.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handlePreview(note.id)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg cursor-pointer transition-all" title="Preview">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleExport(note.id)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg cursor-pointer transition-all" title="Export Excel">
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                        </button>
                        {note.status !== "sending" && (
                          <button onClick={() => handleResend(note.id)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg cursor-pointer transition-all" title="Resend Email">
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => handleDelete(note.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg cursor-pointer transition-all" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Modal */}
      {showGenerate && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-black text-slate-900 dark:text-gray-100">Generate Debit Notes</h2>
              <button onClick={() => !generating && setShowGenerate(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer transition-all">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 mb-1">Start Date *</label>
                  <input type="date" value={genStartDate} onChange={(e) => setGenStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 mb-1">End Date *</label>
                  <input type="date" value={genEndDate} onChange={(e) => setGenEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 -mt-2">Stock issue items within this date range will be grouped by warehouse/department/campus.</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 mb-1">Warehouse</label>
                  <input type="text" value={genWarehouse} onChange={(e) => setGenWarehouse(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    placeholder="Optional" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 mb-1">Department</label>
                  <input type="text" value={genDepartment} onChange={(e) => setGenDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    placeholder="Optional" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 mb-1">Campus</label>
                  <input type="text" value={genCampus} onChange={(e) => setGenCampus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    placeholder="Optional" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowGenerate(false)} disabled={generating}
                className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer disabled:opacity-50 transition-all">
                Cancel
              </button>
              <button onClick={handleGenerate} disabled={generating}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm cursor-pointer disabled:opacity-50 transition-all">
                {generating && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{generating ? "Generating..." : "Generate"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && previewNote && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-gray-800">
              <div>
                <h2 className="text-sm font-black text-slate-900 dark:text-gray-100">{previewNote.referenceNumber}</h2>
                <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-0.5">
                  {previewNote.department} - {previewNote.warehouse} | {previewNote.campus}
                </p>
              </div>
              <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer transition-all">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                <div className="bg-slate-50 dark:bg-gray-800 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase">Period</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-gray-300 mt-1">{previewNote.startDate} - {previewNote.endDate}</p>
                </div>
                <div className="bg-slate-50 dark:bg-gray-800 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase">Status</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-gray-300 mt-1 capitalize">{previewNote.status}</p>
                </div>
                <div className="bg-slate-50 dark:bg-gray-800 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase">Total Items</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-gray-300 mt-1">{previewNote.items?.length || 0}</p>
                </div>
                <div className="bg-slate-50 dark:bg-gray-800 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase">Total Amount</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-gray-300 mt-1">
                    ${(previewNote.items || []).reduce((s: number, i: any) => s + parseFloat(i.totalPrice || 0), 0).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-gray-700">
                      <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">#</th>
                      <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Code</th>
                      <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Description</th>
                      <th className="text-right px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Qty</th>
                      <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">UoM</th>
                      <th className="text-right px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">U/Price</th>
                      <th className="text-right px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Total</th>
                      <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Date</th>
                      <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Requester</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewNote.items?.map((item: any, i: number) => (
                      <tr key={item.id} className="border-b border-slate-50 dark:border-gray-800/50">
                        <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                        <td className="px-3 py-2 font-mono text-slate-700 dark:text-gray-300">{item.itemCode}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-gray-400 max-w-[200px] truncate">{item.description}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-gray-300">{item.quantity}</td>
                        <td className="px-3 py-2 text-slate-500">{item.uom}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-gray-300">${parseFloat(item.unitPrice).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-gray-300">${parseFloat(item.totalPrice).toFixed(2)}</td>
                        <td className="px-3 py-2 text-slate-500">{item.transactionDate}</td>
                        <td className="px-3 py-2 text-slate-500">{item.requesterName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
