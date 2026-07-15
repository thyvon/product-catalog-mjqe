import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import type { ReactNode } from "react";

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
  maxHeight?: string;
  zIndex?: string;
  rounded?: string;
  backdropBlur?: string;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  className?: string;
}

export default function BaseModal({
  isOpen,
  onClose,
  children,
  maxWidth = "max-w-lg",
  maxHeight = "",
  zIndex = "z-50",
  rounded = "rounded-2xl",
  backdropBlur = "backdrop-blur-sm",
  showCloseButton = false,
  closeOnBackdrop = true,
  className = "",
}: BaseModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className={`fixed inset-0 ${zIndex} flex items-center justify-center p-4 overflow-y-auto`}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeOnBackdrop ? onClose : undefined}
            className={`fixed inset-0 bg-slate-900/60 ${backdropBlur}`}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className={`relative bg-white dark:bg-gray-900 w-full ${maxWidth} ${rounded} shadow-2xl border border-slate-100 dark:border-gray-800 ${maxHeight} overflow-hidden ${className}`}
          >
            {showCloseButton && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-200 rounded-full transition-colors cursor-pointer z-10"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
