import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, CheckCircle, AlertCircle, Info, TriangleAlert } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  title?: string;
}

interface ToastContextType {
  toast: {
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | null>(null);

const icons: Record<ToastType, React.FC<{ className?: string }>> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: TriangleAlert,
};

const styles: Record<ToastType, string> = {
  success: "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950",
  error: "border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950",
  info: "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950",
  warning: "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950",
};

const iconStyles: Record<ToastType, string> = {
  success: "text-emerald-500",
  error: "text-rose-500",
  info: "text-blue-500",
  warning: "text-amber-500",
};

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType, title?: string) => {
    const id = String(++toastId);
    setToasts((prev) => [...prev, { id, message, type, title }]);
    setTimeout(() => removeToast(id), 4000);
  }, [removeToast]);

  const toast = {
    success: (message: string, title?: string) => addToast(message, "success", title),
    error: (message: string, title?: string) => addToast(message, "error", title),
    info: (message: string, title?: string) => addToast(message, "info", title),
    warning: (message: string, title?: string) => addToast(message, "warning", title),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = icons[t.type];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 80, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 80, scale: 0.95 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-lg ${styles[t.type]}`}
              >
                <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconStyles[t.type]}`} />
                <div className="flex-1 min-w-0">
                  {t.title && (
                    <p className="text-xs font-bold text-slate-800 dark:text-gray-100 mb-0.5">{t.title}</p>
                  )}
                  <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed">{t.message}</p>
                </div>
                <button
                  onClick={() => removeToast(t.id)}
                  className="shrink-0 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
