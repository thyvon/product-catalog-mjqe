import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import PmSimpleTab from "./PmSimpleTab";
import { pmProductGroups, pmDeleteProductGroup } from "@/features/product-management/api";
import type { PMCategory, PMProductGroup } from "@/features/shared/types";

interface Props {
  categories: PMCategory[];
  refreshRefs: () => void;
}

export default function PmProductGroupsTab({ categories, refreshRefs }: Props) {
  const columns: ColumnDef<PMProductGroup, any>[] = [
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => <span className="font-mono">{row.original.code}</span>,
    },
    { accessorKey: "name", header: "Name" },
    {
      id: "category",
      header: "Category",
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.category_name || "—"}</Badge>
      ),
    },
  ];

  return (
    <PmSimpleTab<PMProductGroup>
      entity="product-group"
      title="Product Groups"
      searchPlaceholder="Search by code, name, or category..."
      addLabel="Add Product Group"
      categories={categories}
      fetchList={pmProductGroups}
      remove={pmDeleteProductGroup}
      columns={columns}
      search={(row, q) =>
        row.name.toLowerCase().includes(q) ||
        row.code.toLowerCase().includes(q) ||
        (row.category_name || "").toLowerCase().includes(q)
      }
      onAfterSave={refreshRefs}
    />
  );
}