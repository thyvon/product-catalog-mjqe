import { useEffect, useState } from "react";
import BaseModal from "@/features/shared/components/BaseModal";
import { Field } from "@/features/shared/components/Field";
import SelectField from "@/features/shared/components/SelectField";
import TextField from "@/features/shared/components/TextField";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PlusCircle, Trash2, Sparkles } from "lucide-react";
import {
  pmSaveCategory,
  pmSaveProductGroup,
  pmSaveBrand,
  pmSaveUom,
  pmCategories,
  pmProductGroups,
  pmBrands,
  pmUoms,
} from "@/features/product-management/api";
import type { PMBrand, PMCategory, PMProductGroup, PMSubUnit, PMUom } from "@/features/shared/types";
import { useToast } from "@/features/shared/components/Toast";
import { PmModalFooter } from "./PmShared";

export type SimpleEntity = "category" | "product-group" | "brand" | "uom";

const UOM_TYPES = ["unit", "weight", "volume", "length", "time", "packaging", "other"];

interface Props {
  entity: SimpleEntity;
  isOpen: boolean;
  onClose: () => void;
  editing: (PMCategory | PMProductGroup | PMBrand | PMUom) | null;
  categories: PMCategory[];
  onSaved: (newId?: string) => void;
}

const autoCode = (name: string): string => {
  const letters = (name.match(/[a-z0-9]/gi) || []).join("").slice(0, 6).toUpperCase() || "NEW";
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ123456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `${letters}-${suffix}`;
};

const TITLES: Record<SimpleEntity, { new: string; edit: string; fields: { label: string; name: string }[] }> = {
  category: {
    new: "Add Category",
    edit: "Edit Category",
    fields: [
      { label: "Code", name: "code" },
      { label: "Name", name: "name" },
    ],
  },
  "product-group": {
    new: "Add Product Group",
    edit: "Edit Product Group",
    fields: [
      { label: "Code", name: "code" },
      { label: "Name", name: "name" },
    ],
  },
  brand: {
    new: "Add Brand",
    edit: "Edit Brand",
    fields: [
      { label: "Code", name: "code" },
      { label: "Name", name: "name" },
    ],
  },
  uom: {
    new: "Add UoM",
    edit: "Edit UoM",
    fields: [
      { label: "Code", name: "code" },
      { label: "Name", name: "name" },
    ],
  },
};

