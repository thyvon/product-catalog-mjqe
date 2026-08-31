import type { ColumnDef } from "@tanstack/react-table";
import PmSimpleTab from "./PmSimpleTab";
import { pmBrands, pmDeleteBrand } from "@/features/product-management/api";
import type { PMBrand } from "@/features/shared/types";

interface Props {
  refreshRefs: () => void;
}

export default function PmBrandsTab({ refreshRefs }: Props) {
  const columns: ColumnDef<PMBrand, any>[] = [
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => <span className="font-mono">{row.original.code}</span>,
    },
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) =>
        row.original.description ? (
          <span className="max-w-[300px] truncate block text-muted-foreground">{row.original.description}</span>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <PmSimpleTab<PMBrand>
      entity="brand"
      title="Brands"
      searchPlaceholder="Search by name or code..."
      addLabel="Add Brand"
      categories={[]}
      fetchList={pmBrands}
      remove={pmDeleteBrand}
      columns={columns}
      search={(row, q) =>
        row.name.toLowerCase().includes(q) ||
        row.code.toLowerCase().includes(q) ||
        (row.description || "").toLowerCase().includes(q)
      }
      onAfterSave={refreshRefs}
    />
  );
}