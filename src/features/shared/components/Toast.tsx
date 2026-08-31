import { createContext, useContext, useCallback } from "react";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastContextType {
  toast: {
    success: (msg: string, title?: string) => void;
    error: (msg: string, title?: string) => void;
    info: (msg: string, title?: string) => void;
    warning: (msg: string, title?: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const toast = useCallback(
    (message: string, type: ToastType = "info", title?: string) => {
      const options = title ? { description: title } : undefined;
      switch (type) {
        case "success": sonnerToast.success(message, options); break;
        case "error": sonnerToast.error(message, options); break;
        case "warning": sonnerToast.warning(message, options); break;
        default: sonnerToast(message, options);
      }
    },
    []
  );

  const value: ToastContextType = {
    toast: {
      success: (msg: string, title?: string) => toast(msg, "success", title),
      error: (msg: string, title?: string) => toast(msg, "error", title),
      info: (msg: string, title?: string) => toast(msg, "info", title),
      warning: (msg: string, title?: string) => toast(msg, "warning", title),
    },
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <SonnerToaster
        position="top-right"
        closeButton
        richColors={false}
        theme="system"
      />
    </ToastContext.Provider>
  );
}

export default SonnerToaster;