export default function PmSimpleFormModal({ entity, isOpen, onClose, editing, categories, onSaved }: Props) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");
  const [sortOrder, setSortOrder] = useState("0");
  const [parentId, setParentId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [uomType, setUomType] = useState("unit");
  const [decimalPlaces, setDecimalPlaces] = useState("0");
  const [subUnits, setSubUnits] = useState<Partial<PMSubUnit>[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const row = editing as any;
    setCode(row?.code ?? "");
    setName(row?.name ?? "");
    setDescription(row?.description ?? "");
    setStatus(row?.status ?? "Active");
    setSortOrder(row?.sort_order ?? 0);
    setParentId(row?.parent_id ?? "");
    setCategoryId(row?.category_id ?? "");
    setUomType(row?.type ?? "unit");
    setDecimalPlaces(row?.decimal_places ?? 0);
    setSubUnits((row?.sub_units ?? []).map((s: PMSubUnit) => ({ ...s })));
  }, [isOpen, editing]);

  const handleSave = async () => {
    if (!code.trim() || !name.trim()) {
      toast.error("Code and name are required.");
      return;
    }
    if (entity === "product-group" && !categoryId) {
      toast.error("Category is required.");
      return;
    }
    setSaving(true);
    try {
      const id = editing?.id;
      let newId = id;
      if (entity === "category") {
        await pmSaveCategory({ code: code.trim(), name: name.trim(), description, status, sort_order: Number(sortOrder) || 0, parent_id: parentId || null }, id);
        if (!id) {
          const cats = await pmCategories();
          const created = cats.find((c) => c.code === code.trim() && c.name === name.trim());
          if (created) newId = created.id;
        }
      } else if (entity === "product-group") {
        await pmSaveProductGroup({ code: code.trim(), name: name.trim(), description, status, category_id: categoryId }, id);
        if (!id) {
          const groups = await pmProductGroups();
          const created = groups.find((g) => g.code === code.trim() && g.name === name.trim());
          if (created) newId = created.id;
        }
      } else if (entity === "brand") {
        await pmSaveBrand({ code: code.trim(), name: name.trim(), description, status }, id);
        if (!id) {
          const brands = await pmBrands();
          const created = brands.find((b) => b.code === code.trim() && b.name === name.trim());
          if (created) newId = created.id;
        }
      } else {
        const cleanSubUnits = subUnits
          .filter((s) => (s.name ?? "").trim() !== "")
          .map((s) => ({
            ...(s.id ? { id: s.id } : {}),
            name: (s.name ?? "").trim(),
            short_name: (s.short_name ?? "").trim() || (s.name ?? "").trim(),
            conversion_factor: Number(s.conversion_factor) || 1,
            status: s.status ?? "Active",
          }));
        await pmSaveUom({ code: code.trim(), name: name.trim(), type: uomType, decimal_places: Number(decimalPlaces) || 0, status, sub_units: cleanSubUnits }, id);
        if (!id) {
          const uoms = await pmUoms();
          const created = uoms.find((u) => u.code === code.trim() && u.name === name.trim());
          if (created) newId = created.id;
        }
      }
      toast.success(id ? "Record updated." : "Record created.");
      onClose();
      onSaved(newId);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const meta = TITLES[entity];
  const parentOptions = categories
    .filter((c) => c.id !== editing?.id)
    .map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }));

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? meta.edit : meta.new}
      size="lg"
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Code">
          <div className="flex gap-1.5">
            <div className="flex-1">
              <TextField value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Auto-generated if blank" className="font-mono" />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => name.trim() && setCode(autoCode(name.trim()))}
              disabled={!name.trim()}
              aria-label="Generate code from name"
              title="Generate code from name"
            >
              <Sparkles className="size-4" />
            </Button>
          </div>
        </Field>
        <Field label="Name">
          <TextField value={name} onChange={(e) => { const val = e.target.value; setName(val); if (!code.trim() && val.trim()) setCode(autoCode(val.trim())); }} placeholder="Name" />
        </Field>

        {entity === "category" && (
          <>
            <Field label="Parent Category">
              <SelectField
                value={parentId}
                onChange={setParentId}
                placeholder="None (top level)"
                options={parentOptions}
                containerClassName=""
              />
            </Field>
            <Field label="Sort Order">
              <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
            </Field>
          </>
        )}

        {entity === "product-group" && (
          <Field label="Category" wide>
            <SelectField
              value={categoryId}
              onChange={setCategoryId}
              placeholder="Select category..."
              options={categories.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
            />
          </Field>
        )}

        {entity === "uom" && (
          <>
            <Field label="Type">
              <SelectField
                value={uomType}
                onChange={setUomType}
                options={UOM_TYPES.map((t) => ({ value: t, label: t }))}
              />
            </Field>
            <Field label="Decimal Places">
              <Input type="number" value={decimalPlaces} onChange={(e) => setDecimalPlaces(e.target.value)} />
            </Field>

            <div className="col-span-2 space-y-2">
              <Field label="Sub-Units">
                <p className="text-xs text-muted-foreground">
                  Smaller selling/purchasing units of this UoM. The conversion factor is how many sub-units make one base unit.
                </p>
              </Field>
              <div className="space-y-2">
                {subUnits.length === 0 && (
                  <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                    No sub-units yet. Add the first one below.
                  </p>
                )}
                {subUnits.map((s, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4">
                      <Field label="Name">
                        <TextField
                          value={s.name ?? ""}
                          onChange={(e) =>
                            setSubUnits((prev) => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))
                          }
                          placeholder="e.g. Box"
                        />
                      </Field>
                    </div>
                    <div className="col-span-3">
                      <Field label="Short Name">
                        <TextField
                          value={s.short_name ?? ""}
                          onChange={(e) =>
                            setSubUnits((prev) => prev.map((x, i) => (i === idx ? { ...x, short_name: e.target.value } : x)))
                          }
                          placeholder="e.g. BOX"
                        />
                      </Field>
                    </div>
                    <div className="col-span-3">
                      <Field label="Conv. Factor">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={String(s.conversion_factor ?? 1)}
                          onChange={(e) =>
                            setSubUnits((prev) => prev.map((x, i) => (i === idx ? { ...x, conversion_factor: Number(e.target.value) } : x)))
                          }
                        />
                      </Field>
                    </div>
                    <div className="col-span-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive"
                        onClick={() => setSubUnits((prev) => prev.filter((_, i) => i !== idx))}
                        aria-label={`Remove sub-unit ${s.name || idx + 1}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSubUnits((prev) => [...prev, { name: "", short_name: "", conversion_factor: 1, status: "Active" }])}
              >
                <PlusCircle />
                <span>Add Sub-Unit</span>
              </Button>
            </div>
          </>
        )}

        <Field label="Status" wide={false}>
          <SelectField
            value={status}
            onChange={(v) => setStatus(v as "Active" | "Inactive")}
            options={[
              { value: "Active", label: "Active" },
              { value: "Inactive", label: "Inactive" },
            ]}
          />
        </Field>

        {(entity === "category" || entity === "product-group" || entity === "brand") && (
          <Field label="Description" wide>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </Field>
        )}
      </div>

      <PmModalFooter onCancel={onClose} onSave={handleSave} saving={saving} />
    </BaseModal>
  );
}