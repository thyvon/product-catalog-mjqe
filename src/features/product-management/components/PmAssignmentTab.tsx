import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ArrowRightLeft, CheckCircle2, GripVertical, Inbox, Loader2, RefreshCw, Search, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import SelectField from "@/features/shared/components/SelectField";
import { useToast } from "@/features/shared/components/Toast";
import { pmProducts, pmSaveProduct } from "@/features/product-management/api";
import type { PMCategory, PMProduct, PMProductGroup } from "@/features/shared/types";

type AssignMode = "group" | "subcategory" | "category";

const MODES: { value: AssignMode; label: string; hint: string }[] = [
  { value: "group", label: "Product Group", hint: "Assign products to a product group" },
  { value: "subcategory", label: "Sub-Category", hint: "Assign products directly to a sub-category" },
  { value: "category", label: "Category", hint: "Assign products directly to a top-level category" },
];

const LEFT_ZONE = "zone:left";
const RIGHT_ZONE = "zone:right";

type FlyDir = "from-left" | "from-right";

const FLY_KEYFRAMES = `
@keyframes pm-fly-from-left { from { opacity: 0.25; transform: translateX(-56px); } to { opacity: 1; transform: none; } }
@keyframes pm-fly-from-right { from { opacity: 0.25; transform: translateX(56px); } to { opacity: 1; transform: none; } }
`;

const flyStyle = (dir: FlyDir | null): React.CSSProperties | undefined =>
  dir ? { animation: `pm-${dir} 380ms cubic-bezier(0.22, 0.61, 0.36, 1)` } : undefined;

interface Props {
  productGroups: PMProductGroup[];
  categories: PMCategory[];
  refreshRefs: () => void;
}

interface PoolRowProps {
  product: PMProduct;
  mode: AssignMode;
  checked: boolean;
  onToggle: () => void;
  flyDir?: FlyDir | null;
}

function PoolRow({ product, mode, checked, onToggle, flyDir }: PoolRowProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pool:${product.id}`,
    data: {
      origin: "pool",
      getIds: () => (checked ? undefined : [product.id]),
    },
  });

  const currentLabel =
    mode === "group"
      ? product.product_group_name || null
      : product.assigned_category_name || product.category_name || null;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={flyStyle(flyDir ?? null)}
      className={`flex cursor-grab touch-none select-none items-center gap-2 rounded-lg border border-border bg-background px-2 py-2 hover:bg-muted active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <span onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={checked} onCheckedChange={onToggle} />
      </span>
      <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{product.name}</span>
      {currentLabel ? (
        <Badge variant="outline" className="shrink-0 max-w-[140px] truncate text-[10px] font-normal">
          {currentLabel}
        </Badge>
      ) : (
        <Badge variant="secondary" className="shrink-0 text-[10px] font-normal text-muted-foreground">
          No {mode === "group" ? "group" : "category"}
        </Badge>
      )}
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{product.code}</span>
    </div>
  );
}

interface AssignedRowProps {
  product: PMProduct;
  onRemove: () => void;
  flyDir?: FlyDir | null;
}

