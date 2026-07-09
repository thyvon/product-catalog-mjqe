import { useState, useEffect } from "react";
import { PlusCircle, RefreshCw, Pencil, Trash2, Mail, X, Search } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

interface EmailConfig {
  id: string;
  warehouse: string;
  department: string;
  campus: string;
  receiverName: string;
  sendToEmail: string;
  ccToEmail: string;
  createdAt: string;
  updatedAt: string;
}

export default function DebitNoteEmailsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  const [configs, setConfigs] = useState<EmailConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EmailConfig | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    warehouse: "",
    department: "",
    campus: "",
    receiverName: "",
    sendToEmail: "",
    ccToEmail: "",
  });

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/debit-note/emails");
      if (res.ok) setConfigs(await res.json());
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { fetchConfigs(); }, []);

  const openCreate = () => {
    setEditing(null);
    setFormData({ warehouse: "", department: "", campus: "", receiverName: "", sendToEmail: "", ccToEmail: "" });
    setShowForm(true);
  };

  const openEdit = (config: EmailConfig) => {
    setEditing(config);
    setFormData({
      warehouse: config.warehouse,
      department: config.department,
      campus: config.campus,
      receiverName: config.receiverName,
      sendToEmail: JSON.parse(config.sendToEmail || "[]").join("\n"),
      ccToEmail: JSON.parse(config.ccToEmail || "[]").join("\n"),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.warehouse || !formData.department || !formData.campus || !formData.receiverName) {
      alert("Warehouse, Department, Campus, and Receiver Name are required.");
      return;
    }

    const sendToEmails = formData.sendToEmail.split("\n").map((e) => e.trim()).filter(Boolean);
    const ccToEmails = formData.ccToEmail.split("\n").map((e) => e.trim()).filter(Boolean);

    if (sendToEmails.length === 0) {
      alert("At least one send-to email is required.");
      return;
    }

    const payload = {
      warehouse: formData.warehouse,
      department: formData.department,
      campus: formData.campus,
      receiverName: formData.receiverName,
      sendToEmail: sendToEmails,
      ccToEmail: ccToEmails,
    };

    try {
      let res;
      if (editing) {
        res = await fetch(`/api/debit-note/emails/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/debit-note/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        setShowForm(false);
        fetchConfigs();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to save.");
      }
    } catch {
      alert("Failed to save email config.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this email configuration?")) return;
    try {
      const res = await fetch(`/api/debit-note/emails/${id}`, { method: "DELETE" });
      if (res.ok) fetchConfigs();
      else alert("Failed to delete.");
    } catch {
      alert("Failed to delete.");
    }
  };

  const filtered = configs.filter((c) =>
    !searchQuery || c.warehouse.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.campus.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.receiverName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-gray-100 tracking-tight">
            Debit Note Email Configurations
          </h1>
          <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
            Manage email recipients for debit note notifications.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchConfigs}
            className="p-2.5 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-500 dark:text-gray-400 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm cursor-pointer transition-all"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm cursor-pointer transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Config</span>
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by warehouse, department, campus, or receiver..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-gray-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-black text-slate-900 dark:text-gray-100">
                {editing ? "Edit Email Config" : "New Email Config"}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer transition-all">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 mb-1">Warehouse</label>
                  <input
                    type="text" value={formData.warehouse}
                    onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    placeholder="e.g. Main WH"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 mb-1">Department</label>
                  <input
                    type="text" value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    placeholder="e.g. IT"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 mb-1">Campus</label>
                  <input
                    type="text" value={formData.campus}
                    onChange={(e) => setFormData({ ...formData, campus: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    placeholder="e.g. PP"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 mb-1">Receiver Name</label>
                <input
                  type="text" value={formData.receiverName}
                  onChange={(e) => setFormData({ ...formData, receiverName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  placeholder="e.g. Vun Thy"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 mb-1">
                  Send To Emails <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={formData.sendToEmail}
                  onChange={(e) => setFormData({ ...formData, sendToEmail: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  placeholder="email1@example.com&#10;email2@example.com"
                  rows={3}
                />
                <p className="text-[10px] text-slate-400 mt-1">One email per line</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 mb-1">CC Emails (optional)</label>
                <textarea
                  value={formData.ccToEmail}
                  onChange={(e) => setFormData({ ...formData, ccToEmail: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  placeholder="cc1@example.com"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm cursor-pointer transition-all"
              >
                {editing ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/30">
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Warehouse</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Department</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Campus</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Receiver</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Send To</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">CC</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50 dark:border-gray-800/50">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-200 dark:bg-gray-700 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center">
                  <Mail className="w-8 h-8 text-slate-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 dark:text-gray-500">No email configurations found.</p>
                </td></tr>
              ) : (
                filtered.map((config) => (
                  <tr key={config.id} className="border-b border-slate-50 dark:border-gray-800/50 hover:bg-slate-50/50 dark:hover:bg-gray-800/20">
                    <td className="px-4 py-3 text-xs font-bold text-slate-700 dark:text-gray-300">{config.warehouse}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-gray-400">{config.department}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-gray-400">{config.campus}</td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-700 dark:text-gray-300">{config.receiverName}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-gray-400">
                      {JSON.parse(config.sendToEmail || "[]").join(", ")}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 dark:text-gray-500">
                      {JSON.parse(config.ccToEmail || "[]").join(", ")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(config)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg cursor-pointer transition-all"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(config.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg cursor-pointer transition-all"
                          title="Delete"
                        >
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
    </div>
  );
}
