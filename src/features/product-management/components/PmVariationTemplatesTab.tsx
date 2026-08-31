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
import PmVariationTemplateModal from "./PmVariationTemplateModal";
import { PmActions, PmStatusBadge } from "./PmShared";
import { pmVariationTemplates, pmDeleteVariationTemplate } from "@/features/product-management/api";
import type { PMVariationTemplate } from "@/features/shared/types";

interface Props {
  refreshRefs: () => void;
}

export default function PmVariationTemplatesTab({ refreshRefs }: Props) {
  const { toast } = useToast();
  const { confirmState, confirm, closeConfirm } = useConfirmModal();
  const { searchQuery, setSearchQuery, currentPage, setCurrentPage, pageSize, setPageSize } = useListPageState();

  const [rows, setRows] = useState<PMVariationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PMVariationTemplate | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await pmVariationTemplates());
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
      (t) =>
        !q ||
        t.name.toLowerCase().includes(q) ||
        (t.values ?? []).some((v) => v.name.toLowerCase().includes(q))
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

  const handleDelete = (row: PMVariationTemplate) => {
    confirm(
      "Delete Variation Template",
      `Are you sure you want to delete "${row.name}"? This action cannot be undone.`,
      async () => {
        closeConfirm();
        try {
          await pmDeleteVariationTemplate(row.id);
          await load();
          refreshRefs();
          toast.success(`Variation template "${row.name}" has been deleted.`);
        } catch (err: any) {
          toast.error(err.message);
        }
      }
    );
  };

  const columns: ColumnDef<PMVariationTemplate, any>[] = [
    { accessorKey: "name", header: "Name" },
    {
      id: "values",
      header: "Values",
      cell: ({ row }) => {
        const values = row.original.values ?? [];
        if (values.length === 0) return <Badge variant="outline">0</Badge>;
        return (
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="outline">{values.length}</Badge>
            <span className="text-muted-foreground">{values.map((v) => v.name).join(", ")}</span>
          </div>
        );
      },
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
        title="Variation Templates"
        description={`${filtered.length} variation template${filtered.length !== 1 ? "s" : ""} found`}
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
              <span>Add Template</span>
            </Button>
          </>
        }
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by name or value..."
      >
        <DataTable<PMVariationTemplate>
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

      <PmVariationTemplateModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        editing={editing}
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
