import { useState, useEffect } from "react";
import {
  PlusCircle,
  Search,
  RefreshCw,
  Building2,
  AlertCircle,
  SquarePen,
  Trash2,
  Eye,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { Supplier, SupplierInput } from "../types";
import SupplierFormModal from "../components/SupplierFormModal";
import ConfirmModal from "../components/ConfirmModal";
import AlertModal from "../components/AlertModal";

const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  Approved: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  Rejected: "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800",
  Suspended: "bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-gray-700",
};

export default function SupplierRegisterPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  const [alertMessage, setAlertMessage] = useState("");
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const showAlert = (message: string) => {
    setAlertMessage(message);
    setIsAlertOpen(true);
  };

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/suppliers");
      if (!res.ok) throw new Error("Failed to fetch suppliers.");
      const data = await res.json();
      setSuppliers(data);
    } catch (err: any) {
      showAlert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
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
      showAlert(err.message);
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
          showAlert(err.message);
        }
      },
    });
  };

  const filtered = suppliers.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      s.companyName.toLowerCase().includes(q) ||
      (s.companyNameKhmer || "").toLowerCase().includes(q) ||
      (s.oldSupplierCode || "").toLowerCase().includes(q) ||
      (s.productServiceType || "").toLowerCase().includes(q) ||
      s.contactPerson.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.phone.includes(q)
    );
  });

  return (
    <div className="p-4 lg:p-6 flex flex-col min-h-0 h-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-xs">
            <Building2 className="w-4 h-4" />
          </div>
          <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-gray-100 tracking-tight">
            Supplier Registration
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchSuppliers}
            className="p-2.5 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-500 dark:text-gray-400 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm cursor-pointer transition-all flex items-center justify-center h-9"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => {
              setEditingSupplier(null);
              setIsFormOpen(true);
            }}
            className="h-9 px-3.5 py-2 bg-slate-900 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer transition-all dark:bg-indigo-700 dark:hover:bg-indigo-800"
          >
            <PlusCircle className="w-4 h-4" /> Register Supplier
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl p-4 mb-4 shadow-sm shrink-0">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search suppliers by name, contact, email, or phone..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-gray-700 rounded-2xl text-xs bg-slate-50/20 dark:bg-gray-800/50 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-gray-200"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl p-5 animate-pulse">
                <div className="h-4 bg-slate-200 dark:bg-gray-700 rounded w-1/3 mb-3" />
                <div className="h-3 bg-slate-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-3xl max-w-lg mx-auto mt-8 p-8 shadow-sm">
            <Building2 className="w-12 h-12 text-slate-300 dark:text-gray-600 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-gray-200 mt-4">
              {searchQuery ? "No suppliers match your search" : "No suppliers registered"}
            </h3>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-2">
              {searchQuery ? "Try a different search term." : "Click 'Register Supplier' to add one."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-[10px] font-mono text-slate-400 dark:text-gray-500 font-bold uppercase tracking-widest px-1">
              {filtered.length} supplier{filtered.length !== 1 ? "s" : ""}
            </div>
            {filtered.map((supplier) => (
              <motion.div
                key={supplier.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-gray-100 truncate">
                        {supplier.companyName}
                      </h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLES[supplier.status] || STATUS_STYLES.Pending}`}>
                        {supplier.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-gray-400">
                      <span>{supplier.contactPerson}</span>
                      <span>{supplier.email}</span>
                      <span>{supplier.phone}</span>
                      {supplier.productServiceType && <span>{supplier.productServiceType}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-gray-700">
                        {supplier.applicationType === "update" ? "Update" : "New"}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        supplier.registrationType === "vat"
                          ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
                          : "bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-gray-700"
                      }`}>
                        {supplier.registrationType === "vat" ? "VAT" : "Non-VAT"}
                      </span>
                      {supplier.codeOfConductAck && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          <FileText className="w-3 h-3" /> Code of Conduct Signed
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setViewingSupplier(supplier);
                        setIsViewOpen(true);
                      }}
                      className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer transition-all"
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingSupplier(supplier);
                        setIsFormOpen(true);
                      }}
                      className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer transition-all"
                      title="Edit"
                    >
                      <SquarePen className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(supplier)}
                      className="p-2 text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl cursor-pointer transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <SupplierFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingSupplier(null);
        }}
        onSubmit={handleSubmit}
        editingSupplier={editingSupplier}
      />

      <AnimatePresence>
        {isViewOpen && viewingSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/20 dark:bg-black/40" onClick={() => setIsViewOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white dark:bg-gray-900 rounded-3xl border border-slate-100 dark:border-gray-800 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AlertModal isOpen={isAlertOpen} message={alertMessage} onClose={() => setIsAlertOpen(false)} />
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
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
