import { motion, AnimatePresence } from "motion/react";
import { CloseCircle, DangerCircle } from "solar-icons";

interface AlertModalProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
}

export default function AlertModal({ isOpen, message, onClose }: AlertModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-100 dark:border-gray-800 z-10 p-6"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-100 dark:bg-rose-900/50 rounded-full shrink-0">
                <DangerCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-800 dark:text-gray-100 mb-1">Notice</h3>
                <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed">{message}</p>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 rounded-full cursor-pointer transition-colors shrink-0"
              >
                <CloseCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-900 dark:bg-indigo-700 hover:bg-slate-800 dark:hover:bg-indigo-800 text-white font-bold text-xs rounded-xl cursor-pointer transition-all"
              >
                OK
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
