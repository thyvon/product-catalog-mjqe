import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { RefreshCw, SquarePen } from "lucide-react";
import { Button } from "@/components/ui/button";
import DataTable from "@/features/shared/components/DataTable";
import ListPageLayout from "@/features/shared/components/ListPageLayout";
import SelectField from "@/features/shared/components/SelectField";
import { useToast } from "@/features/shared/components/Toast";
import { PmStatusBadge } from "./PmShared";
import { pmVariants } from "@/features/product-management/api";
import type { PMProduct, PMVariant } from "@/features/shared/types";

interface Props {
  products: PMProduct[];
}

export default function PmVariantsTab({ products }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [rows, setRows] = useState<PMVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [productId, setProductId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (productId) params.productId = productId;
      if (statusFilter) params.status = statusFilter;
      setRows(await pmVariants(params));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, productId, statusFilter, toast]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  const columns: ColumnDef<PMVariant, any>[] = [
    {
      id: "sku",
      header: "SKU",
      cell: ({ row }) => <span className="font-mono">{row.original.sku}</span>,
    },
    { accessorKey: "name", header: "Name" },
    {
      id: "product",
      header: "Product",
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-foreground">{row.original.product_name}</div>
          <div className="text-xs text-muted-foreground">{row.original.product_code}</div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <PmStatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => navigate(`/product-management/products/${row.original.product_id}/edit`)}
            aria-label={`Edit ${row.original.name}`}
            title="Edit parent product"
          >
            <SquarePen className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <ListPageLayout
        title="Variants"
        description={`${rows.length} variant${rows.length !== 1 ? "s" : ""} found`}
        actions={
          <>
            <Button variant="outline" size="icon" onClick={load}>
              <RefreshCw className={loading ? "animate-spin" : ""} />
            </Button>
          </>
        }
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by SKU, name, or product..."
        activeFilterCount={[productId, statusFilter].filter(Boolean).length}
        filters={
          <>
            <SelectField
              value={productId}
              onChange={setProductId}
              containerClassName="min-w-[200px]"
              options={[
                { value: "", label: "All Products" },
                ...products.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
              ]}
            />
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
        <DataTable<PMVariant>
          columns={columns}
          data={rows}
          loading={loading}
          getRowId={(r) => r.id}
        />
      </ListPageLayout>
    </>
  );
}
