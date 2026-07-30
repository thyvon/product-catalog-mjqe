import { createContext, useContext, useCallback } from "react";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastContextType {
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
    warning: (msg: string) => void;
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
    (message: string, type: ToastType = "info") => {
      switch (type) {
        case "success": sonnerToast.success(message); break;
        case "error": sonnerToast.error(message); break;
        case "warning": sonnerToast.warning(message); break;
        default: sonnerToast(message);
      }
    },
    []
  );

  const value: ToastContextType = {
    toast: {
      success: (msg: string) => toast(msg, "success"),
      error: (msg: string) => toast(msg, "error"),
      info: (msg: string) => toast(msg, "info"),
      warning: (msg: string) => toast(msg, "warning"),
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
