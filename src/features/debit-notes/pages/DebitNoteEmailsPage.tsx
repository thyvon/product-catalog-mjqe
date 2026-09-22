import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
import MultiSelectCombobox from "@/features/shared/components/MultiSelectCombobox";
import { debitNotesApi, type DebitNoteEmailConfig, type DnContact } from "@/features/debit-notes/api";

export default function DebitNoteEmailsPage() {
  const { toast } = useToast();
  const { confirmState, confirm, closeConfirm } = useConfirmModal();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DebitNoteEmailConfig | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [campusFilter, setCampusFilter] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: configs = [], isLoading: loading } = useQuery({
    queryKey: ["dn-email-configs"],
    queryFn: debitNotesApi.emailConfigs.list,
  });

  const { data: filterValues } = useQuery({
    queryKey: ["dn-email-config-filter-values"],
    queryFn: debitNotesApi.emailConfigs.getFilterValues,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["dn-contacts"],
    queryFn: () => debitNotesApi.contacts.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (args: { id?: string; data: Record<string, unknown> }) =>
      args.id
        ? debitNotesApi.emailConfigs.update(args.id, args.data)
        : debitNotesApi.emailConfigs.create(args.data),
    onSuccess: async (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dn-email-configs"] });
      setShowForm(false);
      toast.success(variables.id ? "Email configuration updated." : "Email configuration created.");
    },
    onError: async () => {
      toast.error("Failed to save.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => debitNotesApi.emailConfigs.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dn-email-configs"] });
      toast.success("Email configuration deleted.");
    },
    onError: () => toast.error("Failed to delete."),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => debitNotesApi.emailConfigs.bulkRemove(ids),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["dn-email-configs"] });
      toast.success("Email configs deleted.");
      setCurrentPage(1);
    },
    onError: () => toast.error("Failed to delete email configs."),
  });

  const [formData, setFormData] = useState({
    warehouse: "",
    department: "",
    campus: "",
    division: "",
    receiverName: "",
    sendToEmail: [] as string[],
    ccToEmail: [] as string[],
  });

  const openCreate = () => {
    setEditing(null);
    setFormData({ warehouse: "", department: "", campus: "", division: "", receiverName: "", sendToEmail: [], ccToEmail: [] });
    setShowForm(true);
  };

  const openEdit = (config: DebitNoteEmailConfig) => {
    setEditing(config);
    const sendTo = (config.contacts ?? []).filter((c) => c.type === "sendTo").map((c) => c.email);
    const ccTo = (config.contacts ?? []).filter((c) => c.type === "cc").map((c) => c.email);
    setFormData({
      warehouse: config.warehouse,
      department: config.department,
      campus: config.campus,
      division: config.division || "",
      receiverName: config.receiverName,
      sendToEmail: sendTo,
      ccToEmail: ccTo,
    });
    setShowForm(true);
  };

  const openDuplicate = (config: DebitNoteEmailConfig) => {
    setEditing(null);
    const sendTo = (config.contacts ?? []).filter((c) => c.type === "sendTo").map((c) => c.email);
    const ccTo = (config.contacts ?? []).filter((c) => c.type === "cc").map((c) => c.email);
    setFormData({
      warehouse: config.warehouse,
      department: config.department,
      campus: config.campus,
      division: config.division || "",
      receiverName: config.receiverName,
      sendToEmail: sendTo,
      ccToEmail: ccTo,
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!formData.warehouse || !formData.department || !formData.campus || !formData.receiverName) {
      toast.error("Warehouse, Department, Campus, and Receiver Name are required.");
      return;
    }
    const sendToEmails = formData.sendToEmail.filter(Boolean);
    if (sendToEmails.length === 0) {
      toast.error("At least one send-to email is required.");
      return;
    }
    saveMutation.mutate({ id: editing?.id, data: formData as unknown as Record<string, unknown> });
  };

  const handleDelete = (id: string) => {
    confirm(
      "Delete Email Config",
      "Are you sure you want to delete this email configuration?",
      () => { closeConfirm(); deleteMutation.mutate(id); },
      "Delete",
    );
  };

  const hasActiveFilters = Boolean(searchQuery || warehouseFilter || divisionFilter || departmentFilter || campusFilter);

  const filtered = useMemo(() => (configs as DebitNoteEmailConfig[]).filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || [c.warehouse, c.department, c.campus, c.division, c.receiverName].some((value) => value.toLowerCase().includes(q));
    const matchesWarehouse = !warehouseFilter || c.warehouse === warehouseFilter;
    const matchesDivision = !divisionFilter || c.division === divisionFilter;
    const matchesDepartment = !departmentFilter || c.department === departmentFilter;
    const matchesCampus = !campusFilter || c.campus === campusFilter;
    return matchesSearch && matchesWarehouse && matchesDivision && matchesDepartment && matchesCampus;
  }), [configs, searchQuery, warehouseFilter, divisionFilter, departmentFilter, campusFilter]);

  const handleBulkDelete = useCallback(() => {
    const ids = filtered.map((c) => c.id);
    confirm(
      "Delete All Filtered Email Configs",
      `Delete all ${ids.length} email config${ids.length !== 1 ? "s" : ""} matching current filters? This cannot be undone.`,
      () => { closeConfirm(); bulkDeleteMutation.mutate(ids); },
      "Delete All",
    );
  }, [filtered, confirm, closeConfirm, bulkDeleteMutation]);

  const handleExport = useCallback(async () => {
    try {
      const XLSX = await import("xlsx");
      const columns = ["Warehouse", "Division", "Department", "Campus", "Receiver Name"];
      const rows = filtered.map((c) => [
        c.warehouse,
        c.department,
        c.campus,
        c.division,
        c.receiverName,
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

  useEffect(() => { setCurrentPage(1); }, [searchQuery, warehouseFilter, departmentFilter, campusFilter]);

  const paginatedConfigs = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filtered.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filtered, pageSize]);

  const fv = useMemo(() => (filterValues as unknown as Record<string, string[]>) ?? {}, [filterValues]);

  const warehouseOptions = useMemo(() => [
    { value: "", label: "All Warehouses" },
    ...((fv.warehouses ?? []) as string[]).map((w) => ({ value: w, label: w })),
  ], [fv]);

  const divisionOptions = useMemo(() => [
    { value: "", label: "All Divisions" },
    ...((fv.divisions ?? []) as string[]).map((d) => ({ value: d, label: d })),
  ], [fv]);

  const departmentOptions = useMemo(() => [
    { value: "", label: "All Departments" },
    ...((fv.departments ?? []) as string[]).map((d) => ({ value: d, label: d })),
  ], [fv]);

  const campusOptions = useMemo(() => [
    { value: "", label: "All Campuses" },
    ...((fv.campuses ?? []) as string[]).map((c) => ({ value: c, label: c })),
  ], [fv]);

  const contactOptions = useMemo(() =>
    (contacts as DnContact[]).map((c) => ({ id: c.email, label: c.name ? `${c.name} <${c.email}>` : c.email })),
  [contacts]);

  const handleAddContact = async (label: string, field: "sendToEmail" | "ccToEmail") => {
    const email = label.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (formData[field].includes(email)) return;
    await debitNotesApi.contacts.create({ email, name: "" });
    queryClient.invalidateQueries({ queryKey: ["dn-contacts"] });
    setFormData({ ...formData, [field]: [...formData[field], email] });
  };

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
              <TooltipTrigger render={<Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ["dn-email-configs"] })}>
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
        searchPlaceholder="Search by warehouse, division, department, campus, or receiver..."
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
              value={divisionFilter}
              onChange={setDivisionFilter}
              placeholder="All Divisions"
              containerClassName="min-w-[140px]"
              options={divisionOptions}
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
          onImportComplete={() => queryClient.invalidateQueries({ queryKey: ["dn-email-configs"] })}
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
              <FormLabel required>Send To</FormLabel>
              <MultiSelectCombobox
                options={contactOptions}
                value={formData.sendToEmail}
                onValueChange={(ids) => setFormData({ ...formData, sendToEmail: ids })}
                placeholder="Search or type email..."
                emptyMessage="Press Enter to add"
                onCreate={async (label) => handleAddContact(label, "sendToEmail")}
              />
            </div>
            <div>
              <FormLabel>CC</FormLabel>
              <MultiSelectCombobox
                options={contactOptions}
                value={formData.ccToEmail}
                onValueChange={(ids) => setFormData({ ...formData, ccToEmail: ids })}
                placeholder="Search or type email..."
                emptyMessage="Press Enter to add"
                onCreate={async (label) => handleAddContact(label, "ccToEmail")}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>{editing ? "Update" : "Create"}</Button>
            </div>
          </div>
        </BaseModal>

        <DataTable<DebitNoteEmailConfig>
          tableLayout="auto"
          columns={[
            { accessorKey: "warehouse", header: "Warehouse", meta: { width: "120px", className: "font-bold text-foreground" } },
            { accessorKey: "division", header: "Division", meta: { width: "100px", className: "text-muted-foreground" } },
            { accessorKey: "department", header: "Department", meta: { width: "110px", className: "text-muted-foreground" } },
            { accessorKey: "campus", header: "Campus", meta: { width: "80px", className: "text-muted-foreground" } },
            { accessorKey: "receiverName", header: "Receiver", meta: { width: "120px", className: "font-medium text-foreground" } },
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
          ]}
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
