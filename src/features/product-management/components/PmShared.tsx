import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SquarePen, Trash2 } from "lucide-react";

export function PmStatusBadge({ status }: { status: string }) {
  return status === "Active" ? (
    <Badge variant="default">Active</Badge>
  ) : (
    <Badge variant="secondary">Inactive</Badge>
  );
}

export function PmActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="size-8" onClick={onEdit} aria-label="Edit">
        <SquarePen className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={onDelete} aria-label="Delete">
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

export function PmModalFooter({
  onCancel,
  onSave,
  saving,
  saveLabel = "Save",
}: {
  onCancel: () => void;
  onSave: () => void;
  saving?: boolean;
  saveLabel?: string;
}) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="button" onClick={onSave} disabled={saving}>
        {saving ? "Saving..." : saveLabel}
      </Button>
    </div>
  );
}