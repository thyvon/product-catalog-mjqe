import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import BaseModal from "@/features/shared/components/BaseModal";
import DatePicker from "@/features/shared/components/DatePicker";
import SelectField from "@/features/shared/components/SelectField";
import TextField from "@/features/shared/components/TextField";
import { useToast } from "@/features/shared/components/Toast";
import { FormLabel } from "@/features/shared/components/FormLabel";

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
    <BaseModal isOpen={isOpen} onClose={onClose} size="3xl" title={isEdit ? "Edit Stock Issue Item" : "New Stock Issue Item"} maxHeight="max-h-[90vh]" className="flex flex-col">

      <div className="p-5 overflow-y-auto flex-1 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <FormLabel required>Item Code </FormLabel>
            <TextField type="text" value={form.itemCode} onChange={(e) => update("itemCode", e.target.value)} />
          </div>
          <div>
            <FormLabel required>Description </FormLabel>
            <TextField type="text" value={form.description} onChange={(e) => update("description", e.target.value)} />
          </div>
          <div>
            <FormLabel>Transaction Date</FormLabel>
            <DatePicker value={form.transactionDate} onChange={(v) => update("transactionDate", v)} />
          </div>
          <div>
            <FormLabel>Quantity</FormLabel>
            <TextField type="number" value={form.quantity} onChange={(e) => update("quantity", Number(e.target.value))} />
          </div>
          <div>
            <FormLabel>UoM</FormLabel>
            <SelectField value={form.uom} onChange={(v) => update("uom", v)} options={uomOptions} containerClassName="w-full" />
          </div>
          <div>
            <FormLabel>Unit Price</FormLabel>
            <TextField type="number" step="any" value={form.unitPrice} onChange={(e) => update("unitPrice", Number(e.target.value))} />
          </div>
          <div>
            <FormLabel>Total Amount</FormLabel>
            <TextField type="number" step="any" value={form.totalPrice} onChange={(e) => update("totalPrice", Number(e.target.value))} />
          </div>
          <div>
            <FormLabel>Warehouse</FormLabel>
            <TextField type="text" value={form.warehouse} onChange={(e) => update("warehouse", e.target.value)} />
          </div>
          <div>
            <FormLabel>Transaction Type</FormLabel>
            <SelectField value={form.transactionType} onChange={(v) => update("transactionType", v)} options={transactionTypeOptions} containerClassName="w-full" />
          </div>
          <div>
            <FormLabel>Division</FormLabel>
            <TextField type="text" value={form.division} onChange={(e) => update("division", e.target.value)} />
          </div>
          <div>
            <FormLabel>Department</FormLabel>
            <TextField type="text" value={form.department} onChange={(e) => update("department", e.target.value)} />
          </div>
          <div>
            <FormLabel>Campus</FormLabel>
            <TextField type="text" value={form.campus} onChange={(e) => update("campus", e.target.value)} />
          </div>
          <div>
            <FormLabel>Requester</FormLabel>
            <TextField type="text" value={form.requesterName} onChange={(e) => update("requesterName", e.target.value)} />
          </div>
          <div>
            <FormLabel>Ref.No</FormLabel>
            <TextField type="text" value={form.referenceNo} onChange={(e) => update("referenceNo", e.target.value)} />
          </div>
          <div>
            <FormLabel>Account Code</FormLabel>
            <TextField type="text" value={form.accountCode} onChange={(e) => update("accountCode", e.target.value)} />
          </div>
          <div className="col-span-2 md:col-span-3">
            <FormLabel>Description/Purpose</FormLabel>
            <Textarea value={form.remarks} onChange={(e) => update("remarks", e.target.value)} rows={2} />
          </div>
        </div>
      </div>

      <Separator className="my-4" />
      <div className="p-4 flex justify-end gap-3 shrink-0">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          <span>{saving ? "Saving..." : isEdit ? "Update" : "Create"}</span>
        </Button>
      </div>
    </BaseModal>
  );
}