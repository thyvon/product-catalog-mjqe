import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const SIZE_MAP: Record<string, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
  "3xl": "sm:max-w-3xl",
  "4xl": "sm:max-w-4xl",
  "5xl": "sm:max-w-5xl",
  // legacy full-class keys (max-w-*) resolved below
  "max-w-sm": "sm:max-w-sm",
  "max-w-md": "sm:max-w-md",
  "max-w-lg": "sm:max-w-lg",
  "max-w-xl": "sm:max-w-xl",
  "max-w-2xl": "sm:max-w-2xl",
  "max-w-3xl": "sm:max-w-3xl",
  "max-w-4xl": "sm:max-w-4xl",
  "max-w-5xl": "sm:max-w-5xl",
};

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  /** Canonical size: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" */
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
  /** @deprecated Pass a `size` prop instead. Still accepted for backward compat. */
  maxWidth?: string;
  maxHeight?: string;
  rounded?: string;
  backdropBlur?: string;
  className?: string;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
}

export default function BaseModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size,
  maxWidth,
  maxHeight,
  rounded,
  backdropBlur,
  className,
  showCloseButton = true,
  closeOnBackdrop = true,
}: BaseModalProps) {
  const widthClass = size
    ? SIZE_MAP[size]
    : maxWidth
      ? SIZE_MAP[maxWidth] ?? maxWidth
      : undefined;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      disablePointerDismissal={!closeOnBackdrop}
    >
      <DialogContent
        className={cn(widthClass, maxHeight, rounded, className)}
        showCloseButton={showCloseButton}
      >
        {title && (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}
