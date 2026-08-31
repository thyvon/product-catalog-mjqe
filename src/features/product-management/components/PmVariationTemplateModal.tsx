import { useEffect, useState } from "react";
import BaseModal from "@/features/shared/components/BaseModal";
import { Field } from "@/features/shared/components/Field";
import SelectField from "@/features/shared/components/SelectField";
import TextField from "@/features/shared/components/TextField";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { pmSaveVariationTemplate } from "@/features/product-management/api";
import type { PMVariationTemplate, PMVariationTemplateValue } from "@/features/shared/types";
import { useToast } from "@/features/shared/components/Toast";
import { PmModalFooter } from "./PmShared";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editing: PMVariationTemplate | null;
  onSaved: () => void;
}

interface ValueRow {
  id?: string;
  name: string;
  sort_order: string;
}

export default function PmVariationTemplateModal({ isOpen, onClose, editing, onSaved }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");
  const [values, setValues] = useState<ValueRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(editing?.name ?? "");
    setStatus(editing?.status ?? "Active");
    const existing = (editing?.values ?? []).map((v: PMVariationTemplateValue) => ({
      id: v.id,
      name: v.name,
      sort_order: String(v.sort_order ?? 0),
    }));
    setValues(existing.length > 0 ? existing : [{ name: "", sort_order: "10" }]);
  }, [isOpen, editing]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Template name is required.");
      return;
    }
    if (name.trim().length > 150) {
      toast.error("Template name is too long (max 150 characters).");
      return;
    }
    if (values.length === 0) {
      toast.error("Add at least one value.");
      return;
    }
    const seenNames = new Set<string>();
    for (const v of values) {
      if (!v.name.trim()) {
        toast.error("Each variation value needs a name.");
        return;
      }
      if (v.name.trim().length > 150) {
        toast.error("Variation value name is too long (max 150 characters).");
        return;
      }
      const nameKey = v.name.trim().toLowerCase();
      if (seenNames.has(nameKey)) {
        toast.error(`Variation value "${v.name.trim()}" cannot be duplicated in a template.`);
        return;
      }
      seenNames.add(nameKey);
      if (v.sort_order !== "" && (!Number.isInteger(Number(v.sort_order)) || Number(v.sort_order) < 0 || Number(v.sort_order) > 65535)) {
        toast.error("Sort order must be a whole number between 0 and 65535.");
        return;
      }
    }
    setSaving(true);
    try {
      await pmSaveVariationTemplate(
        {
          name: name.trim(),
          status,
          values: values.map((v, i) => ({
            ...(v.id ? { id: v.id } : {}),
            name: v.name.trim(),
            sort_order: v.sort_order !== "" ? Number(v.sort_order) : (i + 1) * 10,
          })),
        },
        editing?.id
      );
      toast.success(editing ? "Variation template updated." : "Variation template created.");
      onClose();
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateValue = (index: number, next: Partial<ValueRow>) => {
    setValues((prev) => prev.map((v, i) => (i === index ? { ...v, ...next } : v)));
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? "Edit Variation Template" : "Add Variation Template"}
      size="2xl"
      maxHeight="max-h-[90vh] overflow-y-auto"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Template Name" wide>
            <TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Size, Color, Material" />
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
        </div>

        <div className="rounded-lg border border-border p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Variation Values</h3>
              <p className="text-sm text-muted-foreground">Examples: Small, Medium, Large or Red, Blue, Black.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setValues((prev) => [...prev, { name: "", sort_order: String((prev.length + 1) * 10) }])}
            >
              <Plus />
              <span>Add Value</span>
            </Button>
          </div>

          {values.length === 0 && (
            <p className="mb-3 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              No values yet. Add at least one value.
            </p>
          )}

          {values.length > 0 && (
            <div className="space-y-2">
              {values.map((v, index) => (
                <div key={v.id ?? `new-${index}`} className="grid grid-cols-[1fr_8rem_auto] items-center gap-2">
                  <TextField
                    value={v.name}
                    onChange={(e) => updateValue(index, { name: e.target.value })}
                    placeholder="Value name"
                  />
                  <TextField
                    value={v.sort_order}
                    onChange={(e) => updateValue(index, { sort_order: e.target.value })}
                    placeholder="Sort order"
                    type="number"
                    min={0}
                    max={65535}
                    step={1}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive disabled:opacity-40"
                    disabled={values.length <= 1}
                    onClick={() => setValues((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
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
