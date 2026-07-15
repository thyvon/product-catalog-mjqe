import { useEffect, useMemo, useState } from "react";
import { PlusCircle, RefreshCw, Pencil, Trash2, Mail, X } from "lucide-react";
import DataTable from "@/features/shared/components/DataTable";
import ListPageLayout from "@/features/shared/components/ListPageLayout";
import SelectField from "@/features/shared/components/SelectField";
import ConfirmModal from "@/features/shared/components/ConfirmModal";
import { useToast } from "@/features/shared/components/Toast";

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
  const { toast } = useToast();
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string }>({ isOpen: false, id: "" });
  const [configs, setConfigs] = useState<EmailConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EmailConfig | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [campusFilter, setCampusFilter] = useState("");
  const [filterValues, setFilterValues] = useState<{ warehouses: string[]; departments: string[]; campuses: string[] }>({
    warehouses: [],
    departments: [],
    campuses: [],
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  const fetchFilterValues = async () => {
    try {
      const res = await fetch("/api/debit-note/emails/filters/values");
      if (res.ok) {
        setFilterValues(await res.json());
      }
    } catch {}
  };

  useEffect(() => { fetchConfigs(); fetchFilterValues(); }, []);

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
      sendToEmail: parseEmailList(config.sendToEmail).join("\n"),
      ccToEmail: parseEmailList(config.ccToEmail).join("\n"),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.warehouse || !formData.department || !formData.campus || !formData.receiverName) {
      toast.error("Warehouse, Department, Campus, and Receiver Name are required.");
      return;
    }

    const sendToEmails = formData.sendToEmail.split("\n").map((e) => e.trim()).filter(Boolean);
    const ccToEmails = formData.ccToEmail.split("\n").map((e) => e.trim()).filter(Boolean);

    if (sendToEmails.length === 0) {
      toast.error("At least one send-to email is required.");
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
        toast.success(editing ? "Email configuration updated." : "Email configuration created.");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save.");
      }
    } catch {
      toast.error("Failed to save email config.");
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    const id = deleteConfirm.id;
    setDeleteConfirm({ isOpen: false, id: "" });
    try {
      const res = await fetch(`/api/debit-note/emails/${id}`, { method: "DELETE" });
      if (res.ok) { fetchConfigs(); toast.success("Email configuration deleted."); }
      else toast.error("Failed to delete.");
    } catch {
      toast.error("Failed to delete.");
    }
  };

  const filtered = configs.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || [c.warehouse, c.department, c.campus, c.receiverName].some((value) => value.toLowerCase().includes(q));
    const matchesWarehouse = !warehouseFilter || c.warehouse === warehouseFilter;
    const matchesDepartment = !departmentFilter || c.department === departmentFilter;
    const matchesCampus = !campusFilter || c.campus === campusFilter;
    return matchesSearch && matchesWarehouse && matchesDepartment && matchesCampus;
  });

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, filtered.length, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, warehouseFilter, departmentFilter, campusFilter]);

  const paginatedConfigs = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filtered.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filtered, pageSize]);

  const warehouseOptions = useMemo(() => [
    { value: "", label: "All Warehouses" },
    ...filterValues.warehouses.map((warehouse) => ({ value: warehouse, label: warehouse })),
  ], [filterValues.warehouses]);

  const departmentOptions = useMemo(() => [
    { value: "", label: "All Departments" },
    ...filterValues.departments.map((department) => ({ value: department, label: department })),
  ], [filterValues.departments]);

  const campusOptions = useMemo(() => [
    { value: "", label: "All Campuses" },
    ...filterValues.campuses.map((campus) => ({ value: campus, label: campus })),
  ], [filterValues.campuses]);

  return (
    <ListPageLayout
      title="Debit Note Email Configurations"
      description={`${filtered.length} email config${filtered.length !== 1 ? "s" : ""} found`}
      actions={(
        <>
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
        </>
      )}
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Search by warehouse, department, campus, or receiver..."
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
        </>
      )}
    >
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Delete Email Config"
        message="Are you sure you want to delete this email configuration?"
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: "" })}
      />

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

      <DataTable<EmailConfig>
        columns={[
          { key: "warehouse", header: "Warehouse", cellClassName: "font-bold text-slate-700 dark:text-gray-300" },
          { key: "department", header: "Department", cellClassName: "text-slate-600 dark:text-gray-400" },
          { key: "campus", header: "Campus", cellClassName: "text-slate-600 dark:text-gray-400" },
          { key: "receiverName", header: "Receiver", cellClassName: "font-medium text-slate-700 dark:text-gray-300" },
          { key: "sendToEmail", header: "Send To", cellClassName: "text-slate-500 dark:text-gray-400", render: (config) => parseEmailList(config.sendToEmail).join(", ") },
          { key: "ccToEmail", header: "CC", cellClassName: "text-slate-400 dark:text-gray-500", render: (config) => parseEmailList(config.ccToEmail).join(", ") },
          { key: "actions", header: "Actions", align: "right", cellClassName: "text-right", render: (config) => (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => openEdit(config)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg cursor-pointer transition-all" title="Edit">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleDelete(config.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg cursor-pointer transition-all" title="Delete">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )},
        ]}
        data={paginatedConfigs}
        loading={loading}
        emptyIcon={<Mail className="w-8 h-8" />}
        emptyMessage={searchQuery ? "No email configs match your search." : "No email configurations found."}
        emptyAction={{ label: "Create one now", onClick: openCreate }}
        skeletonRows={3}
        rowKey={(config) => config.id}
        pagination={{
          currentPage,
          pageSize,
          total: filtered.length,
          onPageChange: setCurrentPage,
          onPageSizeChange: setPageSize,
          pageSizeOptions: [10, 25, 50, 100],
        }}
      />
    </ListPageLayout>
  );
}

function parseEmailList(value: string | null | undefined): string[] {
  try {
    if (!value) return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [parsed].filter(Boolean);
  } catch {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
}
