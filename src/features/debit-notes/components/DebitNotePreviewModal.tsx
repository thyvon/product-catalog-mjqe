import BaseModal from "@/features/shared/components/BaseModal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmount } from "@/features/shared/utils/format";

interface DebitNotePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewNote: any;
}

export default function DebitNotePreviewModal({ isOpen, onClose, previewNote }: DebitNotePreviewModalProps) {
  const note = previewNote || {};
  const items = Array.isArray(note.items) ? note.items : [];
  const totalAmount = items.reduce((sum: number, item: any) => sum + parseFloat(item.totalPrice || 0), 0);

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} size="4xl" maxHeight="max-h-[calc(100dvh-4rem)]">
      <div className="flex flex-col max-h-[calc(100dvh-4rem)]">
        <div className="p-5 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-foreground">{note.referenceNumber || "Debit Note Preview"}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {note.department || "—"} - {note.warehouse || "—"} | {note.campus || "—"}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase">Period</p>
              <p className="text-xs font-medium text-foreground mt-1">{note.startDate ? new Date(note.startDate).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "—"} - {note.endDate ? new Date(note.endDate).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "—"}</p>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase">Status</p>
              <p className="text-xs font-medium text-foreground mt-1 capitalize">{note.status || "pending"}</p>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase">Total Items</p>
              <p className="text-xs font-medium text-foreground mt-1">{items.length}</p>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase">Total Amount</p>
              <p className="text-xs font-medium text-foreground mt-1">{formatAmount(totalAmount)}</p>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No items are available for this debit note yet.
            </div>
          ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">#</TableHead>
                      <TableHead className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Code</TableHead>
                      <TableHead className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Description</TableHead>
                      <TableHead className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Qty</TableHead>
                      <TableHead className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">UoM</TableHead>
                      <TableHead className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase">U/Price</TableHead>
                      <TableHead className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Total</TableHead>
                      <TableHead className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Date</TableHead>
                      <TableHead className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Requester</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item: any, i: number) => (
                      <TableRow key={item.id || `${item.itemCode}-${i}`}>
                        <TableCell className="px-3 py-2 text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="px-3 py-2 font-mono text-foreground whitespace-nowrap">{item.itemCode || "—"}</TableCell>
                        <TableCell className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{item.description || "—"}</TableCell>
                        <TableCell className="px-3 py-2 text-right font-mono text-foreground whitespace-nowrap">{item.quantity || 0}</TableCell>
                        <TableCell className="px-3 py-2 text-muted-foreground whitespace-nowrap">{item.uom || "—"}</TableCell>
                        <TableCell className="px-3 py-2 text-right font-mono text-foreground whitespace-nowrap">{formatAmount(item.unitPrice)}</TableCell>
                        <TableCell className="px-3 py-2 text-right font-mono text-foreground whitespace-nowrap">{formatAmount(item.totalPrice)}</TableCell>
                        <TableCell className="px-3 py-2 text-muted-foreground whitespace-nowrap">{item.transactionDate ? new Date(item.transactionDate).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "—"}</TableCell>
                        <TableCell className="px-3 py-2 text-muted-foreground">{item.requesterName || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
          )}
        </div>
      </div>
    </BaseModal>
  );
}
