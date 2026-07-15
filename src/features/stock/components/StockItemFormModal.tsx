import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import BaseModal from "@/features/shared/components/BaseModal";
import DatePicker from "@/features/shared/components/DatePicker";
import SelectField from "@/features/shared/components/SelectField";
import { useToast } from "@/features/shared/components/Toast";

interface StockItemFormData {
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

interface StockItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editItem?: StockItemFormData & { id: string } | null;
}

const defaultForm: StockItemFormData = {
  itemCode: "", description: "", quantity: 0, uom: "Pcs", unitPrice: 0, totalPrice: 0,
  transactionDate: "", warehouse: "", division: "", department: "", campus: "",
  requesterName: "", referenceNo: "", transactionType: "", accountCode: "", remarks: "",
};

const transactionTypeOptions = [
  { value: "", label: "Select Type" },
  { value: "Issue", label: "Issue" },
  { value: "Transfer", label: "Transfer" },
  { value: "Return", label: "Return" },
  { value: "Adjustment", label: "Adjustment" },
];

const uomOptions = [
  { value: "Pcs", label: "Pcs" },
  { value: "Box", label: "Box" },
  { value: "Doz", label: "Doz" },
  { value: "Kg", label: "Kg" },
  { value: "Ltr", label: "Ltr" },
  { value: "Mtr", label: "Mtr" },
  { value: "Pack", label: "Pack" },
  { value: "Set", label: "Set" },
];

export default function StockItemFormModal({ isOpen, onClose, onSaved, editItem }: StockItemFormModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<StockItemFormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const isEdit = !!editItem;

  useEffect(() => {
    if (isOpen) {
      if (editItem) {
        const { id: _, ...rest } = editItem;
        if (rest.transactionDate) {
          rest.transactionDate = rest.transactionDate.slice(0, 10);
        }
        setForm(rest);
      } else {
        setForm(defaultForm);
      }
    }
  }, [isOpen, editItem]);

  const update = (field: keyof StockItemFormData, value: any) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.itemCode || !form.description) {
      toast.error("Item code and description are required.");
      return;
    }
    setSaving(true);
    try {
      const url = isEdit ? `/api/stock-issue-items/${editItem!.id}` : "/api/stock-issue-items";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) {
        toast.success(isEdit ? "Stock issue item updated." : "Stock issue item created.");
        onSaved();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save.");
      }
    } catch {
      toast.error("Failed to save stock issue item.");
    } finally { setSaving(false); }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-3xl" maxHeight="max-h-[90vh]" className="flex flex-col">
      <div className="p-5 border-b border-slate-100 dark:border-gray-800 flex items-center justify-between shrink-0">
        <h2 className="text-sm font-black text-slate-900 dark:text-gray-100">
          {isEdit ? "Edit Stock Issue Item" : "New Stock Issue Item"}
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer transition-all">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="p-5 overflow-y-auto flex-1 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-gray-400">Item Code <span className="text-rose-500">*</span></label>
            <input type="text" value={form.itemCode} onChange={(e) => update("itemCode", e.target.value)}
              className="h-[38px] w-full rounded-xl border border-slate-200 bg-white/90 px-3 text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-gray-400">Description <span className="text-rose-500">*</span></label>
            <input type="text" value={form.description} onChange={(e) => update("description", e.target.value)}
              className="h-[38px] w-full rounded-xl border border-slate-200 bg-white/90 px-3 text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-gray-400">Transaction Date</label>
            <DatePicker value={form.transactionDate} onChange={(v) => update("transactionDate", v)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-gray-400">Quantity</label>
            <input type="number" value={form.quantity} onChange={(e) => update("quantity", Number(e.target.value))}
              className="h-[38px] w-full rounded-xl border border-slate-200 bg-white/90 px-3 text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-gray-400">UoM</label>
            <SelectField value={form.uom} onChange={(v) => update("uom", v)} options={uomOptions} containerClassName="w-full" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-gray-400">Unit Price</label>
            <input type="number" step="0.01" value={form.unitPrice} onChange={(e) => update("unitPrice", Number(e.target.value))}
              className="h-[38px] w-full rounded-xl border border-slate-200 bg-white/90 px-3 text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-gray-400">Total Amount</label>
            <input type="number" step="0.01" value={form.totalPrice} onChange={(e) => update("totalPrice", Number(e.target.value))}
              className="h-[38px] w-full rounded-xl border border-slate-200 bg-white/90 px-3 text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-gray-400">Warehouse</label>
            <input type="text" value={form.warehouse} onChange={(e) => update("warehouse", e.target.value)}
              className="h-[38px] w-full rounded-xl border border-slate-200 bg-white/90 px-3 text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-gray-400">Transaction Type</label>
            <SelectField value={form.transactionType} onChange={(v) => update("transactionType", v)} options={transactionTypeOptions} containerClassName="w-full" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-gray-400">Division</label>
            <input type="text" value={form.division} onChange={(e) => update("division", e.target.value)}
              className="h-[38px] w-full rounded-xl border border-slate-200 bg-white/90 px-3 text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-gray-400">Department</label>
            <input type="text" value={form.department} onChange={(e) => update("department", e.target.value)}
              className="h-[38px] w-full rounded-xl border border-slate-200 bg-white/90 px-3 text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-gray-400">Campus</label>
            <input type="text" value={form.campus} onChange={(e) => update("campus", e.target.value)}
              className="h-[38px] w-full rounded-xl border border-slate-200 bg-white/90 px-3 text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-gray-400">Requester</label>
            <input type="text" value={form.requesterName} onChange={(e) => update("requesterName", e.target.value)}
              className="h-[38px] w-full rounded-xl border border-slate-200 bg-white/90 px-3 text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-gray-400">Ref.No</label>
            <input type="text" value={form.referenceNo} onChange={(e) => update("referenceNo", e.target.value)}
              className="h-[38px] w-full rounded-xl border border-slate-200 bg-white/90 px-3 text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-gray-400">Account Code</label>
            <input type="text" value={form.accountCode} onChange={(e) => update("accountCode", e.target.value)}
              className="h-[38px] w-full rounded-xl border border-slate-200 bg-white/90 px-3 text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300" />
          </div>
          <div className="col-span-2 md:col-span-3">
            <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-gray-400">Description/Purpose</label>
            <textarea value={form.remarks} onChange={(e) => update("remarks", e.target.value)} rows={2}
              className="w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300" />
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-100 dark:border-gray-800 flex justify-end gap-3 shrink-0">
        <button onClick={onClose} disabled={saving}
          className="px-4 py-2 border border-slate-200 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-600 dark:text-gray-400 rounded-xl font-bold text-xs cursor-pointer transition-all">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-sm cursor-pointer disabled:opacity-50 transition-all">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{saving ? "Saving..." : isEdit ? "Update" : "Create"}</span>
        </button>
      </div>
    </BaseModal>
  );
}