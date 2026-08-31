import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import PmSimpleTab from "./PmSimpleTab";
import { pmUoms, pmDeleteUom } from "@/features/product-management/api";
import type { PMUom } from "@/features/shared/types";

interface Props {
  refreshRefs: () => void;
}

export default function PmUomsTab({ refreshRefs }: Props) {
  const columns: ColumnDef<PMUom, any>[] = [
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => <span className="font-mono">{row.original.code}</span>,
    },
    { accessorKey: "name", header: "Name" },
    {
      id: "type",
      header: "Type",
      cell: ({ row }) => <Badge variant="outline">{row.original.type}</Badge>,
    },
    {
      accessorKey: "decimal_places",
      header: "Decimals",
      cell: ({ row }) => <span className="font-mono">{row.original.decimal_places}</span>,
    },
    {
      id: "sub_units",
      header: "Sub-Units",
      cell: ({ row }) => {
        const subs = row.original.sub_units ?? [];
        return (
          <div className="flex flex-wrap gap-1">
            {subs.length === 0 ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              subs.map((s) => (
                <Badge key={s.id} variant="outline" className="font-mono">
                  {s.short_name || s.name}
                  <span className="ml-1 text-muted-foreground">×{s.conversion_factor}</span>
                </Badge>
              ))
            )}
          </div>
        );
      },
    },
  ];

  return (
    <PmSimpleTab<PMUom>
      entity="uom"
      title="Units of Measure"
      searchPlaceholder="Search by name, code, or type..."
      addLabel="Add UoM"
      categories={[]}
      fetchList={pmUoms}
      remove={pmDeleteUom}
      columns={columns}
      search={(row, q) =>
        row.name.toLowerCase().includes(q) ||
        row.code.toLowerCase().includes(q) ||
        (row.type || "").toLowerCase().includes(q)
      }
      onAfterSave={refreshRefs}
    />
  );
}