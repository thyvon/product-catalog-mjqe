import { useEffect, useMemo, useState } from "react";
import {
  PlusCircle,
  RefreshCw,
  Building2,
  SquarePen,
  Trash2,
  Eye,
  FileText,
} from "lucide-react";
import type { Supplier, SupplierInput } from "@/features/shared/types";
import SupplierFormModal from "@/features/suppliers/components/SupplierFormModal";
import { useToast } from "@/features/shared/components/Toast";
import ConfirmModal from "@/features/shared/components/ConfirmModal";
import DataTable from "@/features/shared/components/DataTable";
import ListPageLayout from "@/features/shared/components/ListPageLayout";
import SelectField from "@/features/shared/components/SelectField";

const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  Approved: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  Rejected: "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800",
  Suspended: "bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-gray-700",
};

export default function SupplierRegisterPage() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [filterValues, setFilterValues] = useState<{ statuses: string[]; applicationTypes: string[] }>({
    statuses: [],
    applicationTypes: [],
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/suppliers");
      if (!res.ok) throw new Error("Failed to fetch suppliers.");
      const data = await res.json();
      setSuppliers(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterValues = async () => {
    try {
      const res = await fetch("/api/suppliers/filters/values");
      if (res.ok) {
        setFilterValues(await res.json());
      }
    } catch {}
  };

  useEffect(() => {
    fetchSuppliers();
    fetchFilterValues();
  }, []);

  const handleSubmit = async (data: SupplierInput) => {
    try {
      const isEdit = !!editingSupplier;
      const url = isEdit ? `/api/suppliers/${editingSupplier!.id}` : "/api/suppliers";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save supplier.");
      }

      setIsFormOpen(false);
      setEditingSupplier(null);
      await fetchSuppliers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = (supplier: Supplier) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Supplier",
      message: `Are you sure you want to delete "${supplier.companyName}"? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch(`/api/suppliers/${supplier.id}`, { method: "DELETE" });
          if (!res.ok) throw new Error("Failed to delete supplier.");
          await fetchSuppliers();
        } catch (err: any) {
          toast.error(err.message);
        }
      },
    });
  };

  const filtered = suppliers.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      s.companyName.toLowerCase().includes(q) ||
      (s.companyNameKhmer || "").toLowerCase().includes(q) ||
      (s.oldSupplierCode || "").toLowerCase().includes(q) ||
      (s.productServiceType || "").toLowerCase().includes(q) ||
      s.contactPerson.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.phone.includes(q)
    );
    const matchesStatus = !statusFilter || s.status === statusFilter;
    const matchesType = !typeFilter || s.applicationType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, filtered.length, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, typeFilter]);

  const paginatedSuppliers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filtered.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filtered, pageSize]);

  const statusOptions = useMemo(() => [
    { value: "", label: "All Status" },
    ...filterValues.statuses.map((status) => ({ value: status, label: status })),
  ], [filterValues.statuses]);

  const typeOptions = useMemo(() => [
    { value: "", label: "All Types" },
    ...filterValues.applicationTypes.map((type) => ({ value: type, label: type === "update" ? "Update" : "New" })),
  ], [filterValues.applicationTypes]);

  return (
    <ListPageLayout
      title="Supplier Registration"
      description={`${filtered.length} supplier${filtered.length !== 1 ? "s" : ""} found`}
      actions={(
        <>
          <button
            onClick={fetchSuppliers}
            className="p-2.5 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-500 dark:text-gray-400 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm cursor-pointer transition-all"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => {
              setEditingSupplier(null);
              setIsFormOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm cursor-pointer transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Register Supplier</span>
          </button>
        </>
      )}
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Search suppliers by name, contact, email, or phone..."
      filters={(
        <>
          <SelectField
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="All Status"
            containerClassName="min-w-[140px]"
            options={statusOptions}
          />
          <SelectField
            value={typeFilter}
            onChange={setTypeFilter}
            placeholder="All Types"
            containerClassName="min-w-[140px]"
            options={typeOptions}
          />
        </>
      )}
    >
      <DataTable<Supplier>
        columns={[
          {
            key: "companyName",
            header: "Company",
            cellClassName: "font-bold text-slate-700 dark:text-gray-300",
            render: (supplier) => (
              <div>
                <div className="font-bold text-slate-700 dark:text-gray-300">{supplier.companyName}</div>
                {supplier.companyNameKhmer ? <div className="text-[10px] text-slate-400 dark:text-gray-500 mt-0.5">{supplier.companyNameKhmer}</div> : null}
              </div>
            ),
          },
          { key: "contactPerson", header: "Contact", cellClassName: "text-slate-600 dark:text-gray-400" },
          { key: "email", header: "Email", cellClassName: "text-slate-600 dark:text-gray-400" },
          { key: "phone", header: "Phone", cellClassName: "text-slate-500 dark:text-gray-400 font-mono" },
          { key: "productServiceType", header: "Service Type", cellClassName: "text-slate-500 dark:text-gray-400" },
          {
            key: "status",
            header: "Status",
            render: (supplier) => (
              <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${STATUS_STYLES[supplier.status] || STATUS_STYLES.Pending}`}>
                {supplier.status}
              </span>
            ),
          },
          {
            key: "applicationType",
            header: "Type",
            render: (supplier) => (
              <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${supplier.applicationType === "update" ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" : "bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400"}`}>
                {supplier.applicationType === "update" ? "Update" : "New"}
              </span>
            ),
          },
          {
            key: "actions",
            header: "Actions",
            align: "right",
            render: (supplier) => (
              <div className="flex items-center justify-end gap-1">
                <button onClick={() => { setViewingSupplier(supplier); setIsViewOpen(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg cursor-pointer transition-all" title="View details">
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => { setEditingSupplier(supplier); setIsFormOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg cursor-pointer transition-all" title="Edit">
                  <SquarePen className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(supplier)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg cursor-pointer transition-all" title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ),
          },
        ]}
        data={paginatedSuppliers}
        loading={loading}
        emptyIcon={<Building2 className="w-8 h-8" />}
        emptyMessage={searchQuery ? "No suppliers match your search." : "No suppliers registered yet."}
        emptyAction={{ label: "Register one now", onClick: () => { setEditingSupplier(null); setIsFormOpen(true); } }}
        skeletonRows={5}
        rowKey={(supplier) => supplier.id}
        pagination={{
          currentPage,
          pageSize,
          total: filtered.length,
          onPageChange: setCurrentPage,
          onPageSizeChange: setPageSize,
          pageSizeOptions: [10, 25, 50, 100],
        }}
      />

      <SupplierFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingSupplier(null);
        }}
        onSubmit={handleSubmit}
        editingSupplier={editingSupplier}
      />

      {isViewOpen && viewingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/20 dark:bg-black/40" onClick={() => setIsViewOpen(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-3xl border border-slate-100 dark:border-gray-800 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 dark:text-gray-100">Supplier Details</h2>
              <button onClick={() => setIsViewOpen(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer transition-all">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-gray-100">{viewingSupplier.companyName}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLES[viewingSupplier.status]}`}>
                  {viewingSupplier.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <DetailRow label="Application" value={viewingSupplier.applicationType === "update" ? "Update existing supplier" : "New supplier"} />
                <DetailRow label="Old Supplier Code" value={viewingSupplier.oldSupplierCode || "-"} />
                <DetailRow label="Type" value={viewingSupplier.registrationType === "vat" ? "VAT / Overseas" : "Non-VAT"} />
                <DetailRow label="Established Year" value={viewingSupplier.establishedYear || "-"} />
                <DetailRow label="Business Activity" value={viewingSupplier.businessActivity || "-"} />
                <DetailRow label="Product / Service" value={viewingSupplier.productServiceType || "-"} />
                <DetailRow label="Contact Person" value={viewingSupplier.contactPerson || "—"} />
                <DetailRow label="Email" value={viewingSupplier.email || "—"} />
                <DetailRow label="Phone" value={viewingSupplier.phone || "—"} />
                <div className="col-span-2">
                  <DetailRow label="Address" value={viewingSupplier.address || "—"} />
                </div>
              </div>
              <div className="border-t border-slate-100 dark:border-gray-800 pt-4">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-2">Documents</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <DetailRow label="Business License" value={viewingSupplier.businessLicense || "—"} />
                  <DetailRow label="Commercial Reg." value={viewingSupplier.commercialRegistration || "—"} />
                  <DetailRow label="Tax Registration" value={viewingSupplier.taxRegistration || "-"} />
                  <DetailRow label="National ID" value={viewingSupplier.nationalId || "-"} />
                  <DetailRow label="VAT Certificate" value={viewingSupplier.vatCertificate || "—"} />
                  <DetailRow label="Patent Tax" value={viewingSupplier.patentTaxCertificate || "—"} />
                  <DetailRow label="Other Documents" value={viewingSupplier.otherDocuments || "-"} />
                </div>
              </div>
              <div className="border-t border-slate-100 dark:border-gray-800 pt-4">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-2">Bank Info</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <DetailRow label="Bank Name" value={viewingSupplier.bankName || "—"} />
                  <DetailRow label="Account Name" value={viewingSupplier.accountHolderName || "-"} />
                  <DetailRow label="Account No." value={viewingSupplier.bankAccount || "—"} />
                  <DetailRow label="Payment Method" value={formatPaymentMethod(viewingSupplier)} />
                  <DetailRow label="Payment Term" value={formatPaymentTerm(viewingSupplier)} />
                </div>
              </div>
              <div className="border-t border-slate-100 dark:border-gray-800 pt-4">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-2">Declaration</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <DetailRow label="Conflict of Interest" value={viewingSupplier.conflictOfInterest ? "Yes" : "No"} />
                  <DetailRow label="Supplier Rep." value={viewingSupplier.supplierDeclarationName || "-"} />
                  <DetailRow label="Declaration Date" value={viewingSupplier.supplierDeclarationDate || "-"} />
                  <DetailRow label="Buyer Completed By" value={viewingSupplier.buyerCompletedName || "-"} />
                </div>
                {viewingSupplier.conflictDetails && (
                  <p className="mt-2 text-xs text-slate-600 dark:text-gray-300">{viewingSupplier.conflictDetails}</p>
                )}
              </div>
              {viewingSupplier.companyProfile && (
                <div className="border-t border-slate-100 dark:border-gray-800 pt-4">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-2">Company Profile</h4>
                  <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed">{viewingSupplier.companyProfile}</p>
                </div>
              )}
              {viewingSupplier.notes && (
                <div className="border-t border-slate-100 dark:border-gray-800 pt-4">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-2">Notes</h4>
                  <p className="text-xs text-slate-600 dark:text-gray-300">{viewingSupplier.notes}</p>
                </div>
              )}
              <div className="border-t border-slate-100 dark:border-gray-800 pt-3 flex items-center gap-2 text-[10px] text-slate-400 dark:text-gray-500">
                <DetailRow label="Code of Conduct" value={viewingSupplier.codeOfConductAck ? "Acknowledged" : "Not Acknowledged"} />
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />
    </ListPageLayout>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider block">{label}</span>
      <span className="text-xs text-slate-700 dark:text-gray-300 font-medium">{value}</span>
    </div>
  );
}

function formatPaymentMethod(supplier: Supplier) {
  const labels: Record<Supplier["paymentMethod"], string> = {
    "bank-transfer": "Bank transfer",
    cheque: "Cheque",
    cash: "Cash",
    other: supplier.paymentMethodOther || "Other",
  };
  return labels[supplier.paymentMethod] || "-";
}

function formatPaymentTerm(supplier: Supplier) {
  const labels: Record<Supplier["paymentTerm"], string> = {
    "no-credit": "No credit",
    "one-week": "Credit 1 week",
    "two-weeks": "Credit 2 weeks",
    "one-month": "Credit 1 month",
    other: supplier.paymentTermOther || "Other",
  };
  return labels[supplier.paymentTerm] || "-";
}
