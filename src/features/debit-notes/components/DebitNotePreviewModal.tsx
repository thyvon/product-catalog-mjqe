import { X } from "lucide-react";
import BaseModal from "@/features/shared/components/BaseModal";

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
    <BaseModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-4xl" maxHeight="max-h-[80vh]">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-gray-800">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-gray-100">{note.referenceNumber || "Debit Note Preview"}</h2>
            <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-0.5">
              {note.department || "—"} - {note.warehouse || "—"} | {note.campus || "—"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer transition-all">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            <div className="bg-slate-50 dark:bg-gray-800 rounded-xl p-3">
              <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase">Period</p>
              <p className="text-xs font-bold text-slate-700 dark:text-gray-300 mt-1">{note.startDate || "—"} - {note.endDate || "—"}</p>
            </div>
            <div className="bg-slate-50 dark:bg-gray-800 rounded-xl p-3">
              <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase">Status</p>
              <p className="text-xs font-bold text-slate-700 dark:text-gray-300 mt-1 capitalize">{note.status || "pending"}</p>
            </div>
            <div className="bg-slate-50 dark:bg-gray-800 rounded-xl p-3">
              <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase">Total Items</p>
              <p className="text-xs font-bold text-slate-700 dark:text-gray-300 mt-1">{items.length}</p>
            </div>
            <div className="bg-slate-50 dark:bg-gray-800 rounded-xl p-3">
              <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase">Total Amount</p>
              <p className="text-xs font-bold text-slate-700 dark:text-gray-300 mt-1">${totalAmount.toFixed(2)}</p>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-gray-700 p-8 text-center text-sm text-slate-500 dark:text-gray-400">
              No items are available for this debit note yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-gray-700">
                    <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">#</th>
                    <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Code</th>
                    <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Description</th>
                    <th className="text-right px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Qty</th>
                    <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">UoM</th>
                    <th className="text-right px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">U/Price</th>
                    <th className="text-right px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Total</th>
                    <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Date</th>
                    <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Requester</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any, i: number) => (
                    <tr key={item.id || `${item.itemCode}-${i}`} className="border-b border-slate-50 dark:border-gray-800/50">
                      <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                      <td className="px-3 py-2 font-mono text-slate-700 dark:text-gray-300">{item.itemCode || "—"}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-gray-400 max-w-[200px] truncate">{item.description || "—"}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-gray-300">{item.quantity || 0}</td>
                      <td className="px-3 py-2 text-slate-500">{item.uom || "—"}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-gray-300">${parseFloat(item.unitPrice || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-gray-300">${parseFloat(item.totalPrice || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-500">{item.transactionDate || "—"}</td>
                      <td className="px-3 py-2 text-slate-500">{item.requesterName || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </BaseModal>
  );
}
