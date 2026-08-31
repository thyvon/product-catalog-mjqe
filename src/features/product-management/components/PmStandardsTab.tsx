import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { PlusCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DataTable from "@/features/shared/components/DataTable";
import ListPageLayout from "@/features/shared/components/ListPageLayout";
import { useConfirmModal, useListPageState } from "@/features/shared/hooks";
import { useToast } from "@/features/shared/components/Toast";
import ConfirmModal from "@/features/shared/components/ConfirmModal";
import PmStandardModal from "./PmStandardModal";
import { PmActions, PmStatusBadge } from "./PmShared";
import { pmStandards, pmDeleteStandard } from "@/features/product-management/api";
import type { PMProductGroup, PMStandard, PMVariant } from "@/features/shared/types";

interface Props {
  productGroups: PMProductGroup[];
  variants: PMVariant[];
  refreshRefs: () => void;
}

export default function PmStandardsTab({ productGroups, variants, refreshRefs }: Props) {
  const { toast } = useToast();
  const { confirmState, confirm, closeConfirm } = useConfirmModal();
  const { searchQuery, setSearchQuery, currentPage, setCurrentPage, pageSize, setPageSize } = useListPageState();

  const [rows, setRows] = useState<PMStandard[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PMStandard | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await pmStandards());
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter(
      (s) =>
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.product_group_name || "").toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, filtered.length, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [currentPage, filtered, pageSize]);

  const handleDelete = (row: PMStandard) => {
    confirm(
      "Delete Standard",
      `Are you sure you want to delete "${row.name}"? This action cannot be undone.`,
      async () => {
        closeConfirm();
        try {
          await pmDeleteStandard(row.id);
          await load();
          refreshRefs();
          toast.success(`Standard "${row.name}" has been deleted.`);
        } catch (err: any) {
          toast.error(err.message);
        }
      }
    );
  };

  const columns: ColumnDef<PMStandard, any>[] = [
    { accessorKey: "code", header: "Code" },
    { accessorKey: "name", header: "Name" },
    {
      id: "group",
      header: "Product Group",
      cell: ({ row }) => row.original.product_group_name || "—",
    },
    {
      id: "items",
      header: "Items",
      cell: ({ row }) => <Badge variant="outline">{row.original.item_count ?? 0}</Badge>,
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
        <PmActions
          onEdit={() => {
            setEditing(row.original);
            setIsFormOpen(true);
          }}
          onDelete={() => handleDelete(row.original)}
        />
      ),
    },
  ];

  return (
    <>
      <ListPageLayout
        title="Standards"
        description={`${filtered.length} standard${filtered.length !== 1 ? "s" : ""} found`}
        actions={
          <>
            <Button variant="outline" size="icon" onClick={load}>
              <RefreshCw className={loading ? "animate-spin" : ""} />
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setIsFormOpen(true);
              }}
            >
              <PlusCircle />
              <span>Add Standard</span>
            </Button>
          </>
        }
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by name, code, or group..."
      >
        <DataTable<PMStandard>
          columns={columns}
          data={paginated}
          loading={loading}
          getRowId={(r) => r.id}
          pagination={{
            currentPage,
            pageSize,
            total: filtered.length,
            onPageChange: setCurrentPage,
            onPageSizeChange: setPageSize,
            pageSizeOptions: [10, 25, 50, 100],
          }}
        />
      </ListPageLayout>

      <PmStandardModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        editing={editing}
        productGroups={productGroups}
        variants={variants}
        onSaved={() => {
          load();
          refreshRefs();
        }}
      />

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
        confirmLabel={confirmState.confirmLabel}
      />
    </>
  );
}