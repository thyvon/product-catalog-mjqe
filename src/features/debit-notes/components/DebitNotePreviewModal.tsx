import BaseModal from "@/features/shared/components/BaseModal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatAmount, formatDisplayDate } from "@/features/shared/utils/format";

interface DebitNotePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewNote: any;
}

export default function DebitNotePreviewModal({ isOpen, onClose, previewNote }: DebitNotePreviewModalProps) {
  const note = previewNote || {};
  const items = Array.isArray(note.items) ? note.items : [];
  const totalAmount = note.totalAmount ?? items.reduce((sum: number, item: any) => sum + (parseFloat(item.totalPrice) || 0), 0);
  const email = note.debitNoteEmail;

  const statusInfo: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "Pending", variant: "secondary" },
    sending: { label: "Sending", variant: "default" },
    sent: { label: "Sent", variant: "default" },
  };
  const status = statusInfo[String(note.status || "").toLowerCase()] || { label: String(note.status || "Unknown"), variant: "outline" as const };

  const headerLine = [note.division, note.department, note.campus].filter(Boolean).join(" - ");

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      size="5xl"
      title="Debit Note"
      description="ទម្រង់វិក័យប័ត្រឥណពន្ធ"
      maxHeight="max-h-[calc(100dvh-4rem)]"
      className="flex flex-col overflow-hidden"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Document header */}
        <div className="shrink-0 border-b border-border bg-card py-5 text-center">
          <h2 className="text-lg font-bold uppercase tracking-wide text-foreground">Debit Note</h2>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{note.referenceNumber || "—"}</p>
          {headerLine && <p className="mt-1 text-xs text-muted-foreground">{headerLine}</p>}
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {/* Summary grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <InfoStat label="Period" value={periodLabel(note)} />
            <InfoStat label="Status" value={status.label} variant={status.variant} />
            <InfoStat label="Items" value={String(items.length)} />
            <InfoStat label="Total Amount" value={formatAmount(totalAmount)} />
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <InfoStat label="Created By" value={note.createdBy || "—"} />
            <InfoStat label="Send Date" value={formatDisplayDate(note.sendDate) || "—"} />
            <InfoStat label="Division" value={note.division || "—"} />
            <InfoStat label="Department / Campus" value={[note.department, note.campus].filter(Boolean).join(" - ") || "—"} />
          </div>

          {email && (
            <>
              <Separator className="my-4" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Recipient</p>
                <p className="mt-1">{email.receiverName || "—"}</p>
                {Array.isArray(email.sendToEmail) && email.sendToEmail.length > 0 && (
                  <p className="font-mono">{email.sendToEmail.join(", ")}</p>
                )}
                {Array.isArray(email.ccToEmail) && email.ccToEmail.length > 0 && (
                  <p className="font-mono mt-0.5">CC: {email.ccToEmail.join(", ")}</p>
                )}
              </div>
            </>
          )}

          <Separator className="my-4" />

          {/* Items */}
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No items are available for this debit note yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1000px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>UoM</TableHead>
                    <TableHead className="text-right">U/Price</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>IO Number</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item: any, i: number) => (
                    <TableRow key={item.id || `${item.itemCode}-${i}`}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDisplayDate(item.transactionDate) || "—"}</TableCell>
                      <TableCell className="font-mono whitespace-nowrap text-foreground">{item.itemCode || "—"}</TableCell>
                      <TableCell className="min-w-[260px] max-w-[520px] whitespace-normal align-top [overflow-wrap:anywhere] text-muted-foreground">{item.description || "—"}</TableCell>
                      <TableCell className="font-mono whitespace-nowrap text-right text-foreground">{item.quantity || 0}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{item.uom || "—"}</TableCell>
                      <TableCell className="font-mono whitespace-nowrap text-right text-foreground">{formatAmount(item.unitPrice)}</TableCell>
                      <TableCell className="font-mono whitespace-nowrap text-right text-foreground">{formatAmount(item.totalPrice)}</TableCell>
                      <TableCell className="text-muted-foreground">{item.requesterName || "—"}</TableCell>
                      <TableCell className="font-mono text-muted-foreground whitespace-nowrap">{item.referenceNo || "—"}</TableCell>
                      <TableCell className="min-w-[200px] max-w-[420px] whitespace-normal align-top [overflow-wrap:anywhere] text-muted-foreground">{item.remarks || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 flex justify-end">
                <div className="flex w-full max-w-xs items-center justify-between rounded-xl bg-muted px-4 py-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total</span>
                  <span className="text-sm font-bold text-foreground">{formatAmount(totalAmount)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </BaseModal>
  );
}

const headerLine = undefined;

function InfoStat({ label, value, variant }: { label: string; value: string; variant?: "default" | "secondary" | "destructive" | "outline" }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {variant ? (
        <span className="mt-1 inline-block">
          <Badge variant={variant} className="text-xs">{value}</Badge>
        </span>
      ) : (
        <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
      )}
    </div>
  );
}

function periodLabel(note: any): string {
  const s = formatDisplayDate(note.startDate);
  const e = formatDisplayDate(note.endDate);
  if (!s && !e) return "—";
  return s && e ? `${s} – ${e}` : s || e;
}