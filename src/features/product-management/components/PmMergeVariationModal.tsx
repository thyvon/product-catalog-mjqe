import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import BaseModal from "@/features/shared/components/BaseModal";
import SelectField from "@/features/shared/components/SelectField";
import MultiSelectCombobox from "@/features/shared/components/MultiSelectCombobox";
import { Field } from "@/features/shared/components/Field";
import { FormLabel } from "@/features/shared/components/FormLabel";
import { useToast } from "@/features/shared/components/Toast";
import { PmModalFooter } from "./PmShared";
import { pmMergeVariation, pmVariationTemplates } from "@/features/product-management/api";
import type { PMProduct, PMVariationTemplate } from "@/features/shared/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  products: PMProduct[];
  onMerged: () => void;
}

export default function PmMergeVariationModal({ isOpen, onClose, products, onMerged }: Props) {
  const { toast } = useToast();
  const [parentId, setParentId] = useState("");
  const [templates, setTemplates] = useState<PMVariationTemplate[]>([]);
  const [templateIds, setTemplateIds] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        setTemplates(await pmVariationTemplates());
      } catch (err: any) {
        toast.error(err.message || "Failed to load variation templates.");
      }
    })();
  }, [isOpen]);

  // Reset whenever the modal opens with a new selection
  useEffect(() => {
    if (!isOpen) return;
    const firstSingle = products.find((p) => p.product_type === "single");
    setParentId(firstSingle?.id ?? "");
    setTemplateIds([]);
    setValues({});
  }, [isOpen]);

  const chosenTemplates = useMemo(
    () => templateIds.map((id) => templates.find((t) => t.id === id)).filter(Boolean) as PMVariationTemplate[],
    [templateIds, templates]
  );

  const errors = useMemo(() => {
    const list: string[] = [];
    if (!parentId) list.push("Select a parent product.");
    if (templateIds.length === 0) list.push("Select at least one variation template.");
    for (const p of products) {
      const ids = values[p.id] ?? [];
      if (ids.length !== templateIds.length) {
        list.push(`"${p.name}" needs ${templateIds.length} value(s) — has ${ids.length}.`);
        continue;
      }
      if (new Set(ids).size !== ids.length) {
        list.push(`"${p.name}" uses a duplicated value.`);
      }
    }
    const combos = products.map((p) => (values[p.id] ?? []).slice().sort().join("|"));
    const dup = combos.find((c, i) => c.split("|").every(Boolean) && combos.indexOf(c) !== i);
    if (dup) list.push("Two products map to the same value combination.");
    return list;
  }, [products, parentId, templateIds, values]);

  const canSubmit = !saving && errors.length === 0;

  const handleValueChange = (productId: string, templateIndex: number, valueId: string) => {
    setValues((prev) => {
      const next = [...(prev[productId] ?? [])];
      next[templateIndex] = valueId;
      return { ...prev, [productId]: next };
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await pmMergeVariation({
        parentId,
        templateIds,
        assignments: products
          .filter((p) => (values[p.id] ?? []).length === templateIds.length)
          .map((p) => ({ productId: p.id, valueIds: values[p.id] })),
      });
      toast.success("Products merged into a variation product.");
      onMerged();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to merge products.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Merge into Variation" size="5xl">
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-50/60 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
            The first product is the parent — its code stays. Each selected product becomes one variant under it,
            keeping its SKU, image and purchase price. Source products are deleted after merging.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Parent Product">
            <SelectField
              value={parentId}
              onChange={setParentId}
              placeholder="Select parent..."
              options={products.map((p) => ({
                value: p.id,
                label: `${p.code} — ${p.name}`,
              }))}
            />
          </Field>
          <Field label="Variation Templates">
            <MultiSelectCombobox
              options={templates.map((t) => ({ id: t.id, label: t.name }))}
              value={templateIds}
              onValueChange={(next) => {
                setTemplateIds(next);
                setValues({});
              }}
              placeholder="Select templates..."
              emptyMessage="No templates found."
            />
          </Field>
        </div>

        {products.length > 0 && (
          <div className="space-y-2">
            <FormLabel>Assign Values</FormLabel>
            <div className="max-h-[260px] space-y-1.5 overflow-y-auto rounded-xl border border-border bg-muted/20 p-2">
              {products.map((p) => (
                <div
                  key={p.id}
                  className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 ${
                    p.id === parentId ? "border-primary/40 bg-primary/5" : "border-border bg-background"
                  }`}
                >
                  <span className="min-w-[160px] flex-1 truncate text-sm font-medium">{p.name}</span>
                  {p.id === parentId && (
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      PARENT
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-muted-foreground">{p.code}</span>
                  <div className="ml-auto flex flex-wrap items-center gap-1.5">
                    {chosenTemplates.map((t, ti) => (
                      <SelectField
                        key={t.id}
                        value={values[p.id]?.[ti] ?? ""}
                        onChange={(v) => handleValueChange(p.id, ti, v)}
                        placeholder={t.name}
                        containerClassName="min-w-[120px]"
                        options={(t.values ?? []).map((v) => ({ value: v.id, label: v.name }))}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {errors.length > 0 ? (
          <ul className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
            {errors.map((e, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <AlertTriangle className="size-3 shrink-0" />
                {e}
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" />
            Ready to merge into {products.length} variant{products.length === 1 ? "" : "s"} under{" "}
            {products.find((p) => p.id === parentId)?.name ?? "parent"}.
          </p>
        )}
      </div>

      <PmModalFooter
        onCancel={onClose}
        onSave={handleSubmit}
        saving={saving}
        saveLabel={saving ? "Merging..." : `Merge ${products.length} products`}
      />
    </BaseModal>
  );
}
