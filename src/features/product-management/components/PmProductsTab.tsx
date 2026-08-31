import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { GitMerge, PlusCircle, RefreshCw, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import DataTable from "@/features/shared/components/DataTable";
import ListPageLayout from "@/features/shared/components/ListPageLayout";
import SelectField from "@/features/shared/components/SelectField";
import { useConfirmModal } from "@/features/shared/hooks";
import { useToast } from "@/features/shared/components/Toast";
import ConfirmModal from "@/features/shared/components/ConfirmModal";
import PmExcelImportModal from "./PmExcelImportModal";
import PmMergeVariationModal from "./PmMergeVariationModal";
import { PmActions, PmStatusBadge } from "./PmShared";
import { pmProducts, pmDeleteProduct } from "@/features/product-management/api";
import type { PMBrand, PMProduct, PMProductGroup } from "@/features/shared/types";

interface Props {
  productGroups: PMProductGroup[];
  brands: PMBrand[];
  refreshRefs: () => void;
}

export default function PmProductsTab({ productGroups, brands, refreshRefs }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { confirmState, confirm, closeConfirm } = useConfirmModal();

  const [rows, setRows] = useState<PMProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupId, setGroupId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mergeOpen, setMergeOpen] = useState(false);

  const selectedProducts = useMemo(
    () => rows.filter((r) => selected.has(r.id)),
    [rows, selected]
  );
  const mergeableCount = selectedProducts.filter((p) => p.product_type === "single").length;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const load = useCallback(
    async (params: Record<string, string>) => {
      setLoading(true);
      try {
        const result = await pmProducts(params);
        setRows(result.data);
        setTotal(result.total);
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      const params: Record<string, string> = {
        page: String(currentPage),
        pageSize: String(pageSize),
      };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (groupId) params.groupId = groupId;
      if (brandId) params.brandId = brandId;
      if (statusFilter) params.status = statusFilter;
      load(params);
    }, 300);
    return () => clearTimeout(timer);
  }, [currentPage, pageSize, searchQuery, groupId, brandId, statusFilter, load]);

  const activeFilterCount = [groupId, brandId, statusFilter].filter(Boolean).length;

  const groupOptions = (list: PMProductGroup[]) => [
    { value: "", label: "All Groups" },
    ...list.map((g) => ({ value: g.id, label: `${g.code} — ${g.name}` })),
  ];
  const brandOptions = (list: PMBrand[]) => [
    { value: "", label: "All Brands" },
    ...list.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` })),
  ];

  const columns: ColumnDef<PMProduct, any>[] = [
    {
      id: "select",
      header: () => (
        <Checkbox
          checked={allOnPageSelected}
          onCheckedChange={() => {
            setSelected((prev) => {
              const next = new Set(prev);
              if (allOnPageSelected) rows.forEach((r) => next.delete(r.id));
              else rows.forEach((r) => next.add(r.id));
              return next;
            });
          }}
          aria-label="Select all on page"
        />
      ),
      meta: { width: "36px" },
      cell: ({ row }) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected.has(row.original.id)} onCheckedChange={() => toggleSelect(row.original.id)} />
        </span>
      ),
    },
    { accessorKey: "code", header: "Code", meta: { width: "100px" } },
    { accessorKey: "name", header: "Name", meta: { width: "20%", className: "font-medium" } },
    {
      id: "group",
      header: "Group",
      meta: { width: "11%" },
      cell: ({ row }) => row.original.product_group_name || "—",
    },
    {
      id: "category",
      header: "Category",
      meta: { width: "11%" },
      cell: ({ row }) => row.original.assigned_category_name || row.original.category_name || "—",
    },
    {
      id: "brand",
      header: "Brand",
      meta: { width: "10%" },
      cell: ({ row }) => row.original.brand_name || "—",
    },
    {
      id: "uom",
      header: "UoM",
      meta: { width: "7%" },
      cell: ({ row }) => row.original.uom_name || "—",
    },
    {
      id: "sub_unit",
      header: "Sub-Unit",
      meta: { width: "7%" },
      cell: ({ row }) => row.original.sub_unit_name || "—",
    },
    {
      id: "type",
      header: "Type",
      meta: { width: "7%" },
      cell: ({ row }) => (
        <Badge variant="outline">
          {row.original.product_type === "variation" ? "Variation" : "Single"}
        </Badge>
      ),
    },
    {
      id: "variants",
      header: "Variants",
      meta: { align: "right", width: "6%" },
      cell: ({ row }) => <span className="font-mono">{row.original.variant_count ?? 0}</span>,
    },
    {
      id: "status",
      header: "Status",
      meta: { width: "7%" },
      cell: ({ row }) => <PmStatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: "Actions",
      meta: { width: "72px", align: "right" },
      cell: ({ row }) => (
        <PmActions
          onEdit={() => navigate(`/product-management/products/${row.original.id}/edit`)}
          onDelete={() => handleDelete(row.original)}
        />
      ),
    },
  ];

  const handleDelete = (row: PMProduct) => {
    confirm(
      "Delete Product",
      `Are you sure you want to delete "${row.name}"? This action cannot be undone.`,
      async () => {
        closeConfirm();
        try {
          await pmDeleteProduct(row.id);
          await load({
            page: String(currentPage),
            pageSize: String(pageSize),
            ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
            ...(groupId ? { groupId } : {}),
            ...(brandId ? { brandId } : {}),
            ...(statusFilter ? { status: statusFilter } : {}),
          });
          refreshRefs();
          toast.success(`Product "${row.name}" has been deleted.`);
        } catch (err: any) {
          toast.error(err.message);
        }
      }
    );
  };

  return (
    <>
      <ListPageLayout
        title="Products"
        description={`${total} product${total !== 1 ? "s" : ""} found`}
        actions={
          <>
            <Button variant="outline" size="icon" onClick={() => load({ page: String(currentPage), pageSize: String(pageSize) })}>
              <RefreshCw className={loading ? "animate-spin" : ""} />
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload />
              <span>Import</span>
            </Button>
            <Button onClick={() => navigate("/product-management/products/new")}>
              <PlusCircle />
              <span>Add Product</span>
            </Button>
          </>
        }
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by name, code, group, or brand..."
        activeFilterCount={activeFilterCount}
        filters={
          <>
            <SelectField value={groupId} onChange={setGroupId} containerClassName="min-w-[180px]" options={groupOptions(productGroups)} placeholder="All Groups" />
            <SelectField value={brandId} onChange={setBrandId} containerClassName="min-w-[160px]" options={brandOptions(brands)} placeholder="All Brands" />
            <SelectField
              value={statusFilter}
              onChange={setStatusFilter}
              containerClassName="min-w-[140px]"
              options={[
                { value: "", label: "All Status" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
          </>
        }
      >
        {selected.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
            <span className="text-sm font-medium text-foreground">
              {selected.size} selected
              {mergeableCount !== selected.size && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  ({selected.size - mergeableCount} not mergeable — only single products can merge)
                </span>
              )}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                disabled={mergeableCount < 2}
                onClick={() => setMergeOpen(true)}
                title={mergeableCount < 2 ? "Select at least 2 single products to merge" : undefined}
              >
                <GitMerge />
                Merge into Variation
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                <X />
                Clear
              </Button>
            </div>
          </div>
        )}
        <DataTable<PMProduct>
          columns={columns}
          data={rows}
          loading={loading}
          getRowId={(r) => r.id}
          pagination={{
            currentPage,
            pageSize,
            total,
            onPageChange: setCurrentPage,
            onPageSizeChange: setPageSize,
            pageSizeOptions: [10, 25, 50, 100],
          }}
        />
      </ListPageLayout>

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
        confirmLabel={confirmState.confirmLabel}
      />

      <PmExcelImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImportComplete={() => {
          load({ page: String(currentPage), pageSize: String(pageSize) });
          refreshRefs();
        }}
      />

      <PmMergeVariationModal
        isOpen={mergeOpen}
        onClose={() => setMergeOpen(false)}
        products={selectedProducts.filter((p) => p.product_type === "single")}
        onMerged={() => {
          setSelected(new Set());
          load({
            page: String(currentPage),
            pageSize: String(pageSize),
            ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
            ...(groupId ? { groupId } : {}),
            ...(brandId ? { brandId } : {}),
            ...(statusFilter ? { status: statusFilter } : {}),
          });
          refreshRefs();
        }}
      />
    </>
  );
}