function DropZone({
  id,
  variant,
  hasTarget = true,
  children,
}: {
  id: string;
  variant: "dashed" | "solid";
  hasTarget?: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const base = "min-h-[320px] flex-1 overflow-y-auto rounded-xl p-2 transition-all";
  const look =
    variant === "dashed"
      ? isOver && hasTarget
        ? "border-2 border-dashed border-primary bg-primary/5"
        : hasTarget
          ? "border-2 border-dashed border-border bg-muted/20"
          : "border-2 border-dashed border-border/60 bg-muted/10"
      : isOver
        ? "border border-primary bg-primary/5"
        : "border border-border bg-muted/10";
  return (
    <div ref={setNodeRef} className={`${base} ${look}`}>
      {children}
    </div>
  );
}

function AssignedRow({ product, onRemove, flyDir }: AssignedRowProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `assigned:${product.id}`,
    data: { origin: "assigned", getIds: () => [product.id] },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={flyStyle(flyDir ?? null)}
      className={`group flex cursor-grab touch-none select-none items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 hover:bg-muted active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
      title="Drag back to the right side to unassign"
    >
      <GripVertical className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{product.name}</span>
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{product.code}</span>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.stopPropagation();
            onRemove();
          }
        }}
        className="ml-auto shrink-0 rounded-sm p-1 text-destructive opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100"
        aria-label={`Remove ${product.name}`}
        title="Remove assignment"
      >
        <X className="size-3.5" />
      </span>
    </div>
  );
}

export default function PmAssignmentTab({ productGroups, categories, refreshRefs }: Props) {
  const { toast } = useToast();
  const [mode, setMode] = useState<AssignMode>("group");
  const [targetId, setTargetId] = useState("");
  const [allProducts, setAllProducts] = useState<PMProduct[]>([]);
  const [targetProducts, setTargetProducts] = useState<PMProduct[]>([]);
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [fly, setFly] = useState<{ id: string; dir: FlyDir } | null>(null);
  const [dragSummary, setDragSummary] = useState<{ count: number; names: string[] } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  );

  const field = mode === "group" ? "product_group_id" : "category_id";
  const queryParam = mode === "group" ? "groupId" : "assignedCategoryId";

  const categoryIds = useMemo(() => new Set(categories.map((c) => c.id)), [categories]);
  const targets: { value: string; label: string }[] = useMemo(() => {
    if (mode === "group") {
      return productGroups
        .filter((g) => (g.status ?? "Active") !== "Inactive")
        .map((g) => ({ value: g.id, label: `${g.code} — ${g.name}` }));
    }
    return categories
      .filter((c) => {
        if ((c.status ?? "Active") === "Inactive") return false;
        const isSub = !!c.parent_id && categoryIds.has(c.parent_id);
        return mode === "subcategory" ? isSub : !isSub;
      })
      .map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }));
  }, [mode, productGroups, categories, categoryIds]);

  const loadAll = useCallback(async () => {
    try {
      const result = await pmProducts({ page: "1", pageSize: "0" });
      setAllProducts(result.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch products.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTarget = useCallback(async () => {
    if (!targetId) {
      setTargetProducts([]);
      return;
    }
    try {
      const result = await pmProducts({ page: "1", pageSize: "0", [queryParam]: targetId });
      setTargetProducts(result.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch assigned products.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, queryParam]);

  useEffect(() => {
    loadAll().finally(() => setLoading(false));
  }, [loadAll]);

  useEffect(() => {
    setChecked(new Set());
    loadTarget();
  }, [loadTarget]);

  useEffect(() => {
    setTargetId("");
    setSearch("");
    setChecked(new Set());
  }, [mode]);

  const filteredRight = useMemo(() => {
    const q = search.trim().toLowerCase();
    const inTargetIds = new Set(targetProducts.map((p) => p.id));
    return allProducts.filter((p) => {
      if (inTargetIds.has(p.id)) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
    });
  }, [allProducts, targetProducts, search]);

  const persist = async (
    updates: { id: string; value: string | null }[],
    fly?: { id: string; dir: FlyDir } | null
  ) => {
    setMoving(true);
    const results = await Promise.allSettled(
      updates.map((u) => pmSaveProduct({ [field]: u.value } as Partial<PMProduct>, u.id))
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) toast.error(`${failed} assignment(s) failed.`);
    else toast.success(`Updated ${updates.length} product(s).`);
    await Promise.all([loadAll(), loadTarget()]);
    setChecked(new Set());
    if (fly && !results.some((r) => r.status === "rejected")) {
      setFly(fly);
      window.setTimeout(() => setFly(null), 420);
    }
    refreshRefs();
    setMoving(false);
  };

  const assignIds = (ids: string[]) => {
    if (!targetId || ids.length === 0) return;
    persist(ids.map((id) => ({ id, value: targetId })), { id: ids[0], dir: "from-right" });
  };

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleChecked = filteredRight.length > 0 && filteredRight.every((p) => checked.has(p.id));

  const handleDragStart = (event: DragStartEvent) => {
    const getDataIds = event.active.data.current?.getIds as (() => string[] | undefined) | undefined;
    let ids = getDataIds?.() ?? [];
    if (!ids || ids.length === 0) {
      // dragging an already-checked pool item: move the whole checked selection
      ids = Array.from(checked);
    }
    const byId = new Map([...allProducts, ...targetProducts].map((p) => [p.id, p]));
    setDragSummary({
      count: ids.length,
      names: ids.slice(0, 3).map((id) => byId.get(id)?.name ?? ""),
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragSummary(null);
    const { active, over } = event;
    if (!over) return;
    const origin = event.active.data.current?.origin as "pool" | "assigned";
    const getDataIds = event.active.data.current?.getIds as (() => string[] | undefined) | undefined;
    let ids = getDataIds?.() ?? [];
    if (!ids || ids.length === 0) ids = Array.from(checked);
    if (ids.length === 0) return;

    const zone = String(over.id);
    if (origin === "pool" && zone === LEFT_ZONE) {
      assignIds(ids);
    } else if (origin === "assigned" && zone === RIGHT_ZONE) {
      persist(ids.map((id) => ({ id, value: null })), { id: ids[0], dir: "from-left" });
    }
  };

  const modeMeta = MODES.find((m) => m.value === mode)!;

  return (
    <div className="space-y-4">
      <style>{FLY_KEYFRAMES}</style>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border bg-muted p-0.5">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === m.value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{modeMeta.hint}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => Promise.all([loadAll(), loadTarget()])}>
          <RefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* ── Left: target + its products (drop zone) ── */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Inbox className="size-4" />
                {modeMeta.label} Products
              </CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
              <SelectField
                value={targetId}
                onChange={setTargetId}
                placeholder={`Select ${modeMeta.label.toLowerCase()}...`}
                options={targets}
              />
              <DropZone id={LEFT_ZONE} variant="dashed" hasTarget={!!targetId}>
                {!targetId ? (
                  <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                    <ArrowRightLeft className="size-8 opacity-40" />
                    <p className="text-sm font-medium">Select a {modeMeta.label.toLowerCase()} first</p>
                    <p className="text-xs">Then drag products here from the right side</p>
                  </div>
                ) : targetProducts.length === 0 ? (
                  <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                    <Inbox className="size-8 opacity-40" />
                    <p className="text-sm font-medium">No products yet</p>
                    <p className="text-xs">Drag products here or use the checkboxes</p>
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {targetProducts.map((p) => (
                      <li key={p.id}>
                        <AssignedRow
                          product={p}
                          onRemove={() => persist([{ id: p.id, value: null }], { id: p.id, dir: "from-left" })}
                          flyDir={fly?.id === p.id ? fly.dir : null}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </DropZone>

              <Separator />

              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  <strong className="font-mono">{targetProducts.length}</strong> in this{" "}
                  {modeMeta.label.toLowerCase()}
                </p>
                <Button
                  size="sm"
                  disabled={!targetId || checked.size === 0 || moving}
                  onClick={() => assignIds(Array.from(checked))}
                >
                  {moving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                  Move {checked.size > 0 ? `${checked.size} ` : ""}to {modeMeta.label}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Right: all products (draggable source) ── */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="flex items-center gap-2">
                  <ArrowRightLeft className="size-4" />
                  All Products
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {filteredRight.length}
                  </Badge>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or code..."
                  className="pl-8"
                />
              </div>

              <DropZone id={RIGHT_ZONE} variant="solid">
                {filteredRight.length === 0 ? (
                  <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                    <Search className="size-8 opacity-40" />
                    <p className="text-sm font-medium">No products found</p>
                    {search && <p className="text-xs">Try a different search term.</p>}
                  </div>
                ) : (
                  <>
                    <label className="mb-1.5 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">
                      <Checkbox
                        checked={allVisibleChecked}
                        onCheckedChange={() => {
                          setChecked((prev) => {
                            const next = new Set(prev);
                            if (allVisibleChecked) filteredRight.forEach((p) => next.delete(p.id));
                            else filteredRight.forEach((p) => next.add(p.id));
                            return next;
                          });
                        }}
                      />
                      Select all visible
                    </label>
                    <ul className="space-y-1.5">
                      {filteredRight.map((p) => (
                        <li key={p.id}>
                          <PoolRow
                            product={p}
                            mode={mode}
                            checked={checked.has(p.id)}
                            onToggle={() => toggleCheck(p.id)}
                            flyDir={fly?.id === p.id ? fly.dir : null}
                          />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </DropZone>

              <p className="text-center text-xs text-muted-foreground">
                Tip: drag a product back here (or press the ×) to remove it from the selected{" "}
                {mode === "group" ? "group" : "category"}.
              </p>
            </CardContent>
          </Card>
        </div>

        <DragOverlay dropAnimation={{ duration: 240, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" }}>
          {dragSummary && (
            <div className="pointer-events-none z-50 inline-flex max-w-[280px] items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 shadow-lg">
              <GripVertical className="size-4 shrink-0 text-primary" />
              {dragSummary.count === 1 ? (
                <span className="truncate text-sm font-medium">{dragSummary.names[0]}</span>
              ) : (
                <span className="truncate text-sm font-medium">
                  {dragSummary.count} products
                  <span className="ml-1 text-muted-foreground">
                    ({dragSummary.names.join(", ")}
                    {dragSummary.count > 3 ? "…" : ""})
                  </span>
                </span>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
