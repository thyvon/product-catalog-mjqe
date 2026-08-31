import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import PmSimpleTab from "./PmSimpleTab";
import { pmCategories, pmDeleteCategory } from "@/features/product-management/api";
import type { PMCategory } from "@/features/shared/types";

interface Props {
  categories: PMCategory[];
  refreshRefs: () => void;
}

export default function PmCategoriesTab({ categories, refreshRefs }: Props) {
  const columns: ColumnDef<PMCategory, any>[] = [
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => <span className="font-mono">{row.original.code}</span>,
    },
    { accessorKey: "name", header: "Name" },
    {
      id: "parent",
      header: "Parent",
      cell: ({ row }) => {
        const parent = categories.find((c) => c.id === row.original.parent_id);
        return parent ? (
          <span className="text-muted-foreground">{parent.name}</span>
        ) : (
          <Badge variant="outline">Top Level</Badge>
        );
      },
    },
    {
      accessorKey: "sort_order",
      header: "Sort Order",
      cell: ({ row }) => <span className="font-mono">{row.original.sort_order}</span>,
    },
  ];

  return (
    <PmSimpleTab<PMCategory>
      entity="category"
      title="Categories"
      searchPlaceholder="Search by code, name, or parent..."
      addLabel="Add Category"
      categories={categories}
      fetchList={pmCategories}
      remove={pmDeleteCategory}
      columns={columns}
      search={(row, q) =>
        row.name.toLowerCase().includes(q) ||
        row.code.toLowerCase().includes(q) ||
        (categories.find((c) => c.id === row.parent_id)?.name.toLowerCase().includes(q) ?? false)
      }
      onAfterSave={refreshRefs}
    />
  );
}