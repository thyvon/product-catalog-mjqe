import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, RefreshCw, Pencil, Trash2, Mail, Upload, Download, Copy } from "lucide-react";
import DataTable from "@/features/shared/components/DataTable";
import ListPageLayout from "@/features/shared/components/ListPageLayout";
import PageContent from "@/features/shared/components/PageContent";
import SelectField from "@/features/shared/components/SelectField";
import TextField from "@/features/shared/components/TextField";
import ConfirmModal from "@/features/shared/components/ConfirmModal";
import BaseModal from "@/features/shared/components/BaseModal";
import { useToast } from "@/features/shared/components/Toast";
import { useConfirmModal } from "@/features/shared/hooks";
import DebitNoteEmailImportModal from "@/features/debit-notes/components/DebitNoteEmailImportModal";
import { FormLabel } from "@/features/shared/components/FormLabel";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface EmailConfig {
  id: string;
  warehouse: string;
  department: string;
  campus: string;
  division: string;
  receiverName: string;
  sendToEmail: string;
  ccToEmail: string;
  createdAt: string;
  updatedAt: string;
}

export default function DebitNoteEmailsPage() {
  const { toast } = useToast();
  const { confirmState, confirm, closeConfirm } = useConfirmModal();
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formData, setFormData] = useState({
    warehouse: "",
    department: "",
    campus: "",
    division: "",
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
    setFormData({ warehouse: "", department: "", campus: "", division: "", receiverName: "", sendToEmail: "", ccToEmail: "" });
    setShowForm(true);
  };

  const openEdit = (config: EmailConfig) => {
    setEditing(config);
    setFormData({
      warehouse: config.warehouse,
      department: config.department,
      campus: config.campus,
      division: config.division || "",
      receiverName: config.receiverName,
      sendToEmail: parseEmailList(config.sendToEmail).join("\n"),
      ccToEmail: parseEmailList(config.ccToEmail).join("\n"),
    });
    setShowForm(true);
  };

  const openDuplicate = (config: EmailConfig) => {
    setEditing(null);
    setFormData({
      warehouse: config.warehouse,
      department: config.department,
      campus: config.campus,
      division: config.division || "",
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
      division: formData.division,
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
    confirm(
      "Delete Email Config",
      "Are you sure you want to delete this email configuration?",
      async () => {
        closeConfirm();
        try {
          const res = await fetch(`/api/debit-note/emails/${id}`, { method: "DELETE" });
          if (res.ok) { fetchConfigs(); toast.success("Email configuration deleted."); }
          else toast.error("Failed to delete.");
        } catch {
          toast.error("Failed to delete.");
        }
      },
      "Delete",
    );
  };

  const hasActiveFilters = Boolean(searchQuery || warehouseFilter || departmentFilter || campusFilter);

  const filtered = configs.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || [c.warehouse, c.department, c.campus, c.division, c.receiverName].some((value) => value.toLowerCase().includes(q));
    const matchesWarehouse = !warehouseFilter || c.warehouse === warehouseFilter;
    const matchesDepartment = !departmentFilter || c.department === departmentFilter;
    const matchesCampus = !campusFilter || c.campus === campusFilter;
    return matchesSearch && matchesWarehouse && matchesDepartment && matchesCampus;
  });

  const handleBulkDelete = useCallback(() => {
    const ids = filtered.map((c) => c.id);
    confirm(
      "Delete All Filtered Email Configs",
      `Delete all ${ids.length} email config${ids.length !== 1 ? "s" : ""} matching current filters? This cannot be undone.`,
      async () => {
        closeConfirm();
        try {
          const res = await fetch("/api/debit-note/emails/bulk-delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
          });
          if (res.ok) {
            const data = await res.json();
            toast.success(`Deleted ${data.count} email config${data.count !== 1 ? "s" : ""}.`);
            setCurrentPage(1);
            fetchConfigs();
          } else {
            const data = await res.json();
            toast.error(data.error || "Failed to delete email configs.");
          }
        } catch {
          toast.error("Failed to delete email configs.");
        }
      },
      "Delete All",
    );
  }, [filtered, confirm, closeConfirm, fetchConfigs, toast]);

  const handleExport = useCallback(async () => {
    try {
      const XLSX = await import("xlsx");
      const columns = ["Warehouse", "Division", "Department", "Campus", "Receiver Name", "Send To Emails", "CC Emails"];
      const rows = filtered.map((c) => [
        c.warehouse,
        c.department,
        c.campus,
        c.division,
        c.receiverName,
        parseEmailList(c.sendToEmail).join(";"),
        parseEmailList(c.ccToEmail).join(";"),
      ]);
      const ws = XLSX.utils.aoa_to_sheet([columns, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Email Configs");
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Debit_Note_Email_Configs.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${filtered.length} email config${filtered.length !== 1 ? "s" : ""}.`);
    } catch {
      toast.error("Failed to export email configs.");
    }
  }, [filtered, toast]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (currentPage > totalPages) setCurrentPage(totalPages);
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
    ...filterValues.warehouses.map((w) => ({ value: w, label: w })),
  ], [filterValues.warehouses]);

  const departmentOptions = useMemo(() => [
    { value: "", label: "All Departments" },
    ...filterValues.departments.map((d) => ({ value: d, label: d })),
  ], [filterValues.departments]);

  const campusOptions = useMemo(() => [
    { value: "", label: "All Campuses" },
    ...filterValues.campuses.map((c) => ({ value: c, label: c })),
  ], [filterValues.campuses]);

  return (
    <PageContent>
      <ListPageLayout
        title="Debit Note Email Configurations"
        description={`${filtered.length} email config${filtered.length !== 1 ? "s" : ""} found`}
        actions={(
          <>
            <Button variant="outline" onClick={() => setShowImportModal(true)}>
              <Upload />
              <span>Import</span>
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download />
              <span>Export</span>
            </Button>
            <Tooltip>
              <TooltipTrigger render={<Button variant="outline" size="icon" onClick={fetchConfigs}>
                <RefreshCw className={loading ? "animate-spin" : ""} />
              </Button>} />
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
            <Button onClick={openCreate}>
              <PlusCircle />
              <span>Add Config</span>
            </Button>
            {filtered.length > 0 && hasActiveFilters && (
              <Button variant="destructive" onClick={handleBulkDelete}>
                <Trash2 /><span>Delete Filtered</span>
              </Button>
            )}
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
        <DebitNoteEmailImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportComplete={fetchConfigs}
        />

        <ConfirmModal
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel ?? "Delete"}
          onConfirm={confirmState.onConfirm}
          onCancel={closeConfirm}
        />

        <BaseModal
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          size="lg"
          title={editing ? "Edit Email Config" : "New Email Config"}
        >
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <FormLabel>Warehouse</FormLabel>
                <TextField type="text" value={formData.warehouse} onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })} placeholder="e.g. Main WH" />
              </div>
              <div>
                <FormLabel>Division</FormLabel>
                <TextField type="text" value={formData.division} onChange={(e) => setFormData({ ...formData, division: e.target.value })} placeholder="e.g. IT Support" />
              </div>
              <div>
                <FormLabel>Department</FormLabel>
                <TextField type="text" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} placeholder="e.g. IT" />
              </div>
              <div>
                <FormLabel>Campus</FormLabel>
                <TextField type="text" value={formData.campus} onChange={(e) => setFormData({ ...formData, campus: e.target.value })} placeholder="e.g. PP" />
              </div>
            </div>
            <div>
              <FormLabel>Receiver Name</FormLabel>
              <TextField type="text" value={formData.receiverName} onChange={(e) => setFormData({ ...formData, receiverName: e.target.value })} placeholder="e.g. Vun Thy" />
            </div>
            <div>
              <FormLabel required>Send To Emails </FormLabel>
              <Textarea
                value={formData.sendToEmail}
                onChange={(e) => setFormData({ ...formData, sendToEmail: e.target.value })}
                placeholder={"email1@example.com\nemail2@example.com"}
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">One email per line</p>
            </div>
            <div>
              <FormLabel>CC Emails (optional)</FormLabel>
              <Textarea
                value={formData.ccToEmail}
                onChange={(e) => setFormData({ ...formData, ccToEmail: e.target.value })}
                placeholder="cc1@example.com"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSave}>{editing ? "Update" : "Create"}</Button>
            </div>
          </div>
        </BaseModal>

        <DataTable<EmailConfig>
          columns={[
            { accessorKey: "warehouse", header: "Warehouse", meta: { className: "font-bold text-foreground" } },
            { accessorKey: "division", header: "Division", meta: { className: "text-muted-foreground" } },
            { accessorKey: "department", header: "Department", meta: { className: "text-muted-foreground" } },
            { accessorKey: "campus", header: "Campus", meta: { className: "text-muted-foreground" } },
            { accessorKey: "receiverName", header: "Receiver", meta: { className: "font-medium text-foreground" } },
            {
              accessorKey: "sendToEmail",
              header: "Send To",
              meta: { className: "text-muted-foreground" },
              cell: ({ row }) => (
                <div className="flex flex-wrap gap-1 max-w-[320px]">
                  {parseEmailList(row.original.sendToEmail).map((email) => (
                    <Badge key={email} className="border-emerald-200 bg-emerald-50 text-emerald-700 truncate max-w-full dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">{email}</Badge>
                  ))}
                </div>
              ),
            },
            {
              accessorKey: "ccToEmail",
              header: "CC",
              meta: { className: "text-muted-foreground" },
              cell: ({ row }) => (
                <div className="flex flex-wrap gap-1 max-w-[320px]">
                  {parseEmailList(row.original.ccToEmail).map((email) => (
                    <Badge key={email} className="border-amber-200 bg-amber-50 text-amber-700 truncate max-w-full dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">{email}</Badge>
                  ))}
                </div>
              ),
            },
            {
              id: "actions",
              header: "Actions",
              meta: { align: "right" },
              cell: ({ row }) => {
                const config = row.original;
                return (
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={() => openEdit(config)}><Pencil /></Button>} />
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={() => openDuplicate(config)}><Copy /></Button>} />
                      <TooltipContent>Duplicate</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={() => handleDelete(config.id)}><Trash2 /></Button>} />
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </div>
                );
              },
            },
          ] satisfies ColumnDef<EmailConfig>[]}
          data={paginatedConfigs}
          loading={loading}
          emptyIcon={<Mail className="w-8 h-8" />}
          emptyMessage={searchQuery ? "No email configs match your search." : "No email configurations found."}
          emptyAction={{ label: "Create one now", onClick: openCreate }}
          skeletonRows={3}
          getRowId={(config) => config.id}
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
    </PageContent>
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
