import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { PlusCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import DataTable from "@/features/shared/components/DataTable";
import ListPageLayout from "@/features/shared/components/ListPageLayout";
import { useConfirmModal, useListPageState } from "@/features/shared/hooks";
import { useToast } from "@/features/shared/components/Toast";
import ConfirmModal from "@/features/shared/components/ConfirmModal";
import PmSimpleFormModal, { type SimpleEntity } from "./PmSimpleFormModal";
import { PmActions, PmStatusBadge } from "./PmShared";
import type { PMCategory } from "@/features/shared/types";

interface PmSimpleTabProps<T extends { id: string; name: string; status: string }> {
  entity: SimpleEntity;
  title: string;
  searchPlaceholder: string;
  addLabel: string;
  categories: PMCategory[];
  fetchList: () => Promise<T[]>;
  remove: (id: string) => Promise<unknown>;
  columns: ColumnDef<T, any>[];
  search: (row: T, query: string) => boolean;
  onAfterSave?: () => void;
}

export default function PmSimpleTab<T extends { id: string; name: string; status: string }>({
  entity,
  title,
  searchPlaceholder,
  addLabel,
  categories,
  fetchList,
  remove,
  columns,
  search,
  onAfterSave,
}: PmSimpleTabProps<T>) {
  const { toast } = useToast();
  const { confirmState, confirm, closeConfirm } = useConfirmModal();
  const { searchQuery, setSearchQuery, currentPage, setCurrentPage, pageSize, setPageSize } = useListPageState();

  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<T | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await fetchList());
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
    return rows.filter((r) => (!q || search(r, q)));
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

  const handleDelete = (row: T) => {
    confirm(
      `Delete ${title.slice(0, -1)}`,
      `Are you sure you want to delete "${row.name}"? This action cannot be undone.`,
      async () => {
        closeConfirm();
        try {
          await remove(row.id);
          await load();
          onAfterSave?.();
          toast.success(`"${row.name}" has been deleted.`);
        } catch (err: any) {
          toast.error(err.message);
        }
      }
    );
  };

  const allColumns: ColumnDef<T, any>[] = [
    ...columns,
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
        title={title}
        description={`${filtered.length} record${filtered.length !== 1 ? "s" : ""} found`}
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
              <span>{addLabel}</span>
            </Button>
          </>
        }
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={searchPlaceholder}
      >
        <DataTable<T>
          columns={allColumns}
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

      <PmSimpleFormModal
        entity={entity}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        editing={editing as any}
        categories={categories}
        onSaved={() => {
          load();
          onAfterSave?.();
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