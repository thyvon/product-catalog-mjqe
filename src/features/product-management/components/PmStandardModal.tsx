import { useEffect, useState } from "react";
import BaseModal from "@/features/shared/components/BaseModal";
import { Field } from "@/features/shared/components/Field";
import SelectField from "@/features/shared/components/SelectField";
import TextField from "@/features/shared/components/TextField";
import Checkbox from "@/features/shared/components/Checkbox";
import DatePicker from "@/features/shared/components/DatePicker";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { api } from "@/features/shared/api/client";
import {
  pmSaveStandard,
  pmSaveStandardItem,
  pmDeleteStandardItem,
} from "@/features/product-management/api";
import type { PMProductGroup, PMStandard, PMStandardItem, PMVariant } from "@/features/shared/types";
import { useToast } from "@/features/shared/components/Toast";
import { PmModalFooter } from "./PmShared";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editing: PMStandard | null;
  productGroups: PMProductGroup[];
  variants: PMVariant[];
  onSaved: () => void;
}

export default function PmStandardModal({ isOpen, onClose, editing, productGroups, variants, onSaved }: Props) {
  const { toast } = useToast();
  const [productGroupId, setProductGroupId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");
  const [saving, setSaving] = useState(false);

  const [items, setItems] = useState<PMStandardItem[]>([]);
  const [addVariantId, setAddVariantId] = useState("");
  const [addPreferred, setAddPreferred] = useState(false);
  const [addFrom, setAddFrom] = useState("");
  const [addTo, setAddTo] = useState("");

  const loadItems = async (standardId: string) => {
    try {
      const std = await api.get<PMStandard>(`/api/pm/standards/${standardId}`);
      setItems(std.items ?? []);
    } catch {}
  };

  useEffect(() => {
    if (!isOpen) return;
    setProductGroupId(editing?.product_group_id ?? "");
    setCode(editing?.code ?? "");
    setName(editing?.name ?? "");
    setDescription(editing?.description ?? "");
    setStatus(editing?.status ?? "Active");
    setItems([]);
    if (editing) loadItems(editing.id);
  }, [isOpen, editing]);

  const handleSave = async () => {
    if (!code.trim() || !name.trim() || !productGroupId) {
      toast.error("Code, name, and product group are required.");
      return;
    }
    setSaving(true);
    try {
      await pmSaveStandard(
        {
          product_group_id: productGroupId,
          code: code.trim(),
          name: name.trim(),
          description,
          status,
        },
        editing?.id
      );
      toast.success(editing ? "Standard updated." : "Standard created.");
      onClose();
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddItem = async () => {
    if (!editing) return;
    if (!addVariantId) {
      toast.error("Select a variant.");
      return;
    }
    try {
      await pmSaveStandardItem({
        product_standard_id: editing.id,
        product_variant_id: addVariantId,
        is_preferred: addPreferred,
        effective_from: addFrom || null,
        effective_to: addTo || null,
        status: "Active",
      });
      setAddVariantId("");
      setAddPreferred(false);
      setAddFrom("");
      setAddTo("");
      await loadItems(editing.id);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? "Edit Standard" : "Add Standard"}
      size="3xl"
      maxHeight="max-h-[90vh] overflow-y-auto"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Product Group" wide>
            <SelectField
              value={productGroupId}
              onChange={setProductGroupId}
              placeholder="Select product group..."
              options={productGroups.map((g) => ({ value: g.id, label: `${g.code} — ${g.name}` }))}
            />
          </Field>
          <Field label="Code">
            <TextField value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. STD-001" />
          </Field>
          <Field label="Name">
            <TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="Standard name" />
          </Field>
          <Field label="Status">
            <SelectField
              value={status}
              onChange={(v) => setStatus(v as "Active" | "Inactive")}
              options={[
                { value: "Active", label: "Active" },
                { value: "Inactive", label: "Inactive" },
              ]}
            />
          </Field>
          <Field label="Description" wide>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </Field>
        </div>

        {editing && (
          <div className="rounded-lg border border-border p-4">
            <h3 className="mb-3 text-sm font-semibold">Standard Items</h3>
            {items.length > 0 && (
              <div className="mb-3 space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.variant_name || item.sku}</span>
                      <span className="text-muted-foreground">({item.product_code})</span>
                      {item.is_preferred && <Badge>Preferred</Badge>}
                      {item.effective_from && <span className="text-muted-foreground">from {item.effective_from}</span>}
                      {item.effective_to && <span className="text-muted-foreground">to {item.effective_to}</span>}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive"
                      onClick={async () => {
                        try {
                          await pmDeleteStandardItem(item.id);
                          await loadItems(editing.id);
                        } catch (err: any) {
                          toast.error(err.message);
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-end gap-2">
              <div className="w-56">
                <Field label="Variant">
                  <SelectField
                    value={addVariantId}
                    onChange={setAddVariantId}
                    placeholder="Select variant..."
                    options={variants.map((v) => ({ value: v.id, label: `${v.product_code} — ${v.name} (${v.sku})` }))}
                  />
                </Field>
              </div>
              <div className="pb-1">
                <Checkbox checked={addPreferred} onChange={setAddPreferred} label="Preferred" />
              </div>
              <div>
                <Field label="From">
                  <DatePicker value={addFrom} onChange={setAddFrom} placeholder="yyyy-mm-dd" />
                </Field>
              </div>
              <div>
                <Field label="To">
                  <DatePicker value={addTo} onChange={setAddTo} placeholder="yyyy-mm-dd" />
                </Field>
              </div>
              <Button variant="outline" onClick={handleAddItem}>Add</Button>
            </div>
          </div>
        )}
      </div>

      <PmModalFooter
        onCancel={onClose}
        onSave={handleSave}
        saving={saving}
        saveLabel={editing ? "Update" : "Create"}
      />
    </BaseModal>
  );
}