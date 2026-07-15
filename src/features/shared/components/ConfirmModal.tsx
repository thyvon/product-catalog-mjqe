import { TriangleAlert as DangerTriangle } from "lucide-react";
import BaseModal from "@/features/shared/components/BaseModal";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <BaseModal isOpen={isOpen} onClose={onCancel} maxWidth="max-w-sm" zIndex="z-[60]" className="p-6">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-full shrink-0">
          <DangerTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-800 dark:text-gray-100 mb-1">{title}</h3>
          <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed">{message}</p>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800 text-slate-600 dark:text-gray-400 font-bold text-xs rounded-xl cursor-pointer transition-all"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl cursor-pointer transition-all"
        >
          {confirmLabel}
        </button>
      </div>
    </BaseModal>
  );
}
